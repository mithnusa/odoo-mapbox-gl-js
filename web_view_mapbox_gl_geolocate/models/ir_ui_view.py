from lxml import etree
from odoo import models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    def _validate_tag_mapbox_gl(self, node, name_manager, node_info):
        super()._validate_tag_mapbox_gl(node, name_manager, node_info)
        if not node_info['validate']:
            return

        att_lat_field = node.get('lat_field')
        att_lng_field = node.get('lng_field')
        att_js_class = node.get('js_class')

        fields_name = [
            child.get('name')
            for child in node.iterchildren(tag=etree.Element)
            if child.tag == 'field'
        ]

        if (
            att_lat_field
            and att_lng_field
            and (
                not att_js_class
                or (
                    att_js_class
                    and not att_js_class.startswith('mapbox_gl_geolocate')
                )
            )
        ):
            self._raise_view_error(
                self.env._(
                    'Missing attribute js_class. The view required to have attribute js_class="mapbox_gl_geolocate"'
                ),
                node,
            )

        if (
            (not att_lat_field or not att_lng_field)
            and att_js_class
            and att_js_class.startswith('mapbox_gl_geolocate')
        ):
            self._raise_view_error(
                self.env._(
                    'Missing attribute lat_field and lng_field. The view required to have attribute "lat_field" and "lng_field", assign the latitude field and the longitude field'
                ),
                node,
            )

        if att_lat_field and att_lat_field not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "lat_field" does not exist. All fields used in mapbox_gl view attribute must be loaded',
                    name=att_lat_field,
                ),
                node,
            )

        if att_lng_field and att_lng_field not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "lng_field" does not exist. All fields used in mapbox_gl view attribute must be loaded',
                    name=att_lng_field,
                ),
                node,
            )
