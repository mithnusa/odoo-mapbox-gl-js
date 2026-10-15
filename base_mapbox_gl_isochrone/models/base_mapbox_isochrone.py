import logging

import requests

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError
from odoo.tools import float_compare

from odoo.addons.web_view_mapbox_gl_draw.models.fields import SearchableJson

_logger = logging.getLogger(__name__)

ISOCHRONE_PROFILES = [
    ('driving', 'Driving'),
    ('walking', 'Walking'),
    ('cycling', 'Cycling'),
]

ISOCHRONE_CONTOUR_TYPES = [
    ('contours_minutes', 'Minutes'),
    ('contours_meters', 'Meters'),
]

# Decimal digits of precision used both for the coordinate snapshot fields
# and for detecting a meaningful coordinate change (~1cm at 7 digits).
ISOCHRONE_COORDINATE_DIGITS = (10, 7)

# Mapbox Isochrone API limits:
# https://docs.mapbox.com/api/navigation/isochrone/
ISOCHRONE_MAX_MINUTES = 60
ISOCHRONE_MAX_METERS = 100000

# Records recomputed per action call: the requests are billable, rate limited
# (300/min) and made one after the other inside a single worker request.
ISOCHRONE_MAX_BATCH = 10


class BaseMapboxIsochrone(models.AbstractModel):
    _name = 'base.mapbox.isochrone'
    _description = 'Mapbox Isochrone Mixin'

    # Inheriting models must override with the (latitude_field,
    # longitude_field) pair to read coordinates from, e.g.
    # ('partner_latitude', 'partner_longitude').
    _isochrone_coordinate_fields = None

    isochrone_profile = fields.Selection(
        selection=ISOCHRONE_PROFILES,
        string='Isochrone Profile',
        default='driving',
    )
    isochrone_minutes = fields.Integer(
        string='Isochrone Minutes',
        default=20,
        help='Reachable travel time, in minutes, used to compute the isochrone zone.',
    )
    isochrone_meters = fields.Integer(
        string='Isochrone Meters',
        default=1000,
        help='Reachable travel distance, in meters, used to compute the isochrone zone.',
    )
    isochrone_contour_type = fields.Selection(
        selection=ISOCHRONE_CONTOUR_TYPES,
        string='Isochrone Contour Type',
        default='contours_minutes',
        help='The contour type used to compute the isochrone zone.',
    )
    isochrone_geojson = SearchableJson(
        string='Isochrone GeoJSON',
        readonly=True,
        copy=False,
    )
    isochrone_computed_date = fields.Datetime(
        string='Isochrone Computed On',
        readonly=True,
        copy=False,
        help='The date and time when the isochrone zone was last computed.',
    )
    isochrone_computed_latitude = fields.Float(
        string='Isochrone Computed Latitude',
        digits=ISOCHRONE_COORDINATE_DIGITS,
        readonly=True,
        copy=False,
    )
    isochrone_computed_longitude = fields.Float(
        string='Isochrone Computed Longitude',
        digits=ISOCHRONE_COORDINATE_DIGITS,
        readonly=True,
        copy=False,
    )
    # Snapshot of the parameters used for the last computation, so a change
    # of profile / contour type / value can be detected as "outdated" too.
    isochrone_computed_profile = fields.Selection(
        selection=ISOCHRONE_PROFILES,
        string='Isochrone Computed Profile',
        readonly=True,
        copy=False,
    )
    isochrone_computed_contour_type = fields.Selection(
        selection=ISOCHRONE_CONTOUR_TYPES,
        string='Isochrone Computed Contour Type',
        readonly=True,
        copy=False,
        help='The contour type used for the last computation.',
    )
    isochrone_computed_value = fields.Integer(
        string='Isochrone Computed Value',
        readonly=True,
        copy=False,
        help='Minutes or meters (depending on the computed contour type) used for the last computation.',
    )
    isochrone_is_stale = fields.Boolean(
        string='Isochrone Outdated',
        compute='_compute_isochrone_is_stale',
        help='The coordinates or the isochrone settings changed since the isochrone zone was last computed.',
    )

    @api.constrains(
        'isochrone_minutes', 'isochrone_meters', 'isochrone_contour_type'
    )
    def _check_isochrone_minutes(self):
        for record in self:
            if (
                record.isochrone_contour_type == 'contours_minutes'
                and not 1 <= record.isochrone_minutes <= ISOCHRONE_MAX_MINUTES
            ):
                raise ValidationError(
                    self.env._(
                        'Isochrone minutes must be between 1 and %(max)s (Mapbox Isochrone API limit).',
                        max=ISOCHRONE_MAX_MINUTES,
                    )
                )
            if (
                record.isochrone_contour_type == 'contours_meters'
                and not 1 <= record.isochrone_meters <= ISOCHRONE_MAX_METERS
            ):
                raise ValidationError(
                    self.env._(
                        'Isochrone meters must be between 1 and %(max)s (Mapbox Isochrone API limit).',
                        max=ISOCHRONE_MAX_METERS,
                    )
                )

    def _get_isochrone_stale_depends(self):
        """Field names the stale flag depends on.

        The flag compares the current settings and coordinates against the
        snapshot stored by the last computation, so it must depend on both
        sides of that comparison. The coordinate fields are declared per
        inheriting model, so the dependencies are resolved dynamically
        (`api.depends` accepts a single callable). The abstract mixin itself
        declares no coordinates.
        """
        return [
            'isochrone_profile',
            'isochrone_contour_type',
            'isochrone_minutes',
            'isochrone_meters',
            'isochrone_computed_date',
            'isochrone_computed_latitude',
            'isochrone_computed_longitude',
            'isochrone_computed_profile',
            'isochrone_computed_contour_type',
            'isochrone_computed_value',
            *(self._isochrone_coordinate_fields or ()),
        ]

    @api.depends(lambda self: self._get_isochrone_stale_depends())
    def _compute_isochrone_is_stale(self):
        for record in self:
            if not record.isochrone_computed_date:
                record.isochrone_is_stale = False
                continue
            latitude, longitude = record._get_isochrone_coordinates()
            is_stale = bool(
                float_compare(
                    latitude or 0.0,
                    record.isochrone_computed_latitude,
                    precision_digits=ISOCHRONE_COORDINATE_DIGITS[1],
                )
                or float_compare(
                    longitude or 0.0,
                    record.isochrone_computed_longitude,
                    precision_digits=ISOCHRONE_COORDINATE_DIGITS[1],
                )
            )
            # Zones computed before the parameter snapshot existed have no
            # snapshot: skip the comparison instead of flagging all of them.
            if not is_stale and record.isochrone_computed_contour_type:
                is_stale = record._get_isochrone_parameters() != (
                    record.isochrone_computed_profile,
                    record.isochrone_computed_contour_type,
                    record.isochrone_computed_value,
                )
            record.isochrone_is_stale = is_stale

    @api.model
    def _get_isochrone_coordinate_field_names(self):
        if not self._isochrone_coordinate_fields:
            raise NotImplementedError(
                f'{self._name} must set _isochrone_coordinate_fields = '
                "('latitude_field', 'longitude_field') to use the isochrone mixin."
            )
        return self._isochrone_coordinate_fields

    def _get_isochrone_coordinates(self):
        self.ensure_one()
        lat_field, lng_field = self._get_isochrone_coordinate_field_names()
        return self[lat_field], self[lng_field]

    def _get_isochrone_parameters(self):
        """Effective (profile, contour_type, value) sent to Mapbox.

        The contour type doubles as the Mapbox query parameter name, and the
        value is the minutes or meters matching it, with the same fallbacks
        for unset values.
        """
        self.ensure_one()
        profile = self.isochrone_profile or 'driving'
        contour_type = self.isochrone_contour_type or 'contours_minutes'
        if contour_type == 'contours_meters':
            value = self.isochrone_meters or 1000
        else:
            value = self.isochrone_minutes or 20
        return profile, contour_type, value

    def action_isochrone_recompute(self):
        # Fail before the first billable Mapbox request: the write() that
        # stores the result would otherwise be the first ACL check, after
        # the request was already made.
        self.check_access('write')
        # Each record costs one billable request and up to the request
        # timeout of worker time, sequentially.
        if len(self) > ISOCHRONE_MAX_BATCH:
            raise UserError(
                self.env._(
                    'You can recompute at most %(max)s isochrones at a time.',
                    max=ISOCHRONE_MAX_BATCH,
                )
            )
        for record in self:
            record._isochrone_recompute_one()

    def _isochrone_recompute_one(self):
        self.ensure_one()
        latitude, longitude = self._get_isochrone_coordinates()
        # Odoo stores an unset coordinate as 0.0, so a zero on either axis is
        # treated as "no coordinates yet" (a partially set pair would
        # otherwise silently compute a zone at the equator / prime meridian).
        if not latitude or not longitude:
            raise UserError(
                self.env._(
                    'Cannot compute the isochrone: this record has no coordinates yet.'
                )
            )
        geojson = self._isochrone_fetch_mapbox(latitude, longitude)
        profile, contour_type, value = self._get_isochrone_parameters()
        self.write(
            {
                'isochrone_geojson': geojson,
                'isochrone_computed_date': fields.Datetime.now(),
                'isochrone_computed_latitude': latitude,
                'isochrone_computed_longitude': longitude,
                'isochrone_computed_profile': profile,
                'isochrone_computed_contour_type': contour_type,
                'isochrone_computed_value': value,
            }
        )

    def _isochrone_fetch_mapbox(self, latitude, longitude):
        self.ensure_one()
        # sudo: access_token is a global system parameter, not user-specific data.
        ir_config_sudo = self.env['ir.config_parameter'].sudo()
        mapbox_token = ir_config_sudo.get_param(
            'base_mapbox_gl.access_token', default=''
        )
        if not mapbox_token:
            raise UserError(
                self.env._(
                    'Mapbox access token is not configured. Please set it in the Mapbox GL settings.'
                )
            )

        profile, contour_type, value = self._get_isochrone_parameters()
        # Fixed-point formatting: float repr switches to scientific notation
        # (e.g. 1e-05) for tiny values, which the API rejects.
        url = (
            f'https://api.mapbox.com/isochrone/v1/mapbox/{profile}/'
            f'{longitude:.7f},{latitude:.7f}'
        )
        params = {
            contour_type: value,
            'polygons': 'true',
            'access_token': mapbox_token,
        }

        try:
            response = requests.get(url, params=params, timeout=10)
        except requests.RequestException as e:
            # requests embeds the full URL, including the access_token query
            # parameter, in its exception text: scrub it before logging and
            # do not chain the exception (its traceback would carry it too).
            _logger.error(
                'Mapbox Isochrone API request failed: %s',
                str(e).replace(mapbox_token, '***'),
            )
            raise UserError(
                self.env._(
                    'Failed to compute the isochrone: could not reach Mapbox. Please try again later.'
                )
            ) from None

        # Parse the body before checking the status: Mapbox returns a JSON
        # {message} payload on 4xx/5xx responses too, and that message is
        # the only way to actually diagnose a failure — raise_for_status()
        # would raise on the HTTP error first and discard it unread.
        try:
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError('expected a JSON object')
        except ValueError as e:
            _logger.error(
                'Mapbox Isochrone API returned an unexpected response (HTTP %s): %s',
                response.status_code,
                e,
            )
            raise UserError(
                self.env._(
                    'Failed to compute the isochrone: unexpected response from Mapbox (HTTP %(status)s).',
                    status=response.status_code,
                )
            ) from e

        if not response.ok:
            message = data.get('message') or self.env._('Unknown error')
            _logger.error(
                'Mapbox Isochrone API returned HTTP %s: %s',
                response.status_code,
                message,
            )
            raise UserError(
                self.env._(
                    'Failed to compute the isochrone (HTTP %(status)s): %(message)s',
                    status=response.status_code,
                    message=message,
                )
            )

        if not data.get('features'):
            raise UserError(
                self.env._(
                    'Mapbox returned no isochrone data for this location.'
                )
            )
        return data
