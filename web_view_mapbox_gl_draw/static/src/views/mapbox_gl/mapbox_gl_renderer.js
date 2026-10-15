import { toRaw } from '@odoo/owl';
import { _t } from '@web/core/l10n/translation';
import { user } from '@web/core/user';
import { MAPBOX_CONFIG, TURF_CONFIG, darkenColor } from '@base_mapbox_gl/utils/utils';
import { BaseMapboxGlRenderer } from '@web_view_base_mapbox_gl/map_base/map_base_renderer';
import {
    calculateFeatureCentroid,
    calculateFeatureBounds,
    calculateFeaturesBounds,
    LAYER_CONFIG,
    SOURCE_CONFIG,
    FEATURE_STYLES,
    MEASUREMENT_CONFIG,
    LABEL_POINT_STYLE,
} from '@web_view_base_mapbox_gl/map_base/utils';

import { formatAreaMeasurement, formatLengthMeasurement, formatPointCount } from './utils';

// Drawing-specific stroke configuration
// Note: This overrides STROKE_CONFIG from @base_mapbox_gl/utils/utils with thinner strokes
// optimized for drawing/editing mode where finer control is needed
export const STROKE_CONFIG = {
    DEFAULT_WIDTH: 2, // Default stroke width in pixels (thinner than base config's 2.5)
    HOVER_WIDTH: 2.5, // Stroke width on hover in pixels (thinner than base config's 3)
    MIN_WIDTH: 1, // Minimum stroke width in pixels (thinner than base config's 1.5)
    MAX_WIDTH: 5, // Maximum stroke width in pixels (same as base config)
};

// Map focus and animation configuration
const MAP_FOCUS_CONFIG = {
    SINGLE_POINT_ZOOM: 15, // Zoom level for single point features
    FIT_BOUNDS_PADDING: 100, // Padding in pixels when fitting bounds
    FIT_BOUNDS_MAX_ZOOM: 15, // Maximum zoom level when fitting bounds
    ANIMATION_DURATION: 1000, // Animation duration in milliseconds
};

export class MapboxGlDrawRenderer extends BaseMapboxGlRenderer {
    get enableTerrainToggle() {
        return true;
    }

    /**
     * @override
     * @returns {Set <string>}
     */
    assetJS() {
        const assetJs = super.assetJS();
        assetJs.add(`https://unpkg.com/@turf/turf@${TURF_CONFIG.VERSION}/turf.min.js`);
        return assetJs;
    }

    /**
     * @override
     * @returns Boolean
     */
    checkAssetsLoaded() {
        const isAssetsLoaded = super.checkAssetsLoaded();
        return isAssetsLoaded && !!window.turf;
    }

    /**
     * Update the map with processed GeoJSON data
     * Creates or updates map layers and sources
     * @override
     * @param {Object} [options]
     * @param {boolean} [options.recenter=true] - Whether to refit the camera to the data
     */
    updateMap({ recenter = true } = {}) {
        if (!this.isMapboxReady()) return;

        this.addGeometryLayers();

        this.setupFeatureInteractions();

        if (recenter) {
            this.debounceCenterMap();
        }
    }

    /**
     * Add geometry layers (fill, stroke, circle) to the map
     * Creates layers with data-driven styling for feature colors
     * @override
     */
    addGeometryLayers() {
        if (!this.isMapboxReady()) return;

        super.addGeometryLayers();

        // Add all geometry layers
        this._addFillLayer();
        this._addFilterHoverFillLayer();
        this._addFilterSelectedFillLayer();
        this._addStrokeLayer();
        this._addFilterHoverStrokeLayer();
        this._addFilterSelectedStrokeLayer();
        this._addCircleLayer();
        this._addLabelCircleLayer();
        this._addLabelLayer();
        this._addFilterHoverCircleLayer();
        this._addFilterSelectedCircleLayer();
    }

