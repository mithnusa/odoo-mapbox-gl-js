# base_mapbox_gl — Technical Reference

This document describes how to consume `base_mapbox_gl` from another module. It covers the two JavaScript integration paths, the settings endpoint, the shared properties and lifecycle hooks, and the utility functions available for import.

---

## Settings Endpoint

The module exposes one JSON-RPC endpoint that every map component calls during startup:

```
POST /web/mapbox_gl/settings
```

Returns a JSON object with the values configured in **Settings → General Settings → Integrations → Mapbox GL**:

| Field | Type | Source (`ir.config_parameter` key) |
|---|---|---|
| `access_token` | string | `base_mapbox_gl.access_token` |
| `style` | string | `base_mapbox_gl.style_url` (takes precedence) or `base_mapbox_gl.style` |
| `light_preset` | string | `base_mapbox_gl.lighting` — only when no custom style URL is set |
| `theme` | string | `base_mapbox_gl.theme` — only when no custom style URL is set |
| `projection` | string | `base_mapbox_gl.projection` |
| `language` | string | `base_mapbox_gl.language` |

The endpoint requires an authenticated user (`auth='user'`). The settings are fetched once and cached for the lifetime of the component.

---

## JavaScript Integration

The module provides two ways to add Mapbox GL JS to an OWL component. Choose one based on your inheritance chain.

### Option 1 — Extend `BaseMapboxGlComponent`

Use this when your component does not already extend another base class.

```js
import { BaseMapboxGlComponent } from '@base_mapbox_gl/utils/base_mapbox_gl';

export class MyMapComponent extends BaseMapboxGlComponent {
    get containerElement() {
        return this.mapContainerRef; // { el: HTMLElement }
    }

    onMapLoaded() {
        super.onMapLoaded(); // adds navigation, scale, fullscreen, style switcher
        // your initialization here — this.mapBoxGlJs is ready
    }
}
MyMapComponent.template = 'my_module.MyMapTemplate';
```

### Option 2 — Use the `withMapboxGl` Mixin

Use this when your component already extends another class (e.g., `ListRenderer`, `FormRenderer`).

```js
import { withMapboxGl } from '@base_mapbox_gl/utils/base_mapbox_gl_mixin';

export class MyRenderer extends withMapboxGl(ListRenderer) {
    get containerElement() {
        return this.mapContainerRef;
    }

    onMapLoaded() {
        super.onMapLoaded();
        // your initialization here
    }
}
```

Both options apply the same shared core via `applyMapboxGlCore()` internally. The only difference is inheritance mechanics.

---

## Required: `containerElement`

Both `BaseMapboxGlComponent` and `withMapboxGl` require the consuming class to implement a `containerElement` getter that returns an object with an `el` property pointing to the map container DOM element. This is typically an OWL `useRef`.

```js
setup() {
    super.setup();
    this.mapContainerRef = useRef('mapContainer');
}

get containerElement() {
    return this.mapContainerRef;
}
```

The container element must have an `id` attribute — `mapOptions()` reads it to pass to `new mapboxgl.Map({ container: id })`.

---

## Lifecycle Hook: `onMapLoaded()`

Called once the map `load` event fires and the map is ready for interaction. This is the correct place to add sources, layers, or markers.

The default implementation in `mapbox_gl_core.js` calls `addMapControl()`, which adds navigation, scale, fullscreen controls, and renders the style switcher. Call `super.onMapLoaded()` to keep these controls, or omit it to take full control.

```js
onMapLoaded() {
    super.onMapLoaded(); // keep built-in controls
    this.mapBoxGlJs.addSource('my-source', { type: 'geojson', data: ... });
    this.mapBoxGlJs.addLayer({ id: 'my-layer', ... });
}
```

---

## Overridable Properties

These are configurable getters defined in `mapbox_gl_core.js`. Override them by assigning to the property in your class.

| Property | Type | Default | Description |
|---|---|---|---|
| `defaultMapCenter` | `[lng, lat]` | `[0, 0]` | Initial map center |
| `defaultMapStyle` | `string \| null` | `null` (uses settings) | Override the style from settings for this instance |
| `defaultMapProjection` | `string \| null` | `null` (uses settings) | Override the projection for this instance |
| `defaultStyleConfig` | `{ lightPreset, theme }` | `{ lightPreset: 'day', theme: 'default' }` | Style config applied at init |
| `enableStyleSwitcher` | `boolean` | `true` | Whether to render the style switcher control |
| `mapControlPosition` | `{ navigation, fullscreen, scale }` | all `'bottom-right'`/`'bottom-left'` | Positions for built-in controls |
| `asset_mapbox_js_url` | `string` | Mapbox CDN URL (pinned to `MAPBOX_CONFIG.VERSION`) | Override to load Mapbox GL JS from a custom URL |
| `asset_mapbox_css_url` | `string` | Mapbox CDN URL (pinned to `MAPBOX_CONFIG.VERSION`) | Override to load Mapbox GL CSS from a custom URL |

