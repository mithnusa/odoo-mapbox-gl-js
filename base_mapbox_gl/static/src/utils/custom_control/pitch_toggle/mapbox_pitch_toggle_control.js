/**
 * Mapbox GL JS custom control that toggles the map's pitch between a
 * flat top-down view (pitch = 0°) and a tilted view (configurable pitch
 * angle, default 60°).
 *
 * Implements the Mapbox IControl interface so it can be added with
 * map.addControl() like any built-in control.
 *
 * Usage:
 *   const toggle = new MapboxPitchToggleControl({ pitchAngle: 60 });
 *   map.addControl(toggle, 'bottom-right');
 */
import { _t } from '@web/core/l10n/translation';
import { sprintf } from '@web/core/utils/strings';

export class MapboxPitchToggleControl {
    /**
     * @param {Object} [options]
     * @param {number} [options.pitchAngle=60]          - Pitch angle (degrees) used for the tilted view
     * @param {number} [options.animationDuration=500]  - easeTo duration in ms
     */
    constructor(options = {}) {
        this._pitchAngle = options.pitchAngle ?? 60;
        this._animationDuration = options.animationDuration ?? 500;

        this._map = null;
        this._container = null;
        this._button = null;
        this._label = null;
        this._isPitched = false;
        this._onPitchEnd = () => this._syncFromMap();
    }

    // ----------------------------------------------------------------
    // Mapbox IControl interface
    // ----------------------------------------------------------------

    /**
     * Called by Mapbox when the control is added to the map.
     * @param {mapboxgl.Map} map
     * @returns {HTMLElement}
     */
    onAdd(map) {
        this._map = map;

        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        this._button = document.createElement('button');
        this._button.className = 'mapboxgl-ctrl-icon o_mapbox_pitch_toggle';
        this._button.type = 'button';

        this._label = document.createElement('span');
        this._label.className = 'o_mapbox_pitch_toggle_label';

        this._button.appendChild(this._label);
        this._container.appendChild(this._button);

        this._syncFromMap();
        this._button.addEventListener('click', () => this._toggle());
        map.on('pitchend', this._onPitchEnd);

        return this._container;
    }

    /**
     * Called by Mapbox when the control is removed from the map.
     */
    onRemove() {
        if (this._map) {
            this._map.off('pitchend', this._onPitchEnd);
        }
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = null;
        this._container = null;
        this._button = null;
        this._label = null;
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    _toggle() {
        if (!this._map) return;

        this._isPitched = !this._isPitched;

        this._map.easeTo({
            pitch: this._isPitched ? this._pitchAngle : 0,
            duration: this._animationDuration,
        });

        this._updateButtonState();
    }

    /** Keep button state in sync when pitch is changed externally (e.g. navigation control). */
    _syncFromMap() {
        if (!this._map) return;
        this._isPitched = this._map.getPitch() > 0;
        this._updateButtonState();
    }

    _updateButtonState() {
        if (!this._button || !this._label) return;

        if (this._isPitched) {
            this._label.textContent = '0°';
            this._button.title = _t('Tilted to top-down view (0°)');
            this._button.setAttribute('aria-label', _t('Tilted to top-down view (0°)'));
            this._button.classList.add('active');
        } else {
            this._label.textContent = `${this._pitchAngle}°`;
            this._button.title = sprintf(_t('Tilted view (%s°)'), this._pitchAngle);
            this._button.setAttribute('aria-label', sprintf(_t('Tilted view (%s°)'), this._pitchAngle));
            this._button.classList.remove('active');
        }
    }
}
