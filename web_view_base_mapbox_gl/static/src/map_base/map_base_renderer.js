import { debounce } from '@web/core/utils/timing';
import { _t } from '@web/core/l10n/translation';
import { isNull } from '@web/views/utils';
import { renderToString } from '@web/core/utils/render';
import { useService, useBus } from '@web/core/utils/hooks';
import { useRef, useEffect, onWillUpdateProps, onWillRender, markup } from '@odoo/owl';
import { BaseMapboxGlComponent } from '@base_mapbox_gl/utils/base_mapbox_gl';
import { lightenColor, validateGeoJson } from '@base_mapbox_gl/utils/utils';
import { MapboxGlSearch } from '@base_mapbox_gl/components/mapbox_search/mapbox_search';
import {
    generateRandomColor,
    calculateFeatureCentroid,
    calculateFeaturesBounds,
    getRecordDataView,
    LAYER_CONFIG,
    SOURCE_CONFIG,
    FEATURE_STYLES,
} from './utils';
import { BaseMapboxGlSidebar } from './map_base_sidebar';

// Error Messages Constants
const ERROR_MESSAGES = {
    INVALID_GEOJSON: _t('Invalid GeoJSON data for record'),
    PROCESSING_FAILED: _t('Failed to process map data for record'),
};

// Configuration Constants
const RENDERER_CONFIG = {
    DEBOUNCE_DELAYS: {
        RENDER: 500,
        UPDATE_MAP: 500,
        CENTER_MAP: 500,
        CUSTOM_EVENT: 10,
    },
    BATCH: {
        RECORD_PROCESSING_SIZE: 100,
        RECORD_PROCESSING_IDLE_TIMEOUT: 10,
        SELECTION_SIZE: 20,
        PROGRESSIVE_PAINT_INTERVAL: 300,
    },
    MAP_ANIMATION: {
        FIT_BOUNDS_PADDING: 50,
        FIT_BOUNDS_MAX_ZOOM: 15,
        FIT_BOUNDS_DURATION: 1000,
    },
    UI: {
        POPUP_FADE_IN_DELAY: 10,
    },
};

export class BaseMapboxGlRenderer extends BaseMapboxGlComponent {
    static template = 'web_view_base_mapbox_gl.BaseMapboxGlRenderer';
    static templatePopupContent = 'web_view_base_mapbox_gl.PopupContent';
    static components = {
        Sidebar: BaseMapboxGlSidebar,
        Search: MapboxGlSearch,
    };
    static props = {
        archInfo: Object,
        openRecord: Function,
        showRecord: Function,
        showRecordsByDomain: Function,
        showUnlocatedRecords: Function,
        unLocatedCount: Number,
        readonly: Boolean,
        list: Object,
        onAdd: { type: Function, optional: true },
        activeActions: { type: Object, optional: true },
        allowSelectors: Boolean,
        viewAttrs: Object,
    };

    setup() {
        super.setup();
        this.validateViewAttributes();
        this.mapDivRef = useRef('map');

        this.uiService = useService('ui');

        this.selectedFeatureIds = new Set();

        // Mapbox-specific state
        this.hoveredFeatureId = null;
        this.mouseMoveDebounce = null;
        this.popup = null;

        // Simple data management
        this.cacheRecordDataView = new Map();
        this.geoJsonData = new Map();
        this.lastRecordsRef = null;
        this.lastSelectionSignature = null;

        // Timeout references for cleanup
        this._timeoutBatchProcessing = null;
        this._timeoutPopupFadeIn = null;

        // Throttle gate for progressive rendering during batch record processing
        this._lastProgressivePaint = 0;

        this.debounceRenderGeolocationData = debounce(
            this.renderGeolocationData.bind(this),
            RENDERER_CONFIG.DEBOUNCE_DELAYS.RENDER
        );
        this.debounceCenterMap = debounce(this.centerMap.bind(this), RENDERER_CONFIG.DEBOUNCE_DELAYS.CENTER_MAP);
        this.debounceUpdateMap = debounce(this.updateMap.bind(this), RENDERER_CONFIG.DEBOUNCE_DELAYS.UPDATE_MAP);
        this.boundHandleMouseMove = debounce(
            this._handleMouseMove.bind(this),
            RENDERER_CONFIG.DEBOUNCE_DELAYS.CUSTOM_EVENT
        );
        this.boundHandleFeatureClick = this._handleFeatureClick.bind(this);
        this.boundHandleFeatureLeave = debounce(
            this._handleFeatureLeave.bind(this),
            RENDERER_CONFIG.DEBOUNCE_DELAYS.CUSTOM_EVENT
        );
        this.boundHandleFeatureHover = debounce(
            this._handleFeatureHover.bind(this),
            RENDERER_CONFIG.DEBOUNCE_DELAYS.CUSTOM_EVENT
        );
        this.boundHandleFeatureSelected = debounce(
            this._handleFeatureSelected.bind(this),
            RENDERER_CONFIG.DEBOUNCE_DELAYS.RENDER
        );

        // Performance-optimized effects
        useEffect(
            (mapIsReady) => {
                if (mapIsReady) {
                    this.debounceRenderGeolocationData();
                }
            },
            () => {
                const mapIsReady = this.isMapboxReady();
                return [mapIsReady];
            }
        );

        onWillUpdateProps((nextProps) => {
            this.onWillUpdatePropsRenderMarkers(nextProps);
        });

        this.editedRecord = null;

        onWillRender(() => {
            this.editedRecord = this.props.list.editedRecord;
        });

        if (this.props.allowSelectors) {
            useBus(this.uiService.bus, 'mapbox-center-map', this.debounceCenterMap);
        }
    }

