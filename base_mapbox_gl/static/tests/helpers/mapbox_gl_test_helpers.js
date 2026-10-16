// base_mapbox_gl/static/tests/helpers/mapbox_gl_test_helpers.js
//
// Shared fakes for the one boundary that actually matters when testing any
// component built on top of base_mapbox_gl (directly, via BaseMapboxGlRenderer,
// or via the withMapboxGl() mixin): the external Mapbox GL JS library.
// Everything else (settings RPC, map bootstrap in mapbox_gl_core.js) runs
// unmodified — real production code, not a bypass — because loadAssets()
// treats a pre-existing window.mapboxgl as "already loaded" and skips both
// the CSS/JS script-injection path entirely.
//
// This file is deliberately generic: it has no opinion on which prototype
// checkInternetConnection() lives on (BaseMapboxGlComponent for a renderer
// that extends it directly, or the consuming class itself for one that
// applies withMapboxGl() as a mixin), and no opinion on whether a given
// view needs native fetch() blocked. Each consuming module composes its
// own mockMapboxGlApi() from the pieces here — see
// web_view_mapbox_gl_geolocate and web_view_list_with_mapbox_gl for the
// two different compositions.

import { onRpc, patchWithCleanup } from '@web/../tests/web_test_helpers';

/**
 * Minimal generic pub/sub shared by on/once/off. Mapbox GL JS overloads
 * these with an optional middle `layerId` argument
 * (`map.on('click', layerId, cb)` vs `map.on('mousemove', cb)`) — the two
 * forms are told apart by checking whether the 2nd argument is a function.
 */
class FakeEventTarget {
    constructor() {
        this._listeners = new Map();
    }
    _key(type, layerId) {
        return layerId ? `${type}:${layerId}` : type;
    }
    _resolveArgs(type, layerIdOrCb, cb) {
        return typeof layerIdOrCb === 'function' ? [type, undefined, layerIdOrCb] : [type, layerIdOrCb, cb];
    }
    on(type, layerIdOrCb, cb) {
        const [t, layerId, handler] = this._resolveArgs(type, layerIdOrCb, cb);
        const key = this._key(t, layerId);
        if (!this._listeners.has(key)) this._listeners.set(key, new Set());
        this._listeners.get(key).add(handler);
        return this;
    }
    off(type, layerIdOrCb, cb) {
        const [t, layerId, handler] = this._resolveArgs(type, layerIdOrCb, cb);
        this._listeners.get(this._key(t, layerId))?.delete(handler);
        return this;
    }
    once(type, layerIdOrCb, cb) {
        const [t, layerId, handler] = this._resolveArgs(type, layerIdOrCb, cb);
        const wrapped = (...args) => {
            this.off(t, layerId, wrapped);
            handler(...args);
        };
        this.on(t, layerId, wrapped);
        return this;
    }
    _fire(type, payload) {
        for (const handler of this._listeners.get(this._key(type)) || []) {
            handler(payload);
        }
    }
}

/** Fake `mapboxgl.GeoJSONSource` — only what the renderers actually call. */
class FakeGeoJsonSource {
    constructor(config) {
        this._config = config;
        this._data = config.data;
    }
    setData(data) {
        this._data = data;
    }
    getData() {
        return this._data;
    }
    getClusterLeaves(clusterId, limit, offset, cb) {
        cb(null, []);
    }
    getClusterExpansionZoom(clusterId, cb) {
        cb(null, 10);
    }
}

/** Trivial IControl stand-in for ScaleControl/NavigationControl/FullscreenControl. */
export class FakeMapControl {
    onAdd() {
        return document.createElement('div');
    }
    onRemove() {}
}

/** Fake `mapboxgl.LngLatBounds` — only what fitBounds()/extend()/isEmpty() callers need. */
export class FakeLngLatBounds {
    constructor(sw, ne) {
        this._points = [];
        if (sw) this.extend(sw);
        if (ne) this.extend(ne);
    }
    extend(coord) {
        this._points.push(coord);
        return this;
    }
    isEmpty() {
        return this._points.length === 0;
    }
}

/** Fake `mapboxgl.Popup` — enough for addRouteMarkers()/_showFeaturePopup()/onClickViewOnMap(). */
export class FakeMapboxPopup {
    constructor(options) {
        this.options = options;
    }
    setLngLat(lngLat) {
        this._lngLat = lngLat;
        return this;
    }
    setHTML(html) {
        this._html = html;
        return this;
    }
    addTo(map) {
        this._map = map;
        return this;
    }
    getElement() {
        if (!this._el) this._el = document.createElement('div');
        return this._el;
    }
    remove() {
        this._map = null;
    }
}

/** Fake `mapboxgl.Marker` — enough for addRouteMarkers()/onClickViewOnMap(). */
export class FakeMapboxMarker {
    constructor(options = {}) {
        this.options = options;
        this._popup = null;
    }
    setLngLat(lngLat) {
        this._lngLat = lngLat;
        return this;
    }
    getLngLat() {
        const [lng, lat] = this._lngLat;
        return { lng, lat };
    }
    setPopup(popup) {
        this._popup = popup;
        return this;
    }
    getPopup() {
        return this._popup;
    }
    addTo(map) {
        this._map = map;
        return this;
    }
    togglePopup() {}
    remove() {
        this._map = null;
    }
}

/**
 * Fake `mapboxgl.Map`. Fires 'load' on the next microtask so that
 * onMapReady()'s `map.once('load', resolve)` — registered synchronously
 * right after the map is constructed — is always in place before it fires.
 */
