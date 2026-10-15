import { _t } from '@web/core/l10n/translation';
import { debounce } from '@web/core/utils/timing';
import { sprintf } from '@web/core/utils/strings';
import { Component, useEffect, onWillUnmount, onWillUpdateProps, xml } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { validateGeoJson } from '@base_mapbox_gl/utils/utils';
import { createPolygonCutMode } from './custom_mode_polygon_cut';
import { createCircleMode } from './custom_mode_draw_circle';
import { createRectangleMode } from './custom_mode_draw_rectangle';
import { DrawCustomControls } from './controls/draw_custom_controls';
import { UploadGeoJsonFileDialog } from '../upload_geojson_dialog/upload_geojson_dialog.js';
import { LabelInputDialog } from '../label_input_dialog/label_input_dialog.js';
import { DrawHistory } from './draw_history.js';
import { LiveMeasurement } from './live_measurement.js';
import { StaticMeasurement } from './static_measurement.js';
import {
    READONLY_SOURCE_ID,
    READONLY_FILL_LAYER_ID,
    READONLY_LINE_LAYER_ID,
    READONLY_POINT_LAYER_ID,
    READONLY_LABEL_LAYER_ID,
    DRAW_STYLES,
} from './utils.js';

export class MapboxGlDrawing extends Component {
    static template = xml`<span></span>`;
    static props = {
        mapbox: Object,
        saveFeatures: Function,
        dataGeoJson: { type: Object, optional: true },
        record: Object,
        readonly: Boolean,
    };

    setup() {
        this.mapboxDraw = null;
        this.drawControls = null;
        this.onUpdatePropsTimeout = null;
        this._mapDestroyed = false;

        this._selectedLabelFeatureId = null;
        this._selectionChangeHandler = null;

        this._drawHistory = new DrawHistory();
        this._keydownHandler = this._handleKeydown.bind(this);
        this._liveMeasurement = null;
        this._staticMeasurement = null;

        this.dialogService = useService('dialog');

        this.debounceInitializeMapboxDraw = debounce(this.initializeMapboxDraw.bind(this), 500);
        this.debounceCenterMap = debounce(this.centerMap.bind(this), 500);
        this.debounceLoadData = debounce(this.loadData.bind(this), 300);
        this.debounceHandleDrawChange = debounce(this.handleDrawChange.bind(this), 300);

        this.handleModeChange = (e) => {
            this._liveMeasurement?.onModeChange(e.mode);

            const isDrawingOrEditing = ['draw_polygon', 'draw_line_string', 'direct_select'].includes(e.mode);

            if (isDrawingOrEditing) {
                this._staticMeasurement?.suspend();
                this.drawControls?.updateMeasurementToggleState(this._staticMeasurement?.isEnabled ?? false, true);
            } else if (e.mode === 'simple_select') {
                this._staticMeasurement?.resume();
                this.drawControls?.updateMeasurementToggleState(this._staticMeasurement?.isEnabled ?? false, false);
            }
        };

        useEffect(
            (mapbox, readonly) => {
                if (mapbox) {
                    const onMapRemove = () => {
                        this._mapDestroyed = true;
                    };
                    mapbox.on('remove', onMapRemove);

                    if (readonly) {
                        this.renderReadonlyFeatures(this.props.dataGeoJson);
                    } else {
                        this.debounceInitializeMapboxDraw();
                    }

                    return () => {
                        mapbox.off('remove', onMapRemove);
                    };
                }
            },
            () => [this.props.mapbox, this.props.readonly]
        );

        onWillUnmount(this.cleanUp.bind(this));

        onWillUpdateProps((nextProps) => {
            const readonlyChanged = nextProps.readonly !== this.props.readonly;
            const geoJsonChanged = JSON.stringify(nextProps.dataGeoJson) !== JSON.stringify(this.props.dataGeoJson);

            if (this.mapboxDraw) {
                if (!readonlyChanged && !geoJsonChanged) return;

                if (this.drawControls) {
                    this.drawControls.highlightSaveButton(false);
                }
                if (this.onUpdatePropsTimeout) {
                    clearTimeout(this.onUpdatePropsTimeout);
                }
                this._liveMeasurement?.destroy();
                this._liveMeasurement = null;
                this._staticMeasurement?.destroy();
                this._staticMeasurement = null;
                this.onUpdatePropsTimeout = setTimeout(() => {
                    this._cleanAllDrawings();
                    if (!nextProps.readonly) {
                        this._liveMeasurement = new LiveMeasurement(this.props.mapbox, () => this.mapboxDraw);
                        this._liveMeasurement.attach();
                        this._staticMeasurement = new StaticMeasurement(this.props.mapbox, () => this.mapboxDraw);
                        this._staticMeasurement.attach();
                        this.loadData(nextProps.dataGeoJson);
                        this.drawControls?.updateMeasurementToggleState(false, false);
                    }
                }, 300);
            } else if (nextProps.readonly && geoJsonChanged) {
                if (this.onUpdatePropsTimeout) {
                    clearTimeout(this.onUpdatePropsTimeout);
                }
                this.onUpdatePropsTimeout = setTimeout(() => {
                    this.renderReadonlyFeatures(nextProps.dataGeoJson);
                }, 300);
            }
        });
    }

