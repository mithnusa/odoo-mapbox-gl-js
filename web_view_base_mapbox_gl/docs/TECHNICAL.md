# web_view_base_mapbox_gl — Technical Reference

This document describes how to build a custom Mapbox map view on top of `web_view_base_mapbox_gl`. It covers the view registration pattern, the XML view definition, each MVC layer and how to extend it, the selection mixins, and the utility exports.

---

## How a Map View Works

When Odoo renders a `mapbox_gl` view, it runs the following sequence:

1. `BaseMapboxGlArchParser` parses the XML `<mapbox_gl>` node and returns an `archInfo` object.
2. `BaseMapboxGlModel` (a `RelationalModel`) loads the records.
3. `BaseMapboxGlController` orchestrates the layout, pager, search, action menu, and selection state.
4. `BaseMapboxGlRenderer` (a `BaseMapboxGlComponent`) initializes the Mapbox map and renders features.

All four classes are exported so consuming modules can extend one or more of them and register the result as a new view type.

---

## Registering a Custom View

The view registry entry that this module adds is:

```js
registry.category('views').add('mapbox_gl', baseMapboxGlView);
```

A consuming module registers its own view type by importing the base components, overriding what it needs, and calling `add` with a new `js_class` name:

```js
import { registry } from '@web/core/registry';
import { baseMapboxGlView } from '@web_view_base_mapbox_gl/map_base/map_base_view';
import { MyArchParser } from './my_arch_parser';
import { MyRenderer } from './my_renderer';

export const myMapView = {
    ...baseMapboxGlView,
    ArchParser: MyArchParser,
    Renderer: MyRenderer,
};

registry.category('views').add('my_map_view', myMapView);
```

Then in XML, use `js_class="my_map_view"` on the `<mapbox_gl>` node.

---

## XML View Definition

The `<mapbox_gl>` root node is validated on the Python side. `js_class` is required. Fields referenced in attribute values must be declared as `<field>` children.

```xml
<mapbox_gl js_class="my_map_view"
           title_field="name"
           description_field="street"
           color_field="color"
           map_style_url="mapbox://styles/mapbox/standard-satellite"
           map_projection="mercator"
           center="106.8456,-6.2088"
           limit="200"
           default_order="name asc"
           default_group_by="partner_id">
    <field name="name"/>
    <field name="street"/>
    <field name="color"/>
    <field name="partner_lat"/>
    <field name="partner_long"/>
</mapbox_gl>
```

### Supported Attributes

| Attribute | Required | Description |
|---|---|---|
| `js_class` | Yes | Matches the key used in `registry.category('views').add(key, ...)` |
| `title_field` | No | Field shown as the record title in the sidebar and popup |
| `description_field` | No | Field shown as the subtitle in the sidebar and popup |
| `color_field` | No | Field used to color-code features on the map |
| `map_style_url` | No | Mapbox style URL for this view instance; overrides global settings |
| `map_projection` | No | Map projection for this view instance; overrides global settings |
| `center` | No | Initial map center as `"longitude,latitude"` |
| `limit` | No | Max records per page (default: 100) |
| `count_limit` | No | Max total record count before showing a count estimate |
| `groups_limit` | No | Max number of groups to load at once |
| `default_order` | No | Default sort order (e.g., `"name asc"`) |
| `default_group_by` | No | Default group-by field name |
| `on_create` | No | Custom action name triggered on record creation |

---

## Extending the Arch Parser

`BaseMapboxGlArchParser` parses the `<mapbox_gl>` node. Override `parseMapboxGlAttrs()` to extract additional custom attributes:

```js
import { BaseMapboxGlArchParser } from '@web_view_base_mapbox_gl/map_base/map_base_arch_parser';

export class MyArchParser extends BaseMapboxGlArchParser {
    parseMapboxGlAttrs(xmlDoc, node, attrs) {
        super.parseMapboxGlAttrs(xmlDoc, node, attrs);
        attrs.latField = xmlDoc.getAttribute('lat_field');
        attrs.lngField = xmlDoc.getAttribute('lng_field');
    }
}
```

The returned `attrs` object is merged into `archInfo` and passed to the controller and renderer as `props.archInfo`.

---

## Extending the Model

`BaseMapboxGlModel` extends Odoo's `RelationalModel`. It adds `viewConfig` (from `params.viewConfig`) to the model instance so renderers can access view-level configuration.

Three inner classes are also exported for more granular extension:

| Class | Extends | Purpose |
|---|---|---|
| `BaseMapboxGlModel` | `RelationalModel` | Root model; holds `viewConfig` |
| `BaseMapboxGlGroup` | `Group` | Group with `groupColor`, `markerColor`, and `dataView` getter |
| `BaseMapboxGlDynamicGroupList` | `DynamicGroupList` | Enforces single group-by at a time |
| `BaseMapboxRecord` | `Record` | Record with `dataView` getter (calls `parseRecord`) |

To override any of them:

```js
import { BaseMapboxGlModel, BaseMapboxGlGroup } from '@web_view_base_mapbox_gl/map_base/map_base_model';

class MyGroup extends BaseMapboxGlGroup {
    get dataView() {
        const base = super.dataView;
        return { ...base, customField: this.records[0]?.data.my_field };
    }
}

export class MyModel extends BaseMapboxGlModel {}
MyModel.Group = MyGroup;
```

---

## Extending the Controller

`BaseMapboxGlController` handles the layout, pager, search, selection, and action menus. The most commonly overridden methods are:

| Method | When to override |
|---|---|
| `onRecordSaved(record)` | Perform actions after a record is saved from the map view |
| `onWillSaveRecord(record)` | Validate or modify a record before it is saved; return `false` to abort |
| `onUpdatedPager()` | React to page changes (e.g., re-fit map bounds) |
| `afterExecuteActionButton(clickParams)` | Perform cleanup after an action button fires |
| `getStaticActionMenuItems()` | Add or remove entries from the Action menu |
| `viewMapConfig` (getter) | Override to pass additional keys to the renderer via `viewAttrs` |

The `rendererProps` getter assembles everything passed to the renderer. Override it to inject additional props:

```js
get rendererProps() {
    return {
        ...super.rendererProps,
        latField: this.archInfo.latField,
        lngField: this.archInfo.lngField,
    };
}
```

---

## Extending the Renderer

`BaseMapboxGlRenderer` extends `BaseMapboxGlComponent` (from `base_mapbox_gl`). The primary hook to override is `onMapLoaded()`, which fires once the map is ready:

```js
import { BaseMapboxGlRenderer } from '@web_view_base_mapbox_gl/map_base/map_base_renderer';

export class MyRenderer extends BaseMapboxGlRenderer {
    onMapLoaded() {
        super.onMapLoaded(); // adds controls, style switcher
        this._addMyLayers();
    }

    _addMyLayers() {
        this.mapBoxGlJs.addSource('my-source', { type: 'geojson', data: this._buildGeoJson() });
        this.mapBoxGlJs.addLayer({ id: 'my-layer', type: 'circle', source: 'my-source' });
    }
}
```

Other useful overrides from the renderer:

| Method / Getter | Purpose |
|---|---|
| `onMapLoaded()` | Primary hook — called once the map finishes loading |
| `_onStyleChangeComplete()` | Re-apply feature state after a style change |
| `_triggerDataReload()` | Re-render data when source restoration fails after style change |
| `canSelectRecord` (getter) | Return `false` to disable selection for certain states |
| `toggleRecordSelection(record)` | Toggle Odoo selection state on a record |
| `getRecordById(resId)` | Look up a record by its `resId` |

---

## Selection Mixins

Two mixin functions are exported to add multi-selection to a renderer. Apply them by wrapping the renderer class:

### `withBoxZoomSelection(Base)`

Hold **Shift** and drag a rectangle on the map canvas to select all markers inside it.

```js
import { withBoxZoomSelection } from '@web_view_base_mapbox_gl/map_base/box_zoom_selection_mixin';

export class MyRenderer extends withBoxZoomSelection(BaseMapboxGlRenderer) { ... }
```

The mixin calls `getSelectableLayers()` to know which Mapbox layer IDs to query. Override this method to change which layer the selection targets:

```js
getSelectableLayers() {
    return ['my-circle-layer'];
}
```

The default returns `[LAYER_CONFIG.GEOJSON_CIRCLE]`.

### `withShiftClickSelection(Base)`

Hold **Shift** and click a marker to toggle its selection without opening the record.

```js
import { withShiftClickSelection } from '@web_view_base_mapbox_gl/map_base/shift_click_selection_mixin';

export class MyRenderer extends withShiftClickSelection(BaseMapboxGlRenderer) { ... }
```

Both mixins can be stacked:

```js
export class MyRenderer extends withShiftClickSelection(withBoxZoomSelection(BaseMapboxGlRenderer)) { ... }
```

Requirements on the base class for both mixins:
- `this.mapBoxGlJs` — the live Mapbox GL JS map instance
- `this.canSelectRecord` — getter returning `true` when selection is allowed
- `this.toggleRecordSelection(record)` — toggles Odoo record selection
- `this.getRecordById(resId)` — returns a record by its `resId`
- `onMapLoaded()` and `cleanUp()` super chain intact

---

## Utility Exports

From `@web_view_base_mapbox_gl/map_base/utils`:

| Export | Description |
|---|---|
| `LAYER_CONFIG` | Layer ID constants (`GEOJSON_FILL`, `GEOJSON_CIRCLE`, `GEOJSON_STROKE`, and their hovered/selected variants) |
| `SOURCE_CONFIG` | Source ID constants (`GEOJSON_SOURCE: 'geojson-data-source'`) |
| `FEATURE_STYLES` | Style values for circle, polygon, and line features in default/hover/selected states |
| `MEASUREMENT_CONFIG` | Constants for measurement calculations (precision, unit system names) |
| `calculateFeatureCentroid(feature)` | Returns `[lng, lat]` center of any GeoJSON geometry type |
| `calculateFeaturesBounds(features)` | Returns a `[[minLng, minLat], [maxLng, maxLat]]` bounding box |
| `extractCoordinatesFromGeometry(geometry, callback)` | Iterates every coordinate pair in a geometry and calls `callback(lng, lat)` |
| `generateRandomColor()` | Returns a random hex color |
| `parseRecord(record, viewConfig, groupMode)` | Extracts `{ geolocation, other }` from a record using the view config |
| `getRecordDataView(record)` | Returns the `dataView` of a record or group |
| `sortedKeyStringify(obj)` | Deterministic `JSON.stringify` with sorted keys |

---

## Python: View Type Registration

`ir.ui.view` is extended to register `mapbox_gl` as a valid view type and to validate the arch. The validator enforces:

- `js_class` attribute is required
- If `title_field` is set, it must be declared as a `<field>` child
- If `description_field` is set, it must be declared as a `<field>` child

The `ir.actions` model is also extended to include `mapbox_gl` in the list of supported view types for window actions.

---

Generated by [Claude Sonnet 4.6](https://www.anthropic.com/) on 2026-04-17.
