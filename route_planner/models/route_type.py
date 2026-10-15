from odoo import fields, models


class RouteType(models.Model):
    _name = 'route.type'
    _description = 'Route Type'

    name = fields.Char(
        string='Name',
        required=True,
    )
    vehicle_required = fields.Boolean(
        string='Vehicle Required',
        default=False,
    )
    driver_required = fields.Boolean(
        string='Driver Required',
        default=False,
    )
    departure_date_required = fields.Boolean(
        string='Departure Date Required',
        default=False,
    )
    departure_title = fields.Char(
        string='Departure Title',
        required=True,
        default='Departure',
        translate=True,
    )
    route_color = fields.Integer(
        string='Route Color',
        default=1,
    )  # must be paired with widget color_picker
    default_service_duration = fields.Float(
        string='Default Service Duration',
        default=0.0,
        help='Default time spent at each stop for routes of this type (hours). '
        'Can be overridden per stop. E.g. 0.25 = 15 min drop-off, 1.0 = 1 hr field visit.',
    )
    active = fields.Boolean(
        string='Active',
        default=True,
    )
    ir_sequence_id = fields.Many2one(
        'ir.sequence',
        string='Sequence for Route Name',
        domain="[('code', '=', 'route.planner')]",  # Only show sequences with code 'route.planner'
        copy=False,
        ondelete='set null',
        help='Optional sequence to auto-generate route names. '
        'If not set, route names must be entered manually.',
    )