    /**
     * Initialize Mapbox Draw control with custom modes and event listeners.
     */
    initializeMapboxDraw() {
        this._cleanUpReadonlyLayerAndSource();

        if (this.mapboxDraw) return;

        try {
            const modes = {
                ...window.MapboxDraw.modes,
                ...createPolygonCutMode(
                    () => this.mapboxDraw,
                    (msg) => this.env.notificationService.add(msg, { type: 'danger' })
                ),
                ...createCircleMode(),
                ...createRectangleMode(),
            };

            this.mapboxDraw = new window.MapboxDraw({
                // All toolbar buttons are rendered by DrawCustomControls (IControl)
                // to keep everything in a single ctrl-group.
                displayControlsDefault: false,
                userProperties: true,
                modes: modes,
                styles: DRAW_STYLES,
            });

            this.props.mapbox.addControl(this.mapboxDraw);
            document.addEventListener('keydown', this._keydownHandler);

            this._liveMeasurement = new LiveMeasurement(this.props.mapbox, () => this.mapboxDraw);
            this._liveMeasurement.attach();

            this._staticMeasurement = new StaticMeasurement(this.props.mapbox, () => this.mapboxDraw);
            this._staticMeasurement.attach();

            // Build and register the custom controls IControl
            this.drawControls = new DrawCustomControls(this.mapboxDraw, this._buildDrawCallbacks());
            this.props.mapbox.addControl(this.drawControls, 'top-right');
            this.props.mapbox.on('draw.modechange', this.handleModeChange);

            // Selection tracking for label edit mode
            this._selectionChangeHandler = (e) => {
                const selected = e.features || [];
                if (selected.length === 1 && selected[0].properties?.odoo_user_label) {
                    this._selectedLabelFeatureId = selected[0].id;
                    this.drawControls?.setLabelButtonEditing(true);
                } else {
                    this._selectedLabelFeatureId = null;
                    this.drawControls?.setLabelButtonEditing(false);
                }
            };
            this.props.mapbox.on('draw.selectionchange', this._selectionChangeHandler);

            this.props.mapbox.on('draw.create', this.debounceHandleDrawChange);
            this.props.mapbox.on('draw.delete', this.debounceHandleDrawChange);
            this.props.mapbox.on('draw.update', this.debounceHandleDrawChange);
            this.props.mapbox.on('draw.polygon_cut', this.debounceHandleDrawChange);

            this.debounceLoadData(this.props.dataGeoJson);
        } catch (err) {
            console.error('Error initializing Mapbox Draw:', err);
            this.env.notificationService.add(_t('Failed to initialize drawing tools. Please try again.'), {
                type: 'danger',
            });
        }
    }

