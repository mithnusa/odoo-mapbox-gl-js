# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class MapboxGlController(http.Controller):
    @http.route('/web/mapbox_gl/settings', type='jsonrpc', auth='user')
    def mapbox_gl_settings(self):
        IrParam = request.env['ir.config_parameter'].sudo()
        access_token = IrParam.get_str(
            'base_mapbox_gl.access_token', default=''
        )
        # Custom style URL
        custom_style_url = IrParam.get_str(
            'base_mapbox_gl.style_url', default=''
        )
        # Style selected from preset options
        preset_style = IrParam.get_str('base_mapbox_gl.style', default='')
        lighting = IrParam.get_str('base_mapbox_gl.lighting', default='')
        theme = IrParam.get_str('base_mapbox_gl.theme', default='')
        # Projection
        projection = IrParam.get_str(
            'base_mapbox_gl.projection', default='globe'
        )
        # Language
        language = IrParam.get_str('base_mapbox_gl.language', default='en')

        values = {
            'access_token': access_token,
            'projection': projection,
            'language': language,
        }

        # We prioritize custom_style_url over preset_style
        # Note: it's possible this style is overridden on the frontend per map instance
        map_style = (
            custom_style_url
            or preset_style
            or 'mapbox://styles/mapbox/standard'
        )
        values['style'] = map_style

        # if 'standard' in map_style and 'satellite' not in map_style:
        if not custom_style_url:
            if lighting:
                values['light_preset'] = lighting

            if theme:
                values['theme'] = theme

        return values
