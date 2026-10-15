import { DRAW_CIRCLE_MODE, DRAW_RECTANGLE_MODE, POLYGON_CUT_MODE } from '../utils';
import { DrawPolygonButton } from './btn_draw_polygon';
import { DrawLineButton } from './btn_draw_line';
import { DrawPointButton } from './btn_draw_point';
import { createTrashButton } from './btn_trash';
import { CircleButton } from './btn_circle';
import { RectangleButton } from './btn_rectangle';
import { CutButton } from './btn_cut';
import { LabelButton } from './btn_label';
import { UndoButton } from './btn_undo';
import { RedoButton } from './btn_redo';
import { SaveButton } from './btn_save';
import { MeasureToggleButton } from './btn_measure_toggle';
import { createUploadButton } from './btn_upload';
import { createDownloadButton } from './btn_download';

// Built-in Draw modes that fire draw.modechange — used to decide when to deactivate label mode.
const BUILTIN_MODES = new Set(['simple_select', 'direct_select', 'draw_polygon', 'draw_line_string', 'draw_point']);

/**
 * DrawCustomControls — Mapbox GL JS IControl that adds custom drawing toolbar
 * buttons alongside the native MapboxDraw control.
 *
 * Implements the IControl interface (onAdd / onRemove) so Mapbox manages the
 * DOM lifecycle. Receives a MapboxDraw instance and a callbacks object from
 * drawing-tools.js. Each button's toggle/activation logic lives in its own
 * file under controls/.
 *
 * Callbacks expected:
 *   onSave()
 *   onPlaceLabel(coords: [lng, lat])
 *   onEditSelectedLabel()
 *   onCustomModeActivated(modeName: string)
 *   onUndo()
 *   onRedo()
 *   onToggleMeasurement()
 *   onUploadGeoJson()
 *   onDownloadGeoJson()
 *   onError(message: string)
 */
export class DrawCustomControls {
    constructor(draw, callbacks = {}) {
        this._draw = draw;
        this._callbacks = callbacks;
        this._map = null;
        this._container = null;
        this._modeChangeHandler = null;

        this._polygonButton = null;
        this._lineButton = null;
        this._pointButton = null;
        this._circleButton = null;
        this._rectangleButton = null;
        this._cutButton = null;
        this._labelButton = null;
        this._undoButton = null;
        this._redoButton = null;
        this._measureToggleButton = null;
        this._saveButton = null;
    }

    // ─── IControl ────────────────────────────────────────────────────────────

    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        this._buildButtons(map);

        this._modeChangeHandler = (e) => this._syncToMode(e.mode);
        map.on('draw.modechange', this._modeChangeHandler);

        return this._container;
    }

    onRemove() {
        if (this._map && this._modeChangeHandler) {
            this._map.off('draw.modechange', this._modeChangeHandler);
        }
        // Clean up label's map click handler if placement mode was active
        this._labelButton?.deactivate();
        this._container?.remove();
        this._container = null;
        this._map = null;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    _buildButtons(map) {
        const cb = this._callbacks;
        const draw = this._draw;

        // ── Native Draw equivalents ──────────────────────────────────────────
        this._polygonButton = new DrawPolygonButton(draw, {
            onBeforeActivate: () => this._deactivateAllModeButtons('polygon'),
        });

        this._lineButton = new DrawLineButton(draw, {
            onBeforeActivate: () => this._deactivateAllModeButtons('line'),
        });

        this._pointButton = new DrawPointButton(draw, {
            onBeforeActivate: () => this._deactivateAllModeButtons('point'),
        });

        const trashEl = createTrashButton(draw);

        // ── Custom draw modes ────────────────────────────────────────────────
        this._circleButton = new CircleButton(draw, {
            onBeforeActivate: () => this._deactivateAllModeButtons('circle'),
            onActivated: () => cb.onCustomModeActivated?.(DRAW_CIRCLE_MODE),
            onError: (msg) => cb.onError?.(msg),
        });

        this._rectangleButton = new RectangleButton(draw, {
            onBeforeActivate: () => this._deactivateAllModeButtons('rectangle'),
            onActivated: () => cb.onCustomModeActivated?.(DRAW_RECTANGLE_MODE),
            onError: (msg) => cb.onError?.(msg),
        });

        this._labelButton = new LabelButton(map, draw, {
            onBeforeActivate: () => this._deactivateAllModeButtons('label'),
            onPlace: (coords) => cb.onPlaceLabel?.(coords),
            onEditSelected: () => cb.onEditSelectedLabel?.(),
        });

        this._cutButton = new CutButton(draw, {
            onBeforeActivate: () => this._deactivateAllModeButtons('cut'),
            onActivated: () => cb.onCustomModeActivated?.(POLYGON_CUT_MODE),
            onError: (msg) => cb.onError?.(msg),
        });

        this._undoButton = new UndoButton(() => cb.onUndo?.());
        this._redoButton = new RedoButton(() => cb.onRedo?.());

        const uploadEl = createUploadButton(() => cb.onUploadGeoJson?.());
        const downloadEl = createDownloadButton(() => cb.onDownloadGeoJson?.());

        this._measureToggleButton = new MeasureToggleButton(() => cb.onToggleMeasurement?.());
        this._saveButton = new SaveButton(() => cb.onSave?.());

        for (const el of [
            this._polygonButton.el,
            this._lineButton.el,
            this._pointButton.el,
            this._circleButton.el,
            this._rectangleButton.el,
            this._labelButton.el,
            this._cutButton.el,
            trashEl,
            this._undoButton.el,
            this._redoButton.el,
            uploadEl,
            downloadEl,
            this._measureToggleButton.el,
            this._saveButton.el,
        ]) {
            this._container.appendChild(el);
        }
    }

    /**
     * Deactivate all mode buttons except the one being activated.
     * @param {string} except - key of the button being activated
     */
    _deactivateAllModeButtons(except) {
        if (except !== 'polygon') this._polygonButton?.deactivate();
        if (except !== 'line') this._lineButton?.deactivate();
        if (except !== 'point') this._pointButton?.deactivate();
        if (except !== 'circle') this._circleButton?.deactivate();
        if (except !== 'rectangle') this._rectangleButton?.deactivate();
        if (except !== 'cut') this._cutButton?.deactivate();
        if (except !== 'label') this._labelButton?.deactivate();
    }

    /**
     * Sync custom button active states to the current Draw mode.
     * Called on every draw.modechange event.
     */
    _syncToMode(mode) {
        this._polygonButton?.syncToMode(mode);
        this._lineButton?.syncToMode(mode);
        this._pointButton?.syncToMode(mode);
        this._circleButton?.syncToMode(mode);
        this._rectangleButton?.syncToMode(mode);
        this._cutButton?.syncToMode(mode);
        // Label mode does not use Draw's changeMode, so draw.modechange firing
        // means the user switched away from label placement — deactivate it.
        if (BUILTIN_MODES.has(mode)) {
            this._labelButton?.deactivate();
        }
    }

    // ─── Public API (called from drawing-tools.js) ───────────────────────────

    updateUndoRedoState(canUndo, canRedo) {
        this._undoButton?.setEnabled(canUndo);
        this._redoButton?.setEnabled(canRedo);
    }

    updateMeasurementToggleState(enabled, suspended) {
        this._measureToggleButton?.setState(enabled, suspended);
    }

    setLabelButtonEditing(isEditing) {
        this._labelButton?.setEditing(isEditing);
    }

    highlightSaveButton(on) {
        this._saveButton?.setHighlighted(on, this._map?.getContainer());
    }
}
