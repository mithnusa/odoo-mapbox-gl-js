# -*- coding: utf-8 -*-
{
    'name': 'Web View Base Mapbox GL',
    'summary': 'Foundation module for Mapbox GL map views: registers the mapbox_gl view type and shared controller, renderer, sidebar, and selection infrastructure',
    'description': '''
Web View Base Mapbox GL
========================

Foundation module for all Mapbox GL JS map views. Registers the
"mapbox_gl" view type and provides the core controller, renderer, model,
and sidebar that specialized map modules extend.

This is a technical dependency — it provides no standalone UI. Install an
extending module such as web_view_mapbox_gl_geolocate or
web_view_mapbox_gl_draw to display maps.

Key Features
------------
* New view type — registers "mapbox_gl" as a valid view type alongside
  form, list, and kanban; map views can be declared in XML and added to
  window action view modes
* XML arch parsing — extracts map-specific attributes and field
  configurations from view definitions declaratively
* Record sidebar — displays a scrollable list of records alongside the map
  with map-to-sidebar and sidebar-to-map synchronization
* Popup information — hovering over a marker shows a popup with record
  details; disappears when the cursor moves away
* Batch selection — checkboxes, Select All, and an action menu for bulk
  export, delete, and archive operations
* Box-zoom selection — hold Shift and drag a rectangle on the map to select
  all markers within it in one gesture
* Shift+click selection — hold Shift and click a marker to toggle its
  selection without opening the record
* Grouping support — records can be grouped by any field; groups appear as
  collapsible sections in the sidebar
* Pager integration — standard pager for navigating large datasets
* Search integration — full compatibility with search bar, filters,
  favourites, and group by
* Automatic bounds fitting — map zooms and pans to show all visible
  features when data loads or filters change
* Debounced updates — batches rapid map changes into single renders to keep
  the UI responsive
* Performance — batch record processing and data caching prevent browser
  freeze on large datasets
''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi (Mithnusa)',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Hidden',
    'version': '20.0.1.0.0',
    'depends': ['base_mapbox_gl'],
    'assets': {
        'web.assets_backend': [
            'web_view_base_mapbox_gl/static/src/map_base/*',
        ],
    },
    'uninstall_hook': '_uninstall_view_mapbox_gl',
}