Example — set a per-instance default style and disable the style switcher:

```js
setup() {
    super.setup();
    this.defaultMapStyle = 'mapbox://styles/mapbox/standard-satellite';
    this.enableStyleSwitcher = false;
    this.defaultMapCenter = [106.8456, -6.2088]; // Jakarta
}
```

---

## Advanced Hooks

Two protected methods exist specifically for subclasses to override:

**`_onStyleChangeComplete()`** — called after `setMapStylePreserveData()` finishes restoring custom sources and layers following a style change. Override to re-apply any post-style state (e.g., re-highlight selected features).

**`_triggerDataReload()`** — called if source/layer restoration fails after a style change. Override to re-render your data from scratch as a fallback.

---

## Accessing the Map Instance

The live `mapboxgl.Map` instance is available as `this.mapBoxGlJs`. It is `null` before `onMapLoaded()` fires and after `cleanUp()` is called. Use `this.isMapReady()` to guard access:

```js
if (this.isMapReady()) {
    this.mapBoxGlJs.flyTo({ center: [lng, lat], zoom: 14 });
}
```

---

## Shared Utility Imports

The following are exported from `@base_mapbox_gl/utils/utils` and can be imported by any module in the suite:

| Export | Description |
|---|---|
| `MAPBOX_STYLES` | Object with Mapbox style URL constants (`STANDARD`, `STREETS`, `SATELLITE_STREETS`, etc.) and the OSM inline style object |
| `MAPBOX_CONFIG` | Runtime configuration constants (default zoom, style switcher breakpoint, connection timeout, etc.) |
| `MAPBOX_LANGUAGES` | Array of `{ code, title }` objects for all 35+ supported map label languages |
| `DEFAULT_COLOR` | Default marker/feature color (`'#F06050'`) |
| `WIDGET_COLOR_PICKER_COLOR` | Array of 11 hex color values matching Odoo's color index (0–11) |
| `generateUUID4()` | Generates a unique ID using `crypto.randomUUID()` with a timestamp fallback |
| `normalizeColor(color)` | Converts any CSS color (hex, rgb, rgba, named) to uppercase hex |
| `darkenColor(color, amount, opacity)` | Darkens a color; returns hex or rgba |
| `lightenColor(color, amount, opacity)` | Lightens a color; returns hex or rgba |
| `hexToRgba(hex, alpha, defaultColor)` | Converts hex to `[r, g, b, a]` array |
| `validateGeoJson(geoJson, options)` | Validates GeoJSON structure; supports FeatureCollection, Feature, and all geometry types |
| `getHexColorPicker(index)` | Returns the hex color for an Odoo color index (0–11) |

Example:

```js
import { darkenColor, validateGeoJson, MAPBOX_STYLES } from '@base_mapbox_gl/utils/utils';

const strokeColor = darkenColor(featureColor, 50);
const isValid = validateGeoJson(geoJsonData, { validateGeometry: true });
const satelliteStyle = MAPBOX_STYLES.STANDARD_SATELLITE;
```

---

## `ir.config_parameter` Keys

For Python code that needs to read Mapbox settings directly:

| Key | Description |
|---|---|
| `base_mapbox_gl.access_token` | Mapbox public access token |
| `base_mapbox_gl.style_url` | Custom style URL (takes precedence over preset) |
| `base_mapbox_gl.style` | Preset style selection |
| `base_mapbox_gl.lighting` | Light preset (`dawn`, `day`, `dusk`, `night`) |
| `base_mapbox_gl.theme` | Map theme (`default`, `faded`, `monochrome`) |
| `base_mapbox_gl.projection` | Map projection (`globe`, `mercator`, etc.) |
| `base_mapbox_gl.language` | Map label language code |

```python
token = request.env['ir.config_parameter'].sudo().get_param('base_mapbox_gl.access_token')
```

---


Generated by [Claude Sonnet 4.6](https://www.anthropic.com/) on 2026-04-17.
