# web_view_mapbox_gl_geolocate — Technical Reference

This document describes how to define a `mapbox_gl_geolocate` view, how automatic domain filtering works, how overlapping markers are handled, and how the optional heatmap and clustering layers are configured.

---

## View Registration

The view is registered as:

```js
registry.category('views').add('mapbox_gl_geolocate', mapboxGlGeolocateView);
```

It uses `js_class="mapbox_gl_geolocate"` and extends `baseMapboxGlView` from `web_view_base_mapbox_gl`, replacing all four MVC components. The renderer applies both `withBoxZoomSelection` and `withShiftClickSelection` mixins from `web_view_base_mapbox_gl`.

---

## XML View Definition

```xml
<mapbox_gl js_class="mapbox_gl_geolocate"
           lat_field="partner_lat"
           lng_field="partner_long"
           title_field="name"
           description_field="street"
           color_field="color"
           enable_heatmap="false"
           enable_clustering="false"
           map_style_url="mapbox://styles/mapbox/standard-satellite"
           map_projection="mercator">
    <field name="name"/>
    <field name="street"/>
    <field name="partner_lat"/>
    <field name="partner_long"/>
    <field name="color"/>
</mapbox_gl>
```

### Supported Attributes

| Attribute | Required | Description |
|---|---|---|
| `js_class` | Yes | Must be `"mapbox_gl_geolocate"` (or a value starting with `mapbox_gl_geolocate`) |
| `lat_field` | Yes | Float field on the model storing the latitude value |
| `lng_field` | Yes | Float field on the model storing the longitude value |
| `title_field` | No | Field shown as the record title in the sidebar and popup |
| `description_field` | No | Field shown as the subtitle in the sidebar and popup |
| `color_field` | No | Field used to color-code markers on the map |
| `enable_heatmap` | No | `"true"` to add a heatmap density layer at zoom levels 0–9. Ignored if clustering is also enabled. Default: `false` |
| `enable_clustering` | No | `"true"` to group nearby markers into cluster bubbles. Mutually exclusive with `enable_heatmap`. Default: `false` |
| `map_style_url` | No | Mapbox style URL override for this view instance |
| `map_projection` | No | Map projection override for this view instance |

All standard `web_view_base_mapbox_gl` attributes (`limit`, `default_order`, `default_group_by`, `center`, etc.) are also supported.

> **Note**: `enable_heatmap` and `enable_clustering` cannot be active at the same time. If both are set to `true`, clustering takes precedence and the heatmap is suppressed with a console warning.

---

## Python View Validation

`ir.ui.view` extends `_validate_tag_mapbox_gl` to enforce the following:

- If `lat_field` and `lng_field` are both set, `js_class` must start with `"mapbox_gl_geolocate"`.
- If `js_class` starts with `"mapbox_gl_geolocate"`, both `lat_field` and `lng_field` must be set.
- Each field named in `lat_field` and `lng_field` must be declared as a `<field>` child of the view node.

Violations raise a view validation error at module install time.

---

## Automatic Domain Filtering

`MapboxGlGeolocateModel` overrides `mapDomain` to automatically exclude records with no valid coordinates. When both `lat_field` and `lng_field` are searchable, the following domain is applied before every data load:

```python
[
    (lat_field, '!=', 0.0),
    (lng_field, '!=', 0.0),
]
```

When either field is a related field, an additional condition is added to require the related source record to be non-false:

```python
[(related_source_field, '!=', False)]
```

Records where both coordinates are exactly `0.0` (e.g. unset partner locations) are excluded. If the coordinate fields are not marked as searchable, the domain is not applied.

---

## Controller

`MapboxGlGeolocateController` overrides `viewMapConfig` to validate the coordinate fields and inject them into the config object passed to the renderer:

- Throws if `lngField` or `latField` is not found in the model's fields.
- Passes `latField`, `lngField`, `enableHeatmap`, and `enableClustering` into `viewMapConfig`.

---

## Rendering

`MapboxGlGeolocateRenderer` extends `BaseMapboxGlRenderer`. Records are converted to GeoJSON `Point` features at render time by reading `lngField` and `latField` from each record's data. Non-finite coordinate values are silently skipped.

### Layers

