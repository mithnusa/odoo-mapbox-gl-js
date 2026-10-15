/**
 * Mapbox GL JS custom control that toggles 3D terrain on and off.
 *
 * When enabled, adds a raster-DEM source and calls setTerrain(). When disabled,
 * calls setTerrain(null) and removes the source. Automatically re-applies terrain
 * after a style change because setStyle() wipes all custom sources.
 *
 * Implements the Mapbox IControl interface so it can be added with
 * map.addControl() like any built-in control.
 *
 * Usage:
 *   const terrain = new MapboxTerrainControl({ exaggeration: 1.5 });
 *   map.addControl(terrain, 'bottom-right');
 */
import { _t } from '@web/core/l10n/translation';

const DEM_SOURCE_ID = 'mapbox-terrain-dem';
const HILLSHADE_LAYER_ID = 'hillshading';

// Simple two-peak mountain silhouette (16×16 viewBox)
const TERRAIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M6 2 1 14h10L6 2zm0 3.2L9.5 13h-7L6 5.2z"/><path d="M11 5 7.5 13H15L11 5z" opacity="0.55"/></svg>`;

export class MapboxTerrainControl {
    /**
     * @param {Object} [options]
     * @param {number} [options.exaggeration=1.5] - Vertical exaggeration factor (0 = flat, 2 = dramatic)
     */
    constructor(options = {}) {
        this._exaggeration = options.exaggeration ?? 1.5;

        this._map = null;
        this._container = null;
        this._button = null;
        this._terrainEnabled = false;
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

        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        this._button = document.createElement('button');
        this._button.className = 'mapboxgl-ctrl-icon o_mapbox_terrain_toggle';
        this._button.type = 'button';
        this._button.innerHTML = TERRAIN_ICON_SVG;
        this._button.setAttribute('title', _t('Enable 3D terrain'));
        this._button.setAttribute('aria-label', _t('Enable 3D terrain'));

        this._container.appendChild(this._button);

        this._updateButtonState();
        this._button.addEventListener('click', () => this._toggle());
        map.on('style.load', this._onStyleLoad);

        return this._container;
    }

    /**
     * Called by Mapbox when the control is removed from the map.
     */
    onRemove() {
        if (this._map) {
            this._map.off('style.load', this._onStyleLoad);
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

    _toggle() {
        if (!this._map) return;
        this._terrainEnabled = !this._terrainEnabled;
        if (this._terrainEnabled) {
            this._enableTerrain();
        } else {
            this._disableTerrain();
        }
        this._updateButtonState();
    }

    _enableTerrain() {
        if (!this._map.getSource(DEM_SOURCE_ID)) {
            this._map.addSource(DEM_SOURCE_ID, {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14,
            });
        }
        this._map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: this._exaggeration });

        // update map pitch and bearing to show terrain by default, but only if map is currently flat
        if (this._map.getPitch() === 0) {
            this._map.easeTo({ pitch: 60, duration: 1000 });
        }
        const style = this._map.getStyle();
        // Update map style to add hillshading layer for better terrain visualization
        if (!style.layers.some((layer) => layer.id === HILLSHADE_LAYER_ID)) {
            this._map.addLayer(
                {
                    id: HILLSHADE_LAYER_ID,
                    type: 'hillshade',
                    source: DEM_SOURCE_ID,
                },
                // Insert below labels for better visibility
                style.layers.find((layer) => layer.type === 'symbol' && layer.layout?.['text-field'])?.id
            );
        }
    }

    _disableTerrain() {
        this._map.setTerrain(null);
        try {
            // Remove hillshading layer if it exists
            if (this._map.getLayer(HILLSHADE_LAYER_ID)) {
                this._map.removeLayer(HILLSHADE_LAYER_ID);
            }
            // Remove DEM source if it exists
            if (this._map.getSource(DEM_SOURCE_ID)) {
                this._map.removeSource(DEM_SOURCE_ID);
            }
            // reset pitch and bearing if they were changed by _enableTerrain and map is still pitched
            if (this._map.getPitch() !== 0) {
                this._map.easeTo({ pitch: 0, duration: 1000 });
            }
        } catch (e) {
            // Source may still be referenced internally; it will be gone on next style.load
        }
    }

    /** Re-apply terrain after a style change wipes all custom sources. */
    _onStyleLoaded() {
        if (this._terrainEnabled) {
            this._enableTerrain();
        }
    }

    _updateButtonState() {
        if (!this._button) return;
        if (this._terrainEnabled) {
            this._button.title = _t('Disable 3D terrain');
            this._button.setAttribute('aria-label', _t('Disable 3D terrain'));
            this._button.classList.add('active');
        } else {
            this._button.title = _t('Enable 3D terrain');
            this._button.setAttribute('aria-label', _t('Enable 3D terrain'));
            this._button.classList.remove('active');
        }
    }
}
