import { LAYER_CONFIG } from './utils';

/**
 * Mixin that adds Shift+click-to-select behaviour to a Mapbox renderer.
 *
 * Normally, clicking a marker opens the record detail view. With this mixin
 * applied, holding Shift while clicking a marker toggles its Odoo selection
 * state instead of opening the record.
 *
 * WHY DOM EVENTS INSTEAD OF MAPBOX EVENTS:
 * Mapbox's built-in BoxZoomHandler intercepts Shift+mousedown to draw a zoom
 * box. This prevents the layer-specific `click` event from firing when Shift
 * is held, even for a plain click with no drag. We bypass this by listening
 * directly to raw DOM mousedown/mouseup events on the canvas, tracking the
 * start position, and treating a small-distance release as a "click".
 *
 * Usage:
 *   export class MyRenderer extends withShiftClickSelection(BaseMapboxGlRenderer) { ... }
 *
 * Requirements on Base:
 *   - this.mapBoxGlJs              – Mapbox GL JS map instance
 *   - this.canSelectRecord         – getter returning true when selection is allowed
 *   - this.toggleRecordSelection(r) – toggles Odoo record selection
 *   - this.getRecordById(resId)    – returns a record by its resId
 *   - onMapLoaded() / cleanUp() super chain
 *   - _handleFeatureClick(e)       – Base's Mapbox `click` handler that opens the record
 *
 * @param {Class} Base - The base renderer class to extend
 * @returns {Class} Extended class with Shift+click selection behaviour
 */
export function withShiftClickSelection(Base) {
    class ShiftClickSelectionMixin extends Base {
        static CLICK_DISTANCE_THRESHOLD = 8; // px – max movement to still count as a click

        setup() {
            super.setup();
            this._shiftClickStartPoint = null;
            this.boundHandleShiftMouseDown = this._handleShiftMouseDown.bind(this);
            this.boundHandleShiftMouseUp = this._handleShiftMouseUp.bind(this);
        }

        onMapLoaded() {
            super.onMapLoaded();
            const canvas = this.mapBoxGlJs.getCanvas();
            canvas.addEventListener('mousedown', this.boundHandleShiftMouseDown, true);
            canvas.addEventListener('mouseup', this.boundHandleShiftMouseUp, true);
        }

        cleanUp() {
            if (this.mapBoxGlJs) {
                const canvas = this.mapBoxGlJs.getCanvas();
                canvas.removeEventListener('mousedown', this.boundHandleShiftMouseDown, true);
                canvas.removeEventListener('mouseup', this.boundHandleShiftMouseUp, true);
            }
            super.cleanUp();
        }

        /**
         * Record the canvas position when Shift+mousedown occurs.
         * @param {MouseEvent} e - Raw DOM mouse event
         * @private
         */
        _handleShiftMouseDown(e) {
            if (!e.shiftKey) {
                this._shiftClickStartPoint = null;
                return;
            }
            this._shiftClickStartPoint = { x: e.clientX, y: e.clientY };
        }

        /**
         * On Shift+mouseup, check if the mouse moved less than the click
         * threshold. If so, treat it as a Shift+click and toggle selection
         * for any marker at that position.
         * @param {MouseEvent} e - Raw DOM mouse event
         * @private
         */
        _handleShiftMouseUp(e) {
            if (!this._shiftClickStartPoint || !e.shiftKey) {
                this._shiftClickStartPoint = null;
                return;
            }

            const start = this._shiftClickStartPoint;
            this._shiftClickStartPoint = null;

            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (Math.sqrt(dx * dx + dy * dy) > ShiftClickSelectionMixin.CLICK_DISTANCE_THRESHOLD) {
                return; // was a drag (box zoom), not a click
            }

            if (!this.canSelectRecord) return;
            if (!this.isMapboxReady()) return;

            // Convert client coordinates to map canvas pixel coordinates.
            // Use [x, y] array format — Mapbox GL JS v3 PointLike only accepts
            // Point instances or [number, number] arrays, not plain {x, y} objects.
            const rect = this.mapBoxGlJs.getCanvas().getBoundingClientRect();
            const point = [e.clientX - rect.left, e.clientY - rect.top];

            const features = this.mapBoxGlJs.queryRenderedFeatures(point, {
                layers: [LAYER_CONFIG.GEOJSON_CIRCLE],
            });

            if (features.length === 0) return;

            const resId = features[0].properties.resId;
            if (!resId) return;

            const record = this.getRecordById(resId);
            if (record) {
                this.toggleRecordSelection(record);
            }
        }

        /**
         * Override the base feature click handler to prevent it from opening
         * the record when Shift is held. Mapbox still fires its own `click`
         * layer event on mouseup even though selection was already toggled
         * by `_handleShiftMouseUp` above — without this guard, a Shift+click
         * would both toggle selection AND open the record.
         * @param {Object} e - Mapbox MapMouseEvent
         * @override
         * @private
         */
        _handleFeatureClick(e) {
            if (e.originalEvent?.shiftKey) {
                return;
            }
            if (typeof super._handleFeatureClick === 'function') {
                super._handleFeatureClick(e);
            }
        }
    }
    return ShiftClickSelectionMixin;
}
