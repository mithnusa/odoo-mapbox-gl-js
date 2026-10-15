import { _t } from '@web/core/l10n/translation';
import { LAYER_CONFIG } from './utils';

/**
 * Mixin that adds box-zoom-to-select behavior to a Mapbox renderer.
 *
 * Uses the Pointer Events API so mouse, touch, and stylus all share the same
 * code path. `setPointerCapture` keeps events flowing even when the pointer
 * leaves the canvas mid-drag.
 *
 * Usage:
 *   export class MyRenderer extends withBoxZoomSelection(BaseMapboxGlRenderer) { ... }
 * @param {Class} Base - The base renderer class to extend
 * @returns {Class} Extended class with box-zoom selection behaviour
 */
export function withBoxZoomSelection(Base) {
    class BoxZoomSelectionMixin extends Base {
        setup() {
            super.setup();
            this.mapBoxGlJsCanvas = null;
            this.mapboxGlJsBox = null;
            this.mapboxGlJsBoxStart = null;
            this.mapboxGlJsBoxCurrent = null;

            this.mapboxGlJsBoxEventRegistered = false;
            this._activePointerId = null;

            this.boundHandleBoxPointerMove = this.pointerMove.bind(this);
            this.boundHandleBoxPointerDown = this.pointerDown.bind(this);
            this.boundHandleBoxPointerUp = this.pointerUp.bind(this);
            this.boundHandleBoxKeyDown = this.handleKeyDown.bind(this);
            this.boundHandleBoxKeyUp = this.handleKeyUp.bind(this);
        }

        mapOptions() {
            return {
                ...super.mapOptions(),
                boxZoom: false, // disable Mapbox's built-in box zoom to implement custom behavior that includes selection
            };
        }

        onMapLoaded() {
            super.onMapLoaded();
            this.mapBoxGlJsCanvas = this.mapBoxGlJs.getCanvasContainer();
            this.mapBoxGlJsCanvas.addEventListener('keydown', this.boundHandleBoxKeyDown, true);
            this.mapBoxGlJsCanvas.addEventListener('keyup', this.boundHandleBoxKeyUp, true);
        }

        handleKeyDown(e) {
            // If the ESC key is pressed
            if (e.key === 'Escape') {
                this.mapBoxGlJs.dragPan.enable();
                this.detachBoxZoomListeners();
            } else if (e.key === 'Shift') {
                if (!this.mapboxGlJsBoxEventRegistered) {
                    this._attachBoxZoomListeners();
                }
            }
        }

        handleKeyUp(e) {
            if (e.key === 'Shift' && this.mapboxGlJsBoxEventRegistered) {
                this.detachBoxZoomListeners();
            }
        }

        /**
         * Attach pointer event listeners that drive the selection box drawing.
         * Called on Shift keydown.
         */
        _attachBoxZoomListeners() {
            this.mapBoxGlJsCanvas.addEventListener('pointerdown', this.boundHandleBoxPointerDown, true);
            this.mapBoxGlJsCanvas.addEventListener('pointermove', this.boundHandleBoxPointerMove, true);
            this.mapBoxGlJsCanvas.addEventListener('pointerup', this.boundHandleBoxPointerUp, true);
            this.mapboxGlJsBoxEventRegistered = true;
        }

        /**
         * Remove all pointer listeners, destroy the selection box element, and
         * re-enable map panning. Safe to call multiple times.
         */
        detachBoxZoomListeners() {
            if (this.mapBoxGlJsCanvas) {
                this.mapBoxGlJsCanvas.removeEventListener('pointerdown', this.boundHandleBoxPointerDown, true);
                this.mapBoxGlJsCanvas.removeEventListener('pointermove', this.boundHandleBoxPointerMove, true);
                this.mapBoxGlJsCanvas.removeEventListener('pointerup', this.boundHandleBoxPointerUp, true);
            }
            if (this.mapboxGlJsBox) {
                this.mapboxGlJsBox.parentNode.removeChild(this.mapboxGlJsBox);
                this.mapboxGlJsBox = null;
            }
            this.mapboxGlJsBoxEventRegistered = false;
            this.mapboxGlJsBoxStart = null;
            this.mapboxGlJsBoxCurrent = null;
            this._activePointerId = null;
            if (this.mapBoxGlJs) {
                this.mapBoxGlJs.dragPan.enable();
            }
        }

        mousePos(e) {
            const rect = this.mapBoxGlJsCanvas.getBoundingClientRect();
            return new window.mapboxgl.Point(
                e.clientX - rect.left - this.mapBoxGlJsCanvas.clientLeft,
                e.clientY - rect.top - this.mapBoxGlJsCanvas.clientTop
            );
        }

        pointerDown(e) {
            if (!(e.pointerType === 'mouse' && e.shiftKey && e.button === 0)) {
                this.detachBoxZoomListeners();
                return;
            }

            // Capture the pointer so pointermove/pointerup keep firing even if
            // the finger or cursor leaves the canvas boundary mid-drag.
            this.mapBoxGlJsCanvas.setPointerCapture(e.pointerId);
            this._activePointerId = e.pointerId;

            this.mapBoxGlJs.dragPan.disable();
            this.mapboxGlJsBoxStart = this.mousePos(e);
        }

        pointerMove(e) {
            if (e.pointerId !== this._activePointerId) return; // ignore other fingers / pointers

            if (!(e.pointerType === 'mouse' && e.shiftKey)) {
                this.detachBoxZoomListeners();
                return;
            }

            if (!this.mapboxGlJsBoxStart) {
                return; // pointerMove can fire before pointerDown, so ensure we have a starting point
            }

            // Capture the ongoing xy coordinates
            this.mapboxGlJsBoxCurrent = this.mousePos(e);

            // Append the box element if it doesnt exist
            if (!this.mapboxGlJsBox) {
                this.mapboxGlJsBox = document.createElement('div');
                this.mapboxGlJsBox.classList.add('mapbox_draw');
                this.mapBoxGlJsCanvas.appendChild(this.mapboxGlJsBox);
            }

            const minX = Math.min(this.mapboxGlJsBoxStart.x, this.mapboxGlJsBoxCurrent.x);
            const maxX = Math.max(this.mapboxGlJsBoxStart.x, this.mapboxGlJsBoxCurrent.x);
            const minY = Math.min(this.mapboxGlJsBoxStart.y, this.mapboxGlJsBoxCurrent.y);
            const maxY = Math.max(this.mapboxGlJsBoxStart.y, this.mapboxGlJsBoxCurrent.y);

            // Adjust width and xy position of the box element ongoing
            this.mapboxGlJsBox.style.transform = `translate(${minX}px, ${minY}px)`;
            this.mapboxGlJsBox.style.width = `${maxX - minX}px`;
            this.mapboxGlJsBox.style.height = `${maxY - minY}px`;
        }

        pointerUp(e) {
            if (e.pointerId !== this._activePointerId) return;
            if (!this.mapboxGlJsBoxStart) {
                this.detachBoxZoomListeners();
                return; // pointerUp can fire before pointerDown, so ensure we have a starting point
            }
            this.finish([this.mapboxGlJsBoxStart, this.mousePos(e)]);
        }

        getSelectableLayers() {
            return [LAYER_CONFIG.GEOJSON_CIRCLE];
        }

        async querySelectedFeatures(bbox) {
            return new Promise((resolve, reject) => {
                if (!bbox) {
                    resolve([]);
                    return;
                }
                try {
                    const features = this.mapBoxGlJs.queryRenderedFeatures(bbox, {
                        layers: this.getSelectableLayers(),
                    });
                    resolve(features);
                } catch (error) {
                    reject(error);
                }
            });
        }

        async finish(bbox) {
            this.detachBoxZoomListeners();

            const features = await this.querySelectedFeatures(bbox);
            if (!features.length) {
                return;
            }
            if (features.length >= 1000) {
                this.notificationService.add(_t('Too many features selected. Please select a smaller area.'), {
                    type: 'warning',
                });
                return;
            }

            const featureIds = new Set(features.filter((f) => f.properties?.resId).map((f) => f.properties.resId));
            const recordsById = Object.fromEntries(this.props.list.records.map((r) => [r.resId, r]));

            // Toggle each record caught by the box: newly-caught records get
            // selected, and records already selected get deselected. This
            // mirrors the per-record toggle behaviour of Shift+click
            // selection (see shift_click_selection_mixin.js).
            for (const resId of featureIds) {
                const record = recordsById[resId];
                if (record) {
                    this.toggleRecordSelection(record);
                }
            }
        }

        cleanUp() {
            if (this.mapBoxGlJs && this.mapBoxGlJsCanvas) {
                this.detachBoxZoomListeners();
                this.mapBoxGlJsCanvas.removeEventListener('keydown', this.boundHandleBoxKeyDown, true);
                this.mapBoxGlJsCanvas.removeEventListener('keyup', this.boundHandleBoxKeyUp, true);
            }
            this.mapBoxGlJsCanvas = null;
            super.cleanUp();
        }
    }
    return BoxZoomSelectionMixin;
}
