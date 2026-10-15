# web_view_mapbox_gl_draw — Technical Reference

This document describes how to define a `mapbox_gl_draw` view, how the automatic domain filtering works, how features are rendered and measured, and how the `SearchableJson` field type works.

---

## View Registration

The view is registered as:

```js
registry.category('views').add('mapbox_gl_draw', mapboxGlDrawView);
```

It uses `js_class="mapbox_gl_draw"` and extends `baseMapboxGlView` from `web_view_base_mapbox_gl`, replacing all four MVC components with `mapbox_gl_draw`-specific implementations.

---

## XML View Definition

```xml
<mapbox_gl js_class="mapbox_gl_draw"
           geojson_field="geojson"
           title_field="name"
           description_field="description"
           color_field="color"
           map_style_url="mapbox://styles/mapbox/standard-satellite"
           map_projection="mercator">
    <field name="name"/>
    <field name="geojson"/>
    <field name="color"/>
    <field name="description"/>
</mapbox_gl>
```

### Supported Attributes

| Attribute | Required | Description |
|---|---|---|
| `js_class` | Yes | Must be `"mapbox_gl_draw"` (or a value starting with `mapbox_gl_draw`) |
| `geojson_field` | Yes | The `json` field on the model that stores GeoJSON data |
| `title_field` | No | Field shown as the record title in the sidebar and popup |
| `description_field` | No | Field shown as the subtitle in the sidebar and popup |
| `color_field` | No | Field used to color-code features on the map |
| `map_style_url` | No | Mapbox style URL override for this view instance |
| `map_projection` | No | Map projection override for this view instance |

All standard `web_view_base_mapbox_gl` attributes (`limit`, `default_order`, `default_group_by`, `center`, etc.) are also supported.

---

## Python View Validation

`ir.ui.view` extends `_validate_tag_mapbox_gl` to enforce two mutual requirements:

- If `geojson_field` is set, `js_class` must start with `"mapbox_gl_draw"`.
- If `js_class` starts with `"mapbox_gl_draw"`, `geojson_field` must be set.
- The field named in `geojson_field` must be declared as a `<field>` child of the view node.

Violations raise a view validation error at module install time.

---

## Automatic Domain Filtering

`MapboxGlDrawModel` overrides `mapDomain` to automatically filter out records with no geometry. When the `geojson_field` is a `SearchableJson` field (i.e. it supports the `json_eq` operator), the following domain is applied automatically before every data load:

```python
[
    '|',
    (geojson_field, '!=', False),
    '!', (geojson_field, 'json_eq', {'type': 'FeatureCollection', 'features': []}),
]
```

This excludes records where the field is `NULL` or an empty `FeatureCollection`. If the field is a plain `json` field (not `SearchableJson`), only the `!= False` filter is applied.

---

## Controller

`MapboxGlDrawController` overrides `viewMapConfig` to validate the `geojson_field` and inject it into the config object passed to the renderer:

- Throws if `geoJsonField` is not found in the model's fields.
- Throws if the field type is not `"json"`.

---

## Rendering

`MapboxGlDrawRenderer` extends `BaseMapboxGlRenderer`. It requires Turf.js in addition to the base assets — `checkAssetsLoaded()` confirms `window.turf` is present before the map initializes.

### Layers

Nine Mapbox GL layers are added to the map, organized by geometry type and interaction state:

| Layer | Type | State |
|---|---|---|
| `GEOJSON_FILL` | `fill` | Normal |
| `GEOJSON_FILL_HOVER` | `fill` | Hovered |
| `GEOJSON_FILL_SELECTED` | `fill` | Selected |
| `GEOJSON_STROKE` | `line` | Normal |
| `GEOJSON_STROKE_HOVER` | `line` | Hovered |
| `GEOJSON_STROKE_SELECTED` | `line` | Selected |
| `GEOJSON_CIRCLE` | `circle` | Normal |
| `GEOJSON_CIRCLE_HOVER` | `circle` | Hovered |
| `GEOJSON_CIRCLE_SELECTED` | `circle` | Selected |

