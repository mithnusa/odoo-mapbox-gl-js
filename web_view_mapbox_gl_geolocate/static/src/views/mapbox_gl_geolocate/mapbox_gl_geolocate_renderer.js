import { _t } from '@web/core/l10n/translation';
import { MAPBOX_CONFIG, STROKE_CONFIG } from '@base_mapbox_gl/utils/utils';
import { BaseMapboxGlRenderer } from '@web_view_base_mapbox_gl/map_base/map_base_renderer';
import { withBoxZoomSelection } from '@web_view_base_mapbox_gl/map_base/box_zoom_selection_mixin';
import { withShiftClickSelection } from '@web_view_base_mapbox_gl/map_base/shift_click_selection_mixin';
import {
    calculateFeatureCentroid,
    darkenColor,
    MEASUREMENT_CONFIG,
    LAYER_CONFIG,
    SOURCE_CONFIG,
    FEATURE_STYLES,
} from '@web_view_base_mapbox_gl/map_base/utils';

const MARKER_CONFIG = {
    OVERLAP: {
        OFFSET_RADIUS: 0.00009, // ~10 meters at equator
        POSITION_TOLERANCE: 0.000001, // Tolerance for position comparison
        MIN_CIRCLE_POSITIONS: 3, // Minimum circle positions for distribution
    },
    VISUAL: {
        CONNECTION_LINE: {
            STROKE_COLOR: '#888888',
            STROKE_OPACITY: 1,
            STROKE_WIDTH: 2,
            DASH_ARRAY: [2, 2], // Dotted line pattern
            MIN_ZOOM: 17,
        },
        MARKER: {
            SELECTED_CLASS: 'marker-circle selected',
            DEFAULT_CLASS: 'marker-circle',
            BORDER: '2px solid #fafafa',
        },
    },
    BOUNDS: {
        DEFAULT_PADDING: 100,
        MIN_ZOOM: 9,
    },
    BATCH: {
        SELECTION_SIZE: 20,
        MARKER_SIZE: 100,
        IDLE_TIMEOUT: 10,
    },
    INTERACTION: {
        MOUSE_MOVE_THROTTLE_MS: 100, // Throttle interval for mouse move events
        POINT_IN_MAP_DEBOUNCE_MS: 150, // Debounce delay for point in map operations
    },
    ANIMATION: {
        DURATION_MS: 1000, // Animation duration in milliseconds
        PITCH_DEGREES: 60, // Camera pitch angle in degrees
    },
    COORDINATE_PRECISION: 6, // 6 decimal places ~ 0.11 meters precision
    MIN_ZOOM: 10, // Minimum zoom level for map focus
};

// Layer IDs for geolocate-specific layers
const GEOLOCATE_SOURCE_CONFIG = {
    CONNECTION_LINES_SOURCE: 'geolocate-connection-lines-source',
};

const GEOLOCATE_LAYER_CONFIG = {
    CONNECTION_LINES_LAYER: 'geolocate-connection-lines',
    HEATMAP_LAYER: 'geolocate-heatmap',
};

const CLUSTER_LAYER = 'features-cluster';
const CLUSTER_COUNT_POINT_LAYER = 'features-cluster-count';
const INTERACTION_CLICK_CLUSTER = 'interaction-click-cluster';
const INTERACTION_CLUSTER_MOUSE_ENTER = 'interaction-cluster-mouse-enter';
const INTERACTION_CLUSTER_MOUSE_LEAVE = 'interaction-cluster-mouse-leave';

export class MapboxGlGeolocateRenderer extends withShiftClickSelection(withBoxZoomSelection(BaseMapboxGlRenderer)) {
    static templatePopupContent = 'web_view_mapbox_gl_geolocate.PopupContent';
    /**
     * Initialize the geolocate renderer
     * Sets up coordinate tracking maps for overlapping feature management
     * @override
     */
    setup() {
        super.setup();
        // Map to track coordinates and count features at each location
        // Key format: "lng,lat" -> value: count of features at that location
        this.coordinateUsageMap = new Map();
        // Map to store the center marker (first marker) at each location
        // Key format: "lng,lat" -> value: center marker coordinates [lng, lat]
        this.centerMarkerMap = new Map();
    }

    /**
     * Clear all existing geolocation data from the map
     * Overrides parent to also clear coordinate tracking
     * @override
     */
    clearData() {
        super.clearData();
        // Clear coordinate tracking map when clearing data
        this.coordinateUsageMap.clear();
        this.centerMarkerMap.clear();
    }

