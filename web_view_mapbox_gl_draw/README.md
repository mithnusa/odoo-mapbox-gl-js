# Web View Mapbox GL Draw

## Overview

A Mapbox-based view for displaying and visualizing GeoJSON geometry data in Odoo. Shows polygons, lines, points, and complex geographic shapes representing areas, boundaries, routes, and regions stored in your Odoo records.

## What It Does

Provides a new "mapbox_gl_draw" view type that renders records containing GeoJSON geometry data as interactive map features. Unlike simple coordinate-based mapping, this module handles complex geographic shapes like service territories, delivery zones, property boundaries, or travel routes, with automatic measurement calculations using Turf.js geodesic algorithms.

## Key Features

- **GeoJSON Geometry Support**: Display all standard GeoJSON types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection)
- **Automatic Measurements**: Calculates area, perimeter, and length using Turf.js geodesic algorithms
- **Unit-Adaptive Formatting**: Smart metric unit selection — cm/m/km for length, m²/ha/km² for area — based on the size of the feature
- **Interactive Hover Effects**: Highlights features when hovering — works on geometry layers and text label layers
- **Color Coding**: Assign custom colors to features with auto-darkened stroke borders
- **Feature Selection**: Click features or their text labels to select and view detailed information in sidebar
- **Text Label Annotations**: Point features with an `odoo_user_label` property render as text symbol labels on the map, with a circle anchor beneath the text
- **Multi-layer Rendering**: Separate layers for fills, strokes, points, and labels with independent styling and correct selected/hover states
- **Coordinate Display**: Shows precise coordinates for point features in N/S E/W format
- **Point Count**: Displays number of vertices for polygon and line features
- **Searchable JSON Field**: Custom field type with PostgreSQL JSONB operators (json_eq, json_ne, json_contains, json_not_contains)
- **Auto-filter Records Without Geometry**: When the GeoJSON field is a `SearchableJson` type, the view automatically excludes records where the field is null or an empty FeatureCollection — only records with actual geometry are shown
- **3D Terrain Toggle**: The base module's 3D terrain control is enabled by default in this view type, adding a terrain button to every draw map
- **Performance Optimized**: Efficient layer updates and debounced rendering for responsiveness

## Dependencies

- `web_view_base_mapbox_gl`: Base map view infrastructure

## Installation

1. Install the module through Odoo Apps
2. Create a model with a JSON field to store GeoJSON data
3. Define a map view using the `mapbox_gl_draw` view type

## Basic Usage

1. Create records with GeoJSON geometry data in a JSON field
2. Navigate to the Map view for your model
3. All geometries are displayed on the map with their assigned colors
4. Hover over features to see highlights and measurements
5. Click features to select and view details in the sidebar

## View Configuration

Add the map view to your model's views:

```xml
<mapbox_gl js_class="mapbox_gl_draw"
           geojson_field="geojson"
           color_field="color"
           title_field="name"
           description_field="description"
           map_style_url="mapbox://styles/mapbox/standard-satellite"
           map_projection="mercator">
    <field name="name"/>
    <field name="geojson"/>
    <field name="color"/>
    <field name="description"/>
</mapbox_gl>
```

| Attribute | Description |
|-----------|-------------|
| `geojson_field` | Field containing GeoJSON data (required) |
| `color_field` | Field for custom feature colors (optional) |
| `title_field` | Field to display as record title in sidebar and popups (optional) |
| `description_field` | Field for record description in popups (optional) |
| `map_style_url` | Custom Mapbox style URL (optional). Allows you to set different style and override the one configured in settings |
| `map_projection` | Map projection to use (e.g., "mercator", "globe") (optional). Allows you to set different projection and override the one configured in settings |

## Example Module

A working example implementation is included in the `example/` folder as the `contacts_area_mapbox_gl` module. It demonstrates how to build a model that uses `web_view_mapbox_gl_draw` in practice:

- A `res.partner.geojson` model with a `SearchableJson` field for storing GeoJSON data, a color field, an area field, and a link to a partner record
- A GeoJSON upload wizard for importing geometry data from a file
- A `mapbox_gl_draw` map view wired up to the model

Install this module alongside `web_view_mapbox_gl_draw` to explore the view in action before building your own integration.

---

## Related Modules

- `base_mapbox_gl`: Core Mapbox configuration
- `web_view_base_mapbox_gl`: Base map view infrastructure
- `web_view_mapbox_gl_geolocate`: For point-based mapping with coordinates
- `web_widget_mapbox_gl`: Map widgets for form fields
- `contacts_area_mapbox_gl`: Example implementation with GeoJSON upload wizard
