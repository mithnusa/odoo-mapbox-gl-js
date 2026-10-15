from odoo import fields, models
from odoo.addons.web_view_mapbox_gl_draw.models.fields import SearchableJson


class ProjectTask(models.Model):
    _inherit = "project.task"

    mapbox_project_geojson = SearchableJson(
        related="project_id.mapbox_geojson",
        string="Project GeoJSON",
        readonly=True,
    )
    mapbox_project_area = fields.Float(
        related="project_id.mapbox_area",
        string="Project Area",
        readonly=True,
    )
    mapbox_geojson = SearchableJson(string="Task GeoJSON")
    mapbox_area = fields.Float(string="Area")
    mapbox_notes = fields.Html(string="Notes")
    # Designed to be paired with widget="color_picker" in the form view, which expects an integer field with a defined set of values
    mapbox_color = fields.Integer(string="Color", default=1)