    /**
     * Main rendering method that processes and displays geolocation data on the map
     * Overrides parent to reset coordinate tracking before processing
     * @override
     */
    async renderGeolocationData(options = {}) {
        if (!this.isMapboxReady()) return;

        // Reset coordinate tracking maps before processing
        // These must be rebuilt on each render because shift positions
        // depend on the order records are processed
        this.coordinateUsageMap.clear();
        this.centerMarkerMap.clear();

        // Call parent implementation to handle the rest
        await super.renderGeolocationData(options);
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
        this.mapBoxGlJs.once('idle', () => {
            this._handleFeatureSelected();
        });
    }

    /**
     * Handle feature selection state after map becomes idle
     * Adds the selected circle layer to highlight selected features
     * @private
     */
    _handleFeatureSelected() {
        if (!this.isMapboxReady()) return;

        this._addFilterSelectedCircleLayer();
    }

    /**
     * Add all geometry layers for the geolocate view
     * Adds connection lines first (so they paint underneath the markers),
     * then the base circle layer, hover highlight layer, and conditionally
     * the heatmap layer and marker cluster layers.
     * @override
     */
    addGeometryLayers() {
        if (!this.isMapboxReady()) return;
        super.addGeometryLayers();

        // Add connection lines for shifted markers first, so they render
        // underneath the marker circles instead of drawn over them.
        this._addConnectionLinesSource();
        this._addConnectionLinesLayer();

        // Add circle layer for points
        this._addCircleLayer();
        this._addFilterHoverCircleLayer();

        const { enableHeatmap, enableClustering } = this.props.viewAttrs;
        if (enableHeatmap && enableClustering) {
            console.warn(
                'Heatmap is enabled in view attributes, but clustering is also enabled. Heatmap layer will not be added to avoid visual conflicts.'
            );
        }

        // Add heatmap layer for point density visualization at low zoom levels
        // Only add heatmap if clustering is not enabled, since they serve similar purposes and can conflict visually
        if (enableHeatmap && !enableClustering) {
            this._addHeatmapLayer();
        }
        // Add clustering if enabled in view attributes
        if (enableClustering) {
            this._addMarkerClusterLayers();
        }
    }

    /**
     * Add or update the GeoJSON data source
     * @override
     */
    addGeoJsonSource() {
        const features = Array.from(this.geoJsonData.values());
        const source = this.mapBoxGlJs.getSource(SOURCE_CONFIG.GEOJSON_SOURCE);

        if (source) {
            // Source already exists, just update the data
            source.setData({
                type: 'FeatureCollection',
                features: features,
            });
        } else {
            const sourceConfig = {
                type: 'geojson',
                generateId: true, // Ensure Mapbox generates consistent IDs for feature-state
                data: {
                    type: 'FeatureCollection',
                    features: features,
                },
            };
            if (this.props.viewAttrs.enableClustering) {
                sourceConfig.cluster = true;
                sourceConfig.clusterMaxZoom = 14; // Max zoom to cluster points
                sourceConfig.clusterRadius = 50; // Radius of each cluster when clustering points (defaults to 50)
            }
            // Create new source
            this.mapBoxGlJs.addSource(SOURCE_CONFIG.GEOJSON_SOURCE, sourceConfig);
        }
    }

