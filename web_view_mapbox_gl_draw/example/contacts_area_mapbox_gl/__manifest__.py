# -*- coding: utf-8 -*-
{
    'name': 'Partners GeoJSON (Mapbox demo implementation)',
    'version': '19.0.1.0.0',
    'author': 'Yopi Angi',
    'license': 'LGPL-3',
    'maintainer': 'Yopi Angi<yopiangi@gmail.com>',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'description': """
Partners GeoJSON
================
This module enables importing and displaying partner locations using GeoJSON files with Mapbox GL.
Features

- Import partner locations from GeoJSON files.
- Display partner locations on an interactive Mapbox GL map.
""",
    'depends': [
        'base_geolocalize',
        'contacts',
        'web_view_mapbox_gl_draw',
        'web_widget_mapbox_gl',
    ],
    'website': 'https://www.mithnusa.com',
    'data': [
        'security/ir.model.access.csv',
        'views/res_partner_geojson.xml',
        'wizard/geojson_upload_wizard_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'contacts_area_mapbox_gl/static/src/views/mapbox_gl/*'
        ],
    },
}
