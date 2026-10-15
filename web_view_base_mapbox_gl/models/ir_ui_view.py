from lxml import etree
from odoo import fields, models


class IrUiView(models.Model):
    _inherit = 'ir.ui.view'

    type = fields.Selection(selection_add=[('mapbox_gl', 'Mapbox')])

    def _get_view_info(self):
        view_info = super()._get_view_info()
        view_info['mapbox_gl'] = {'icon': 'fa fa-map text-800'}
        return view_info

    def _validate_tag_mapbox_gl(self, node, name_manager, node_info):
        if not node_info['validate']:
            return

        att_title_field = node.get('title_field')
        att_description_field = node.get('description_field')
        att_js_class = node.get('js_class')

        if not att_js_class:
            self._raise_view_error(
                self.env._(
                    'Attribute "js_class" is required for mapbox_gl view'
                ),
                node,
            )

        fields_name = [
            child.get('name')
            for child in node.iterchildren(tag=etree.Element)
            if child.tag == 'field'
        ]

        if att_title_field and att_title_field not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "title_field" does not exist. All fields used in mapbox_gl view attribute must be loaded',
                    name=att_title_field,
                ),
                node,
            )

        if att_description_field and att_description_field not in fields_name:
            self._raise_view_error(
                self.env._(
                    'Field %(name)s assigned to attribute "description_field" does not exist. All fields used in mapbox_gl view attribute must be loaded',
                    name=att_description_field,
                ),
                node,
            )
