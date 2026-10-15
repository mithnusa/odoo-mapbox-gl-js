# Web View Mapbox GL Geolocate

## Overview

A Mapbox-based view for displaying records with latitude and longitude coordinates on interactive maps. Ideal for visualizing customers, warehouses, delivery points, service locations, or any data with geographic coordinates.

## What It Does

Provides a "mapbox_gl_geolocate" view type that renders records with separate latitude and longitude fields as point markers on interactive maps. The module intelligently handles overlapping markers by automatically spreading them in a circular pattern (~10 meter radius), preventing hidden or stacked points at the same location.

## Key Features

- **Coordinate-Based Mapping**: Display records using separate latitude and longitude fields (no GeoJSON conversion needed)
- **Smart Overlap Handling**: Automatically spreads markers at the same location in a ~10 meter circular pattern
- **Connection Lines**: Dotted lines link distributed markers back to their shared location (visible at zoom 17+); line color matches the marker's stroke color
- **Shifted Marker Indicator**: An info icon appears in the popup of any offset marker, with a tooltip explaining that the marker has been moved and pointing to its original location
- **Interactive Markers**: Hover for popups with record info, click to select and view full details in sidebar
- **Box-Zoom Selection**: Hold Shift and drag a rectangle on the map to select all markers within it; when clustering is enabled, records inside visible clusters are also selected (up to 100 per cluster)
- **Shift+Click Selection**: Hold Shift and click a marker to toggle its selection without opening the record
- **Color Coding**: Assign colors to markers using Odoo color index, named colors (red, blue), or hex codes (#ff0000)
- **Coordinate Display**: Shows precise coordinates in human-readable format with 6 decimal precision (~0.11m accuracy)
- **Automatic Filtering**: Only displays records with valid, non-zero coordinate data
- **Heatmap Support**: Optional heatmap layer for visualizing point density at zoom levels 0–9 (mutually exclusive with clustering)
- **Clustered Rendering**: Optional marker clustering at zoom levels up to 14 for improved performance and readability (mutually exclusive with heatmap)
- **Performance Optimized**: Batch processing (100 markers/batch), throttled mouse events (100ms), and debounced operations for smooth interaction
- **Multi-layer Rendering**: Separate visual states for default, hover, and selected markers

## Dependencies

- `web_view_base_mapbox_gl`: Base map view infrastructure

## Installation

1. Install the module through Odoo Apps
2. Ensure your model has latitude and longitude fields
3. Define a map view using the `mapbox_gl_geolocate` view type

## Basic Usage

1. Navigate to any model with a geolocate map view configured
2. All records with valid coordinates appear as markers on the map
3. Hover over markers to see popups with record information
4. Click markers to select them and view details in the sidebar
5. Records at the same location are automatically spread in a circle with connecting lines

## View Configuration

Add the map view to your model's views:

```xml
<mapbox_gl js_class="mapbox_gl_geolocate"
           lat_field="partner_latitude"
           lng_field="partner_longitude"
           color_field="color"
           title_field="name"
           description_field="city"
           enable_heatmap="1"
           enable_clustering="1"
           map_style_url="mapbox://styles/mapbox/streets-v11"
           map_projection="mercator">
    <field name="name"/>
    <field name="partner_latitude"/>
    <field name="partner_longitude"/>
    <field name="color"/>
    <field name="city"/>
</mapbox_gl>
```

| Attribute | Description |
|-----------|-------------|
| `lat_field` | Field containing latitude values in decimal degrees (required) |
| `lng_field` | Field containing longitude values in decimal degrees (required) |
| `color_field` | Field for marker colors - Odoo color index (0-11), color name (red, blue), or hex code (#ff0000) (optional) |
| `title_field` | Field to display as record title in sidebar and popups (optional) |
| `description_field` | Field for record description in sidebar and popups (optional) |
| `enable_heatmap` | Set to "1" to enable heatmap layer showing point density at zoom levels 0–9 (optional, default: disabled). Ignored if `enable_clustering` is also set. |
| `enable_clustering` | Set to "1" to enable marker clustering up to zoom level 14 (optional, default: disabled). Takes precedence over `enable_heatmap` if both are set. |
| `map_style_url` | Custom Mapbox style URL to override the default configured in settings (optional) |
| `map_projection` | Map projection to use - "mercator", "globe", etc. - to override the default configured in settings (optional) |

All fields referenced by `lat_field`, `lng_field`, `color_field`, `title_field`, and `description_field` must be declared as `<field>` children of the view element. Odoo will raise a validation error at install time if any of these fields are missing from the view definition.

## Related Modules

- `base_mapbox_gl`: Core Mapbox configuration
- `web_view_base_mapbox_gl`: Base map view infrastructure
- `web_view_mapbox_gl_draw`: For GeoJSON geometry mapping (polygons, lines)
- `web_widget_mapbox_gl`: Map widgets for form fields
