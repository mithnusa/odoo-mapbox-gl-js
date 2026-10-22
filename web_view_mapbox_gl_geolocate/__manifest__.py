# -*- coding: utf-8 -*-
{
    'name': 'Web View Mapbox GL Geolocate',
    'summary': 'Mapbox GL map view for coordinate-based records — markers, clustering, heatmap, overlap handling, and color coding from lat/lng fields',
    'description': '''
Web View Mapbox GL Geolocate
=============================

Provides the "mapbox_gl_geolocate" view type for displaying records
as point markers on an interactive Mapbox map using separate latitude and
longitude fields. Handles overlapping markers, color coding, clustering,
and heatmap visualization with no GeoJSON conversion required.

This is a technical dependency — it provides no standalone UI. Define a
mapbox_gl_geolocate view on any model that has lat/lng fields, or install
contacts_mapbox_gl to see this view in action on Contacts.

Key Features
------------
* Coordinate-based mapping — reads any two lat/lng fields; records without
  valid or non-zero coordinates are automatically excluded
* Smart overlap handling — when multiple records share the same coordinates
  (within 0.000001° tolerance), markers are distributed in a circular
  pattern with a ~10 m radius offset; the first stays at the true location
* Connection lines — gray dotted lines link distributed markers back to
  their shared center point; visible at zoom level 17 and above only
* Color coding — marker colors from default color index (0-11), a named
  color (red, blue), or a hex code (#ff0000)
* Interactive markers — hover shows a popup with title, description, and
  N/S E/W coordinates (6 decimal places, ~0.11 m accuracy); click to select
* Box-zoom selection — hold Shift and drag a rectangle to select all markers
  within it in one gesture
* Shift+click selection — toggle marker selection without opening the record
* Clustering (optional) — enable_clustering="1" groups nearby markers up to
  zoom 14; clusters color by count: blue (<100), yellow (100-750), pink
  (750+); clicking zooms to expansion level
* Heatmap (optional) — enable_heatmap="1" shows point density at zoom 0-9,
  fading to individual markers above zoom 9; mutually exclusive with
  clustering
* Multi-layer rendering — separate Mapbox layers for default, hover, and
  selected marker states
* Performance — batch processing (100 markers/batch, 10 ms idle yield),
  throttled mouse events (100 ms), and debounced map operations (150 ms)
* Configurable view attributes — lat_field, lng_field, color_field,
  title_field, description_field, enable_heatmap, enable_clustering,
  map_style_url, map_projection
''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi (Mithnusa)',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Hidden',
    'version': '20.0.1.0.0',
    'depends': ['web_view_base_mapbox_gl'],
    'uninstall_hook': '_uninstall_mapbox_gl_geolocate',
    'assets': {
        'web.assets_backend': [
            'web_view_mapbox_gl_geolocate/static/src/views/**/*',
        ],
        "web.assets_unit_tests": [
            "web_view_mapbox_gl_geolocate/static/tests/**/*",
        ],
    },
}
