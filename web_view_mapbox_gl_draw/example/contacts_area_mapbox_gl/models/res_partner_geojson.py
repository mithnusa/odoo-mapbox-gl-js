from odoo import fields, models
from odoo.addons.web_view_mapbox_gl_draw.models.fields import SearchableJson


class ResPartnerGeojson(models.Model):
    _name = 'res.partner.geojson'
    _description = 'Partner GeoJSON'
    _order = 'name asc'

    name = fields.Char(
        string='Name',
        required=True,
    )
    geojson = SearchableJson(string='GeoJSON Data')
    partner_id = fields.Many2one(
        'res.partner',
        string='Customer',
        ondelete='cascade',
    )
    area = fields.Float(string='Area')
    active = fields.Boolean(
        string='Active',
        default=True,
    )
    color = fields.Integer(
        string='Color',
        default=1,
    )
    description = fields.Text(string='Description')

    def copy(self, default=None):
        if default is None:
            default = {}

        default['name'] = f"{self.name} (Copy)"
        return super().copy(default)
