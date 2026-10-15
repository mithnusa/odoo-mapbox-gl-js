from odoo import api, fields, models
from odoo.exceptions import ValidationError
from .utils import ROUTE_STOP_STATES, ROUTE_STOP_STATE_NONE


class RoutePlannerLine(models.Model):
    _name = 'route.planner.line'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = 'Route Planner Stops'
    _order = 'route_planner_id, stop_sequence'
    _rec_name = 'stop_id'

    @api.constrains('stop_latitude', 'stop_longitude')
    def _check_stop_coordinates_valid(self):
        for line in self:
            # Treat (0.0, 0.0) as an invalid sentinel/default coordinate.
            # Although (0, 0) is a valid geographic point ("Null Island"),
            # in this application it is reserved to indicate an unset location.
            if line.stop_latitude == 0.0 and line.stop_longitude == 0.0:
                raise ValidationError(
                    self.env._(
                        'Stop coordinates (0, 0) are reserved as a default/unset '
                        'value and are not allowed. Please provide a valid location.'
                    )
                )
            if not (-90 <= line.stop_latitude <= 90):
                raise ValidationError(
                    self.env._(
                        'Stop latitude must be between -90 and 90 degrees.'
                    )
                )
            if not (-180 <= line.stop_longitude <= 180):
                raise ValidationError(
                    self.env._(
                        'Stop longitude must be between -180 and 180 degrees.'
                    )
                )

    state = fields.Selection(
        selection=ROUTE_STOP_STATES,
        string='Status',
        default=ROUTE_STOP_STATE_NONE,
        copy=False,
        help='Current status of the route stop',
        tracking=True,
    )
    route_planner_id = fields.Many2one(
        'route.planner',
        string='Route Planner',
        required=True,
        ondelete='cascade',
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        related='route_planner_id.company_id',
        store=True,
        readonly=True,
    )
    user_id = fields.Many2one(
        'res.users',
        string='Responsible',
        related='route_planner_id.user_id',
        store=True,
        readonly=True,
        ondelete='restrict',
    )
    origin_address = fields.Char(
        string='Origin/Destination',
        related='route_planner_id.departure_address',
    )
    origin_latitude = fields.Float(
        related='route_planner_id.departure_latitude'
    )
    origin_longitude = fields.Float(
        related='route_planner_id.departure_longitude'
    )
    stop_sequence = fields.Integer(
        string='Stop Sequence',
        required=True,
    )
    stop_id = fields.Many2one(
        'res.partner',
        string='Address',
        domain="[('partner_latitude', '!=', 0.0), ('partner_longitude', '!=', 0.0)]",
        required=True,
    )
    stop_address = fields.Char(
        string='Stop Address',
        compute='_compute_stop_geolocation',
        store=True,
        readonly=True,
    )
    stop_latitude = fields.Float(
        string='Stop Latitude',
        compute='_compute_stop_geolocation',
        store=True,
        readonly=True,
        digits=(10, 7),
    )
    stop_longitude = fields.Float(
        string='Stop Longitude',
        compute='_compute_stop_geolocation',
        store=True,
        readonly=True,
        digits=(10, 7),
    )
    distance_from_previous = fields.Float(
        string='Approx. Distance (km)',
        help='Estimated distance measured from previous point',
    )
    duration_from_previous = fields.Float(
        string='Est. Duration (hours)',
        help='Estimated duration measured from previous point',
    )
    service_duration = fields.Float(
        string='Service Duration',
        default=0.0,
        help='Time spent at this stop, excluding travel. E.g. drop-off, customer meeting, repair, inspection.',
    )
    notes = fields.Text(
        string='Note by driver',
        copy=False,
        tracking=True,
        help='Note entered by the driver',
    )
    stop_notes = fields.Text(string='Stop Note', help='Note for this stop')

    # ir.attachment is already polymorphic in Odoo core (res_model/res_id)
    # — no new storage needed here, just a computed lookup. The driver
    # portal's photo/signature capture targets this specific stop when one
    # is known, so this is how a dispatcher finds "the photo for this job"
    # directly instead of only "some photo somewhere on this route".
    # Many2many rather than One2many: a computed One2many normally still
    # needs a real inverse Many2one on the comodel to write through, which
    # doesn't exist here (ir.attachment only has generic res_model/res_id,
    # not a field pointing at route.planner.line specifically) — Many2many
    # has no such requirement for a compute-only, unstored field.
    attachment_ids = fields.Many2many(
        'ir.attachment',
        compute='_compute_attachment_ids',
        string='Attachments',
    )
    attachment_count = fields.Integer(
        compute='_compute_attachment_ids', string='Attachments'
    )

    def _compute_attachment_ids(self):
        for line in self:
            attachments = self.env['ir.attachment'].search(
                [
                    ('res_model', '=', 'route.planner.line'),
                    ('res_id', '=', line.id),
                ]
            )
            line.attachment_ids = attachments
            line.attachment_count = len(attachments)

    _mapping_route_unique = models.Constraint(
        'UNIQUE(route_planner_id, stop_id)',
        'Drop-off addresses must be unique per route.',
    )
    _mapping_lat_lng_unique = models.Constraint(
        'UNIQUE(route_planner_id, stop_latitude, stop_longitude)',
        'Drop-off coordinates (latitude and longitude) must be unique per route.',
    )

    @api.model_create_multi
    def create(self, vals_list):
        needs_defaults = [
            v
            for v in vals_list
            if v.get('route_planner_id')
            and ('service_duration' not in v or 'stop_sequence' not in v)
        ]
        if needs_defaults:
            planner_ids = {v['route_planner_id'] for v in needs_defaults}
            planners = self.env['route.planner'].browse(planner_ids)
            default_by_planner = {
                p.id: p.route_type_id.default_service_duration
                for p in planners
            }
            # Current max sequence per planner — avoids ties when adding multiple stops
            existing = self.search(
                [('route_planner_id', 'in', list(planner_ids))],
                order='route_planner_id, stop_sequence desc',
            )
            max_seq_by_planner = {}
            for line in existing:
                pid = line.route_planner_id.id
                if pid not in max_seq_by_planner:
                    max_seq_by_planner[pid] = line.stop_sequence

            for vals in vals_list:
                pid = vals.get('route_planner_id')
                if not pid:
                    continue
                if 'service_duration' not in vals:
                    default = default_by_planner.get(pid)
                    if default:
                        vals['service_duration'] = default
                if 'stop_sequence' not in vals:
                    next_seq = max_seq_by_planner.get(pid, 0) + 10
                    vals['stop_sequence'] = next_seq
                    max_seq_by_planner[pid] = next_seq

        return super().create(vals_list)

    @api.depends('stop_address', 'stop_id')
    def _compute_display_name(self):
        for line in self:
            line.display_name = (
                line.stop_address
                or line.stop_id.name
                or self.env._('Unnamed Stop')
            )

    @api.depends('stop_id')
    def _compute_stop_geolocation(self):
        """Compute stop address, latitude, and longitude from the selected stop partner.
        All three fields are intentionally snapshotted when stop_id is assigned: stop_id.partner_latitude,
        stop_id.partner_longitude, and the partner's address fields are NOT listed as dependencies, so a
        later change to the partner record does not silently overwrite the coordinates or address that
        were valid when the stop was recorded. This field only recomputes when stop_id itself changes.

        State-aware re-sync of an already-recorded stop (e.g. propagating an updated partner address into
        a still-draft stop) is handled separately by res.partner.write() in res_partner.py, which filters
        by route/stop state before overwriting these snapshot fields. Do not add partner sub-fields here —
        that would recompute the snapshot for every stop referencing the partner, including done/cancelled
        ones, regardless of state.
        """
        for line in self:
            if line.stop_id:
                line.stop_latitude = line.stop_id.partner_latitude
                line.stop_longitude = line.stop_id.partner_longitude
                line.stop_address = line.stop_id.contact_address
            else:
                line.stop_latitude = 0.0
                line.stop_longitude = 0.0
                line.stop_address = ''
