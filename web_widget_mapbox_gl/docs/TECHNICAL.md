# web_widget_mapbox_gl — Technical Reference

This document describes how to add the `mapbox_gl_draw_geojson` field widget to a form view, how to configure its options, and how the save flow, drawing modes, and readonly display work.

---

## Widget Registration

The widget is registered as:

```js
registry.category('fields').add('mapbox_gl_draw_geojson', mapboxGlDrawingField);
```

It supports the `json` field type only. The underlying component is `MapboxGlDrawingField`, which extends `BaseMapboxGlComponent` from `base_mapbox_gl`.

---

## Using the Widget in a Form View

Add the `widget` attribute to any `json` field in a form view:

```xml
<field name="geojson_field" widget="mapbox_gl_draw_geojson"/>
```

### Widget Options

Options are passed via the `options` attribute as a JSON object:

```xml
<field name="geojson_field"
       widget="mapbox_gl_draw_geojson"
       options="{
           'field_area': 'area',
           'default_center': [106.8456, -6.2088],
           'map_style_url': 'mapbox://styles/mapbox/standard-satellite',
           'map_projection': 'mercator'
       }"/>
```

| Option | Type | Description |
|---|---|---|
| `field_area` | string | Field name on the same record where total polygon area (m²) is written on save. The field must be declared in the view. |
| `default_center` | `[lng, lat]` | Initial map center when no geometry is loaded yet. Must be a two-element numeric array. |
| `map_style_url` | string | Mapbox style URL for this widget instance. Must start with `mapbox://`. Overrides the global setting. |
| `map_projection` | string | Map projection for this widget instance (e.g. `'mercator'`, `'globe'`). Overrides the global setting. |

All options are validated at component setup time. An invalid value raises an error in the browser console.

---

## Assets Loaded

The widget extends the base asset loading from `base_mapbox_gl` by also loading:

- `https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v{MAPBOX_DRAW_VERSION}/mapbox-gl-draw.js` — Mapbox GL Draw library (`window.MapboxDraw`)
- `https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v{MAPBOX_DRAW_VERSION}/mapbox-gl-draw.css` — Draw toolbar styles
- `https://unpkg.com/@turf/turf@{TURF_CONFIG.VERSION}/turf.min.js` — Turf.js (`window.turf`)

All three are loaded from their official CDNs at the pinned versions declared in `MAPBOX_CONFIG`/`TURF_CONFIG` (`base_mapbox_gl/utils/utils.js`). The map will not initialize until all assets are confirmed present (`window.mapboxgl`, `window.MapboxDraw`, and `window.turf` must all exist).

---

## Save Flow

Changes drawn on the map are **not saved automatically**. The user must click the **Save** button in the draw toolbar.

The flow is:

1. User draws or edits features → `handleDrawChange()` fires on every `draw.create`, `draw.delete`, `draw.update`, or `draw.polygon_cut` event.
2. `handleDrawChange()` calls `integratedControls.highlightSaveButton(true)` — the Save button gets a flashing highlight and the map container gets the `has-unsaved-changes` CSS class.
3. User clicks the Save button → `updateFeatures()` is called.
4. `updateFeatures()` calls `this.mapboxDraw.getAll()` to collect all features, then `window.turf.area(allFeatures)` to calculate total area in m².
5. `updateFeatures()` calls `props.saveFeatures(allFeatures, totalArea)`.
6. `MapboxGlDrawingField.handleSave()` receives the features and area, then calls `this.props.record.update({ [fieldName]: features, [areaField]: totalArea })` to write both values to the Odoo record.

The record update does **not** trigger an immediate server save — it updates the form's dirty state, and the record is persisted when the form is saved normally.

---

## Draw Modes

`MapboxGlDrawing` initializes `MapboxDraw` with three custom modes merged alongside the default MapboxDraw modes:

### `draw_circle` (Circle Mode)

Activated from the circle button in the toolbar. Click once to set the center, then click again to set the radius. The circle is stored as a 64-vertex polygon using `turf.circle(center, radius, { steps: 64, units: 'kilometers' })`. Maximum radius is 10,000 km.

### `polygon_cut_mode` (Polygon Cut Mode)

Activated from the cut button in the toolbar. Draw a cutting polygon over existing polygons to split them into pieces. Uses `turf.difference` to compute the split. Existing polygons that do not overlap the cutting shape are left unchanged.

### `customModeCombineAndUncombine` (Combine / Uncombine)

Patches the default MapboxDraw `simple_select.onCombineFeatures` handler. Select two or more overlapping polygons and click **Combine** to merge them using `turf.union`. If the union fails, falls back to a `MultiPolygon`. Select a `MultiPolygon` and click **Uncombine** to split it back into individual polygons.

> Combine requires the selected polygons to intersect. A warning notification is shown if they do not.

---

## Toolbar Buttons

The `IntegratedDrawControls` class injects additional buttons directly into the MapboxDraw toolbar DOM after the draw control is rendered:

| Button | Icon | Action |
|---|---|---|
| Circle | `fa-circle-o` | Activates `draw_circle` mode |
| Cut | `fa-scissors` | Activates `polygon_cut_mode` |
| Upload | `fa-upload` | Opens the GeoJSON file import dialog |
| Download | `fa-download` | Exports all drawn features as a `.geojson` file |
| Save | `fa-save` | Calls `updateFeatures()` and writes to the record |

The Save button flashes (`animation-flash-highlight` CSS class) and the map container gains `has-unsaved-changes` whenever unsaved drawing changes exist.

---

## Readonly Display

When the form is in view (non-edit) mode, `props.readonly` is `true`. In this case, `MapboxGlDrawing` skips the `MapboxDraw` initialization entirely and instead renders the GeoJSON as three static Mapbox layers using a fixed red color (`#fb2828`):

| Layer | Type | Geometry filter |
|---|---|---|
| `readonly-drawing-fill-layer` | `fill` | Polygon, MultiPolygon |
| `readonly-drawing-line-layer` | `line` | Polygon, MultiPolygon, LineString, MultiLineString |
| `readonly-drawing-point-layer` | `circle` | Point, MultiPoint |

These layers are removed and recreated whenever `props.dataGeoJson` changes.

---

## GeoJSON Import

Clicking the Upload button opens an `UploadGeoJsonFileDialog`. Accepted files are validated with `validateGeoJson()` (from `base_mapbox_gl`) and the maximum file size is 5 MB. On confirmation, the imported features replace all current draw features and `highlightSaveButton(true)` is called — the user must still click Save to write the data to the record.

---

Generated by [Claude Sonnet 4.6](https://www.anthropic.com/) on 2026-04-17.
