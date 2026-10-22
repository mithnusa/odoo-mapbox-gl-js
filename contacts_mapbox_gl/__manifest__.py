# -*- coding: utf-8 -*-
{
    'name': 'Contacts Mapbox GL',
    'version': '20.0.1.0.0',
    'author': 'Yopi Angi',
    'license': 'LGPL-3',
    'maintainer': 'Yopi Angi<yopiangi@gmail.com>',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'summary': 'Interactive Mapbox GL map view for Contacts with clustering and per-contact marker colors',
    'description': """
Contacts Mapbox GL
==================

Adds a Mapbox GL map view directly inside the Contacts application, letting
you see all your partners plotted on an interactive map alongside their
geolocated addresses.

Key Features
------------
* Map view tab — available next to List, Kanban, and Form in Contacts
* Marker clustering — groups nearby contacts at low zoom levels for clarity
* Per-contact marker color — assign a custom color to each partner via a
  color picker field on the partner form
* Sidebar panel — shows a scrollable list of contacts next to the map for
  easy navigation
* Popup cards — click a marker to see the contact name and address
""",
    'depends': [
        'base_geolocalize',
        'contacts',
        'web_view_mapbox_gl_geolocate',
    ],
    'data': [
        'data/cron_contact_geolocalize.xml',
        'views/res_partner_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'contacts_mapbox_gl/static/src/views/**/*',
        ],
    },
}