| Layer ID | Type | Purpose |
|---|---|---|
| `GEOJSON_CIRCLE` | `circle` | Main marker layer; data-driven `fillColor` and `strokeColor` properties |
| `GEOJSON_CIRCLE_HOVERED` | `circle` | Hover highlight; filtered to the hovered feature's `resId` |
| `GEOJSON_CIRCLE_SELECTED` | `circle` | Selection highlight; filtered to features with `isSelected = true` |
| `geolocate-heatmap` | `heatmap` | Density heatmap, zoom 0–9 only; added only when `enable_heatmap="true"` and clustering is off |
| `feautures-cluster` | `circle` | Cluster bubble; added only when `enable_clustering="true"` |
| `features-cluster-count` | `symbol` | Cluster count label; added only when `enable_clustering="true"` |
| `geolocate-connection-lines` | `line` | Dashed lines from shifted markers back to their center marker; visible at zoom ≥ 17 |

All marker layers share the `geojson-data-source` GeoJSON source. Connection lines use a separate source (`geolocate-connection-lines-source`).

### Color Expression

Marker fill and stroke colors are driven by a Mapbox data expression:

```js
['case', ['!=', ['get', propertyName], null], ['get', propertyName], defaultColor]
```

This reads `fillColor` and `strokeColor` from each feature's properties, falling back to the configured defaults when absent.

---

## Overlap Handling

When two or more records share the same coordinates (to 6 decimal places, ≈ 0.11 m precision), markers are spread in a circular pattern to keep them individually clickable.

### Algorithm

1. The first record at a given coordinate is placed at the exact coordinate and registered as the **center marker**.
2. Each subsequent record at the same coordinate is offset using a circular distribution:
   - Offset angle = `(index × 2π) / max(index + 1, 3)` — always uses at least 3 positions to ensure spacing.
   - Offset radius = `0.00009` degrees (≈ 10 m at the equator).
   - Resulting coordinates = `[lng + cos(angle) × radius, lat + sin(angle) × radius]`.
3. Shifted markers receive `isShifted: true` and `centerMarkerCoordinates` in their properties.

### Connection Lines

For every shifted marker, a `LineString` is generated from the center marker's coordinates to the shifted coordinates. These lines are rendered as dashed strokes (`[2, 2]`) at zoom ≥ 17, using the feature's `strokeColor` when available.

The overlap tracking maps (`coordinateUsageMap`, `centerMarkerMap`) are rebuilt on every render.

---

## Heatmap Layer

When `enable_heatmap="true"` and `enable_clustering="false"`, a heatmap layer is added to the same `geojson-data-source` source:

- Active at zoom levels 0–9 only (`maxzoom: 9`).
- Opacity transitions from 1 at zoom 7 to 0 at zoom 9, creating a smooth handoff to the circle marker layer.
- Color ramp: transparent blue (low density) → red (high density).
- Radius interpolates from 2 px at zoom 0 to 20 px at zoom 9.

---

## Clustering

When `enable_clustering="true"`, the GeoJSON source is created with `cluster: true`, `clusterMaxZoom: 14`, and `clusterRadius: 50`. Two additional layers are added:

**Cluster bubbles** (`feautures-cluster`): Step-expression sizing and coloring:

| Point count | Color | Radius |
|---|---|---|
| < 100 | Blue (`#1390af`) | 20 px |
| 100–749 | Yellow (`#c5ba20`) | 30 px |
| ≥ 750 | Pink (`#bb3063`) | 40 px |

**Cluster count labels** (`features-cluster-count`): White abbreviated count text in Open Sans Bold 14 px.

Clicking a cluster calls `getClusterExpansionZoom` and zooms the map to that level, expanding the cluster.

---

## Map Navigation

`centerMapByFeature(feature)` navigates the map to a selected marker:

- Calls `flyTo({ center: coordinates, zoom, duration: 1000 })`.
- Zoom level: the greater of the current zoom and `9` — the map never zooms out when navigating to a marker.
- Any ongoing map animation is stopped first via `this.mapBoxGlJs.stop()`.

---

## Feature Measurement

`calculateFeatureMeasurement(feature)` returns a coordinate string for `Point` features in the format:

```
12.345678°N, 106.789012°E
```

Latitude and longitude are formatted to 6 decimal places with `N/S` and `E/W` directional suffixes.

---

## Style Change Handling

`onMapLoaded()` registers a `style.load` listener. Whenever the style changes, the listener calls `debounceUpdateMap()` to rebuild all sources and layers on the new style.

---

Generated by [Claude Sonnet 4.6](https://www.anthropic.com/) on 2026-04-17.
