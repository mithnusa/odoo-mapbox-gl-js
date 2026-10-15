/**
 * Mapbox GL JS custom control that flies the map closer, with a zoom step
 * that adapts to the current zoom level: large jumps when zoomed far out,
 * small jumps when already zoomed in close.
 *
 * Implements the Mapbox IControl interface so it can be added with
 * map.addControl() like any built-in control.
 *
 * Usage:
 *   const flyZoom = new MapboxFlyToZoomControl({ zoomStep: 6 });
 *   map.addControl(flyZoom, 'bottom-right');
 */
import { _t } from '@web/core/l10n/translation';

export class MapboxFlyToZoomControl {
    /**
     * @param {Object} [options]
     * @param {number} [options.zoomStep=8]              - Maximum step applied at the lowest zoom; shrinks to 1 as current zoom approaches maxZoom
     * @param {number} [options.maxZoom=20]              - Clamp so the button disables at max zoom
     * @param {number} [options.animationDuration=300]   - flyTo duration in ms
     */
    constructor(options = {}) {
        this._zoomStep = options.zoomStep ?? 8;
        this._maxZoom = options.maxZoom ?? 20;
        this._animationDuration = options.animationDuration ?? 300;

        this._map = null;
        this._container = null;
        this._button = null;

        this._onZoomEnd = () => this._syncFromMap();
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
        this._button.className = 'mapboxgl-ctrl-icon o_mapbox_fly_zoom';
        this._button.type = 'button';
        this._button.title = _t('Zoom in closer');
        this._button.setAttribute('aria-label', _t('Zoom in closer'));

        const icon = document.createElement('span');
        icon.className = 'o_mapbox_fly_zoom_icon';
        icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

        this._button.appendChild(icon);
        this._container.appendChild(this._button);

        this._syncFromMap();
        this._button.addEventListener('click', () => this._flyIn());
        map.on('zoomend', this._onZoomEnd);

        return this._container;
    }

    /**
     * Called by Mapbox when the control is removed from the map.
     */
    onRemove() {
        if (this._map) {
            this._map.off('zoomend', this._onZoomEnd);
        }
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = null;
        this._container = null;
        this._button = null;
    }

    // ----------------------------------------------------------------
    // Internal
    // ----------------------------------------------------------------

    _flyIn() {
        if (!this._map) return;

        const currentZoom = this._map.getZoom();
        const step = this._computeZoomStep(currentZoom);
        const targetZoom = Math.min(currentZoom + step, this._maxZoom);

        this._map.flyTo({
            zoom: targetZoom,
            duration: this._animationDuration,
        });
    }

    /**
     * Returns a step size that scales linearly from _zoomStep (at zoom 0)
     * down to 1 (at maxZoom). This gives large jumps when zoomed out and
     * fine steps when already zoomed in close.
     * @param {number} currentZoom
     * @returns {number}
     */
    _computeZoomStep(currentZoom) {
        const ratio = 1 - Math.min(currentZoom, this._maxZoom) / this._maxZoom;
        const toZoom = Math.max(1, Math.round(this._zoomStep * ratio));
        if (toZoom > this._maxZoom) {
            console.warn(`Computed zoom step ${toZoom} exceeds maxZoom ${this._maxZoom}, capping to maxZoom`);
            return this._maxZoom;
        }
        return toZoom;
    }

    /** Disable the button when already at max zoom. */
    _syncFromMap() {
        if (!this._map || !this._button) return;
        const atMax = this._map.getZoom() >= this._maxZoom;
        this._button.disabled = atMax;
        this._button.classList.toggle('disabled', atMax);
    }
}