    /**
     * Handles marker rendering logic before props are updated.
     * Invalidates the marker position index and manages marker lifecycle based on grouping state changes.
     * When switching to grouped view, clears all markers. Otherwise, triggers a debounced render.
     *
     * @param {Object} nextProps - The incoming props object containing the updated state
     * @param {Object} nextProps.list - The list data object
     * @param {boolean} nextProps.list.isGrouped - Whether the next state is grouped
     */
    onWillUpdatePropsRenderMarkers(nextProps) {
        if (!this.isMapboxReady()) return;

        const nextIsGrouped = !!nextProps.list.isGrouped;
        const currentIsGrouped = !!this.props.list.isGrouped;
        const isGroupingChanged = nextIsGrouped !== currentIsGrouped;
        const recordsChanged = nextProps.list.records !== this.lastRecordsRef;

        // Odoo mutates record.selected in place (no new `records` array), so
        // selection toggles must be detected separately from a data reload.
        // The selected subset is normally much smaller than the full record
        // set, so this signature stays cheap regardless of marker count.
        const nextSelectionSignature = nextProps.list.selection.map((r) => r.resId).join(',');
        const selectionChanged = nextSelectionSignature !== this.lastSelectionSignature;

        if (!isGroupingChanged && !recordsChanged && !selectionChanged) {
            return;
        }

        this._hideFeaturePopup();
        this.selectedFeatureIds.clear();
        this.lastSelectionSignature = nextSelectionSignature;

        // cacheRecordDataView holds label/popup formatting, not selection
        // state, so only invalidate it on an actual data reload.
        if (recordsChanged) {
            this.cacheRecordDataView.clear();
            this.lastRecordsRef = nextProps.list.records;
        }

        // Clear all markers when switching to grouped view
        if (isGroupingChanged && nextIsGrouped) {
            if (this.debounceUpdateMap.cancel) {
                this.debounceUpdateMap.cancel();
            }
            if (this.debounceRenderGeolocationData.cancel) {
                this.debounceRenderGeolocationData.cancel();
            }
            this.clearData();
            return;
        }

        // Re-render when not in grouped view (staying ungrouped or switching from grouped)
        if (!nextIsGrouped) {
            // Only a real data reload should recenter the map — a selection
            // toggle must never move the viewport out from under the user.
            this.debounceRenderGeolocationData({ center: recordsChanged });
        }
    }

    /**
     * Get the container element reference for the map
     * @returns {Object} The map container reference
     */
    get containerElement() {
        return this.mapDivRef;
    }

    /**
     * Get the default map style URL from view attributes
     * @returns {string|null} Map style URL or null if not configured
     */
    get defaultMapStyle() {
        return this.props.viewAttrs?.mapStyleUrl || null;
    }

    /**
     * Get the default map projection from view attributes
     * @returns {string|null} Map projection or null if not configured
     */
    get defaultMapProjection() {
        return this.props.viewAttrs?.mapProjection || null;
    }

    /**
     * Main rendering method that processes and displays geolocation data on the map
     * Handles both grouped and ungrouped data rendering
     * @param {Object} options - Rendering options
     * @param {boolean} options.centerMap - Whether to recenter the map after rendering
     * @override
     */
    async renderGeolocationData(options = {}) {
        if (!this.isMapboxReady()) return;

        const datas = this.getGroupsOrRecords();
        const shouldRecenter = options?.center ?? true;

        if (this.props.list.isGrouped) {
            await this.renderGroupedRecords(datas, true, shouldRecenter);
        } else {
            await this.renderUngroupedRecords(datas, true, shouldRecenter);
        }

        this.debounceUpdateMap({ recenter: shouldRecenter });
    }

    /**
     * Clear all existing geolocation data from the map
     */
    clearData() {
        // Remove any existing popups
        this._hideFeaturePopup();

        // Reset feature
        this.resetSourceFeatures();

        // Clean up map layers and sources
        this.removeMapLayers();

        // Clean up map sources
        this.removeMapSources();

        // Clean highlighted features
        this._clearHighlightedFeatures();

        // Reset hovered feature state
        this.hoveredFeatureId = null;

        // Clear data structures
        this.selectedFeatureIds.clear();
        this.geoJsonData.clear();
        this.cacheRecordDataView.clear();
    }

    /**
     * Get a slice of records for batch processing
     * @private
     * @param {Array} records All records
     * @param {number} startIndex Starting index
     * @param {number} batchSize Size of the batch
     * @returns {Array} Batch slice
     */
    _getBatchSlice(records, startIndex, batchSize) {
        return records.slice(startIndex, Math.min(startIndex + batchSize, records.length));
    }

    /**
     * Remove features from the map that no longer correspond to current records
     * @param {Array} records - Current array of records to keep
     * @private
     */
    _removeObsoleteRecordFeatures(records) {
        const recordIds = new Set(records.map((data) => this.getRecordId(data.record || data)));
        for (const featureId of this.geoJsonData.keys()) {
            const recordId = this.extractRecordIdFromFeatureId(featureId);
            if (!recordIds.has(recordId)) {
                this._cleanObsoleteFeature(recordId, featureId);
            }
        }
    }

    /**
     * Process and render a collection of records with optional color
     * @param {Array} datas - Array of records to process
     * @param {string} [color] - Optional color to apply to all records
     * @param {boolean} [removeObsolete=true] - Whether to remove obsolete records
     * @param {boolean} [shouldRecenter=false] - Whether progressive paints between
     *   batches (see {@link _paintProgressively}) should also recenter the map.
     *   Left false for flows that must never move the viewport mid-load (e.g. a
     *   selection toggle); the caller's own final updateMap() call still recenters
     *   when it explicitly asks to, regardless of this flag.
     */
    async renderRecords(datas, color, removeObsolete = true, shouldRecenter = false) {
        const batchSize = RENDERER_CONFIG.BATCH.RECORD_PROCESSING_SIZE;
        const idleTimeout = RENDERER_CONFIG.BATCH.RECORD_PROCESSING_IDLE_TIMEOUT;

        // In grouping case, I don't want to remove the existing features
        if (removeObsolete) {
            this._removeObsoleteRecordFeatures(datas);
        }

        return new Promise((resolve, reject) => {
            let failedCount = 0;
            const errors = [];

            const processBatch = async (startIndex) => {
                try {
                    const endIndex = Math.min(startIndex + batchSize, datas.length);

                    // Create markers in current batch
                    const batchPromises = [];
                    for (let i = startIndex; i < endIndex; i++) {
                        const record = datas[i].record || datas[i];
                        batchPromises.push(
                            this.commitRecordToMap(record, color).catch((err) => {
                                failedCount++;
                                errors.push({ recordId: this.getRecordId(record), error: err });
                                return false; // Continue processing other records
                            })
                        );
                    }

                    // Use allSettled to handle both successes and failures
                    await Promise.allSettled(batchPromises);

                    // Paint what's been processed so far instead of waiting for every
                    // batch to finish — throttled so large datasets (many batches)
                    // don't pay for a setData() call after every single one.
                    this._paintProgressively(shouldRecenter);

                    if (endIndex < datas.length) {
                        this._scheduleNextBatch(() => processBatch(endIndex), idleTimeout);
                    } else {
                        // All batches completed
                        if (failedCount > 0) {
                            console.warn(`Failed to process ${failedCount} records out of ${datas.length}`, errors);
                        }
                        resolve({
                            total: datas.length,
                            processed: datas.length - failedCount,
                            failed: failedCount,
                            errors: errors,
                        });
                    }
                } catch (error) {
                    console.error('Error in batch record processing:', error);
                    reject(error);
                }
            };

            this._scheduleNextBatch(() => processBatch(0), 0);
        });
    }