    /**
     * Add or update the GeoJSON data source
     * @override
     */
    addGeoJsonSource() {
        const features = Array.from(this.geoJsonData.values());
        const source = this.mapBoxGlJs.getSource(SOURCE_CONFIG.GEOJSON_SOURCE);

        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: features,
            });
        } else {
            this.mapBoxGlJs.addSource(SOURCE_CONFIG.GEOJSON_SOURCE, {
                type: 'geojson',
                generateId: true, // Ensure Mapbox generates consistent IDs for feature-state
                data: {
                    type: 'FeatureCollection',
                    features: features,
                },
            });
        }
    }

    /**
     * Add polygon/multi-polygon fill layer with data-driven styling
     * @private
     */
    _addFillLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_FILL)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_FILL,
            type: 'fill',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: {
                'fill-color': this._createColorExpression('fillColor', MAPBOX_CONFIG.DEFAULT_COLORS.FILL),
                'fill-outline-color': this._createColorExpression('strokeColor', MAPBOX_CONFIG.DEFAULT_COLORS.STROKE),
                'fill-opacity': FEATURE_STYLES.POLYGON.FILL_OPACITY.DEFAULT,
            },
            slot: 'middle',
        });
    }

    /**
     * Add hover state fill layer for polygons
     * Shows highlighted fill when hovering over polygon features
     * @private
     */
    _addFilterHoverFillLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_FILL_HOVERED)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_FILL_HOVERED,
            type: 'fill',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: {
                'fill-color': FEATURE_STYLES.COLORS.HOVER.FILL,
                'fill-outline-color': FEATURE_STYLES.COLORS.HOVER.STROKE,
                // `feature-state` expressions are not supported in `filter` (only in
                // paint/layout), so hover visibility is driven by opacity instead of
                // re-filtering the layer on every mousemove.
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    FEATURE_STYLES.POLYGON.FILL_OPACITY.HOVER,
                    0,
                ],
            },
            slot: 'top',
        });
    }

    /**
     * Add selected state fill layer for polygons
     * Shows highlighted fill for selected polygon features
     * @private
     */
    _addFilterSelectedFillLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_FILL_SELECTED)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_FILL_SELECTED,
            type: 'fill',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
                ['has', 'resId'],
                ['!=', ['get', 'resId'], ''],
                ['has', 'isSelected'],
                ['==', ['get', 'isSelected'], true],
            ],
            paint: {
                'fill-color': FEATURE_STYLES.COLORS.SELECTED.FILL,
                'fill-outline-color': FEATURE_STYLES.COLORS.SELECTED.STROKE,
                'fill-opacity': FEATURE_STYLES.POLYGON.FILL_OPACITY.SELECTED,
            },
            slot: 'top',
        });
    }

    /**
     * Add stroke layer for all geometries with data-driven styling
     * @private
     */
    _addStrokeLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_STROKE)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_STROKE,
            type: 'line',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'in',
                ['geometry-type'],
                ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']],
            ],
            paint: {
                'line-color': this._createColorExpression('strokeColor', MAPBOX_CONFIG.DEFAULT_COLORS.STROKE),
                'line-width': STROKE_CONFIG.DEFAULT_WIDTH,
                'line-opacity': FEATURE_STYLES.LINE.OPACITY.DEFAULT,
            },
            slot: 'middle',
        });
    }

    /**
     * Add hover state stroke layer for lines and polygons
     * Shows highlighted stroke when hovering over line/polygon features
     * @private
     */
    _addFilterHoverStrokeLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_STROKE_HOVERED)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_STROKE_HOVERED,
            type: 'line',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'in',
                ['geometry-type'],
                ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']],
            ],
            paint: {
                'line-color': FEATURE_STYLES.COLORS.HOVER.STROKE,
                'line-width': STROKE_CONFIG.HOVER_WIDTH,
                'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
            },
            slot: 'top',
        });
    }

    /**
     * Add selected state stroke layer for lines and polygons
     * Shows highlighted stroke for selected line/polygon features
     * @private
     */
    _addFilterSelectedStrokeLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_STROKE_SELECTED)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_STROKE_SELECTED,
            type: 'line',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']]],
                ['has', 'resId'],
                ['!=', ['get', 'resId'], ''],
                ['has', 'isSelected'],
                ['==', ['get', 'isSelected'], true],
            ],
            paint: {
                'line-color': FEATURE_STYLES.COLORS.SELECTED.STROKE,
                'line-width': STROKE_CONFIG.HOVER_WIDTH,
            },
            slot: 'top',
        });
    }

    /**
     * Add circle layer for points with data-driven styling
     * @private
     */
    _addCircleLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_CIRCLE,
            type: 'circle',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['!', ['has', 'odoo_user_label']],
            ],
            paint: {
                'circle-radius': FEATURE_STYLES.CIRCLE.RADIUS.DEFAULT,
                'circle-color': this._createColorExpression('fillColor', MAPBOX_CONFIG.DEFAULT_COLORS.FILL),
                'circle-stroke-color': this._createColorExpression('strokeColor', MAPBOX_CONFIG.DEFAULT_COLORS.STROKE),
                'circle-stroke-width': STROKE_CONFIG.DEFAULT_WIDTH,
                'circle-opacity': FEATURE_STYLES.CIRCLE.OPACITY.DEFAULT,
            },
            slot: 'top',
        });
    }

    /**
     * Add circle layer for label annotation points with fixed styling.
     * Label points are distinguished visually from regular data points,
     * which use data-driven colors. This layer uses a fixed neutral color
     * so the circle acts as a stable anchor beneath the text label.
     * @private
     */
    _addLabelCircleLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE_LABEL)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_CIRCLE_LABEL,
            type: 'circle',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['has', 'odoo_user_label'],
            ],
            paint: {
                'circle-radius': LABEL_POINT_STYLE.SIZE,
                'circle-color': this._createColorExpression('fillColor', MAPBOX_CONFIG.DEFAULT_COLORS.FILL),
                'circle-stroke-color': LABEL_POINT_STYLE.STROKE_COLOR,
                'circle-stroke-width': STROKE_CONFIG.DEFAULT_WIDTH,
                'circle-opacity': FEATURE_STYLES.CIRCLE.OPACITY.DEFAULT,
            },
            slot: 'top',
        });
    }

    /**
     * Add a symbol layer that renders text labels for annotation points.
     *
     * Only features that have a `label` property are matched — regular draw
     * points are excluded. The `label` property is promoted to the top-level
     * feature properties by {@link _createRecordFeature} so that Mapbox GL JS
     * style expressions can access it directly (nested objects stored under
     * `_originalProperties` are serialised to a JSON string by the source
     * loader and are not reachable from filter or layout expressions).
     *
     * Render slot: `top` — ensures the text floats above geometry layers and
     * the label anchor circle added by {@link _addLabelCircleLayer}.
     *
     * Collision behaviour: `text-allow-overlap` and `text-ignore-placement`
     * are both enabled so labels are never suppressed by Mapbox GL's
     * placement engine, regardless of map density.
     * @private
     */
    _addLabelLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_LABEL)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_LABEL,
            type: 'symbol',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: ['has', 'odoo_user_label'],
            layout: {
                'text-field': ['get', 'odoo_user_label'],
                'text-size': 14,
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-anchor': 'top',
                'text-offset': [0, 0.4],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: {
                'text-color': this._createColorExpression('fillColor', MAPBOX_CONFIG.DEFAULT_COLORS.FILL),
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
            },
            slot: 'top',
        });
    }

    /**
     * Promote user-defined annotation properties (e.g. `label`) to the
     * top-level feature properties so Mapbox GL JS style expressions can
     * access them directly.
     *
     * The base implementation stores the original GeoJSON properties under
     * `_originalProperties`, which Mapbox GL serialises to a JSON string —
     * making nested values unreachable from filter/layout expressions.
     * @override
     */
    _createRecordFeature(feature, featureId, colors, recordInfo) {
        const result = super._createRecordFeature(feature, featureId, colors, recordInfo);
        if (feature.properties?.odoo_user_label) {
            result.properties.odoo_user_label = feature.properties.odoo_user_label;
        }
        return result;
    }

    /**
     * Add hover state circle layer for points
     * Shows highlighted circles when hovering over point features
     * @private
     */
    _addFilterHoverCircleLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED,
            type: 'circle',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            paint: {
                'circle-radius': FEATURE_STYLES.CIRCLE.RADIUS.HOVER,
                'circle-color': FEATURE_STYLES.COLORS.HOVER.FILL,
                'circle-stroke-color': FEATURE_STYLES.COLORS.HOVER.STROKE,
                'circle-stroke-width': STROKE_CONFIG.HOVER_WIDTH,
                'circle-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
                'circle-stroke-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
            },
            slot: 'top',
        });
    }

    /**
     * Add selected state circle layer for points
     * Shows highlighted circles for selected point features
     * @private
     */
    _addFilterSelectedCircleLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE_SELECTED)) return;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_CIRCLE_SELECTED,
            type: 'circle',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['has', 'resId'],
                ['!=', ['get', 'resId'], ''],
                ['has', 'isSelected'],
                ['==', ['get', 'isSelected'], true],
            ],
            paint: {
                'circle-radius': FEATURE_STYLES.CIRCLE.RADIUS.SELECTED,
                'circle-color': FEATURE_STYLES.COLORS.SELECTED.FILL,
                'circle-stroke-color': FEATURE_STYLES.COLORS.SELECTED.STROKE,
                'circle-stroke-width': STROKE_CONFIG.HOVER_WIDTH,
            },
            slot: 'top',
        });
    }

    /**
     * Create a Mapbox GL JS color expression with hover/selected states
     * @param {string} propertyName - Feature property name for color
     * @param {string} defaultColor - Default color to use
     * @returns {Array} Mapbox GL JS expression array
     * @private
     */
    _createColorExpression(propertyName, defaultColor) {
        return ['coalesce', ['get', propertyName], defaultColor];
    }

    /**
     * Setup feature interaction handlers (click, hover, mousemove)
     * Configures event listeners for map feature interactions
     * Removes any handlers from a previous call first so repeated calls (e.g. after
     * every style change) never stack duplicate listeners on the same layer/map.
     */
    setupFeatureInteractions() {
        this.removeFeatureInteractions();

        // Only setup interactions if there is data
        if (!this.hasData) return;

        // Setup click handlers using bound functions
        this.executeOnLayers(
            [
                LAYER_CONFIG.GEOJSON_FILL,
                LAYER_CONFIG.GEOJSON_CIRCLE,
                LAYER_CONFIG.GEOJSON_STROKE,
                LAYER_CONFIG.GEOJSON_LABEL,
                LAYER_CONFIG.GEOJSON_CIRCLE_LABEL,
            ],
            (layerId) => {
                this.mapBoxGlJs.on('click', layerId, this.boundHandleFeatureClick);
            }
        );

        // Setup hover handlers - only use fill and circle layers to avoid stroke conflicts
        this.executeOnLayers(
            [LAYER_CONFIG.GEOJSON_FILL, LAYER_CONFIG.GEOJSON_CIRCLE, LAYER_CONFIG.GEOJSON_STROKE],
            (layerId) => {
                this.mapBoxGlJs.on('mouseleave', layerId, this.boundHandleFeatureLeave);
            }
        );

        // Add a global mousemove handler for adjacent polygon detection
        this.mapBoxGlJs.on('mousemove', this.boundHandleMouseMove);
    }

    /**
     * Utility method for executing operations on multiple layers
     * Safely executes a callback for each layer that exists on the map
     * @param {Array<string>} layerIds - Array of layer IDs to operate on
     * @param {Function} callback - Function to execute for each layer, receives layerId as parameter
     * @returns {void}
     */
    executeOnLayers(layerIds, callback) {
        layerIds.forEach((layerId) => {
            if (this.mapBoxGlJs.getLayer(layerId)) {
                callback(layerId);
            }
        });
    }

    /**
     * Handle mouse move for adjacent polygon detection
     * Provides more reliable hover detection for touching polygons.
     * Coalesced to at most one queryRenderedFeatures() call per animation
     * frame — mousemove can fire far more often than the map can repaint,
     * and queryRenderedFeatures is expensive against large GeoJSON sources.
     * @override
     * @param {Object} e - Mouse move event object
     * @private
     */
    _handleMouseMove(e) {
        if (!this.isMapboxReady()) return;

        this._lastMouseMoveEvent = e;
        if (this._mouseMoveRaf) return;

        this._mouseMoveRaf = requestAnimationFrame(() => {
            this._mouseMoveRaf = null;
            this._processMouseMove(this._lastMouseMoveEvent);
        });
    }

    /**
     * Actually query rendered features and dispatch hover/leave handling.
     * Runs at most once per animation frame, see {@link _handleMouseMove}.
     * @param {Object} e - Mouse move event object
     * @private
     */
    _processMouseMove(e) {
        if (!this.isMapboxReady()) return;

        try {
            const features = this.mapBoxGlJs.queryRenderedFeatures(e.point, {
                layers: [
                    LAYER_CONFIG.GEOJSON_FILL,
                    LAYER_CONFIG.GEOJSON_CIRCLE,
                    LAYER_CONFIG.GEOJSON_STROKE,
                    LAYER_CONFIG.GEOJSON_LABEL,
                    LAYER_CONFIG.GEOJSON_CIRCLE_LABEL,
                ],
            });

            if (features.length > 0) {
                this.boundHandleFeatureHover({
                    features: features,
                    point: e.point,
                });
            } else {
                if (this.hoveredFeatureId !== null) {
                    this.boundHandleFeatureLeave(e);
                }
            }
        } catch (_err) {
            // queryRenderedFeatures can throw if the map style is not yet ready
        }
    }

    /**
     * Clear all highlighted features and reset cursor
     * Removes hover feature-state from the previously hovered feature(s)
     * instead of re-filtering the hover layers (setFilter re-evaluates the
     * predicate across the whole source and is too costly to run on every
     * mousemove-driven hover change against large GeoJSON datasets).
     * @private
     */
    _clearHighlightedFeatures() {
        if (!this.isMapboxReady()) return;
        this.mapBoxGlJs.getCanvas().style.cursor = '';

        (this._hoveredFeatureIds || []).forEach((id) => {
            this.mapBoxGlJs.setFeatureState({ source: SOURCE_CONFIG.GEOJSON_SOURCE, id }, { hover: false });
        });
        this._hoveredFeatureIds = [];
    }

    /**
     * Highlight a feature by setting hover feature-state
     * Shows popup and changes cursor to pointer. A record can be stored as
     * several features sharing the same resId, so every feature belonging
     * to the hovered record is highlighted via {@link _getSourceFeatureIdsByResId}.
     * @param {Object} ev - Mouse event object with point coordinates
     * @param {Object} feature - GeoJSON feature to highlight
     * @private
     */
    _highlightFeatures(ev, feature) {
        if (!feature || !this.isMapboxReady()) return;

        const { resId } = feature.properties;
        if (!resId) return;

        this.mapBoxGlJs.getCanvas().style.cursor = 'pointer';
        this._showFeaturePopup(ev, feature);

        this._hoveredFeatureIds = this._getSourceFeatureIdsByResId(resId);
        this._hoveredFeatureIds.forEach((id) => {
            this.mapBoxGlJs.setFeatureState({ source: SOURCE_CONFIG.GEOJSON_SOURCE, id }, { hover: true });
        });
    }

    /**
     * Resolve the Mapbox-generated feature ids (from `generateId: true`) for
     * every feature on the GeoJSON source whose `resId` matches. Queries the
     * live source rather than `this.geoJsonData` because the plain JS feature
     * objects kept there never receive the ids Mapbox auto-assigns.
     * @param {string|number} resId - The record ID to look up
     * @returns {Array<number>} Mapbox feature ids
     * @private
     */
    _getSourceFeatureIdsByResId(resId) {
        if (!this.isMapboxReady()) return [];
        try {
            return this.mapBoxGlJs
                .querySourceFeatures(SOURCE_CONFIG.GEOJSON_SOURCE, {
                    filter: ['==', ['get', 'resId'], resId],
                })
                .map((f) => f.id)
                .filter((id) => id !== undefined);
        } catch (_err) {
            return [];
        }
    }

    /**
     * Handle feature hover event
     * Hides existing popup and highlights the hovered feature
     * @param {Object} e - Event object containing features array and point coordinates
     * @private
     */
    _handleFeatureHover(e) {
        if (!this.isMapboxReady()) return;
        this._hideFeaturePopup();
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        this.hoveredFeatureId = feature.id;
        this._highlightFeatures(e, feature);
    }

    /**
     * Zoom and center map on a specific record
     * @param {Object} record - Record to focus on
     * @override
     */
    pointInMap(record) {
        if (!record) return;
        const recordId = this.getRecordId(record);
        const feature = this.getGeoJsonByRecordId(recordId);
        if (!feature) return;
        this.centerMapByFeature(feature);
        this.hoverByFeature(feature);
    }

    /**
     * Hover and highlight a feature by its GeoJSON feature
     * @param {Object} feature - The GeoJSON feature to hover
     */
    hoverByFeature(feature) {
        const centroid = calculateFeatureCentroid(feature);
        this.boundHandleFeatureHover({
            features: [feature],
            point: null,
            lngLat: { lng: centroid[0], lat: centroid[1] },
        });
    }

    /**
     * Center map on a specific feature. When the feature belongs to a record
     * (has a resId), all features sharing that resId are taken into account
     * so the camera fits the record as a whole rather than just one of its parts.
     * @param {Object} feature - The GeoJSON feature to center on
     */
    centerMapByFeature(feature) {
        if (!feature?.geometry || !this.mapBoxGlJs) return;

        const resId = feature.properties?.resId;
        const recordFeatures = resId ? this._getFeaturesByResId(resId) : [feature];

        if (recordFeatures.length > 1) {
            this._fitBoundsToFeatures(recordFeatures);
            return;
        }

        const bounds = calculateFeatureBounds(feature.geometry);
        if (bounds.minX === bounds.maxX && bounds.minY === bounds.maxY) {
            // Single point - zoom in closely
            this.mapBoxGlJs.flyTo({
                center: [bounds.minX, bounds.minY],
                zoom: MAP_FOCUS_CONFIG.SINGLE_POINT_ZOOM,
                essential: true,
                duration: MAP_FOCUS_CONFIG.ANIMATION_DURATION,
            });
        } else {
            // Fit to bounds with padding
            this.mapBoxGlJs.fitBounds(
                [
                    [bounds.minX, bounds.minY],
                    [bounds.maxX, bounds.maxY],
                ],
                {
                    padding: MAP_FOCUS_CONFIG.FIT_BOUNDS_PADDING,
                    maxZoom: MAP_FOCUS_CONFIG.FIT_BOUNDS_MAX_ZOOM,
                    duration: MAP_FOCUS_CONFIG.ANIMATION_DURATION,
                }
            );
        }
    }

    /**
     * Collect all GeoJSON features belonging to the same record.
     * A single record can be stored as several features (e.g. "resId-0",
     * "resId-1", ...), so this reads the local geoJsonData - the full
     * dataset - rather than queryRenderedFeatures, which only sees what is
     * currently on screen and would miss parts of the record outside the viewport.
     * @param {string|number} resId - The record ID to look up
     * @returns {Array<Object>} Features whose properties.resId matches
     * @private
     */
    _getFeaturesByResId(resId) {
        const features = [];
        for (const geoJson of this.geoJsonData.values()) {
            if (geoJson.properties?.resId === resId) {
                features.push(geoJson);
            }
        }
        return features;
    }

    /**
     * Fit the map to the combined bounds of several features
     * @param {Array<Object>} features - GeoJSON features to fit
     * @private
     */
    _fitBoundsToFeatures(features) {
        const {
            minLng = Infinity,
            minLat = Infinity,
            maxLng = -Infinity,
            maxLat = -Infinity,
        } = calculateFeaturesBounds(features);

        if (minLng === Infinity || minLat === Infinity || maxLng === -Infinity || maxLat === -Infinity) {
            return;
        }

        this.mapBoxGlJs.fitBounds(
            [
                [minLng, minLat],
                [maxLng, maxLat],
            ],
            {
                padding: MAP_FOCUS_CONFIG.FIT_BOUNDS_PADDING,
                maxZoom: MAP_FOCUS_CONFIG.FIT_BOUNDS_MAX_ZOOM,
                duration: MAP_FOCUS_CONFIG.ANIMATION_DURATION,
            }
        );
    }

    /**
     * Get GeoJSON data from record
     * @param {Object} record - The record object
     * @returns {Object} GeoJSON data
     * @override
     */
    getRecordGeoJsonData(record) {
        const geoJsonField = this.props.viewAttrs?.geoJsonField;
        if (!geoJsonField) {
            throw new Error(
                'GeoJSON field is not defined in view attributes. Please add your geoJson field to the view definition.'
            );
        }
        let geojson = record.data ? record.data[geoJsonField] : null;
        if (typeof geojson === 'string') {
            try {
                geojson = JSON.parse(geojson);
            } catch (error) {
                console.error('Invalid GeoJSON string in record:', error);
                geojson = null;
            }
        } else if (geojson && typeof geojson === 'object') {
            // This field is an Odoo Json-type field (SearchableJson extends fields.Json),
            // so the web client hands it back already parsed — but still wrapped in Owl's
            // reactive Proxy as part of the record's reactive data tree. Every nested
            // coordinate read through that proxy (by Mapbox's own addSource/setData
            // serialization) pays Owl's get/observeTargetKey/reactive trap overhead.
            // Profiling a 715k-point dataset showed this dominating addGeoJsonSource's
            // time (~1.2-1.5s) even after the data had nothing left to optimize on our
            // side. toRaw() unwraps it back to the plain underlying object once, here,
            // before it ever reaches feature-building or Mapbox.
            geojson = toRaw(geojson);
        }
        return geojson;
    }

    /**
     * Validate that required view attributes are present and valid
     * Checks that geoJsonField is defined and exists in the model
     * @throws {Error} If geoJsonField is missing or invalid
     * @override
     */
    validateViewAttributes() {
        super.validateViewAttributes();
        const { geoJsonField } = this.props.viewAttrs;
        if (!geoJsonField) {
            throw new Error(
                `GeoJSON field "${geoJsonField}" is not defined in view attributes. Please add the geojson attribute to the view definition.`
            );
        }

        const fieldNames = this.props.list.fieldNames;
        if (!fieldNames.includes(geoJsonField)) {
            throw new Error(
                `Invalid view attributes: The specified GeoJSON field "${geoJsonField}" does not exist in the model or is not included in the view. Please ensure this field is present.`
            );
        }
    }

    /**
     * Determine colors for a record's feature
     * Extends base implementation by adding dynamic strokeColor calculation
     * based on darkened fillColor for better visual contrast
     * @param {Object} record - The Odoo record
     * @param {string} featureColor - Base color for the feature
     * @returns {Object} Color object with fillColor and strokeColor properties
     * @override
     */
    _determineRecordColors(record, featureColor) {
        const colors = super._determineRecordColors(record, featureColor);
        return {
            ...colors,
            strokeColor: darkenColor(colors.fillColor, 0.1),
        };
    }

    /**
     * Calculate comprehensive measurements for a GeoJSON feature
     * Uses Turf.js library to compute area, perimeter, length, and coordinates
     * based on geometry type (Point, LineString, Polygon, MultiPolygon)
     *
     * @param {Object} feature - GeoJSON feature object
     * @param {Object} feature.geometry - Geometry object with type and coordinates
     * @param {string} feature.geometry.type - Geometry type (Point, LineString, Polygon, MultiPolygon)
     * @param {Array} feature.geometry.coordinates - Coordinate array structure based on geometry type
     * @returns {Object|null} Measurement object containing:
     *   - type: Geometry type
     *   - display_name: Formatted measurement string for display
     *   - For Point: coordinates in degrees N/S, E/W format
     *   - For LineString/MultiLineString: length and point count
     *   - For Polygon/MultiPolygon: area, perimeter, and point count
     *   Returns null if feature or geometry is missing
     */
    calculateFeatureMeasurement(feature) {
        if (!feature || !feature.geometry) return null;

        const { type, coordinates } = feature.geometry;

        const unit = MEASUREMENT_CONFIG.UNITS.METRIC; // Default to metric
        const measurements = {};
        let area = 0;
        let displayArea = '';

        try {
            area = window.turf.area(feature);
            displayArea = formatAreaMeasurement(area, user.context.lang, 2, unit);
        } catch (error) {
            console.error('Error calculating area with Turf.js:', error);
        }

        try {
            switch (type) {
                case 'Point': {
                    const lat = coordinates[1];
                    const lng = coordinates[0];
                    const latDir = lat >= 0 ? 'N' : 'S';
                    const lngDir = lng >= 0 ? 'E' : 'W';
                    measurements.type = 'Point';
                    measurements.coordinates = `${Math.abs(lat).toFixed(
                        MEASUREMENT_CONFIG.COORDINATE_PRECISION
                    )}°${latDir}, ${Math.abs(lng).toFixed(MEASUREMENT_CONFIG.COORDINATE_PRECISION)}°${lngDir}`;
                    measurements.display_name = `Point: ${measurements.coordinates}`;
                    break;
                }
                case 'LineString':
                case 'MultiLineString': {
                    const length = window.turf.length(feature, {
                        units: 'kilometers',
                    });
                    measurements.type = 'Line';
                    measurements.length = formatLengthMeasurement(length, user.context.lang, 2, unit);
                    measurements.points = formatPointCount(
                        type === 'MultiLineString'
                            ? coordinates.reduce((sum, line) => sum + line.length, 0)
                            : coordinates.length
                    );
                    measurements.display_name = `Length: ${measurements.length} | Points: ${measurements.points}`;
                    break;
                }
                case 'Polygon': {
                    const polygonCoords = coordinates[0];
                    const lines = window.turf.lineString(polygonCoords);
                    const perimeter = window.turf.length(lines, {
                        units: 'kilometers',
                    });
                    measurements.type = 'Polygon';
                    measurements.area = displayArea;
                    measurements.perimeter = formatLengthMeasurement(perimeter, user.context.lang, 2, unit);
                    measurements.points = formatPointCount(polygonCoords.length - 1);
                    measurements.display_name = `Area: ${measurements.area} | Perimeter: ${measurements.perimeter} | Points: ${measurements.points}`;
                    break;
                }
                case 'MultiPolygon': {
                    let totalPerimeter = 0;
                    let totalPoints = 0;
                    coordinates.forEach((polygon) => {
                        const polyCoords = polygon[0];
                        const lines = window.turf.lineString(polyCoords);
                        totalPerimeter += window.turf.length(lines, {
                            units: 'kilometers',
                        });
                        totalPoints += polyCoords.length - 1;
                    });
                    measurements.type = 'MultiPolygon';
                    measurements.area = displayArea;
                    measurements.perimeter = formatLengthMeasurement(totalPerimeter, user.context.lang, 2, unit);
                    measurements.points = formatPointCount(totalPoints);
                    measurements.display_name = `Area: ${measurements.area} | Perimeter: ${measurements.perimeter} | Points: ${measurements.points}`;
                    break;
                }
                default:
                    measurements.type = type;
                    measurements.display_name = 'Measurements not available for this geometry type';
            }
        } catch (error) {
            console.error('Error calculating measurement:', error);
            measurements.error = 'Error calculating measurements';
        }
        return measurements;
    }

    generateMarkerPopupContentValues(data, feature) {
        const values = super.generateMarkerPopupContentValues(data, feature);
        delete values.originalProperties;
        return values;
    }
}
