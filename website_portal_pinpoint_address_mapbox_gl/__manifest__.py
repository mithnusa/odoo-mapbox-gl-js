# -*- coding: utf-8 -*-
{
    'name': 'Website Portal Pinpoint Address - Mapbox GL',
    'summary': 'Let portal users pin their address on a Mapbox map on the My Address form',
    'description': '''
Website Portal Pinpoint Address - Mapbox GL
============================================

Adds an interactive Mapbox map to the portal "My Address" form so that
users can visually pinpoint their exact location instead of typing
coordinates manually.

Key Features
------------
* Interactive map embedded in the portal address form
* Click-to-pin — users click the map to set their address location
* Coordinates (latitude/longitude) are saved automatically to the partner
  record when the address form is submitted
* Pre-fills the map marker from any existing partner coordinates
''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Website',
    'version': '19.0.1.0.0',
    'depends': ['website', 'portal', 'base_mapbox_gl'],
    'data': [
        'views/address_templates.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'base_mapbox_gl/static/src/utils/**/*',
            'website_portal_pinpoint_address_mapbox_gl/static/src/components/mapbox_dialog/*',
            'website_portal_pinpoint_address_mapbox_gl/static/src/interactions/address_form_pinpoint_address_mapbox_gl.js',
        ],
    },
}