    /**
     * Build the callbacks object passed to DrawCustomControls.
     */
    _buildDrawCallbacks() {
        return {
            onSave: () => {
                this.mapboxDraw.changeMode('simple_select');
                this.updateFeatures();
            },
            onCustomModeActivated: (modeName) => {
                this._liveMeasurement?.onModeChange(modeName);
                this._staticMeasurement?.suspend();
                this.drawControls?.updateMeasurementToggleState(this._staticMeasurement?.isEnabled ?? false, true);
            },
            onPlaceLabel: (coords) => this._openLabelDialog(coords),
            onEditSelectedLabel: () => {
                const feature = this.mapboxDraw.get(this._selectedLabelFeatureId);
                this._openLabelEditDialog(this._selectedLabelFeatureId, feature?.properties?.odoo_user_label ?? '');
            },
            onUndo: () => this._undo(),
            onRedo: () => this._redo(),
            onToggleMeasurement: () => {
                const enabled = this._staticMeasurement?.toggle();
                this.drawControls?.updateMeasurementToggleState(enabled ?? false, false);
            },
            onUploadGeoJson: () => {
                this.mapboxDraw.changeMode('simple_select');
                this.dialogService.add(UploadGeoJsonFileDialog, {
                    confirm: (file) => {
                        if (!file) {
                            this.env.notificationService.add(_t('No file was uploaded.'), { type: 'danger' });
                            return false;
                        }
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                try {
                                    const geojson = JSON.parse(e.target.result);
                                    const isValid = validateGeoJson(geojson);
                                    if (!isValid) {
                                        this.env.notificationService.add(
                                            _t('The imported file is not a valid GeoJSON.'),
                                            { type: 'danger' }
                                        );
                                        resolve(false);
                                        return;
                                    }
                                    this.loadData(geojson);
                                    this.env.notificationService.add(_t('GeoJSON file imported successfully.'), {
                                        type: 'success',
                                    });
                                    this.drawControls?.highlightSaveButton(true);
                                    resolve(true);
                                } catch {
                                    this.env.notificationService.add(_t('Failed to parse the imported GeoJSON file.'), {
                                        type: 'danger',
                                    });
                                    resolve(false);
                                }
                            };
                            reader.onerror = () => {
                                this.env.notificationService.add(_t('Failed to read the imported GeoJSON file.'), {
                                    type: 'danger',
                                });
                                resolve(false);
                            };
                            reader.readAsText(file);
                        });
                    },
                    cancel: () => {},
                });
            },
            onDownloadGeoJson: () => {
                const allFeatures = this.mapboxDraw.getAll();
                if (!allFeatures || allFeatures.features.length === 0) {
                    this.env.notificationService.add(_t('There are no features to download.'), { type: 'warning' });
                    return;
                }
                const blob = new Blob([JSON.stringify(allFeatures)], {
                    type: 'application/geo+json',
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                const filename = `mapbox_drawings_${this.props.record.resId || this.props.record.id || 'data'}.geojson`;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                this.env.notificationService.add(sprintf(_t('GeoJSON file "%s" downloaded.'), filename), {
                    type: 'success',
                });
            },
            onError: (msg) => {
                this.env.notificationService.add(msg, { type: 'danger' });
            },
        };
    }

    /**
     * Render geometries as static, non-editable layers for readonly display.
     */
    renderReadonlyFeatures(geojson) {
        geojson = geojson ?? this.props.dataGeoJson;

        this._removeMapboxDrawControls();
        this._cleanUpReadonlyLayerAndSource();

        const isValidGeoJson = validateGeoJson(geojson);
        if (!isValidGeoJson) return;

        this.props.mapbox.addSource(READONLY_SOURCE_ID, {
            type: 'geojson',
            data: geojson,
        });

        const featureColor = '#fb2828';

        this.props.mapbox.addLayer({
            id: READONLY_FILL_LAYER_ID,
            type: 'fill',
            source: READONLY_SOURCE_ID,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: {
                'fill-color': featureColor,
                'fill-opacity': 0.2,
            },
        });

        this.props.mapbox.addLayer({
            id: READONLY_LINE_LAYER_ID,
            type: 'line',
            source: READONLY_SOURCE_ID,
            filter: [
                'in',
                ['geometry-type'],
                ['literal', ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString']],
            ],
            paint: {
                'line-color': featureColor,
                'line-width': 1,
            },
        });

        this.props.mapbox.addLayer({
            id: READONLY_POINT_LAYER_ID,
            type: 'circle',
            source: READONLY_SOURCE_ID,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['!has', 'odoo_user_label'],
            ],
            paint: {
                'circle-radius': 6,
                'circle-color': featureColor,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#FFFFFF',
            },
        });

        this.props.mapbox.addLayer({
            id: READONLY_LABEL_LAYER_ID,
            type: 'symbol',
            source: READONLY_SOURCE_ID,
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
                'text-color': '#1a1a1a',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
            },
        });

        this.debounceCenterMap();
    }

    handleDrawChange(e) {
        if (this._drawHistory.isRestoring) return;
        this._drawHistory.push(this.mapboxDraw.getAll());
        this._updateUndoRedoButtons();
        this.drawControls?.highlightSaveButton(true);
        this._staticMeasurement?.update();
    }

    loadData(geojson) {
        if (!this.mapboxDraw || !this.props.mapbox) return;
        if (this._mapDestroyed) return;

        geojson = geojson || this.props.dataGeoJson;
        const isValidGeoJson = validateGeoJson(geojson);

        this._staticMeasurement?.suspend();
        this._drawHistory.beginRestore();
        try {
            this.mapboxDraw.deleteAll();
            if (isValidGeoJson) {
                this.mapboxDraw.add(geojson);
            }
        } finally {
            this._drawHistory.endRestore();
        }
        this.debounceHandleDrawChange.cancel?.();

        this._drawHistory.reset(isValidGeoJson ? geojson : null);
        this._updateUndoRedoButtons();
        this._staticMeasurement?.resume();

        if (isValidGeoJson) {
            this.debounceCenterMap();
        }
    }

    updateFeatures() {
        const allFeatures = this.mapboxDraw.getAll();
        let totalArea = 0;
        if (allFeatures && allFeatures.features.length > 0 && window.turf) {
            try {
                totalArea = window.turf.area(allFeatures);
            } catch {
                totalArea = 0;
            }
        }
        this.drawControls?.highlightSaveButton(false);
        this.props.saveFeatures(allFeatures, totalArea);
    }

    centerMap() {
        if (this.mapboxDraw) {
            const allFeatures = this.mapboxDraw.getAll();
            if (allFeatures && allFeatures.features.length > 0) {
                const bbox = window.turf.bbox(allFeatures);
                this.props.mapbox.fitBounds(bbox, { padding: 150 });
            }
        } else if (this.props.readonly) {
            const isValidGeoJson = validateGeoJson(this.props.dataGeoJson);
            if (isValidGeoJson) {
                const bbox = window.turf.bbox(this.props.dataGeoJson);
                this.props.mapbox.fitBounds(bbox, { padding: 150 });
            }
        }
    }

    // ─── Label annotation helpers ────────────────────────────────────────────

    _openLabelDialog(coords) {
        this.dialogService.add(LabelInputDialog, {
            confirm: (text) => {
                if (!text || !this.mapboxDraw) return;
                const ids = this.mapboxDraw.add({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: coords },
                    properties: { odoo_user_label: text },
                });
                if (ids?.length > 0) {
                    this._drawHistory.push(this.mapboxDraw.getAll());
                    this._updateUndoRedoButtons();
                    this.drawControls?.highlightSaveButton(true);
                }
            },
        });
    }

    _openLabelEditDialog(featureId, currentText) {
        this.dialogService.add(LabelInputDialog, {
            isEdit: true,
            initialValue: currentText,
            confirm: (text) => {
                if (!text || !this.mapboxDraw) return;
                this.mapboxDraw.setFeatureProperty(featureId, 'odoo_user_label', text);
                this._drawHistory.push(this.mapboxDraw.getAll());
                this._updateUndoRedoButtons();
                this.drawControls?.highlightSaveButton(true);
            },
        });
    }

    // ─── Undo / redo ─────────────────────────────────────────────────────────

    _undo() {
        const snapshot = this._drawHistory.undo();
        if (snapshot) this._restoreSnapshot(snapshot);
    }

    _redo() {
        const snapshot = this._drawHistory.redo();
        if (snapshot) this._restoreSnapshot(snapshot);
    }

    _restoreSnapshot(snapshot) {
        if (!this.mapboxDraw) return;
        this._drawHistory.beginRestore();
        try {
            this.mapboxDraw.deleteAll();
            if (snapshot?.features?.length > 0) {
                this.mapboxDraw.add(snapshot);
            }
        } finally {
            this._drawHistory.endRestore();
        }
        this.debounceHandleDrawChange.cancel?.();
        this._updateUndoRedoButtons();
        this._staticMeasurement?.update();
        this.drawControls?.highlightSaveButton(true);
    }

    _updateUndoRedoButtons() {
        this.drawControls?.updateUndoRedoState(this._drawHistory.canUndo, this._drawHistory.canRedo);
    }

    _handleKeydown(e) {
        if (!this.mapboxDraw) return;
        const ctrlOrCmd = e.ctrlKey || e.metaKey;
        if (!ctrlOrCmd) return;
        const active = document.activeElement;
        if (active) {
            const tag = active.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (active.isContentEditable) {
                const mapContainer = this.props.mapbox?.getContainer();
                if (!mapContainer || !mapContainer.contains(active)) return;
            }
        }
        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this._undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
            e.preventDefault();
            this._redo();
        }
    }

    // ─── Cleanup ─────────────────────────────────────────────────────────────

    cleanUp() {
        if (this.onUpdatePropsTimeout) {
            clearTimeout(this.onUpdatePropsTimeout);
        }

        if (this.debounceInitializeMapboxDraw.cancel) {
            this.debounceInitializeMapboxDraw.cancel();
        }
        if (this.debounceCenterMap.cancel) {
            this.debounceCenterMap.cancel();
        }
        if (this.debounceLoadData.cancel) {
            this.debounceLoadData.cancel();
        }
        if (this.debounceHandleDrawChange.cancel) {
            this.debounceHandleDrawChange.cancel();
        }
        document.removeEventListener('keydown', this._keydownHandler);

        const isMapValid = this.props.mapbox && !this._mapDestroyed;

        if (this.mapboxDraw !== null) {
            try {
                if (!isMapValid) {
                    this._liveMeasurement?.destroy();
                    this._liveMeasurement = null;
                    this._staticMeasurement?.destroy();
                    this._staticMeasurement = null;
                    this.mapboxDraw = null;
                    this.drawControls = null;
                    return;
                }
                this._removeMapboxDrawControls();
            } catch {
                // Swallow — cleanup errors must not interrupt the unmount flow.
            }
        }

        if (isMapValid) {
            this._cleanUpReadonlyLayerAndSource();
        }
    }

    _removeMapboxDrawControls() {
        if (this.mapboxDraw && this.props.mapbox) {
            this.props.mapbox.off('draw.create', this.debounceHandleDrawChange);
            this.props.mapbox.off('draw.delete', this.debounceHandleDrawChange);
            this.props.mapbox.off('draw.update', this.debounceHandleDrawChange);
            this.props.mapbox.off('draw.polygon_cut', this.debounceHandleDrawChange);
            this.props.mapbox.off('draw.modechange', this.handleModeChange);

            if (this._selectionChangeHandler) {
                this.props.mapbox.off('draw.selectionchange', this._selectionChangeHandler);
                this._selectionChangeHandler = null;
            }

            if (this._liveMeasurement) {
                this._liveMeasurement.destroy();
                this._liveMeasurement = null;
            }
            if (this._staticMeasurement) {
                this._staticMeasurement.destroy();
                this._staticMeasurement = null;
            }

            // IControl teardown: onRemove() handles DOM removal and its own
            // draw.modechange listener cleanup automatically.
            if (this.drawControls) {
                this.props.mapbox.removeControl(this.drawControls);
                this.drawControls = null;
            }

            this._cleanAllDrawings();
            this.props.mapbox.removeControl(this.mapboxDraw);
            this.mapboxDraw = null;
        }
    }

    _cleanAllDrawings() {
        if (this.mapboxDraw) {
            this.mapboxDraw.deleteAll();
        }
    }

    _cleanUpReadonlyLayerAndSource() {
        if (!this.props.mapbox) return;

        if (this.props.mapbox.getLayer(READONLY_FILL_LAYER_ID)) {
            this.props.mapbox.removeLayer(READONLY_FILL_LAYER_ID);
        }
        if (this.props.mapbox.getLayer(READONLY_LINE_LAYER_ID)) {
            this.props.mapbox.removeLayer(READONLY_LINE_LAYER_ID);
        }
        if (this.props.mapbox.getLayer(READONLY_POINT_LAYER_ID)) {
            this.props.mapbox.removeLayer(READONLY_POINT_LAYER_ID);
        }
        if (this.props.mapbox.getLayer(READONLY_LABEL_LAYER_ID)) {
            this.props.mapbox.removeLayer(READONLY_LABEL_LAYER_ID);
        }
        if (this.props.mapbox.getSource(READONLY_SOURCE_ID)) {
            this.props.mapbox.removeSource(READONLY_SOURCE_ID);
        }
    }
}