export class FakeMapboxMap extends FakeEventTarget {
    constructor(options = {}) {
        super();
        this.options = options;
        this._sources = {};
        this._layers = {};
        this._controls = [];
        this._interactions = {};
        this._pitch = 0;
        this._zoom = options.zoom ?? 0;
        this._center = options.center ?? [0, 0];
        // Real DOM elements, not plain objects: withShiftClickSelection and
        // withBoxZoomSelection register real addEventListener()s on these
        // during onMapLoaded(), and some renderers assign `.style.cursor`
        // on the canvas while hovering features.
        this._canvas = document.createElement('canvas');
        this._canvasContainer = document.createElement('div');
        this.dragPan = { enable() {}, disable() {} };
        Promise.resolve().then(() => this._fire('load'));
    }
    addSource(id, config) {
        this._sources[id] = new FakeGeoJsonSource(config);
    }
    getSource(id) {
        return this._sources[id];
    }
    removeSource(id) {
        delete this._sources[id];
    }
    addLayer(layer) {
        this._layers[layer.id] = layer;
    }
    getLayer(id) {
        return this._layers[id];
    }
    removeLayer(id) {
        delete this._layers[id];
    }
    addControl(control) {
        this._controls.push(control);
        control.onAdd?.(this);
    }
    removeControl(control) {
        control.onRemove?.();
        this._controls = this._controls.filter((c) => c !== control);
    }
    addInteraction(id, config) {
        this._interactions[id] = config;
    }
    removeInteraction(id) {
        delete this._interactions[id];
    }
    getStyle() {
        return {
            sources: Object.fromEntries(Object.entries(this._sources).map(([id, s]) => [id, s._config])),
            layers: Object.values(this._layers),
        };
    }
    setStyle() {}
    setConfigProperty() {}
    setProjection() {}
    getProjection() {
        return { name: 'mercator' };
    }
    setFog() {}
    setLanguage() {}
    getPitch() {
        return this._pitch;
    }
    getZoom() {
        return this._zoom;
    }
    setZoom(zoom) {
        this._zoom = zoom;
    }
    getCenter() {
        return this._center;
    }
    getCanvas() {
        return this._canvas;
    }
    getCanvasContainer() {
        return this._canvasContainer;
    }
    getContainer() {
        return this._canvasContainer;
    }
    getBounds() {
        const [lng, lat] = this._center;
        return {
            getWest: () => lng - 1,
            getEast: () => lng + 1,
            getSouth: () => lat - 1,
            getNorth: () => lat + 1,
        };
    }
    unproject() {
        return { lng: this._center[0], lat: this._center[1] };
    }
    queryRenderedFeatures() {
        return [];
    }
    querySourceFeatures() {
        return [];
    }
    setFeatureState() {}
    resize() {}
    fitBounds() {}
    flyTo() {}
    easeTo() {}
    stop() {}
    remove() {
        this._listeners.clear();
    }
}

/**
 * Mocks the /web/mapbox_gl/settings RPC and pre-seeds window.mapboxgl so
 * loadAssets() takes its "already loaded" fast path, skipping the real
 * CSS/JS script-injection entirely. This is the one piece every consumer
 * needs unconditionally; compose it with mockCheckInternetConnection()
 * and, where relevant, blockNativeFetch() in a module-local
 * mockMapboxGlApi() wrapper.
 */
export function mockMapboxGlSettings() {
    onRpc('/web/mapbox_gl/settings', () => ({
        access_token: 'pk.test_token_0123456789',
        style: 'mapbox://styles/mapbox/streets-v12',
        projection: 'globe',
        theme: 'default',
        light_preset: 'day',
        language: 'en',
    }));

    patchWithCleanup(window, {
        mapboxgl: {
            Map: FakeMapboxMap,
            Popup: FakeMapboxPopup,
            Marker: FakeMapboxMarker,
            LngLatBounds: FakeLngLatBounds,
            ScaleControl: FakeMapControl,
            NavigationControl: FakeMapControl,
            FullscreenControl: FakeMapControl,
            accessToken: null,
        },
    });
}

/**
 * Patches checkInternetConnection() on the given prototype to skip its real
 * "verify" branch, which otherwise makes a real
 * `fetch('https://api.mapbox.com', ...)` HEAD request that has no place in
 * a unit test. The target prototype differs by how the consuming class
 * gets its Mapbox capabilities:
 * - A renderer extending BaseMapboxGlComponent: pass BaseMapboxGlComponent.prototype.
 * - A renderer applying the withMapboxGl() mixin directly onto another base
 *   class (e.g. ListRenderer): pass that renderer's own prototype — the
 *   mixin's methods live there, not on BaseMapboxGlComponent.
 */
export function mockCheckInternetConnection(Prototype) {
    patchWithCleanup(Prototype, {
        checkInternetConnection: async () => true,
    });
}

/**
 * Blocks native fetch() so a test that reaches a mounted, ready map never
 * fires a real external HTTP request (e.g. the Mapbox Directions/
 * Optimization API, called directly via fetch() rather than through Odoo's
 * rpc service). Opt-in: only views that call fetch() themselves need this.
 */
export function blockNativeFetch() {
    patchWithCleanup(window, {
        fetch: () => Promise.reject(new Error('Network disabled in tests')),
    });
}

/**
 * Polls a predicate until it's true. Map rendering in these components
 * typically sits behind a real debounce, so there's nothing for
 * hoot-dom's waitFor() to poll on the DOM — wait on the component's own
 * state instead of guessing a fixed number of timers.
 */
export async function waitUntil(predicate, { timeout = 3000, interval = 20 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) {
            throw new Error('waitUntil: condition not met within timeout');
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
}
