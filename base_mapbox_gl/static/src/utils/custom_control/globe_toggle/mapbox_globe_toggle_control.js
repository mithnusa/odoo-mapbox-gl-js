/**
 * Mapbox GL JS custom control that toggles the map projection between
 * Globe and Mercator. Globe is compatible with all of this suite's map
 * styles, including the OSM raster style.
 *
 * Implements the Mapbox IControl interface so it can be added with
 * map.addControl() like any built-in control.
 *
 * The button disables itself whenever `isProjectionLocked()` reports true
 * and forces the map back to Mercator for as long as that lock holds — an
 * extensibility hook for a future style that genuinely can't render on a
 * globe. The user's last choice is remembered and automatically re-applied
 * once the lock is lifted, since setStyle() triggers a fresh 'style.load'
 * each time.
 *
 * setProjection() itself swaps instantly with no built-in animation, so a
 * user-triggered toggle briefly fades the map canvas out and back in
 * (CSS opacity crossfade) around the swap to avoid a visual "pop". Automatic
 * re-syncs (initial load, style changes, lock/unlock) apply instantly since
 * they aren't a deliberate user action.
 *
 * Only the Mapbox Standard/Standard Satellite styles ship their own fog
 * (atmosphere) config; every other style renders the space outside the
 * globe as a flat white void. This control applies a dark-space fog
 * whenever globe is active (and clears it back to none in Mercator, where
 * it doesn't apply), so the globe looks consistent across all styles.
 *
 * Usage:
 *   const globeToggle = new MapboxGlobeToggleControl({ defaultProjection: 'globe' });
 *   map.addControl(globeToggle, 'bottom-right');
 */
import { _t } from '@web/core/l10n/translation';

// Simple globe/meridians glyph (16×16 viewBox)
const GLOBE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.1"><circle cx="8" cy="8" r="6.5" /><ellipse cx="8" cy="8" rx="2.6" ry="6.5" /><path d="M1.7 5.8h12.6M1.7 10.2h12.6" /></svg>`;

const TRANSITION_HOST_CLASS = 'o_mapbox_projection_transition_host';
const TRANSITION_FADE_CLASS = 'o_mapbox_projection_fade_out';

// Dark-space atmosphere, per Mapbox's own "Add custom fog to a map" example.
const DEFAULT_GLOBE_FOG = {
    color: 'rgb(186, 210, 235)', // Lower atmosphere
    'high-color': 'rgb(36, 92, 223)', // Upper atmosphere
    'horizon-blend': 0.02, // Atmosphere thickness
    'space-color': 'rgb(11, 11, 25)', // Background color
    'star-intensity': 0.6, // Background star brightness
};

export class MapboxGlobeToggleControl {
    /**
     * @param {Object} [options]
     * @param {string} [options.defaultProjection='globe']  - Initial projection ('globe' | 'mercator')
     * @param {() => boolean} [options.isProjectionLocked]  - Returns true when the globe projection must not be used
     * @param {number} [options.transitionDuration=260]     - Fade-out duration (ms) before the projection is swapped; the fade-in mirrors it via CSS
     * @param {Object|null} [options.fog]                   - Fog (atmosphere) config applied while globe is active; pass null to disable
     */
    constructor(options = {}) {
        this._isGlobe = (options.defaultProjection ?? 'globe') === 'globe';
        this._isProjectionLocked = options.isProjectionLocked ?? (() => false);
        this._transitionDuration = options.transitionDuration ?? 260;
        this._fog = options.fog !== undefined ? options.fog : DEFAULT_GLOBE_FOG;

        this._map = null;
        this._container = null;
        this._button = null;
        this._transitionTimeoutId = null;
        this._onStyleLoad = () => this._onStyleLoaded();
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
        map.getContainer().classList.add(TRANSITION_HOST_CLASS);

        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        this._button = document.createElement('button');
        this._button.className = 'mapboxgl-ctrl-icon o_mapbox_globe_toggle';
        this._button.type = 'button';
        this._button.innerHTML = GLOBE_ICON_SVG;

        this._container.appendChild(this._button);

        this._button.addEventListener('click', () => this._toggle());
        map.on('style.load', this._onStyleLoad);
        this._setProjection(this._intendedProjection(), { animate: false });

        return this._container;
    }

    /**
     * Called by Mapbox when the control is removed from the map.
     */
    onRemove() {
        clearTimeout(this._transitionTimeoutId);
        this._transitionTimeoutId = null;

        if (this._map) {
            this._map.off('style.load', this._onStyleLoad);
            this._map.getContainer().classList.remove(TRANSITION_HOST_CLASS, TRANSITION_FADE_CLASS);
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

    /** User-triggered toggle: swaps with a fade transition. */
    _toggle() {
        if (!this._map || this._isProjectionLocked() || this._transitionTimeoutId) return;
        this._isGlobe = !this._isGlobe;
        this._setProjection(this._intendedProjection(), { animate: true });
    }

    /** Re-applies the intended projection after a style change; no fade (not a user action). */
    _onStyleLoaded() {
        this._setProjection(this._intendedProjection(), { animate: false });
    }

    _intendedProjection() {
        return !this._isProjectionLocked() && this._isGlobe ? 'globe' : 'mercator';
    }

    /**
     * Applies the projection, optionally crossfading the map canvas so the
     * globe/Mercator swap doesn't visually "pop".
     * @param {string} projection
     * @param {Object} [opts]
     * @param {boolean} [opts.animate=false]
     */
    _setProjection(projection, { animate = false } = {}) {
        if (!this._map) return;

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!animate || prefersReducedMotion || this._map.getProjection?.().name === projection) {
            this._map.setProjection(projection);
            this._applyFog(projection);
            this._updateButtonState();
            return;
        }

        const container = this._map.getContainer();
        container.classList.add(TRANSITION_FADE_CLASS);
        this._button.disabled = true;

        this._transitionTimeoutId = setTimeout(() => {
            this._transitionTimeoutId = null;
            this._map.setProjection(projection);
            this._applyFog(projection);
            this._updateButtonState();
            // Wait a frame so the new projection has rendered before fading back in.
            requestAnimationFrame(() => container.classList.remove(TRANSITION_FADE_CLASS));
        }, this._transitionDuration);
    }

    /**
     * Applies the dark-space atmosphere while globe is active. Most styles (besides
     * Mapbox Standard/Standard Satellite) don't ship their own fog, so without this
     * the space outside the globe renders as a flat white void. Cleared in Mercator,
     * where fog doesn't apply. Re-applied on every 'style.load' since setStyle()
     * wipes it, same as the projection itself.
     * @param {string} projection
     */
    _applyFog(projection) {
        this._map.setFog(projection === 'globe' ? this._fog : null);
    }

    _updateButtonState() {
        if (!this._button) return;
        const locked = this._isProjectionLocked();

        this._button.disabled = locked;
        this._button.classList.toggle('disabled', locked);

        if (locked) {
            this._button.title = _t('Globe projection unavailable for this map style');
            this._button.setAttribute('aria-label', _t('Globe projection unavailable for this map style'));
            this._button.classList.remove('active');
            return;
        }

        if (this._isGlobe) {
            this._button.title = _t('Switch to Mercator projection');
            this._button.setAttribute('aria-label', _t('Switch to Mercator projection'));
            this._button.classList.add('active');
        } else {
            this._button.title = _t('Switch to Globe projection');
            this._button.setAttribute('aria-label', _t('Switch to Globe projection'));
            this._button.classList.remove('active');
        }
    }
}