    /**
     * Add circle layer for Point geometries with data-driven styling
     * @private
     */
    _addCircleLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE)) return;

        const radius = FEATURE_STYLES.CIRCLE.RADIUS.DEFAULT + 4; // Slightly larger for better visibility

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_CIRCLE,
            type: 'circle',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            paint: {
                'circle-radius': radius,
                'circle-color': this._createColorExpression('fillColor', MAPBOX_CONFIG.DEFAULT_COLORS.FILL),
                'circle-stroke-color': this._createColorExpression('strokeColor', MAPBOX_CONFIG.DEFAULT_COLORS.STROKE),
                'circle-stroke-width': STROKE_CONFIG.DEFAULT_WIDTH,
                'circle-opacity': FEATURE_STYLES.CIRCLE.OPACITY.DEFAULT,
            },
            slot: 'top',
        });
    }

    /**
     * Add circle layer for hovered feature highlighting
     * Uses a filter to only display the currently hovered feature
     * @private
     */
    _addFilterHoverCircleLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED)) return;

        const hover = FEATURE_STYLES.CIRCLE.RADIUS.HOVER + 3; // Slightly larger for better visibility
        const hoverStrokeWidth = STROKE_CONFIG.HOVER_WIDTH + 1;

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED,
            type: 'circle',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: ['all', ['has', 'resId'], ['==', ['get', 'resId'], '']],
            paint: {
                'circle-radius': hover,
                'circle-color': this._createColorExpression('fillColor', MAPBOX_CONFIG.DEFAULT_COLORS.FILL),
                'circle-stroke-color': FEATURE_STYLES.COLORS.HOVER.STROKE,
                'circle-stroke-width': hoverStrokeWidth,
                'circle-opacity': FEATURE_STYLES.CIRCLE.OPACITY.HOVER,
            },
            slot: 'top',
        });
    }

    // Placeholder for querying features inside a cluster - this can be implemented to return the individual features within a cluster when selected
    async queryFeatureInsideCluster(clusterFeatures) {
        const queryFeatures = clusterFeatures
            .filter((cluster) => cluster?.properties?.cluster_id)
            .map((cluster) => {
                return new Promise((resolve, reject) => {
                    const clusterId = cluster.properties.cluster_id;

                    this.mapBoxGlJs
                        .getSource(SOURCE_CONFIG.GEOJSON_SOURCE)
                        // Bounded limit (one above the rejection threshold below) instead of
                        // Infinity, so oversized clusters aren't fully materialized before
                        // being rejected.
                        .getClusterLeaves(clusterId, 101, 0, (err, features) => {
                            if (err) {
                                reject(err);
                            } else if (features.length > 100) {
                                reject(
                                    new Error(
                                        _t(
                                            'Too many features in this cluster to select. Please zoom in and select a smaller area.'
                                        )
                                    )
                                );
                            } else {
                                resolve(features);
                            }
                        });
                });
            });
        const featuresByCluster = await Promise.all(queryFeatures);
        return featuresByCluster.flat();
    }

    async querySelectedFeatures(bbox) {
        const selectableLayers = await super.querySelectedFeatures(bbox);

        if (!this.props.viewAttrs.enableClustering || !bbox) {
            return selectableLayers;
        }

        try {
            const clusters = this.mapBoxGlJs.queryRenderedFeatures(bbox, {
                layers: [CLUSTER_LAYER],
            });

            if (!clusters.length) {
                return selectableLayers;
            }

            const clusterFeatures = await this.queryFeatureInsideCluster(clusters);
            selectableLayers.push(...clusterFeatures);
        } catch (error) {
            this.notificationService?.add(
                error?.message || _t('An error occurred while selecting clustered features.'),
                { type: 'warning' }
            );
        }

        return selectableLayers;
    }

    /**
     * Add cluster, cluster count, and unclustered point layers to the map
     * Renders clustered features as sized/colored circles with a count label,
     * and unclustered points using feature-driven colors.
     * Also registers click and cursor interactions on the cluster layer.
     * Only adds layers that do not already exist. The click/hover interactions are
     * re-registered on every call (Mapbox's addInteraction() throws if an id already
     * exists), so any previous ones are removed first to stay idempotent.
     * @private
     */
    _addMarkerClusterLayers() {
        this.removeCustomMapInteractions();

        if (!this.mapBoxGlJs.getLayer(CLUSTER_LAYER)) {
            this.mapBoxGlJs.addLayer({
                id: CLUSTER_LAYER,
                type: 'circle',
                source: SOURCE_CONFIG.GEOJSON_SOURCE,
                filter: ['has', 'point_count'],
                paint: {
                    // Use step expressions (https://docs.mapbox.com/style-spec/reference/expressions/#step)
                    // with three steps to implement three types of circles:
                    //   * Blue, 20px circles when point count is less than 100
                    //   * Yellow, 30px circles when point count is between 100 and 750
                    //   * Pink, 40px circles when point count is greater than or equal to 750
                    'circle-color': ['step', ['get', 'point_count'], '#1390af', 100, '#c5ba20', 750, '#bb3063'],
                    'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
                    'circle-emissive-strength': 1,
                },
                // Keep clusters in the same slot as individual markers so their
                // z-order relative to Standard-style basemap features is explicit.
                slot: 'top',
            });
        }

        if (!this.mapBoxGlJs.getLayer(CLUSTER_COUNT_POINT_LAYER)) {
            this.mapBoxGlJs.addLayer({
                id: CLUSTER_COUNT_POINT_LAYER,
                type: 'symbol',
                source: SOURCE_CONFIG.GEOJSON_SOURCE,
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': ['get', 'point_count_abbreviated'],
                    'text-font': ['Open Sans Bold'],
                    'text-size': 14,
                },
                paint: {
                    'text-color': '#ffffff',
                },
                slot: 'top',
            });
        }

        this.mapBoxGlJs.addInteraction(INTERACTION_CLICK_CLUSTER, {
            type: 'click',
            target: { layerId: CLUSTER_LAYER },
            handler: (e) => {
                const features = this.mapBoxGlJs.queryRenderedFeatures(e.point, {
                    layers: [CLUSTER_LAYER],
                });
                if (!features.length) return;
                const clusterId = features[0].properties.cluster_id;
                this.mapBoxGlJs
                    .getSource(SOURCE_CONFIG.GEOJSON_SOURCE)
                    .getClusterExpansionZoom(clusterId, (err, zoom) => {
                        if (err) {
                            console.warn('Failed to get cluster expansion zoom:', err);
                            return;
                        }

                        this.mapBoxGlJs.easeTo({
                            center: features[0].geometry.coordinates,
                            zoom: zoom,
                        });
                    });
            },
        });

        this.mapBoxGlJs.addInteraction(INTERACTION_CLUSTER_MOUSE_ENTER, {
            type: 'mouseenter',
            target: { layerId: CLUSTER_LAYER },
            handler: () => {
                this.mapBoxGlJs.getCanvas().style.cursor = 'pointer';
            },
        });

        this.mapBoxGlJs.addInteraction(INTERACTION_CLUSTER_MOUSE_LEAVE, {
            type: 'mouseleave',
            target: { layerId: CLUSTER_LAYER },
            handler: () => {
                this.mapBoxGlJs.getCanvas().style.cursor = '';
            },
        });
    }

    /**
     * Add heatmap layer for point density visualization
     * Renders at low zoom levels (0-9) and transitions to circles at higher zooms
     * @private
     */
    _addHeatmapLayer() {
        if (this.mapBoxGlJs.getLayer(GEOLOCATE_LAYER_CONFIG.HEATMAP_LAYER)) return;

        this.mapBoxGlJs.addLayer({
            id: GEOLOCATE_LAYER_CONFIG.HEATMAP_LAYER,
            type: 'heatmap',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            maxzoom: 9,
            paint: {
                // Increase the heatmap color weight by zoom level
                // heatmap-intensity is a multiplier on top of heatmap-weight
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
                // Color ramp for heatmap. Domain is 0 (low) to 1 (high).
                // Begin color ramp at 0-stop with a 0-transparency color
                // to create a blur-like effect.
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0,
                    'rgba(33,102,172,0)',
                    0.2,
                    'rgb(103,169,207)',
                    0.4,
                    'rgb(209,229,240)',
                    0.6,
                    'rgb(253,219,199)',
                    0.8,
                    'rgb(239,138,98)',
                    1,
                    'rgb(178,24,43)',
                ],
                // Adjust the heatmap radius by zoom level
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
                // Transition from heatmap to circle layer by zoom level
                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0],
            },
            slot: 'top',
        });
    }

    /**
     * Add circle layer for selected feature highlighting
     * Filters to only display features with isSelected property set to true
     * @private
     */
    _addFilterSelectedCircleLayer() {
        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE_SELECTED)) return;

        const selected = FEATURE_STYLES.CIRCLE.RADIUS.SELECTED + 2; // Slightly larger for better visibility

        this.mapBoxGlJs.addLayer({
            id: LAYER_CONFIG.GEOJSON_CIRCLE_SELECTED,
            type: 'circle',
            source: SOURCE_CONFIG.GEOJSON_SOURCE,
            filter: [
                'all',
                ['has', 'resId'],
                ['!=', ['get', 'resId'], ''],
                ['has', 'isSelected'],
                ['==', ['get', 'isSelected'], true],
            ],
            paint: {
                'circle-radius': selected,
                'circle-color': FEATURE_STYLES.COLORS.SELECTED.FILL,
                'circle-stroke-color': FEATURE_STYLES.COLORS.SELECTED.STROKE,
                'circle-stroke-width': STROKE_CONFIG.HOVER_WIDTH,
                'circle-opacity': FEATURE_STYLES.CIRCLE.OPACITY.SELECTED,
            },
            slot: 'top',
        });
    }

    /**
     * Create a data-driven Mapbox GL JS color expression
     * Returns the feature property value if present, otherwise falls back to defaultColor
     * @param {string} propertyName - Feature property name to read the color from
     * @param {string} defaultColor - Fallback color when the property is absent or null
     * @returns {Array} Mapbox GL JS expression array
     * @private
     */
    _createColorExpression(propertyName, defaultColor) {
        return ['case', ['!=', ['get', propertyName], null], ['get', propertyName], defaultColor];
    }

    /**
     * Setup feature interaction handlers (click, hover, mousemove) for circle layer
     * Configures event listeners for map feature interactions
     * Removes any handlers from a previous call first so repeated calls (e.g. after
     * every style change) never stack duplicate listeners on the same layer/map.
     * Uses the base (non-cluster) cleanup only — cluster interactions are a separate
     * concern owned and self-cleaned by _addMarkerClusterLayers().
     */
    setupFeatureInteractions() {
        super.removeFeatureInteractions();

        // Only setup interactions if there is data
        if (!this.hasData) return;

        // Setup click and hover handlers for circle layer
        this.mapBoxGlJs.on('click', LAYER_CONFIG.GEOJSON_CIRCLE, this.boundHandleFeatureClick);
        this.mapBoxGlJs.on('mouseleave', LAYER_CONFIG.GEOJSON_CIRCLE, this.boundHandleFeatureLeave);

        // Add a global mousemove handler for better hover detection
        this.mapBoxGlJs.on('mousemove', this.boundHandleMouseMove);
    }

    /**
     * Handle mouse move for better hover detection of Point features.
     * Trailing-edge throttled to MARKER_CONFIG.INTERACTION.MOUSE_MOVE_THROTTLE_MS:
     * queryRenderedFeatures() is skipped for moves inside the throttle window, and
     * the most recent event is processed once the window elapses.
     * @param {Object} e - Mouse move event object
     * @private
     */
    _handleMouseMove(e) {
        if (!this.isMapboxReady()) return;

        const now = Date.now();
        if (this.lastMouseMoveTime && now - this.lastMouseMoveTime < MARKER_CONFIG.INTERACTION.MOUSE_MOVE_THROTTLE_MS) {
            this.pendingMouseMoveEvent = e;
            if (!this.mouseMoveThrottleTimeout) {
                const remaining = MARKER_CONFIG.INTERACTION.MOUSE_MOVE_THROTTLE_MS - (now - this.lastMouseMoveTime);
                this.mouseMoveThrottleTimeout = setTimeout(() => {
                    this.mouseMoveThrottleTimeout = null;
                    const pending = this.pendingMouseMoveEvent;
                    this.pendingMouseMoveEvent = null;
                    if (pending) this._processMouseMove(pending);
                }, remaining);
            }
            return;
        }

        this.lastMouseMoveTime = now;
        this._processMouseMove(e);
    }

    /**
     * Queries rendered features at the mouse position and triggers hover/leave.
     * Split out of _handleMouseMove so the throttle wrapper above can call it
     * either immediately or on the trailing edge of the throttle window.
     * @param {Object} e - Mouse move event object
     * @private
     */
    _processMouseMove(e) {
        try {
            const features = this.mapBoxGlJs.queryRenderedFeatures(e.point, {
                layers: [LAYER_CONFIG.GEOJSON_CIRCLE],
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
        } catch (error) {
            console.warn(_t('Error during mouse move feature query:'), error);
        }
    }

    /**
     * Handle feature hover event
     * Hides existing popup, updates hovered feature ID, and triggers highlighting
     * @param {Object} e - Hover event with features array and point
     * @private
     */
    _handleFeatureHover(e) {
        if (!this.isMapboxReady()) return;
        this._hideFeaturePopup();
        if (!e.features || e.features.length === 0) {
            console.warn('Feature has no ID from Mapbox, hover state cannot work');
            return;
        }
        const feature = e.features[0];
        this.hoveredFeatureId = feature.id;
        this._highlightFeatures(e, feature);
    }

    /**
     * Highlight a feature on the map by showing a popup and updating the hover filter
     * @param {Object} e - Event object with point/lngLat for popup positioning
     * @param {Object} feature - The GeoJSON feature to highlight
     * @private
     */
    _highlightFeatures(e, feature) {
        if (!this.isMapboxReady()) return;
        const { resId } = feature.properties;
        if (resId) {
            this.mapBoxGlJs.getCanvas().style.cursor = 'pointer';
            this._showFeaturePopup(e, feature);
            if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED)) {
                this.mapBoxGlJs.setFilter(LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED, ['==', ['get', 'resId'], resId]);
            }
        }
    }

    /**
     * Clear all highlighted features by resetting cursor, hover state, and filter
     * @private
     */
    _clearHighlightedFeatures() {
        if (!this.isMapboxReady()) return;
        this.mapBoxGlJs.getCanvas().style.cursor = '';
        this.hoveredFeatureId = null;

        if (this.mapBoxGlJs.getLayer(LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED)) {
            this.mapBoxGlJs.setFilter(LAYER_CONFIG.GEOJSON_CIRCLE_HOVERED, ['==', ['get', 'resId'], '']);
        }
    }

    /**
     * Zoom, center, and highlight the map on a specific record
     * Skips re-centering if the record was already centered last.
     * Flies to the feature's location and triggers hover highlighting.
     * @param {Object} record - Record to focus on
     * @override
     */
    pointInMap(record) {
        if (!record) return;

        const recordId = this.getRecordId(record);

        // Avoid redundant centering on the same record
        if (this.lastCenteredRecordId === recordId) {
            return;
        }

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
     * Center map on a specific feature
     * @param {Object} feature - The GeoJSON feature to center on
     */
    centerMapByFeature(feature, minZoom = MARKER_CONFIG.MIN_ZOOM) {
        if (feature && feature.geometry) {
            // Stop any ongoing animations to prevent memory accumulation
            this.mapBoxGlJs.stop();
            // Get the current zoom level to determine if we need to adjust it
            const currentZoom = this.mapBoxGlJs.getZoom();
            // Prepare the options object for the flyTo method
            const options = {
                center: feature.geometry.coordinates,
                essential: true,
                duration: MARKER_CONFIG.ANIMATION.DURATION_MS,
            };
            // Adjust the zoom level if the current zoom is below the minimum required
            if (currentZoom < minZoom) {
                options.zoom = minZoom;
            }
            // Fly to the feature's coordinates with animation
            this.mapBoxGlJs.flyTo(options);
        }
    }

    /**
     * Enhanced cleanup with proper memory management
     * Cleans up all event listeners, popups, and data structures
     * @override
     */
    cleanUp() {
        if (this.mouseMoveThrottleTimeout) {
            clearTimeout(this.mouseMoveThrottleTimeout);
            this.mouseMoveThrottleTimeout = null;
        }
        if (this.pointInMapDebounce) {
            clearTimeout(this.pointInMapDebounce);
            this.pointInMapDebounce = null;
        }

        // Hide popup first
        this._hideFeaturePopup();

        // Reset state
        this.hoveredFeatureId = null;
        this.lastCenteredRecordId = null;
        this.lastMouseMoveTime = null;
        this.pendingMouseMoveEvent = null;

        // Call parent cleanup
        super.cleanUp();
    }

    /**
     * Create a coordinate key for tracking location usage
     * @param {number} lng - Longitude value
     * @param {number} lat - Latitude value
     * @returns {string} Coordinate key in format "lng,lat"
     * @private
     */
    _createCoordinateKey(lng, lat) {
        return `${lng.toFixed(MARKER_CONFIG.COORDINATE_PRECISION)},${lat.toFixed(MARKER_CONFIG.COORDINATE_PRECISION)}`;
    }

    /**
     * Check if coordinates already exist and get the count
     * @param {number} lng - Longitude value
     * @param {number} lat - Latitude value
     * @returns {number} Number of features already at this location
     * @private
     */
    _getCoordinateUsageCount(lng, lat) {
        const key = this._createCoordinateKey(lng, lat);
        return this.coordinateUsageMap.get(key) || 0;
    }

    /**
     * Register coordinate usage by incrementing the count
     * @param {number} lng - Longitude value
     * @param {number} lat - Latitude value
     * @private
     */
    _registerCoordinateUsage(lng, lat) {
        const key = this._createCoordinateKey(lng, lat);
        const currentCount = this.coordinateUsageMap.get(key) || 0;
        this.coordinateUsageMap.set(key, currentCount + 1);
    }

    /**
     * Calculate circular offset for overlapping features
     * @param {number} index - Index of the overlapping feature (0-based)
     * @param {number} radius - Offset radius in degrees
     * @returns {Object} Object with offsetLng and offsetLat
     * @private
     */
    _calculateCircularOffset(index, radius = MARKER_CONFIG.OVERLAP.OFFSET_RADIUS) {
        // Distribute features in a circle
        // Start from 0 degrees and distribute evenly
        // Use minimum of 3 positions even for 1-2 markers to ensure proper spacing
        const angle = (index * 2 * Math.PI) / Math.max(index + 1, MARKER_CONFIG.OVERLAP.MIN_CIRCLE_POSITIONS);

        return {
            offsetLng: Math.cos(angle) * radius,
            offsetLat: Math.sin(angle) * radius,
        };
    }

    /**
     * Apply coordinate shift to avoid overlapping features
     * @param {number} lng - Original longitude
     * @param {number} lat - Original latitude
     * @returns {Object} Object with shifted coordinates and isShifted flag
     * @private
     */
    _applyCoordinateShift(lng, lat) {
        const usageCount = this._getCoordinateUsageCount(lng, lat);
        const key = this._createCoordinateKey(lng, lat);

        if (usageCount === 0) {
            // First feature at this location - this is the center marker
            // Store this as the center marker for this location
            this.centerMarkerMap.set(key, [lng, lat]);
            this._registerCoordinateUsage(lng, lat);
            return {
                coordinates: [lng, lat],
                isShifted: false,
                originalCoordinates: [lng, lat],
                centerMarkerCoordinates: [lng, lat],
            };
        }

        // Get the center marker coordinates for this location
        const centerMarkerCoords = this.centerMarkerMap.get(key) || [lng, lat];

        // Calculate offset for this feature
        const { offsetLng, offsetLat } = this._calculateCircularOffset(usageCount);
        const shiftedLng = lng + offsetLng;
        const shiftedLat = lat + offsetLat;

        // Register both original and shifted coordinates
        this._registerCoordinateUsage(lng, lat);

        return {
            coordinates: [shiftedLng, shiftedLat],
            isShifted: true,
            originalCoordinates: [lng, lat],
            centerMarkerCoordinates: centerMarkerCoords,
        };
    }

    /**
     * Generate LineString features connecting shifted markers to their center marker
     * @returns {Array} Array of GeoJSON LineString features
     * @private
     */
    _generateConnectionLineFeatures() {
        const lineFeatures = [];

        // Iterate through all features and create lines for shifted markers
        for (const feature of this.geoJsonData.values()) {
            const originalProperties = this.getFeatureOriginalProperties(feature);
            const isShifted = feature.properties?.isShifted || originalProperties?.isShifted || false;
            const centerMarkerCoordinates =
                feature.properties?.centerMarkerCoordinates || originalProperties?.centerMarkerCoordinates || null;
            if (isShifted && centerMarkerCoordinates) {
                const shiftedCoords = feature.geometry.coordinates;
                const centerCoords = centerMarkerCoordinates;

                // Create a LineString connecting the center marker to the shifted marker
                lineFeatures.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: [centerCoords, shiftedCoords],
                    },
                    properties: {
                        featureId: feature.id,
                        color: darkenColor(
                            feature.properties.strokeColor ||
                                originalProperties?.strokeColor ||
                                MARKER_CONFIG.VISUAL.CONNECTION_LINE.STROKE_COLOR,
                            0.4
                        ),
                    },
                });
            }
        }
        return lineFeatures;
    }

    /**
     * Add or update the connection lines GeoJSON source on the map
     * Generates line features from shifted markers and either creates a new source
     * or updates the existing one with the latest data
     * @private
     */
    _addConnectionLinesSource() {
        const lineFeatures = this._generateConnectionLineFeatures();
        if (this.mapBoxGlJs.getSource(GEOLOCATE_SOURCE_CONFIG.CONNECTION_LINES_SOURCE)) {
            // Source exists, update data
            this.mapBoxGlJs.getSource(GEOLOCATE_SOURCE_CONFIG.CONNECTION_LINES_SOURCE).setData({
                type: 'FeatureCollection',
                features: lineFeatures,
            });
        } else {
            // Create new source
            this.mapBoxGlJs.addSource(GEOLOCATE_SOURCE_CONFIG.CONNECTION_LINES_SOURCE, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: lineFeatures,
                },
            });
        }
    }

    /**
     * Add connection lines layer to visualize shifted marker connections
     * @private
     */
    _addConnectionLinesLayer() {
        if (!this.mapBoxGlJs.getLayer(GEOLOCATE_LAYER_CONFIG.CONNECTION_LINES_LAYER)) {
            this.mapBoxGlJs.addLayer({
                id: GEOLOCATE_LAYER_CONFIG.CONNECTION_LINES_LAYER,
                type: 'line',
                source: GEOLOCATE_SOURCE_CONFIG.CONNECTION_LINES_SOURCE,
                paint: {
                    'line-color': ['coalesce', ['get', 'color'], MARKER_CONFIG.VISUAL.CONNECTION_LINE.STROKE_COLOR],
                    'line-width': MARKER_CONFIG.VISUAL.CONNECTION_LINE.STROKE_WIDTH,
                    'line-opacity': MARKER_CONFIG.VISUAL.CONNECTION_LINE.STROKE_OPACITY,
                    'line-dasharray': MARKER_CONFIG.VISUAL.CONNECTION_LINE.DASH_ARRAY,
                },
                minzoom: MARKER_CONFIG.VISUAL.CONNECTION_LINE.MIN_ZOOM,
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                },
                // Same slot as the marker layers so it's explicit, not dependent
                // on default Standard-style ordering for slot-less layers.
                slot: 'top',
            });
        }
    }

    /**
     * Get GeoJSON data from record's latitude and longitude fields
     * Converts separate lat/lng fields into a GeoJSON Point feature
     * Handles overlapping coordinates by applying circular offset
     * @param {Object} record - The record object
     * @param {boolean} skipShift - If true, skip coordinate shifting (for checksum calculation)
     * @returns {Object} GeoJSON FeatureCollection
     * @override
     */
    getRecordGeoJsonData(record, skipShift = false) {
        const { lngField, latField, title = 'display_name' } = this.props.viewAttrs;

        if (!lngField || !latField) {
            throw new Error(
                'Latitude and longitude fields are not defined in view attributes. Please add lat and lng attributes to the view definition.'
            );
        }

        const lng = parseFloat(record.data?.[lngField]);
        const lat = parseFloat(record.data?.[latField]);

        // Check if we have valid coordinates
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
            return null;
        }

        let coordinates, isShifted, originalCoordinates, centerMarkerCoordinates;

        if (skipShift) {
            // For checksum calculation, don't apply shift
            coordinates = [lng, lat];
            isShifted = false;
            originalCoordinates = [lng, lat];
            centerMarkerCoordinates = [lng, lat];
        } else {
            // Apply coordinate shift if there are overlapping features
            const shiftResult = this._applyCoordinateShift(lng, lat);
            coordinates = shiftResult.coordinates;
            isShifted = shiftResult.isShifted;
            originalCoordinates = shiftResult.originalCoordinates;
            centerMarkerCoordinates = shiftResult.centerMarkerCoordinates;
        }

        // Create a GeoJSON Point feature from lat/lng fields
        const displayName = record.data?.[title] || _t('None');
        const featureId = this.getRecordId(record);
        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coordinates,
                    },
                    properties: {
                        id: featureId,
                        resId: record.resId,
                        name: displayName,
                        description: displayName,
                        isShifted: isShifted,
                        originalCoordinates: originalCoordinates,
                        centerMarkerCoordinates: centerMarkerCoordinates,
                        isSelected: record.selected || false,
                    },
                },
            ],
        };
    }

    /**
     * Prepare data for marker popup rendering
     * Extends base implementation to add isShifted flag for markers with shifted coordinates
     * @param {Object} data - Odoo record data containing title, subTitle, and resId
     * @param {Object} feature - GeoJSON feature object with geometry and properties
     * @returns {Object} Prepared popup data with isShifted flag and base properties
     * @override
     */
    prepareMarkerPopupData(data, feature) {
        const baseContent = super.prepareMarkerPopupData(data, feature);
        const originalProperties = this.getFeatureOriginalProperties(feature);
        // Add original and center coordinates info if shifted
        baseContent.isShifted = feature.properties?.isShifted || originalProperties?.isShifted || false;
        return baseContent;
    }

    /**
     * Validate that required view attributes are present and valid
     * Checks that lngField and latField are defined and exist in the model
     * @throws {Error} If lngField or latField are missing or don't exist in the model
     * @override
     */
    validateViewAttributes() {
        super.validateViewAttributes();
        const { lngField, latField } = this.props.viewAttrs;
        if (!lngField || !latField) {
            throw new Error(
                'Latitude and longitude fields are not defined in view attributes. Please add lat and lng attributes to the view definition.'
            );
        }

        const fieldNames = this.props.list.fieldNames;
        if (!fieldNames.includes(lngField) || !fieldNames.includes(latField)) {
            throw new Error(
                `Invalid view attributes: The specified latitude field "${latField}" and longitude field "${lngField}" do not exist in the model or are not included in the view. Please ensure these fields are present.`
            );
        }
    }

    /**
     * Calculate measurement data for a Point feature
     * Formats coordinates with directional indicators (N/S, E/W)
     * @param {Object} feature - GeoJSON feature to measure
     * @returns {Object|null} Measurement object with type, coordinates, and display_name, or null
     * @override
     */
    calculateFeatureMeasurement(feature) {
        if (!feature || !feature.geometry) return null;

        const { type, coordinates } = feature.geometry;
        let measurements = null;

        if (type === 'Point') {
            measurements = {};
            measurements.type = 'Point';
            const lat = coordinates[1];
            const lng = coordinates[0];
            const latDir = lat >= 0 ? 'N' : 'S';
            const lngDir = lng >= 0 ? 'E' : 'W';
            measurements.coordinates = `${Math.abs(lat).toFixed(
                MEASUREMENT_CONFIG.COORDINATE_PRECISION
            )}°${latDir}, ${Math.abs(lng).toFixed(MEASUREMENT_CONFIG.COORDINATE_PRECISION)}°${lngDir}`;
            measurements.display_name = `Point: ${measurements.coordinates}`;
        }

        return measurements;
    }

    /**
     * Generate popup content values for a marker feature
     * Extends the base implementation and strips the internal originalProperties
     * key to prevent it from being exposed in the rendered popup
     * @param {Object} data - Odoo record data
     * @param {Object} feature - GeoJSON feature object
     * @returns {Object} Popup content values without originalProperties
     * @override
     */
    generateMarkerPopupContentValues(data, feature) {
        const values = super.generateMarkerPopupContentValues(data, feature);
        delete values.originalProperties;
        return values;
    }

    /**
     * Remove cluster-specific map interactions registered on the cluster layer
     * Cleans up click, mouseenter, and mouseleave interaction handlers
     * @private
     */
    removeCustomMapInteractions() {
        if (!this.isMapboxReady()) return;
        this.mapBoxGlJs.removeInteraction(INTERACTION_CLICK_CLUSTER);
        this.mapBoxGlJs.removeInteraction(INTERACTION_CLUSTER_MOUSE_ENTER);
        this.mapBoxGlJs.removeInteraction(INTERACTION_CLUSTER_MOUSE_LEAVE);
    }

    /**
     * Remove all feature interaction handlers including cluster-specific ones
     * Calls the parent implementation and then removes the custom cluster interactions
     * @override
     */
    removeFeatureInteractions() {
        super.removeFeatureInteractions();
        this.removeCustomMapInteractions();
    }
}
