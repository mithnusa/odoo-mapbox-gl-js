from datetime import timedelta
import time

from odoo import api, fields, models, SUPERUSER_ID
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_round
from .utils import (
    ROUTE_STATES,
    ROUTE_STATE_DRAFT,
    ROUTE_STATE_DONE,
    ROUTE_STATE_IN_PROGRESS,
    ROUTE_STATE_CONFIRMED,
    ROUTE_STATE_CANCELLED,
    ROUTE_STOP_STATE_CANCELLED_OR_SKIPPED,
    ROUTE_STOP_STATE_NONE,
    ROUTE_STOP_STATE_ARRIVED,
)


class RoutePlanner(models.Model):
    _name = 'route.planner'
    _description = 'Route Planner'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'id desc'

    def _default_route_type(self):
        """Return the default route type if the XML reference exists, else False."""
        route_type_id = self.env.ref(
            'route_planner.route_type_route',
            raise_if_not_found=False,
        )
        return route_type_id.id if route_type_id else False

    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
        required=True,
        index=True,
    )
    user_id = fields.Many2one(
        'res.users',
        string='Responsible',
        default=lambda self: self.env.user,
        tracking=True,
    )
    name = fields.Char(
        string='Name',
        required=True,
        copy=False,
        tracking=True,
        default=lambda self: self.env._('New'),
    )
    active = fields.Boolean(
        string='Active',
        default=True,
    )
    departure_date = fields.Datetime(
        string='Departure Date',
        tracking=True,
        help='Planned departure date and time. Required for certain route types before confirmation.',
    )
    state = fields.Selection(
        selection=ROUTE_STATES,
        string='Status',
        default=ROUTE_STATE_DRAFT,
        tracking=True,
        copy=False,
    )
    description = fields.Text(string='Description')

    # Origin: which record (if any) generated this route. Generic by
    # design (res_model/res_id, the same shape ir.attachment already uses
    # in Odoo core) rather than a dedicated Many2one per integration, so
    # a new integration never needs its own bespoke "what created this
    # route" field. Deliberately not unique: one origin record can
    # generate many routes over time (e.g. one per day), unlike a 1:1
    # relationship.
    origin_res_model = fields.Char(readonly=True, copy=False, index=True)
    origin_res_id = fields.Integer(readonly=True, copy=False, index=True)
    origin_display_name = fields.Char(
        string='Source',
        compute='_compute_origin_display_name',
        store=True,
        help='The record that generated this route, if any.',
    )

    # Departure information
    departure_id = fields.Many2one(
        'res.partner',
        string='Departure at',
        domain="[('partner_latitude', '!=', 0.0), ('partner_longitude', '!=', 0.0)]",
        help='Starting point for the route. Must have valid coordinates.',
        tracking=True,
    )
    departure_address = fields.Char(
        string='Departure Address',
        compute='_compute_departure_geolocation',
        store=True,
        readonly=True,
    )
    departure_latitude = fields.Float(
        string='Departure Latitude',
        compute='_compute_departure_geolocation',
        store=True,
        readonly=True,
        digits=(10, 7),
    )
    departure_longitude = fields.Float(
        string='Departure Longitude',
        compute='_compute_departure_geolocation',
        store=True,
        readonly=True,
        digits=(10, 7),
    )
    is_departure_geolocation_valid = fields.Boolean(
        string='Is Departure Geolocation Valid',
        compute='_compute_departure_geolocation_validity',
        readonly=True,
        store=True,
    )
    is_stops_geolocation_valid = fields.Boolean(
        string='Are Stops Geolocations Valid',
        compute='_compute_stops_geolocation_validity',
        readonly=True,
        store=True,
    )
    route_type_id = fields.Many2one(
        'route.type',
        string='Type',
        required=True,
        default=lambda self: self._default_route_type(),
        tracking=True,
        help='Route type controls which fields are required before confirming the route. For example, some route types may require a vehicle and driver to be assigned, while others may not.',
    )

    # Arrival information
    arrival_id = fields.Many2one(
        'res.partner',
        string='Arrival (Last Stop) at',
        compute='_compute_arrival_id',
    )

    # Driver and Vehicle information
    vehicle_id = fields.Many2one(
        'fleet.vehicle',
        string='Vehicle',
        tracking=True,
    )
    driver_id = fields.Many2one(
        'res.users',
        string='Driver',
        tracking=True,
    )

    # Distance and duration
    total_distance = fields.Float(
        string='Approx. Distance (km)',
        compute='_compute_total_distance_duration',
        help='Estimated total distance calculated from the sum of distances between stops.',
    )
    estimated_duration = fields.Float(
        string='Est. Duration (hours)',
        compute='_compute_total_distance_duration',
        help='Estimated total travel time calculated from the sum of durations between stops. Does not include service duration at stops.',
    )

    arrival_date = fields.Datetime(
        string='Est. Arrival Date',
        compute='_compute_arrival_date',
        store=True,
        help='Estimated arrival date and time calculated from departure date, total travel duration, and total service duration at stops.',
    )
    total_service_duration = fields.Float(
        string='Total Service Duration',
        compute='_compute_total_service_duration',
        help='Sum of service duration across all stops. Excludes travel time.',
    )

    # Route details
    route_line_ids = fields.One2many(
        'route.planner.line',
        'route_planner_id',
        string='Stops',
        copy=True,
    )

    total_stops = fields.Integer(
        string='Number of Stops',
        compute='_compute_total_stops',
        help='Total number of stops in the route, excluding the departure point.',
    )

    _name_company_unique = models.Constraint(
        'UNIQUE(name, company_id)',
        'Route name must be unique within the same company',
    )

    @api.model_create_multi
    def create(self, vals_list):
        """Assign a datetime-based draft placeholder to any record whose name is still the default.
        Microsecond precision avoids unique-constraint collisions in bulk creates or concurrent sessions.
        """
        for vals in vals_list:
            if not vals.get('name') or vals.get('name') == self.env._('New'):
                vals['name'] = fields.Datetime.now().strftime(
                    'DRAFT-%d.%m.%Y %H:%M:%S.%f'
                )[:-3]
        return super().create(vals_list)

    @api.constrains('departure_id', 'route_line_ids')
    def _check_departure_and_drop_off_points(self):
        """Prevent assigning the departure location as one of the stops."""
        for route in self:
            if not route.departure_id or not route.route_line_ids:
                continue

            stops = route.route_line_ids.mapped('stop_id')
            if route.departure_id in stops:
                raise ValidationError(
                    self.env._(
                        'Departure location cannot be used as a drop-off point'
                    )
                )

    @api.depends('route_line_ids')
    def _compute_arrival_id(self):
        """Set arrival to the partner of the last stop in the route."""
        for record in self:
            if record.route_line_ids:
                record.arrival_id = record.route_line_ids[-1].stop_id
            else:
                record.arrival_id = False

    @api.depends(
        'route_line_ids.distance_from_previous',
        'route_line_ids.duration_from_previous',
    )
    def _compute_total_distance_duration(self):
        """Sum distances and durations across all stop segments.
        Duration is rounded to 2 decimal places to avoid float_time widget conversion errors.
        """
        for record in self:
            total_distance = sum(
                line.distance_from_previous for line in record.route_line_ids
            )
            total_duration_hours = sum(
                line.duration_from_previous for line in record.route_line_ids
            )
            record.total_distance = total_distance
            # Round to 2 decimal places to prevent float_to_time() errors
            # when widget='float_time' converts the value
            record.estimated_duration = float_round(
                total_duration_hours, precision_digits=2
            )

    @api.depends('route_line_ids.service_duration')
    def _compute_total_service_duration(self):
        """Sum service durations across all stops, rounded to 2 decimal places."""
        for record in self:
            record.total_service_duration = float_round(
                sum(line.service_duration for line in record.route_line_ids),
                precision_digits=2,
            )

    @api.depends(
        'departure_date', 'estimated_duration', 'total_service_duration'
    )
    def _compute_arrival_date(self):
        """Compute estimated arrival by adding total travel and service duration to the departure date."""
        for record in self:
            total = record.estimated_duration + record.total_service_duration
            if record.departure_date and total:
                record.arrival_date = record.departure_date + timedelta(
                    hours=total
                )
            else:
                record.arrival_date = False

    @api.depends('route_line_ids')
    def _compute_total_stops(self):
        """Count the number of stop lines in the route."""
        for record in self:
            record.total_stops = len(record.route_line_ids)

    def _get_origin_record(self):
        """Resolve the record that generated this route, if any."""
        self.ensure_one()
        if not (self.origin_res_model and self.origin_res_id):
            return None
        return (
            self.env[self.origin_res_model].browse(self.origin_res_id).exists()
        )

    @api.depends('origin_res_model', 'origin_res_id')
    def _compute_origin_display_name(self):
        for record in self:
            origin = record._get_origin_record()
            record.origin_display_name = (
                origin.display_name if origin else False
            )

    @api.depends('departure_id')
    def _compute_departure_geolocation(self):
        """Compute departure address, latitude, and longitude from the selected departure partner.
        All three fields are intentionally snapshotted at planning time: sub-fields such as
        departure_id.partner_latitude, departure_id.partner_longitude, and the partner's address
        fields are NOT listed as dependencies so that later changes to the partner record do not
        silently overwrite the coordinates or address that were valid when the route was planned.
        The fields only recompute when the departure partner itself is replaced (departure_id changes).
        """
        for record in self:
            if record.departure_id:
                record.departure_latitude = (
                    record.departure_id.partner_latitude
                )
                record.departure_longitude = (
                    record.departure_id.partner_longitude
                )
                record.departure_address = record.departure_id.contact_address
            else:
                record.departure_latitude = 0.0
                record.departure_longitude = 0.0
                record.departure_address = ''

    @api.depends('departure_id', 'departure_latitude', 'departure_longitude')
    def _compute_departure_geolocation_validity(self):
        """Check whether the departure snapshot coordinates are populated.
        Depends on snapshot fields, not live partner coordinates, so the validity
        reflects what was captured at planning time."""
        for record in self:
            record.is_departure_geolocation_valid = bool(
                record.departure_id
            ) and not (
                record.departure_latitude == 0.0
                and record.departure_longitude == 0.0
            )

    @api.depends(
        'route_line_ids.stop_latitude',
        'route_line_ids.stop_longitude',
        'route_line_ids.stop_id',
    )
    def _compute_stops_geolocation_validity(self):
        """Check whether all stop snapshots have valid coordinates.
        The len(lines) > 0 guard prevents a route with no stops from evaluating as valid.
        """
        for record in self:
            lines = record.route_line_ids
            if len(lines) == 0:
                record.is_stops_geolocation_valid = True
            else:
                record.is_stops_geolocation_valid = all(
                    bool(line.stop_id)
                    and not (
                        line.stop_latitude == 0.0
                        and line.stop_longitude == 0.0
                    )
                    for line in lines
                )

    @api.onchange('route_line_ids')
    def _onchange_route_line_ids(self):
        """Warn early if stops are added before a departure location is set."""
        if not self.departure_id and self.route_line_ids:
            raise UserError(
                self.env._(
                    'Please set the Departure location before adding stops.'
                )
            )

    @api.onchange('vehicle_id')
    def _onchange_vehicle_id(self):
        """Auto-fill the driver field from the vehicle's assigned driver employee."""
        if (
            self.vehicle_id
            and self.vehicle_id.driver_employee_id
            and self.vehicle_id.driver_employee_id.user_id
        ):
            self.driver_id = self.vehicle_id.driver_employee_id.user_id

    def _validate_departure_and_stops_coordinates(self):
        """Raise if departure or any stop lacks valid snapshot coordinates.
        Deliberately checks snapshot fields (departure_latitude, stop_latitude) rather than
        live partner coordinates to validate what was captured at planning time.
        """
        self.ensure_one()
        if not self.departure_id or (
            self.departure_latitude == 0.0 and self.departure_longitude == 0.0
        ):
            raise UserError(
                self.env._(
                    'Departure location must be set with valid coordinates.'
                )
            )

        for line in self.route_line_ids:
            if not line.stop_id or (
                line.stop_latitude == 0.0 and line.stop_longitude == 0.0
            ):
                raise UserError(
                    self.env._(
                        'All stops must have valid coordinates. Please check stop: %s',
                        (
                            line.stop_id.name
                            if line.stop_id
                            else self.env._('(undefined)')
                        ),
                    )
                )

    def _validate_route_type_fields(self):
        """Validate mandatory fields based on the selected route type."""
        self.ensure_one()
        if not self.route_type_id:
            raise UserError(
                self.env._(
                    'Route type must be selected. Please select a route type.'
                )
            )

        if self.route_type_id.vehicle_required and not self.vehicle_id:
            raise UserError(
                self.env._(
                    "Vehicle is required for route type '%s'. Please assign vehicle.",
                    self.route_type_id.name,
                )
            )
        if self.route_type_id.driver_required and not self.driver_id:
            raise UserError(
                self.env._(
                    "Driver is required for route type '%s'. Please assign driver.",
                    self.route_type_id.name,
                )
            )
        if (
            self.route_type_id.departure_date_required
            and not self.departure_date
        ):
            raise UserError(
                self.env._(
                    "Departure date is required for route type '%s'. Please set departure date.",
                    self.route_type_id.name,
                )
            )

    def _validate_responsible_user(self):
        """Raise if no responsible user is assigned to the route."""
        self.ensure_one()
        if not self.user_id:
            raise UserError(
                self.env._(
                    'No responsible user assigned to the route. Please assign one.'
                )
            )

    def _validate_before_confirm(self):
        """Perform any additional validations before confirming the route."""
        self.ensure_one()
        if len(self.route_line_ids) == 0:
            raise UserError(
                self.env._(
                    'Route must have at least one stop before confirmation.'
                )
            )

    def action_confirm(self):
        """Confirm the route after running route-type, stop-count, and coordinate validations.
        Assigns the final name from the route type's sequence at this point, so the correct
        sequence is used regardless of any route type changes made while the route was in draft.
        """
        for record in self:
            if record.state != ROUTE_STATE_DRAFT:
                raise UserError(
                    self.env._('Only routes in draft state can be confirmed.')
                )

            record._validate_route_type_fields()
            record._validate_before_confirm()
            record._validate_departure_and_stops_coordinates()

            if record.name.startswith('DRAFT-'):
                if record.route_type_id.ir_sequence_id:
                    record.name = (
                        record.route_type_id.ir_sequence_id.next_by_id()
                    )
                else:
                    name = self.env['ir.sequence'].next_by_code(
                        'route.planner'
                    )
                    if not name:
                        raise UserError(
                            self.env._(
                                'No sequence is configured for route names. '
                                "Please assign a sequence to the route type '%s', "
                                "or ask your administrator to restore the 'route.planner' sequence.",
                                record.route_type_id.name,
                            )
                        )
                    record.name = name

        self.write({'state': ROUTE_STATE_CONFIRMED})

        for record in self:
            origin = record._get_origin_record()
            # message_post is a mail.thread method, not guaranteed on
            # every possible origin model — guard rather than assume.
            if origin is not None and hasattr(origin, 'message_post'):
                origin.message_post(
                    body=self.env._(
                        'Route %(route)s confirmed.', route=record.name
                    )
                )

    def action_cancel(self):
        """Cancel the route and mark all stop lines as cancelled or skipped."""
        self.write({'state': ROUTE_STATE_CANCELLED})
        self.route_line_ids.write(
            {'state': ROUTE_STOP_STATE_CANCELLED_OR_SKIPPED}
        )

    def action_done(self):
        """Mark the route as done. Raises if any stop is still in none or arrived state."""
        for record in self:
            if record.state != ROUTE_STATE_IN_PROGRESS:
                raise UserError(
                    self.env._(
                        'Only routes in progress can be marked as done.'
                    )
                )

            incomplete_stop_ids = record.route_line_ids.filtered(
                lambda line: (
                    line.state
                    in (ROUTE_STOP_STATE_NONE, ROUTE_STOP_STATE_ARRIVED)
                )
            )
            if incomplete_stop_ids:
                # Use with_user(SUPERUSER_ID) to ensure we can access the stop_id.name even if the current user doesn't have read access to the stop.partner record
                incomplete_stops = '- %s' % '\n- '.join(
                    incomplete_stop_ids.with_user(SUPERUSER_ID).mapped(
                        'stop_id.name'
                    )
                )
                raise UserError(
                    self.env._(
                        'Cannot mark route as done. The following stop(s) have not been completed:\n%s',
                        incomplete_stops,
                    )
                )

        self.write({'state': ROUTE_STATE_DONE})

    def action_in_progress(self):
        """Move a confirmed route to in-progress (start the route)."""
        for record in self:
            if record.state != ROUTE_STATE_CONFIRMED:
                raise UserError(
                    self.env._(
                        'Only confirmed routes can be set to in progress.'
                    )
                )

        self.write({'state': ROUTE_STATE_IN_PROGRESS})

    def action_draft(self):
        """Reset a cancelled route to draft and restore all stop lines to their initial state."""
        for record in self:
            if record.state != ROUTE_STATE_CANCELLED:
                raise UserError(
                    self.env._('Only cancelled routes can be reset to draft.')
                )

        self.write({'state': ROUTE_STATE_DRAFT})
        self.route_line_ids.write({'state': ROUTE_STOP_STATE_NONE})

    def action_get_departure_geolocation(self):
        """Attempt to geocode the departure partner and propagate the result to this route.
        Skips geocoding if the partner already has valid coordinates. The res.partner write()
        hook handles propagating updated coordinates to the route snapshot fields.
        """
        self.ensure_one()
        if not self.departure_id:
            raise UserError(
                self.env._(
                    'No departure location set. Please set a departure location first.'
                )
            )

        if not (
            self.departure_id.partner_latitude == 0.0
            and self.departure_id.partner_longitude == 0.0
        ):
            # If the departure partner already has valid coordinates, write them to the route's snapshot fields without calling geo_localize again
            self.write(
                {
                    'departure_latitude': self.departure_id.partner_latitude,
                    'departure_longitude': self.departure_id.partner_longitude,
                    'departure_address': self.departure_id.contact_address,
                }
            )
        else:
            self.env.user._bus_send(
                'simple_notification',
                {
                    'type': 'info',
                    'title': self.env._('Geolocation Departure'),
                    'message': self.env._(
                        'Attempting to fetch geolocation data for the departure location. Please wait...'
                    ),
                },
            )
            self.departure_id.with_context(
                update_route_departure=True
            ).geo_localize()
            # After attempting the geolocatization, the departure geolocation will updated by the custom logic in the res.partner write() method
            # in route_planner/models/res_partner.py which listens to changes on partner_latitude and partner_longitude fields
            # and updates related route planner records accordingly.

        if self.departure_latitude == 0.0 and self.departure_longitude == 0.0:
            raise UserError(
                self.env._(
                    'Unable to automatically fix geolocation data for the departure location.\nPlease edit the departure partner record and set valid latitude and longitude values.'
                )
            )

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': self.env._('Geolocation Data Updated'),
                'message': self.env._(
                    "The departure location's geolocation data has been updated.\nPlease review the route planner to ensure all data is correct before confirming the route."
                ),
                'type': 'success',
                'next': {
                    'type': 'ir.actions.client',
                    'tag': 'soft_reload',
                },
            },
        }

    def action_get_stops_geolocation(self):
        """Attempt to geocode each stop partner that is missing coordinates.
        The res.partner write() hook propagates updated coordinates to the route line snapshots.
        OpenStreetMap calls are throttled to 1 request/second to respect API rate limits.
        """
        self.ensure_one()
        invalid_lines = self.route_line_ids.filtered(
            lambda line: (
                line.stop_id
                and line.stop_latitude == 0.0
                and line.stop_longitude == 0.0
            )
        )
        if len(invalid_lines) == 0:
            raise UserError(
                self.env._('All stops have valid geolocation data.')
            )

        geo_provider_id = self.env['base.geocoder']._get_provider()
        openstreetmap_provider_id = self.env.ref(
            'base_geolocalize.geoprovider_open_street',
            raise_if_not_found=False,
        )
        is_openstreetmap_provider = (
            openstreetmap_provider_id
            and geo_provider_id
            and geo_provider_id.tech_name
            == openstreetmap_provider_id.tech_name
        )

        length_invalid_lines = len(invalid_lines)
        if length_invalid_lines > 25:
            raise UserError(
                self.env._(
                    'There are %d stops with invalid geolocation data. Due to limitations of '
                    'the OpenStreetMap geolocation provider, only up to 25 stops can be automatically '
                    'processed at a time.\nPlease fix the geolocation data for some stops and try again.',
                    len(invalid_lines),
                )
            )

        for index, line in enumerate(invalid_lines):
            if (
                line.stop_id
                and line.stop_latitude == 0.0
                and line.stop_longitude == 0.0
            ):
                if not (
                    line.stop_id.partner_latitude == 0.0
                    and line.stop_id.partner_longitude == 0.0
                ):
                    # If the stop's partner has valid coordinates, write them to the line's snapshot fields without calling geo_localize again
                    line.write(
                        {
                            'stop_latitude': line.stop_id.partner_latitude,
                            'stop_longitude': line.stop_id.partner_longitude,
                            'stop_address': line.stop_id.contact_address,
                        }
                    )
                else:
                    self.env.user._bus_send(
                        'simple_notification',
                        {
                            'type': 'info',
                            'title': self.env._(
                                'Geolocation Stop: %s', line.stop_id.name
                            ),
                            'message': self.env._(
                                "Attempting to fetch geolocation data for stop '%s'. Please wait...",
                                line.stop_id.name,
                            ),
                        },
                    )
                    stop = line.stop_id.with_context(update_route_stop=True)
                    stop.geo_localize()
                    if is_openstreetmap_provider and (
                        index < length_invalid_lines - 1
                    ):
                        time.sleep(
                            1
                        )  # Sleep for 1 second between geolocalization calls to avoid hitting API rate limits
                    # After attempting the geolocatization, same as departure geolocation, the stop geolocation will updated by the custom logic in the res.partner write() method
                    # in route_planner/models/res_partner.py which listens to changes on partner_latitude and partner_longitude fields and updates related route planner line records accordingly.

        still_invalid_lines = invalid_lines.filtered(
            lambda line: (
                line.stop_id
                and line.stop_latitude == 0.0
                and line.stop_longitude == 0.0
            )
        )
        if still_invalid_lines:
            stop_names = ', '.join(
                (
                    line.stop_id.name
                    if line.stop_id
                    else self.env._('(undefined)')
                )
                for line in still_invalid_lines
            )
            raise UserError(
                self.env._(
                    'Unable to automatically fix geolocation data for the following stops:\n%s\nPlease edit these stop partner records and set valid latitude and longitude values.',
                    stop_names,
                )
            )

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': self.env._('Geolocation Data Updated'),
                'message': self.env._(
                    "All stops' geolocation data has been updated.\nPlease review the route planner to ensure all data is correct before confirming the route."
                ),
                'type': 'success',
                'next': {
                    'type': 'ir.actions.client',
                    'tag': 'soft_reload',
                },
            },
        }

    @api.model
    def _create_from_stops(
        self, stop_specs, origin=None, route_type=None, **route_vals
    ):
        """Create a route and its stops from a flat list of stop specs, for
        reuse by any integration instead of re-deriving the
        validate/group/create flow per module.

        :param origin: singleton recordset identifying what generated this
            route (e.g. an fsm.person, a stock.picking.batch), or omitted
            when there is none worth tracking — e.g. a transient wizard
            record, which would resolve to nothing once vacuumed anyway.
            Stored via origin_res_model/origin_res_id, not a dedicated
            field per integration.
        :param stop_specs: list of dicts, one per intended stop:
            {'partner': res.partner recordset (required, must have coords),
             'sequence': int (optional),
             'service_duration': float hours (optional),
             'notes': str (optional),
             'bridge_vals': dict merged into the created route.planner.line,
                 e.g. {'fsm_order_ids': [(6, 0, order_ids)]} — a single
                 (6, 0, ids) command per field is expected, since this is
                 how each integration attaches its own typed bridge field
                 without this method needing to know it exists.}
            Specs sharing the same partner are folded into one stop line
            automatically, so any caller also gets route.planner.line's
            UNIQUE(route_planner_id, stop_id) constraint satisfied for
            free rather than needing to pre-group stops itself.
            bridge_vals with matching keys are merged by unioning their
            command-tuple ids, not overwritten.
        :param route_type: route.type record (optional — if omitted,
            route.planner's own field default applies).
        :param route_vals: extra route.planner.create() vals — departure_id,
            vehicle_id, driver_id, departure_date, user_id, etc.
        :return: the created route.planner record.

        Deliberately does not validate integration-specific business rules
        (e.g. "all stops must share one source location") — that stays in
        each integration's own caller, which should validate before
        calling this.
        """
        if not stop_specs:
            raise UserError(self.env._('Cannot create a route with no stops.'))

        grouped = {}
        order = []
        for spec in stop_specs:
            partner = spec.get('partner')
            if not partner:
                continue
            if partner.id not in grouped:
                order.append(partner.id)
                grouped[partner.id] = {
                    'partner': partner,
                    'sequence': spec.get('sequence'),
                    'service_duration': spec.get('service_duration'),
                    'notes': spec.get('notes'),
                    'bridge_vals': {},
                }
            for field_name, command in (spec.get('bridge_vals') or {}).items():
                bucket = grouped[partner.id]['bridge_vals'].setdefault(
                    field_name, [(6, 0, [])]
                )
                existing_ids = set(bucket[0][2])
                existing_ids.update(command[0][2])
                grouped[partner.id]['bridge_vals'][field_name] = [
                    (6, 0, list(existing_ids))
                ]

        line_commands = []
        for index, partner_id in enumerate(order):
            data = grouped[partner_id]
            line_vals = {
                'stop_id': data['partner'].id,
                'stop_sequence': (
                    data['sequence']
                    if data['sequence'] is not None
                    else (index + 1) * 10
                ),
                **data['bridge_vals'],
            }
            if (
                data['service_duration'] is not None
                and data['service_duration'] > 0
            ):
                line_vals['service_duration'] = data['service_duration']
            if data['notes']:
                line_vals['notes'] = data['notes']
            line_commands.append((0, 0, line_vals))

        vals = {
            'route_line_ids': line_commands,
            **route_vals,
        }
        if origin is not None:
            vals['origin_res_model'] = origin._name
            vals['origin_res_id'] = origin.id
        if route_type is not None:
            vals['route_type_id'] = route_type.id

        return self.create(vals)
