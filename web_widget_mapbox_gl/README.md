# Web Widget Mapbox GL

## Overview

This module provides form view widgets for drawing and editing GeoJSON geometry data on interactive Mapbox maps. Users can create, modify, and visualize geographic shapes directly within Odoo forms.

## What It Does

Embeds interactive Mapbox maps into form views where users can draw points, lines, and polygons. Unlike the view modules that display entire datasets, these widgets focus on individual record fields, making them perfect for capturing boundary data, defining areas, or marking locations as part of form data entry.

## Key Features

- **Interactive Drawing**: Draw points, lines, and polygons directly on the map
- **Circle Drawing**: Click to set a center point, then click to set the radius
- **Rectangle Drawing**: Click one corner, then click the opposite corner to draw an axis-aligned rectangle
- **Polygon Cut**: Draw a polygon over existing polygons to cut them into separate pieces
- **Edit Existing Shapes**: Modify vertices, move shapes, or delete geometries
- **Readonly Display Mode**: View geometries without editing capabilities when form is in readonly state
- **Multiple Geometry Types**: Support for all GeoJSON geometry types including multi-geometries
- **Automatic Area Calculation**: Calculates and saves polygon area to a specified field when changes are saved
- **Location Search**: Integrated geocoding search to navigate to any address
- **Style Switcher**: Change map styles while editing
- **Custom Map Center**: Set default map position for better user experience
- **GeoJSON Import/Export**: Upload shapes from a GeoJSON file or download all drawn features as a .geojson file
- **Explicit Save Button**: A Save button in the draw toolbar must be clicked to commit changes to the record
- **Undo/Redo**: Full undo/redo history (up to 20 steps) via Ctrl+Z / Ctrl+Y or the toolbar buttons
- **Live Measurements**: Real-time area and length overlay follows the cursor while drawing; per-segment length labels appear at each edge midpoint
- **Measurements Toggle**: Show or hide area and perimeter labels on completed features with a single button click
- **Text Label Annotations**: Place custom text labels anywhere on the map; click a placed label to edit or update it

## Dependencies

- `base_mapbox_gl`

## Installation

1. Install the module through Odoo Apps
2. Add a JSON field to your model for storing geometry data
3. Apply the widget to the field in your form view

## Basic Usage

1. Open a form with the drawing widget
2. Use the drawing tools to create shapes on the map
3. Click existing shapes to edit or delete them
4. Save the form - geometry data is stored automatically

## Widget Configuration

Apply the widget to a JSON field in your form view:

```xml
<field name="boundary"
       widget="mapbox_gl_draw_geojson"
       options="{
           'field_area': 'area_sqm',
           'default_center': [106.8456, -6.2088],
           'map_style_url': 'mapbox://styles/mapbox/satellite-streets-v12'
       }"/>
```

| Option | Type | Description |
|--------|------|-------------|
| `field_area` | String | Field name to store calculated area in m² |
| `default_center` | Array | Initial map center as [longitude, latitude] |
| `map_style_url` | String | Mapbox style URL to override default |
| `map_projection` | String | Map projection (globe, mercator, etc.) |

## Drawing Tools

| Tool | Description |
|------|-------------|
| Point | Click to place point markers |
| Line | Click to create connected line segments |
| Polygon | Click to draw closed shapes |
| Circle | Click to set center, then click to set radius |
| Rectangle | Click one corner, then click the opposite corner |
| Polygon Cut | Draw a polygon to cut existing polygons into pieces |
| Edit | Click a shape to adjust vertices or reposition it |
| Delete | Remove selected shapes |
| Undo | Revert the last change (Ctrl+Z) |
| Redo | Reapply a reverted change (Ctrl+Y) |
| Measurements | Toggle area and perimeter labels on completed features |
| Label | Click to enter label placement mode, then click the map to place a text annotation; click a placed label to edit it |
| Import | Upload shapes from a GeoJSON file |
| Export | Download all shapes as a .geojson file |
| Save | Commit drawn changes to the Odoo record |

## Related Modules

- `base_mapbox_gl`: Core Mapbox configuration
- `web_view_base_mapbox_gl`: Map view infrastructure for datasets
- `web_view_mapbox_gl_draw`: GeoJSON display in list views
- `web_view_mapbox_gl_geolocate`: Coordinate-based point mapping