    /**
     * Paint the map with whatever has been committed to this.geoJsonData so
     * far, throttled to at most once per PROGRESSIVE_PAINT_INTERVAL. Called
     * between record batches so large datasets render incrementally instead
     * of staying blank until every batch finishes.
     *
     * When `shouldRecenter` is true, this also asks to recenter on the data
     * loaded so far — via the already-debounced `centerMap()` (see
     * `debounceCenterMap`), so rapid batches coalesce into one actual
     * `fitBounds()` once things pause, rather than the camera jumping on
     * every batch. Without this, newly-loaded features that land outside the
     * current viewport paint invisibly off-screen until the load's final
     * updateMap() call — progressive painting alone isn't visible unless the
     * camera is also allowed to move toward the incoming data. Safe to call
     * from concurrent batches (grouped rendering runs one renderRecords()
     * per group) since both the throttle gate and the centering debounce
     * are shared, and `centerMap()` always reads the latest full dataset
     * when it actually fires.
     * @param {boolean} [shouldRecenter=false] - Whether to also request a
     *   (debounced) recenter on this paint.
     * @private
     */
    _paintProgressively(shouldRecenter = false) {
        if (!this.isMapboxReady()) return;

        const now = Date.now();
        if (now - this._lastProgressivePaint < RENDERER_CONFIG.BATCH.PROGRESSIVE_PAINT_INTERVAL) return;

        this._lastProgressivePaint = now;
        this.updateMap({ recenter: !!shouldRecenter });
    }

