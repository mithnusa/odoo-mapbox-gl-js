# -*- coding: utf-8 -*-
{
    'name': 'Web Widget Mapbox GL',
    'summary': 'Form field widget for drawing and editing GeoJSON geometry (polygons, lines, points, circles) on an embedded Mapbox map',
    'description': '''
Web Widget Mapbox GL
=====================

Provides the "mapbox_gl_draw_geojson" form field widget for drawing and
editing GeoJSON geometry data directly within form views. Embeds an
interactive Mapbox map with a full drawing toolbar into any JSON field.

This is a technical dependency — it provides no standalone UI. Apply the
widget to a JSON field in any form view to enable geometry editing.

Key Features
------------
* Drawing tools — point, line, and polygon with click-to-add vertices;
  applies to any JSON field via widget="mapbox_gl_draw_geojson"
* Circle drawing — click to place center, click again to set radius;
  stored as a 64-vertex polygon approximation via Turf.js
* Polygon cut — draw a cutting polygon over existing polygons to split
  them into separate pieces (Turf.js difference operation)
* Edit mode — drag vertices or move entire shapes; delete selected shapes
* Readonly display mode — when the form is readonly, drawing tools are
  hidden and geometries render as static fill/stroke/circle layers
* Explicit Save button — changes are committed to the record only when
  the Save button in the draw toolbar is clicked; unsaved changes are
  highlighted
* Automatic area calculation — calculates total polygon area (m²) using
  Turf.js geodesic algorithms and saves to a configured field on Save
* GeoJSON import — upload a .geojson or .json file to load shapes onto
  the canvas
* GeoJSON export — download all drawn features as a timestamped .geojson
  file for backup or use in external GIS tools
* Location search — integrated geocoding search to navigate to any
  address or place name
* Style switcher — change map style (streets, satellite, etc.) mid-edit
* Configurable options — field_area, default_center, map_style_url,
  map_projection
* Lazy asset loading — Mapbox GL Draw and Turf.js load on demand
* Resource cleanup — map instance and event listeners disposed on unmount
''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Hidden',
    'version': '20.0.1.0.0',
    'depends': ['base_mapbox_gl'],
    'assets': {
        'web.assets_backend': [
            'web_widget_mapbox_gl/static/src/widgets/components/**/*',
            'web_widget_mapbox_gl/static/src/widgets/drawing/*',
        ],
    },
}