All nine layers share a single GeoJSON source (`geojson-data-source`).

### Color Expressions

Fill color is driven by a Mapbox data expression:

```js
['case', ['!=', ['get', colorPropertyName], null], ['get', colorPropertyName], defaultColor]
```

Stroke color is derived by calling `darkenColor(fillColor, 0.1)` — a 10% darkening of the fill — applied to the same expression.

### View Attribute Validation

`validateViewAttributes()` is called at map init time. It throws a runtime error if:

- `geojson_field` is missing from `archInfo`.
- The field is not present in the model's field definitions.

### Style Change Handling

`onMapLoaded()` registers a `style.load` listener in addition to calling `super.onMapLoaded()`. Whenever the style changes (e.g. via the style switcher), the listener calls `debounceUpdateMap()` to re-render all features on the new style.

---

## Feature Measurements

`calculateFeatureMeasurement(feature)` returns a measurement object based on the GeoJSON geometry type:

| Geometry | Measurement |
|---|---|
| `Point`, `MultiPoint` | Coordinate in `N/S E/W` format + point count |
| `LineString`, `MultiLineString` | Total length (Turf.js `length`) + point count |
| `Polygon`, `MultiPolygon` | Area (Turf.js `area`) + perimeter (Turf.js `length`) + point count |
| `GeometryCollection` | Area + perimeter of all constituent geometries combined |

### Measurement Formatting

| Function | Input | Output examples |
|---|---|---|
| `formatAreaMeasurement(m²)` | area in m² | `"1,234 m²"`, `"12.34 ha"`, `"1.23 km²"` |
| `formatLengthMeasurement(km)` | length in km | `"45 cm"`, `"12 m"`, `"3.45 km"` |
| `formatPointCount(n)` | integer | `"1 point"`, `"5 points"` |

`formatAreaMeasurement` thresholds (metric): below 10,000 m² → m²; 10,000–1,000,000 m² → ha; above 1,000,000 m² → km².

`formatLengthMeasurement` thresholds (metric): below 0.001 km → cm; 0.001–1 km → m; above 1 km → km.

Both functions also support imperial unit output (ft², ac, mi² / in, ft, yd, mi) via an optional `unitSystem` parameter.

---

## Map Navigation

`centerMapByFeature(feature)` navigates the map to a selected feature:

- **Point** geometry: `flyTo({ center, zoom: 15 })`.
- **All other geometries**: `fitBounds(bounds, { padding: 100, maxZoom: 15, duration: 1000 })`.

---

## SearchableJson Field

`SearchableJson` extends Odoo's standard `fields.Json`. It adds four custom domain operators that map to PostgreSQL JSONB operations:

| Operator | SQL | Description |
|---|---|---|
| `json_eq` | `field = '...'` | Exact JSON equality |
| `json_ne` | `field IS NULL OR field != '...'` | JSON inequality |
| `json_contains` | `field @> '...'::jsonb` | Field contains a sub-object |
| `json_not_contains` | `NOT (field @> '...'::jsonb)` | Field does not contain a sub-object |

### Domain Optimization

The operators are registered with Odoo's `@operator_optimization` system:

- `json_eq` / `json_ne` are rewritten to `in` / `not in` with `JsonValue`-wrapped values, enabling multiple conditions to be combined into a single SQL `IN` clause.
- `json_contains` / `json_not_contains` are rewritten to `in` / `not in` with `JsonContainsValue`-wrapped values, which `_condition_to_sql` detects and maps to the `@>` operator.

Both `JsonValue` and `JsonContainsValue` are hashable wrappers that use a stable, sorted-key JSON string for `__hash__` and `__eq__`, allowing them to be used in Odoo's `OrderedSet` collections.

### Usage in a Domain

```python
# Exact match
[('geojson', 'json_eq', {'type': 'FeatureCollection', 'features': []})]

# Contains check (PostgreSQL @> operator)
[('geojson', 'json_contains', {'type': 'FeatureCollection'})]
```

---

Generated by [Claude Sonnet 4.6](https://www.anthropic.com/) on 2026-04-17.