    /**
     * Schedule next batch using optimal timing method
     * @private
     * @param {Function} callback Callback to execute
     * @param {number} timeout Fallback timeout
     */
    _scheduleNextBatch(callback, timeout) {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(callback);
        } else {
            if (this._timeoutBatchProcessing) {
                clearTimeout(this._timeoutBatchProcessing);
                this._timeoutBatchProcessing = null;
            }
            this._timeoutBatchProcessing = setTimeout(callback, timeout);
        }
    }

    /**
     * Remove features that are no longer present in the given grouped records
     * Clears popup and cache before performing cleanup
     * @param {Array} groupRecords - Array of group objects containing records
     */
    cleanupGroupObsoleteRecords(groupRecords) {
        this._hideFeaturePopup();
        this.cacheRecordDataView.clear();
        const groupRecordIds = new Set();

        for (const { group } of groupRecords) {
            for (const record of group.list.records) {
                const recordId = this.getRecordId(record);
                groupRecordIds.add(recordId);
            }
        }

        if (groupRecordIds.size) {
            for (const featureId of this.geoJsonData.keys()) {
                const recordId = this.extractRecordIdFromFeatureId(featureId);
                if (!groupRecordIds.has(recordId)) {
                    this._cleanObsoleteFeature(recordId, featureId);
                }
            }
        }
    }

    /**
     * Clean up a single obsolete feature from all data structures
     * @param {string} recordId - The record ID to clean
     * @param {string} featureId - The feature ID to remove
     * @private
     */
    _cleanObsoleteFeature(recordId, featureId) {
        this.geoJsonData.delete(featureId);
        this.selectedFeatureIds.delete(featureId);
        this.cacheRecordDataView.delete(recordId);
    }

    /**
     * Extract record ID from feature ID format: recordId-featureIndex
     * @param {string} featureId - The feature ID to extract from
     * @returns {string} The extracted record ID
     */
    extractRecordIdFromFeatureId(featureId) {
        const parts = featureId.toString().split('-');
        return parts[0] || featureId;
    }

    /**
     * Render ungrouped records without group colors
     * @param {Array} datas - Array of ungrouped records
     * @param {boolean} removeObsolete - Whether to remove obsolete records
     * @param {boolean} [shouldRecenter=false] - Forwarded to renderRecords(), see
     *   {@link _paintProgressively}.
     */
    async renderUngroupedRecords(datas, removeObsolete = true, shouldRecenter = false) {
        await this.renderRecords(datas, null, removeObsolete, shouldRecenter);
    }

    /**
     * Render grouped records with their respective group colors
     * @param {Array} datas - Array of grouped data objects
     * @param {boolean} removeObsolete - Whether to remove obsolete records
     * @param {boolean} [shouldRecenter=false] - Forwarded to renderRecords(), see
     *   {@link _paintProgressively}.
     */
    async renderGroupedRecords(datas, removeObsolete = true, shouldRecenter = false) {
        const groupedPromises = datas.map(async ({ group }) => {
            try {
                await this.renderRecords(group.list.records, group.groupColor, removeObsolete, shouldRecenter);
            } catch (error) {
                console.error('Failed to load group records:', error);
            }
        });
        await Promise.all(groupedPromises);
    }

    /**
     * Render grouped records without removing obsolete features and fit map bounds
     * @param {Array} datas - Array of grouped data objects
     * @private
     */
    async _renderGroupedRecordsFitBounds(datas) {
        await this.renderGroupedRecords(datas, false);
        this.debounceUpdateMap();
    }

    /**
     * Deletes all markers associated with the given group records.
     * Cleans up markers from the cache and map, then adjusts the map bounds.
     *
     * @param {Array<Object>} groupRecords - Array of record objects to delete from the map
     * @returns {Promise<void>}
     */
    async deleteGroupRecords(groupRecords) {
        if (!this.isMapboxReady() || groupRecords.length === 0) return;

        this._hideFeaturePopup();

        const groupRecordIds = new Set();

        for (const { group } of groupRecords) {
            for (const record of group.list.records) {
                const recordId = this.getRecordId(record);
                groupRecordIds.add(recordId);
            }
        }

        for (const featureId of this.geoJsonData.keys()) {
            const recordId = this.extractRecordIdFromFeatureId(featureId);
            if (groupRecordIds.has(recordId)) {
                this._cleanObsoleteFeature(recordId, featureId);
            }
        }

        this.debounceUpdateMap();
    }

    /**
     * Get all records from the list, flattening grouped data if necessary
     * @returns {Array} Array of all records
     */
    getRecords() {
        const { list } = this.props;

        if (list.isGrouped) {
            // For grouped data, flatten all records from all groups
            const allRecords = [];
            list.groups.forEach((group) => {
                if (group.list && group.list.records) {
                    allRecords.push(...group.list.records);
                }
            });
            return allRecords;
        } else {
            // For ungrouped data, just return the records
            return list.records || [];
        }
    }

    /**
     * Find a record by its ID
     * @param {number} id - The record ID to search for
     * @returns {Object|undefined} The found record or undefined
     */
    getRecordById(id) {
        const records = this.getRecords();
        return records.find((record) => record.resId === id);
    }

    /**
     * Find GeoJSON feature by record ID
     * @param {number|string} resId - The record ID to search for (supports both number and string)
     * @returns {Object|undefined} The found GeoJSON feature or undefined if not found
     */
    getGeoJsonByRecordId(resId) {
        // Try direct lookup first (O(1) operation)
        const directMatch = this.geoJsonData.get(resId);
        if (directMatch) {
            return directMatch;
        }

        // Fallback: iterate Map directly without creating intermediate array
        // Only needed for IDs with suffixes like "123-456"
        for (const geoJson of this.geoJsonData.values()) {
            if (geoJson.id && (geoJson.id === resId || geoJson.id.startsWith(`${resId}-`))) {
                return geoJson;
            }
        }

        return undefined;
    }

    /**
     * Commit record changes to the map if the record has changed
     * @param {Object} record - The record containing GeoJSON data
     * @param {string} [featureColor] - Optional color to apply to features
     * @returns {Promise<boolean>} Promise that resolves to true if changes were committed, false otherwise
     * @throws {Error} Rejects the promise if committing fails with an error
     */
    async commitRecordToMap(record, featureColor) {
        try {
            const geoJson = this.getRecordGeoJsonData(record);
            if (!validateGeoJson(geoJson)) {
                this.handleInvalidGeoJson(record);
                return false;
            }

            const recordFeatures = this.prepareRecordFeatures(geoJson, record, featureColor);

            // remove old features for this record
            this._removeRecordFeatures(record);

            const hasFeatures = Object.keys(recordFeatures).length > 0;

            if (hasFeatures) {
                for (const [featureId, feature] of Object.entries(recordFeatures)) {
                    this.geoJsonData.set(featureId, feature);
                }
            }

            return hasFeatures;
        } catch (error) {
            console.error(`Error processing record ${record.resId}:`, error);
            this.notificationService?.add(`${ERROR_MESSAGES.PROCESSING_FAILED} ${record.resId}`, { type: 'warning' });
            throw error;
        }
    }

    /**
     * Remove all features associated with a specific record
     * @param {Object} record - The record whose features should be removed
     * @private
     */
    _removeRecordFeatures(record) {
        const recordId = this.getRecordId(record);
        this.cacheRecordDataView.delete(recordId);
        for (const featureId of this.geoJsonData.keys()) {
            if (featureId.startsWith(`${recordId}-`)) {
                this._cleanObsoleteFeature(recordId, featureId);
            }
        }
    }

    /**
     * Determine the colors to use for a record's features
     * @param {Object} record - The record object
     * @param {string} [featureColor] - Optional override color
     * @returns {Object} Object containing strokeColor and fillColor
     * @returns {string} returns.strokeColor - Lightened stroke color (95% lightness, 100% opacity)
     * @returns {string} returns.fillColor - Base fill color
     * @private
     */
    _determineRecordColors(record, featureColor) {
        const dataView = this.getRecordDataView(record);
        const baseColor = featureColor || dataView?.other?.__geoColor || generateRandomColor();

        return {
            strokeColor: lightenColor(baseColor, 0.95, 1),
            fillColor: baseColor,
        };
    }

    /**
     * Prepare record information object for popups
     * @param {Object} record - The record object
     * @returns {Object} Record information object
     * @private
     */
    _prepareRecordInfo(record) {
        const dataView = this.getRecordDataView(record);
        const title = dataView?.other?.title || 'Feature';
        const subTitle = (dataView?.other?.subTitle || '').replace(title, '').trim();

        return {
            title,
            subTitle,
            resId: record.resId,
            isSelected: record.selected || false,
        };
    }

    /**
     * Process all features in a GeoJSON FeatureCollection
     * @param {Object} geoJson - The GeoJSON FeatureCollection
     * @param {Object} record - The parent record
     * @param {Object} colors - Color configuration object
     * @returns {Array} Array of processed feature objects
     * @private
     */
    prepareRecordFeatures(geoJson, record, featureColor) {
        const recordId = this.getRecordId(record);

        // Determine colors for this record
        const colors = this._determineRecordColors(record, featureColor);

        // Prepare record metadata for popups
        const recordInfo = this._prepareRecordInfo(record);

        const features = {};

        let featureIndex = 0;
        for (const feature of geoJson.features) {
            try {
                const featureId = `${recordId}-${featureIndex}`;

                if (!this.validateFeatureGeometry(feature)) {
                    console.warn(`Invalid geometry for feature ${featureId} in record ${recordId}`);
                    featureIndex++;
                    continue;
                }

                const processedFeature = this._createRecordFeature(feature, featureId, colors, recordInfo);
                features[featureId] = processedFeature;
            } catch (error) {
                console.warn(`Error processing feature ${featureIndex} in record ${recordId}:`, error);
            }
            featureIndex++;
        }
        return features;
    }

    /**
     * Create a processed feature object with properties for Mapbox GL JS
     * @param {Object} feature - The original GeoJSON feature
     * @param {string} featureId - Unique feature identifier
     * @param {Object} colors - Color configuration object
     * @param {Object} recordInfo - Record information for popups
     * @returns {Object} Processed feature object
     * @private
     */
    _createRecordFeature(feature, featureId, colors, recordInfo) {
        const { strokeColor, fillColor } = colors;
        const result = {
            id: featureId,
            type: 'Feature',
            geometry: feature.geometry,
            properties: {
                fillColor,
                strokeColor,
                odoo: recordInfo,
                color: colors.fillColor,
                resId: recordInfo.resId,
                isSelected: recordInfo.isSelected,
                _originalProperties: feature.properties,
            },
        };
        return result;
    }

    /**
     * Validate individual feature geometry
     * @param {Object} feature - The feature to validate
     * @returns {boolean} True if valid feature geometry
     */
    validateFeatureGeometry(feature) {
        return (
            feature &&
            feature.geometry &&
            feature.geometry.type &&
            feature.geometry.coordinates &&
            Array.isArray(feature.geometry.coordinates)
        );
    }

    /**
     * Handle invalid GeoJSON data
     * @param {Object} record - The record with invalid GeoJSON
     */
    handleInvalidGeoJson(record) {
        console.warn(`${ERROR_MESSAGES.INVALID_GEOJSON} ${record.resId}`);
    }

    /**
     * Remove all map layers and sources
     * @override
     */
    removeMapLayers() {
        if (!this.isMapboxReady() || !this.mapBoxGlJs) return;

        // Before removing layers, remove feature interactions first
        this.removeFeatureInteractions();

        const { layers } = this._getCustomMapData();

        if (Array.isArray(layers) && layers.length > 0) {
            layers.forEach(({ layer }) => {
                this._removeMapLayer(layer);
            });
        }
    }

    /**
     * Remove a specific map layer
     * @param {Object} layer - The layer object to remove from the map
     */
    _removeMapLayer(layer) {
        if (layer && layer.constructor === Object) {
            const layerId = layer.id;
            if (layerId && this.mapBoxGlJs.getLayer(layerId)) {
                this.mapBoxGlJs.removeLayer(layerId);
            }
        }
    }

    /**
     * Remove all custom map sources
     */
    removeMapSources() {
        if (!this.isMapboxReady() || !this.mapBoxGlJs) return;

        const { sources } = this._getCustomMapData();

        if (sources && sources.constructor === Object) {
            Object.keys(sources).forEach((sourceId) => {
                const source = sources[sourceId];
                this._removeMapSource(sourceId, source);
            });
        }
    }

    /**
     * Remove a specific map source
     * @param {String} sourceId - The source ID to remove from the map
     * @param {Object} source - The source object to remove from the map
     */
    _removeMapSource(sourceId, source) {
        if (sourceId && source && source.constructor === Object) {
            if (this.mapBoxGlJs.getSource(sourceId)) {
                this.mapBoxGlJs.removeSource(sourceId);
            }
        }
    }

    /**
     * Reset the GeoJSON source data to an empty FeatureCollection
     */
    resetSourceFeatures() {
        if (!this.isMapboxReady() || !this.mapBoxGlJs) return;

        const source = this.mapBoxGlJs.getSource(SOURCE_CONFIG.GEOJSON_SOURCE);
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: [],
            });
        }
    }

    /**
     * Ensure the GeoJSON source exists and is up to date.
     * Layer creation is left to subclasses' addGeometryLayers() overrides
     * (which all call super.addGeometryLayers() first, then add their own
     * layers). Those _addXxxLayer() methods are idempotent — each guards
     * with `if (getLayer(id)) return;` — so calling this repeatedly (e.g.
     * on every data update) only touches layers that don't exist yet,
     * instead of tearing down and rebuilding every layer and interaction
     * on every call. Full teardown is intentionally NOT done here; see
     * clearData() and cleanUp() for the cases that do need a full
     * removeMapLayers() (switching to grouped view, unmount).
     */
    addGeometryLayers() {
        if (!this.isMapboxReady()) return;

        // Add or update the GeoJSON source
        this.addGeoJsonSource();
    }

    /**
     * Add or update the GeoJSON data source
     * @abstract
     * @throws {Error} Must be implemented by subclass
     * @private
     */
    addGeoJsonSource() {
        // To be implemented in subclasses
        throw new Error('Abstract method addGeoJsonSource must be implemented by subclass');
    }

    /**
     * Check if there is any GeoJSON data to display
     * @returns {boolean} True if there is data to display
     */
    get hasData() {
        return this.geoJsonData.size > 0;
    }

    /**
     * Update the map with processed GeoJSON data
     * Creates or updates map layers and sources
     * @abstract
     * @param {Object} [options]
     * @param {boolean} [options.recenter=true] - Whether to refit the camera to the data.
     *   Callers pass `false` when re-invoking this only to restore layers after a style
     *   change (setStyle() wipes custom layers/sources), where the user's current pan/zoom
     *   should be left untouched.
     * @throws {Error} Must be implemented by subclass
     */
    updateMap(options = {}) {
        // To be implemented in subclasses
        throw new Error('Abstract method updateMap must be implemented by subclass');
    }

    /**
     * Center and fit the map to show all features
     * Calculates bounds from all features and fits the map view
     */
    centerMap() {
        if (!this.isMapboxReady()) return;
        const featureSelected = this.getFeaturesSelected();
        if (featureSelected.length > 0) {
            this._mapFitBounds(featureSelected);
        } else {
            const features = Array.from(this.geoJsonData.values());
            this._mapFitBounds(features);
        }
    }

    /**
     * Center map on group of records
     * Logs warnings when features are not found for records
     * @param {Array} records - Array of records to center on
     * @returns {void} Returns early if no valid features are found
     */
    centerMapByGroup(records) {
        if (!this.isMapboxReady() || !records || records.length <= 0) return;
        const features = [];
        let missingCount = 0;

        records.forEach((record) => {
            const recordId = this.getRecordId(record);
            const feature = this.getGeoJsonByRecordId(recordId);
            if (feature) {
                features.push(feature);
            } else {
                missingCount++;
                console.warn(`No GeoJSON feature found for record ${recordId} while centering map.`);
            }
        });
        if (features.length === 0) {
            console.warn(
                `Cannot center map: no valid features found for ${records.length} records (${missingCount} missing).`
            );
            return;
        }
        if (missingCount > 0) {
            console.warn(
                `Centering map on ${features.length} features; ${missingCount} records had no valid features.`
            );
        }
        this._mapFitBounds(features);
    }

    /**
     * Fit map bounds to show all provided features
     * @param {Array} features - Array of GeoJSON features to fit
     * @returns {void} Returns early if features array is empty or bounds are invalid
     * @throws {Error} Logs error if fitBounds operation fails
     * @private
     */
    _mapFitBounds(features) {
        if (features.length === 0 || !this.mapBoxGlJs) return;

        // Calculate bounding box from geometry coordinates
        const {
            minLng = Infinity,
            minLat = Infinity,
            maxLng = -Infinity,
            maxLat = -Infinity,
        } = calculateFeaturesBounds(features);

        // Check if we have valid bounds
        if (minLng === Infinity || minLat === Infinity || maxLng === -Infinity || maxLat === -Infinity) {
            console.warn('Could not calculate valid bounds for features');
            return;
        }

        try {
            this.mapBoxGlJs.fitBounds(
                [
                    [minLng, minLat],
                    [maxLng, maxLat],
                ],
                {
                    padding: RENDERER_CONFIG.MAP_ANIMATION.FIT_BOUNDS_PADDING,
                    maxZoom: RENDERER_CONFIG.MAP_ANIMATION.FIT_BOUNDS_MAX_ZOOM,
                    duration: RENDERER_CONFIG.MAP_ANIMATION.FIT_BOUNDS_DURATION,
                }
            );
        } catch (error) {
            console.error('Error fitting map to bounds:', error);
        }
    }

    /**
     * Handle map loaded event
     * Sets up style change listeners and calls parent implementation
     * @override
     */
    onMapLoaded() {
        // Call parent method to render style switcher
        super.onMapLoaded();

        // Listen for style changes to restore our custom features. Only restore layers —
        // don't refit the camera, since a style switch isn't a data change and shouldn't
        // move the view the user already has.
        this.boundHandleStyleLoad = () => this.debounceUpdateMap({ recenter: false });
        this.mapBoxGlJs.on('style.load', this.boundHandleStyleLoad);
    }

    /**
     * Enhanced cleanup with proper memory management
     * Cleans up all event listeners, popups, and data structures
     * @override
     */
    cleanUp() {
        this._hideFeaturePopup();

        if (this._timeoutBatchProcessing) {
            clearTimeout(this._timeoutBatchProcessing);
            this._timeoutBatchProcessing = null;
        }
        if (this._timeoutPopupFadeIn) {
            clearTimeout(this._timeoutPopupFadeIn);
            this._timeoutPopupFadeIn = null;
        }

        if (this.debounceRenderGeolocationData.cancel) {
            this.debounceRenderGeolocationData.cancel();
        }
        if (this.debounceCenterMap.cancel) {
            this.debounceCenterMap.cancel();
        }
        if (this.debounceUpdateMap.cancel) {
            this.debounceUpdateMap.cancel();
        }
        if (this.boundHandleMouseMove.cancel) {
            this.boundHandleMouseMove.cancel();
        }
        if (this.boundHandleFeatureLeave.cancel) {
            this.boundHandleFeatureLeave.cancel();
        }
        if (this.boundHandleFeatureHover.cancel) {
            this.boundHandleFeatureHover.cancel();
        }
        if (this.boundHandleFeatureSelected.cancel) {
            this.boundHandleFeatureSelected.cancel();
        }

        if (this.mapBoxGlJs && this.boundHandleStyleLoad) {
            this.mapBoxGlJs.off('style.load', this.boundHandleStyleLoad);
        }
        this.boundHandleStyleLoad = null;

        // Clean up record data view cache
        this.cacheRecordDataView.clear();

        // Clean up map layers and sources
        this.removeMapLayers();

        // Clean up map sources
        this.removeMapSources();

        // Clear data structures
        this.selectedFeatureIds.clear();
        this.geoJsonData.clear();

        // Call parent cleanup
        super.cleanUp();
    }

    // ===================================================================
    // SIDEBAR FUNCTIONALITY
    // ===================================================================

    /**
     * Toggle sidebar expand/collapse state
     * Resizes map after toggle to maintain proper dimensions
     */
    /**
     * Get sidebar properties configuration for the sidebar component
     * @returns {Object} Configuration object for sidebar component
     */
    get sidebarProps() {
        const { viewTitle, titleField, descriptionField } = this.props.archInfo;
        return {
            header: viewTitle,
            title: titleField || '',
            unLocatedCount: this.props.unLocatedCount ?? 0,
            subTitle: descriptionField || '',
            getGroupsOrRecords: this.getGroupsOrRecords.bind(this),
            toggleGroup: this.toggleGroup.bind(this),
            renderGroupedRecordsFitBounds: this._renderGroupedRecordsFitBounds.bind(this),
            openRecord: this.props.openRecord.bind(this),
            showRecordsByDomain: this.props.showRecordsByDomain.bind(this),
            showUnlocatedRecords: this.props.showUnlocatedRecords.bind(this),
            pointInMap: this.pointInMap.bind(this),
            deleteGroupRecords: this.deleteGroupRecords.bind(this),
            handleToggleRecordSelection: this.toggleRecordSelection.bind(this),
            handleToggleSelection: this.toggleSelectionAll.bind(this),
            handleCanSelectRecord: this.canSelectRecord,
            handleSelectAll: this.props.allowSelectors ? this.selectAll : false,
            allowSelectors: this.props.allowSelectors,
            isGrouped: !!this.props.list.isGrouped,
        };
    }

    /**
     * Check if records can be selected
     * @returns {boolean} True if records can be selected
     */
    get canSelectRecord() {
        return !this.props.list.editedRecord && !this.props.list.model.useSampleModel;
    }

    /**
     * Check if all records are selected
     * @returns {boolean} True if all records are selected
     */
    get selectAll() {
        const records = this.getRecords();
        return records.length > 0 && records.every((record) => record.selected);
    }

    /**
     * Toggles the expansion/collapse state of a group in the sidebar.
     * Sets a flag to indicate this is a sidebar-initiated action.
     *
     * @param {Object} group - The group object to toggle
     * @returns {Promise<void>}
     */
    async toggleGroup(group) {
        await group.toggle();
    }

    /**
     * Get current groups or records data for sidebar
     * @returns {Array} Array of group or record data
     */
    getGroupsOrRecords() {
        const { list } = this.props;
        let result;

        if (list.isGrouped) {
            result = [...list.groups]
                .sort((a, b) => (a.value && !b.value ? 1 : !a.value && b.value ? -1 : 0))
                .map((group, i) => ({
                    group,
                    key: isNull(group.value) ? `group_key_${i}` : `${String(group.value)}_${i}`,
                }));
        } else {
            result = list.records.map((record) => ({ record, key: record.id }));
        }
        return result;
    }

    /**
     * Get record ID as string
     * @param {Object} record - The record object
     * @returns {string} The record ID as string
     */
    getRecordId(record) {
        return (record.resId || record.id).toString();
    }

    /**
     * Zoom and center map on a specific record
     * @abstract
     * @param {Object} record - Record to focus on
     * @throws {Error} Must be implemented by subclass
     */
    pointInMap(record) {
        // To be implemented by subclasses
        throw new Error('Abstract method pointInMap must be implemented by subclass');
    }

    /**
     * Toggle record selection
     * @param {Object} record - Record to toggle
     */
    toggleRecordSelection(record) {
        if (!record || !this.canSelectRecord) return;
        record.toggleSelection();
    }

    /**
     * Process a batch of records for selection
     * @private
     * @param {Array} batch Batch of records to process
     * @param {boolean} shouldSelect Whether to select or deselect
     * @returns {Promise} Promise resolving when batch is processed
     */
    async _processBatchRecords(batch, shouldSelect) {
        const batchPromises = batch.map((record) => record.toggleSelection(shouldSelect));

        await Promise.all(batchPromises);
    }

    /**
     * Enhanced batch processing with configuration and infinite loop protection
     * Processes records in batches with retry mechanism for stalled operations
     * @param {Array} records - Records to process
     * @param {boolean} shouldSelect - Whether to select or deselect
     * @returns {Promise<void>} Promise resolving when complete
     * @throws {Error} Rejects with error if batch processing stalls after max retries (3 attempts)
     * or if processing encounters an unrecoverable error
     * @private
     */
    _processSelectionInBatches(records, shouldSelect) {
        const selectionSize = RENDERER_CONFIG.BATCH.SELECTION_SIZE;
        const totalRecords = records.length;
        let processedCount = 0;
        const maxRetries = 3;
        let retryCount = 0;

        return new Promise((resolve, reject) => {
            const processBatch = async () => {
                try {
                    // Safety check: prevent infinite loop
                    if (processedCount >= totalRecords) {
                        resolve();
                        return;
                    }

                    const batch = this._getBatchSlice(records, processedCount, selectionSize);
                    const previousCount = processedCount;

                    await this._processBatchRecords(batch, shouldSelect);

                    processedCount += batch.length;

                    // Safety check: ensure progress is being made
                    if (processedCount === previousCount && batch.length > 0) {
                        retryCount++;
                        if (retryCount > maxRetries) {
                            reject(new Error('Selection batch processing stalled - no progress after retries'));
                            return;
                        }
                        console.warn(
                            `Batch processing stalled at ${processedCount}/${totalRecords}, retry ${retryCount}/${maxRetries}`
                        );
                    } else {
                        retryCount = 0; // Reset retry count on successful progress
                    }

                    if (processedCount < totalRecords) {
                        setTimeout(processBatch, 0);
                    } else {
                        resolve();
                    }
                } catch (error) {
                    console.error('Error in batch selection processing:', error);
                    reject(error);
                }
            };

            processBatch();
        });
    }

    /**
     * Toggle all records selection state
     * Toggles between selecting all records or deselecting all records
     */
    toggleSelectionAll() {
        const list = this.props.list;
        if (!this.canSelectRecord) {
            return Promise.resolve();
        }

        const recordsToUpdate = [...list.records];
        const shouldSelect = list.selection.length !== recordsToUpdate.length;
        // Process records in batches for better UI responsiveness
        return this._processSelectionInBatches(recordsToUpdate, shouldSelect);
    }

    /**
     * Parse the GeoJSON data from Odoo record
     * @abstract
     * @param {Object} record - Odoo record
     * @returns {Object} GeoJSON FeatureCollection
     * @throws {Error} Must be implemented by subclass
     */
    getRecordGeoJsonData(record) {
        throw new Error('Abstract method getRecordGeoJsonData must be implemented by subclass');
    }

    /**
     * Hide and remove the current feature popup
     * @private
     */
    _hideFeaturePopup() {
        try {
            this.popup?.remove();
        } catch (error) {
            console.warn('Error removing popup:', error);
        }
        this.popup = null;
    }

    /**
     * Show popup with feature information
     * Handles multiple coordinate sources: lngLat event property, screen point conversion, or feature centroid
     * @param {Object} e - Event object containing coordinates
     * @param {Object} feature - GeoJSON feature object
     * @throws {Error} Logs error if JSON parsing fails or popup creation encounters issues
     * @private
     */
    _showFeaturePopup(e, feature) {
        const odooData = feature.properties?.odoo;
        if (!odooData) return;

        // Always ensure any existing popup is removed first
        this._hideFeaturePopup();

        try {
            const data = typeof odooData === 'string' ? JSON.parse(odooData) : odooData;
            const popupContent = this.generateMarkerPopupContent(data, feature);
            // Get popup coordinates - handle different event sources
            let popupCoords;
            if (e.lngLat) {
                // Standard mouseenter event
                popupCoords = e.lngLat;
            } else if (e.point && this.mapBoxGlJs) {
                // Mouse move event - convert screen coordinates to lng/lat
                popupCoords = this.mapBoxGlJs.unproject(e.point);
            } else {
                // Fallback: calculate centroid of the feature
                popupCoords = calculateFeatureCentroid(feature);
            }

            // Validate coordinates before creating popup
            if (!popupCoords || typeof popupCoords.lng !== 'number' || typeof popupCoords.lat !== 'number') {
                console.warn('Invalid popup coordinates calculated, cannot display popup');
                return;
            }

            this.popup = new window.mapboxgl.Popup({
                closeButton: true,
                closeOnClick: true,
                className: 'mapbox-feature-popup enhanced-popup',
                maxWidth: '300px',
            })
                .setLngLat(popupCoords)
                .setHTML(popupContent)
                .addTo(this.mapBoxGlJs);

            // Add smooth fade-in animation
            const popupElement = this.popup.getElement();
            if (popupElement) {
                popupElement.style.opacity = '0';
                popupElement.style.transition = 'opacity 0.3s ease';
                if (this._timeoutPopupFadeIn) {
                    clearTimeout(this._timeoutPopupFadeIn);
                    this._timeoutPopupFadeIn = null;
                }
                this._timeoutPopupFadeIn = setTimeout(() => {
                    popupElement.style.opacity = '1';
                }, RENDERER_CONFIG.UI.POPUP_FADE_IN_DELAY);
            }
        } catch (error) {
            console.error('Error parsing odoo data for popup:', error);
        }
    }

    /**
     * Prepare data for marker popup rendering
     * @param {Object} data - Odoo record data containing title, subTitle, and resId
     * @param {Object} feature - GeoJSON feature object with geometry and properties
     * @returns {Object} Prepared popup data with geometryType, featureColor, and original data
     */
    prepareMarkerPopupData(data, feature) {
        const geometryType = feature.geometry?.type || 'Unknown';
        const featureColor = feature.properties?.color || FEATURE_STYLES.COLORS.HOVER.FILL;
        return { geometryType, featureColor, data };
    }

    /**
     * Calculate measurements for a feature (e.g., coordinates, area, length)
     * @param {Object} feature - GeoJSON feature object
     * @returns {Object|null} Measurement object or null if not applicable
     */
    calculateFeatureMeasurement(feature) {
        // To be implemented in subclasses if needed
        return null;
    }

    /**
     * Generate HTML content for marker popup
     * @param {Object} data - Odoo record data containing title, subTitle, and resId
     * @param {Object} feature - GeoJSON feature object with geometry and properties
     * @returns {string} HTML string for popup content
     */
    generateMarkerPopupContent(data, feature) {
        const values = this.generateMarkerPopupContentValues(data, feature);
        const content = renderToString(this.constructor.templatePopupContent, values);
        return content;
    }

    /**
     * Generate values for marker popup content rendering
     * @param {Object} data - Odoo record data containing title, subTitle, and resId
     * @param {Object} feature - GeoJSON feature object with geometry and properties
     * @returns {Object} Template values including popup data, measurements, and properties
     */
    generateMarkerPopupContentValues(data, feature) {
        const values = this.prepareMarkerPopupData(data, feature);
        let properties = this._getFeatureProperties(feature);
        if (properties && Object.keys(properties).length > 0) {
            values.originalProperties = properties;
        }
        const measurements = this.calculateFeatureMeasurement(feature);
        if (measurements) {
            values.measurements = (measurements?.display_name || '').split('|');
        }
        if (values.data) {
            const odooData = values.data;
            const subTitle = (odooData.subTitle || '')
                .replace('\n\n', '\n')
                .split('\n')
                .filter((line) => line.trim())
                .join('<br>')
                .trim();
            odooData.subTitle = markup(subTitle);
            values.data = odooData;
        }
        return values;
    }

    /**
     * Handle feature selection events
     * @abstract
     * @throws {Error} Must be implemented by subclass
     * @private
     */
    _handleFeatureSelected() {
        throw new Error('Abstract method _handleFeatureSelected must be implemented by subclass');
    }

    /**
     * Extract original properties from a feature
     * @param {Object} feature - GeoJSON feature object
     * @returns {Object} Original properties object, or empty object if unavailable
     * @private
     */
    _getFeatureProperties(feature) {
        return this.getFeatureOriginalProperties(feature);
    }

    /**
     * Get all currently selected features from the GeoJSON data
     * @returns {Array} Array of selected GeoJSON features
     */
    getFeaturesSelected() {
        if (!this.isMapboxReady()) return [];

        const selectedFeatures = [];
        for (const feature of this.geoJsonData.values()) {
            const isSelected = feature.properties?.isSelected || false;
            if (isSelected) {
                selectedFeatures.push(feature);
            }
        }
        return selectedFeatures;
    }

    /**
     * Clear all highlighted features on the map by resetting the 'hover'
     * feature-state for every id tracked in selectedFeatureIds (set by
     * _highlightFeatures), then clearing the set. Subclasses using a
     * different highlight mechanism (e.g. a filtered layer) may override
     * this instead of relying on feature-state.
     * @returns {void}
     */
    _clearHighlightedFeatures() {
        if (!this.isMapboxReady()) return;
        for (const id of this.selectedFeatureIds) {
            this.mapBoxGlJs.setFeatureState({ source: SOURCE_CONFIG.GEOJSON_SOURCE, id: id }, { hover: false });
        }
        this.selectedFeatureIds.clear();
    }

    /**
     * Highlight features on the map based on the given feature's resId
     * @param {Object} feature - GeoJSON feature object with geometry and properties
     * @returns {void}
     */
    _highlightFeatures(feature) {
        if (!this.isMapboxReady()) return;

        const featuresSource = this.mapBoxGlJs
            .querySourceFeatures(SOURCE_CONFIG.GEOJSON_SOURCE, {
                filter: ['==', ['get', 'resId'], feature.properties.resId],
            })
            .map((f) => f.id);

        for (const id of featuresSource) {
            this.selectedFeatureIds.add(id);
            this.mapBoxGlJs.setFeatureState({ source: SOURCE_CONFIG.GEOJSON_SOURCE, id: id }, { hover: true });
        }
    }

    /**
     * Handle mouse move for adjacent polygon detection
     * Provides more reliable hover detection for touching polygons
     * Can be implemented in subclasses for custom hover behavior
     * @param {Object} e - Mouse move event object
     * @private
     */
    _handleMouseMove(e) {
        // To be implemented in subclasses if needed
    }

    /**
     * Handle feature mouse leave events
     * Removes hover styling and hides popup with delay for adjacent polygons
     * @private
     */
    _handleFeatureLeave(e) {
        if (!this.isMapboxReady()) return;
        this.mapBoxGlJs.getCanvas().style.cursor = '';
        this._clearHighlightedFeatures();
        this._hideFeaturePopup();
        this.hoveredFeatureId = null;
    }

    /**
     * Handle feature hover events
     * Shows popup and applies hover styling to features
     * @param {Object} e - Hover event object
     * @private
     */
    _handleFeatureHover(e) {
        if (!this.isMapboxReady()) return;
        this._clearHighlightedFeatures();
        this._hideFeaturePopup();
        if (!e.features || e.features.length === 0) {
            console.warn('Feature has no ID from Mapbox, hover state cannot work');
            return;
        }

        const feature = e.features[0];
        this.hoveredFeatureId = feature.id;

        // Change the cursor style as a UI indicator.
        this.mapBoxGlJs.getCanvas().style.cursor = 'pointer';

        this._highlightFeatures(feature);
        this._showFeaturePopup(e, feature);
    }

    /**
     * Handle feature click events
     * Opens the record detail view when a feature is clicked
     * @param {Object} e - Click event object
     * @private
     */
    _handleFeatureClick(e) {
        if (!e.features || e.features.length === 0) return;

        try {
            const feature = e.features[0];
            const resId = feature.properties.resId;
            if (resId) {
                const record = this.getRecordById(resId);
                if (record) {
                    this.props.showRecord(record);
                }
            }
        } catch (error) {
            console.error('Error handling feature click:', error);
        }
    }

    /**
     * Remove all feature interaction handlers to prevent memory leaks
     * Cleans up event listeners when component is destroyed or data changes
     */
    removeFeatureInteractions() {
        if (!this.isMapboxReady()) return;

        // Remove global mouse move handler
        this.mapBoxGlJs.off('mousemove', this.boundHandleMouseMove);

        const allLayerIds = Object.values(LAYER_CONFIG);

        for (const layerId of allLayerIds) {
            try {
                if (this.mapBoxGlJs.getLayer(layerId)) {
                    this.mapBoxGlJs.off('click', layerId, this.boundHandleFeatureClick);
                    this.mapBoxGlJs.off('mouseleave', layerId, this.boundHandleFeatureLeave);
                }
            } catch (error) {
                // Layer might not exist, ignore error
                console.warn(`Could not remove interactions for layer ${layerId}:`, error);
            }
        }
    }

    /**
     * Validate view attributes for title and subtitle fields
     * @throws {Error} If title or subtitle fields do not exist in model fields
     */
    validateViewAttributes() {
        const { title, subTitle } = this.props.viewAttrs;
        const fieldNames = this.props.list.fieldNames;
        if (title && !fieldNames.includes(title)) {
            throw new Error(
                `The title field "${title}" does not exist in the model fields. Please make sure it is included in the view's fields.`
            );
        }
        if (subTitle && !fieldNames.includes(subTitle)) {
            throw new Error(
                `The subTitle field "${subTitle}" does not exist in the model fields. Please make sure it is included in the view's fields.`
            );
        }
    }

    /**
     * Get data view for a record, with caching
     * @param {Object} Odoo record
     * @returns Object Data view for the record
     */
    getRecordDataView(record) {
        if (!record) return {};

        const recordId = this.getRecordId(record);
        if (this.cacheRecordDataView.has(recordId)) {
            const cachedDataView = this.cacheRecordDataView.get(recordId);
            return cachedDataView;
        }
        const dataView = getRecordDataView(record, this.props.viewAttrs || {});
        this.cacheRecordDataView.set(recordId, dataView);
        return dataView;
    }

    /**
     * Retrieve the original properties of a feature
     * @param {Object} feature
     * @returns {Object} Original properties of the feature
     */
    getFeatureOriginalProperties(feature) {
        const originalProperties = feature?.properties?._originalProperties;
        if (!originalProperties) return {};

        if (typeof originalProperties === 'string') {
            try {
                const parsed = JSON.parse(originalProperties);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (error) {
                console.warn('Error parsing original properties JSON:', error);
                return {};
            }
        }
        return typeof originalProperties === 'object' && !Array.isArray(originalProperties) ? originalProperties : {};
    }
}
