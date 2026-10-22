import { _t } from '@web/core/l10n/translation';
import { loadJS } from '@web/core/assets';
import { debounce } from '@web/core/utils/timing';
import { Component, onWillStart, xml, onMounted, onWillUnmount, useProps, t } from '@odoo/owl';
import { MAPBOX_CONFIG } from '../../utils/utils';

export class MapboxGlSearch extends Component {
    static template = xml`<span></span>`;
    static propsSchema = {
        description: t.any().optional(true),
    };
    props = useProps(this.constructor.propsSchema);

    setup() {
        this.mapboxSearchBox = null;
        this.assetIsLoaded = false;
        this.customEventListenerCleanup = [];
        this.isKeywordExists = false;

        this.debounceHandleSearchDisplay = debounce(this.handleSearchDisplay.bind(this), 500);

        onWillStart(this.loadAsset.bind(this));
        onMounted(this.initializeSearchBox.bind(this));
        onWillUnmount(this.cleanUp.bind(this));
    }

    async loadAsset() {
        try {
            await loadJS(`https://api.mapbox.com/search-js/v${MAPBOX_CONFIG.MAPBOX_SEARCH_VERSION}/web.js`);
            this.assetIsLoaded = true;
        } catch (error) {
            console.error('Error loading Mapbox Search JS:', error);
            this.assetIsLoaded = false;
        }
    }

    /**
     * Attempts to initialize the search box when all dependencies are ready.
     * Uses polling with exponential backoff instead of a fixed delay.
     * @param {number} attempt - Current attempt number (for backoff calculation)
     */
    initializeSearchBox(attempt = 0) {
        if (this.mapboxSearchBox) return; // Already initialized

        const MAX_ATTEMPTS = 10;
        const BASE_DELAY = 50; // Start with 50ms

        // Clear any pending retry
        if (this._initRetryTimeout) {
            clearTimeout(this._initRetryTimeout);
            this._initRetryTimeout = null;
        }

        const mapbox = this.env.getMapbox();
        const isMapReady = this.env.getIsMapReady();
        const settings = this.env.getSettings();

        // Check if all dependencies are ready
        const isReady = mapbox && isMapReady && settings?.access_token && this.assetIsLoaded && window.MapboxSearchBox;

        if (isReady) {
            this._createSearchBox(mapbox, settings);
        } else if (attempt < MAX_ATTEMPTS) {
            // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc. (capped at 1600ms)
            const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), 1600);
            this._initRetryTimeout = setTimeout(() => {
                this.initializeSearchBox(attempt + 1);
            }, delay);
        }
        // After MAX_ATTEMPTS, silently give up (map may not be available)
    }

    /**
     * Creates and configures the Mapbox search box control.
     * @param {Object} mapbox - The Mapbox GL JS map instance
     * @param {Object} settings - The Mapbox settings containing access_token and language
     */
    _createSearchBox(mapbox, settings) {
        this.mapboxSearchBox = new window.MapboxSearchBox();
        this.mapboxSearchBox.accessToken = settings.access_token;
        this.mapboxSearchBox.mapboxgl = window.mapboxgl;
        this.mapboxSearchBox.marker = true;
        this.mapboxSearchBox.options = {
            types: 'address,poi',
            language: settings.language || 'en',
        };
        this.mapboxSearchBox.componentOptions = {
            allowReverse: true,
            flipCoordinates: true,
            flyTo: true,
        };
        this.mapboxSearchBox.placeholder = _t('Search for places');
        mapbox.addControl(this.mapboxSearchBox, 'top-right');
        this.updateBbox();
        const moveEndHandler = () => this.updateBbox();
        mapbox.on('moveend', moveEndHandler);
        this.customEventListenerCleanup.push(() => mapbox.off('moveend', moveEndHandler));
        this.debounceHandleSearchDisplay();
    }

    updateBbox() {
        const mapbox = this.env.getMapbox();
        if (!mapbox || !this.mapboxSearchBox) return;
        const bounds = mapbox.getBounds();
        this.mapboxSearchBox.options = {
            ...this.mapboxSearchBox.options,
            bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        };
    }

    handleSearchDisplay() {
        const mapbox = this.env.getMapbox();
        if (!mapbox || !this.mapboxSearchBox) return;

        const mapboxContainer = mapbox.getContainer();
        const mapboxEl = mapboxContainer.querySelector('mapbox-search-box');
        if (!mapboxEl) return;

        // select parent element
        const parentEl = mapboxEl.parentElement;

        this.isKeywordExists = false;
        const inputEl = mapboxEl.querySelector('input');
        if (inputEl) {
            const inputHandler = (e) => {
                const value = e.target.value;
                this.isKeywordExists = value && value.length > 0;
            };
            inputEl.addEventListener('input', inputHandler);
            this.customEventListenerCleanup.push(() => inputEl.removeEventListener('input', inputHandler));
        }

        // Use aria-label selector (stable accessibility attribute) instead of internal class name
        const clearBtn = mapboxEl.querySelector('button[aria-label="Clear"]');
        if (clearBtn) {
            const clearHandler = () => {
                this.isKeywordExists = false;
                if (parentEl && inputEl) {
                    parentEl.style.width = '34px';
                    inputEl.blur();
                }
            };
            clearBtn.addEventListener('click', clearHandler);
            this.customEventListenerCleanup.push(() => clearBtn.removeEventListener('click', clearHandler));
        }

        if (parentEl && inputEl) {
            parentEl.style.width = '34px';
            parentEl.style.transition = 'width 0.3s ease, transform 0.3s ease';

            // Event handlers
            const expandHandler = () => {
                parentEl.style.width = '300px';
                inputEl.focus();
            };

            const collapseHandler = () => {
                if (this.isKeywordExists) return;
                parentEl.style.width = '34px';
                inputEl.blur();
            };

            // Add event listeners and track them for cleanup
            parentEl.addEventListener('mouseenter', expandHandler);
            parentEl.addEventListener('mouseleave', collapseHandler);
            parentEl.addEventListener('click', expandHandler);
            parentEl.addEventListener('focusin', expandHandler);
            parentEl.addEventListener('focusout', collapseHandler);

            this.customEventListenerCleanup.push(
                () => parentEl.removeEventListener('mouseenter', expandHandler),
                () => parentEl.removeEventListener('mouseleave', collapseHandler),
                () => parentEl.removeEventListener('click', expandHandler),
                () => parentEl.removeEventListener('focusin', expandHandler),
                () => parentEl.removeEventListener('focusout', collapseHandler)
            );
        }
    }

    cleanUp() {
        // Clean up polling timeout
        if (this._initRetryTimeout) {
            clearTimeout(this._initRetryTimeout);
            this._initRetryTimeout = null;
        }

        if (this.debounceHandleSearchDisplay.cancel) {
            this.debounceHandleSearchDisplay.cancel();
        }

        // Clean up event listeners
        for (const customEventListenerCleanup of this.customEventListenerCleanup) {
            customEventListenerCleanup();
        }
        // Reset the cleanup array
        this.customEventListenerCleanup = [];

        // Clean up search box
        if (this.mapboxSearchBox) {
            const mapbox = this.env.getMapbox();
            if (mapbox) {
                try {
                    mapbox.removeControl(this.mapboxSearchBox);
                } catch (error) {
                    console.warn('Error removing search box control:', error);
                }
            }
            this.mapboxSearchBox = null;
        }
    }
}
