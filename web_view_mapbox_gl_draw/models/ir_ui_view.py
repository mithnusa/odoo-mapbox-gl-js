from lxml import etree
from odoo import models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    def _validate_tag_mapbox_gl(self, node, name_manager, node_info):
        super()._validate_tag_mapbox_gl(node, name_manager, node_info)
        if not node_info['validate']:
            return

        att_geojson_field = node.get('geojson_field')
        att_js_class = node.get('js_class')

        fields_name = [
            child.get('name')
            for child in node.iterchildren(tag=etree.Element)
            if child.tag == 'field'
        ]

        if att_geojson_field and (
            not att_js_class
            or (att_js_class and not att_js_class.startswith('mapbox_gl_draw'))
        ):
            self._raise_view_error(
                self.env._(
                    'Missing attribute js_class. The view required to have attribute js_class="mapbox_gl_draw"'
                ),
                node,
            )

        if (
            not att_geojson_field
            and att_js_class
            and att_js_class.startswith('mapbox_gl_draw')
        ):
            self._raise_view_error(
                self.env._(
                    'Missing attribute geojson_field. Please set the GeoJSON field as view\'s attribute'
                ),
                node,
            )

        if att_geojson_field and att_geojson_field not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "geojson_field" does not exist. All fields used in mapbox_gl view attribute must be loaded',
                    name=att_geojson_field,
                ),
                node,
            )
