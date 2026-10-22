# -*- coding: utf-8 -*-
{
    'name': 'Web View Mapbox GL Draw',
    'summary': 'Mapbox GL map view for GeoJSON geometry data — renders polygons, lines, and points with area/length measurements and color coding',
    'description': '''
Web View Mapbox GL Draw
========================

Provides the "mapbox_gl_draw" view type for displaying GeoJSON geometry
data stored in records. Renders polygons, lines, points, and complex
multi-part shapes as interactive map features with automatic measurements,
color coding, and a sidebar information panel.

This is a technical dependency — it provides no standalone UI. Build a
model with a JSON field for GeoJSON data and define a mapbox_gl_draw view,
or install the included contacts_area_mapbox_gl example module to explore
the view in action.

Key Features
------------
* GeoJSON geometry support — renders all standard types: Point, LineString,
  Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection
* Multi-layer rendering — separate Mapbox layers for fills, strokes, and
  points each with default, hover, and selected visual states
* Color coding — each feature can have a custom color; stroke borders are
  automatically darkened for contrast
* Automatic measurements via Turf.js geodesic algorithms:
  - Polygons: area (m²/ha/km²) and perimeter (cm/m/km)
  - Lines: total length (cm/m/km)
  - Points: coordinates displayed in N/S E/W format
  - Vertex count for polygon and line features
* Unit-adaptive formatting — measurement units switch automatically based
  on the size of the feature
* Interactive hover — features highlight on hover with enhanced stroke
  width and opacity
* Feature selection & sidebar — clicking a feature shows its title,
  description, measurements, and an Open Record button in the sidebar
* Searchable JSON field type — custom SearchableJson field with four
  PostgreSQL JSONB operators: json_eq, json_ne, json_contains,
  json_not_contains; optimized via domain optimizer
* Configurable view attributes — geojson_field, color_field, title_field,
  description_field, map_style_url, map_projection
* Auto-fit bounds — map zooms to show all features on load and data change
* Animated transitions — flyTo and fitBounds with smooth 1-second animation
* Debounced rendering and efficient layer updates for responsiveness
* Example module — contacts_area_mapbox_gl in the example/ folder
  demonstrates a complete integration with a GeoJSON upload wizard
''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi (Mithnusa)',
    'website': 'https://www.mithnusa.com',
    'support': 'yopiangi@gmail.com',
    'category': 'Hidden',
    'version': '20.0.1.0.0',
    'depends': ['web_view_base_mapbox_gl'],
    'assets': {
        'web.assets_backend': [
            'web_view_mapbox_gl_draw/static/src/views/**/*',
        ],
    },
}
