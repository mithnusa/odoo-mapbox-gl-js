/**
 * Shared core methods for Mapbox GL JS integration.
 *
 * Applied to both BaseMapboxGlComponent.prototype and the MapboxGlMixin
 * prototype via applyMapboxGlCore(). All methods access reactive state
 * through this._getMapboxState(), which must return the appropriate state
 * object (this.state for the component, this.mapboxState for the mixin).
 *
 * @module base_mapbox_gl/utils/mapbox_gl_core
 */

import { _t } from '@web/core/l10n/translation';
import { rpc } from '@web/core/network/rpc';
import { renderToString } from '@web/core/utils/render';
import { loadCSS, loadJS } from '@web/core/assets';
import { MAPBOX_STYLES, MAPBOX_CONFIG, MAPBOX_LANGUAGES } from './utils';
import { MapboxPitchToggleControl } from './custom_control/pitch_toggle/mapbox_pitch_toggle_control';
import { MapboxFlyToZoomControl } from './custom_control/dynamic_zoom/mapbox_fly_to_zoom_control';
import { MapboxTerrainControl } from './custom_control/3d_terrain/mapbox_3d_terrain_control';
import { MapboxGlobeToggleControl } from './custom_control/globe_toggle/mapbox_globe_toggle_control';

// =====================================================================
// REGULAR METHODS (applied via Object.assign)
// =====================================================================

const mapboxGlCoreMethods = {
    // -----------------------------------------------------------------
    // ASSET MANAGEMENT
    // -----------------------------------------------------------------

    /**
     * Loads external Mapbox GL JS assets (CSS and JavaScript).
     * Skips loading if assets are already available globally.
     * @async
     * @returns {Promise<void>}
     */
    async loadAssets() {
        const state = this._getMapboxState();
        const checkAssetsLoaded = this.checkAssetsLoaded();
        if (checkAssetsLoaded && !state.assetsLoaded) {
            state.assetsLoaded = true;
            return;
        }
        try {
            const assetJS = this.assetJS();
            const assetCSS = this.assetCSS();

            await Promise.all([...Array.from(assetCSS).map((cssUrl) => loadCSS(cssUrl))]);
            await Promise.all([...Array.from(assetJS).map((jsUrl) => loadJS(jsUrl))]);

            state.assetsLoaded = true;
        } catch (error) {
            console.warn('Failed to load Mapbox GL JS assets:', error);
            state.assetsLoaded = false;
            this.notificationService.add(
                _t('Failed to load Mapbox GL JS assets. Please check your internet connection.'),
                { type: 'danger' }
            );
            this.showErrorAssetsContent();
        }
    },

    /**
     * Checks if external assets are already loaded.
     * @returns {boolean}
     */
    checkAssetsLoaded() {
        return !!window.mapboxgl;
    },

    /**
     * List of external JS assets to load.
     * @returns {Set<string>}
     */
    assetJS() {
        const assetJs = new Set();
        assetJs.add(this.asset_mapbox_js_url);
        return assetJs;
    },

    /**
     * List of external CSS assets to load.
     * @returns {Set<string>}
     */
    assetCSS() {
        const assetCss = new Set();
        assetCss.add(this.asset_mapbox_css_url);
        return assetCss;
    },

    // -----------------------------------------------------------------
    // SETTINGS
    // -----------------------------------------------------------------

    /**
     * Fetches Mapbox GL JS configuration from the server.
     * Sets state.settingsFailed on error so retryConnection() can re-attempt
     * even when the internet was already connected (e.g. Odoo server returned 500).
     * @async
     * @returns {Promise<void>}
     */
    async fetchSettings() {
        const state = this._getMapboxState();
        if (state.settings && Object.keys(state.settings).length) {
            return;
        }
        try {
            const settings = await rpc('/web/mapbox_gl/settings', {});
            state.settings = settings;
            state.settingsFailed = false;
        } catch (error) {
            console.error('Failed to fetch Mapbox GL JS settings:', error);
            state.settingsFailed = true;
            this.notificationService.add(
                _t('Failed to load Mapbox settings. Please reload the page or check your connection.'),
                { type: 'danger' }
            );
        }
    },

    /**
     * Validates that required Mapbox settings are available.
     * @returns {boolean}
     */
    validateSettings() {
        const state = this._getMapboxState();
        if (!state.settings || !state.settings.access_token) {
            this.notificationService.add(
                _t('Mapbox cannot be loaded. No access token is configured. Please contact your administrator.'),
                { type: 'danger' }
            );
            this.showErrorAccessTokenContent();
            return false;
        }
        return true;
    },

    // -----------------------------------------------------------------
    // CONNECTIVITY
    // -----------------------------------------------------------------

    /**
     * Checks if the user is connected to the internet.
     * @async
     * @param {boolean} [verify=false] - If true, makes a network request to verify
     * @returns {Promise<boolean>}
     */
    async checkInternetConnection(verify = false) {
        if (!navigator.onLine) {
            return false;
        }
        if (!verify) {
            return true;
        }
        try {
            const controller = new AbortController();
            const timeout = MAPBOX_CONFIG.CONNECTION?.CHECK_TIMEOUT || 5000;

            if (this._checkInternetTimeoutId) {
                clearTimeout(this._checkInternetTimeoutId);
                this._checkInternetTimeoutId = null;
            }
            this._checkInternetTimeoutId = setTimeout(() => controller.abort(), timeout);
            await fetch('https://api.mapbox.com', {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal,
            });
            clearTimeout(this._checkInternetTimeoutId);
            this._checkInternetTimeoutId = null;
            return true;
        } catch (error) {
            clearTimeout(this._checkInternetTimeoutId);
            this._checkInternetTimeoutId = null;
            console.error('Internet connection check failed: ', error);
            return false;
        }
    },

    /**
     * Shows a notification when there is no internet connection.
     * @param {string} [customMessage]
     */
    showNoInternetNotification(customMessage) {
        if (this._connectionNotificationShown) return;

        const message =
            customMessage ||
            _t('No internet connection detected. Mapbox requires an internet connection to load maps.');
        this.notificationService.add(message, { type: 'warning' });
        this._connectionNotificationShown = true;
    },

    /**
     * Handles browser 'online' event.
     * @private
     */
    _handleOnline() {
        this._connectionNotificationShown = false;
        if (!this.mapBoxGlJs && !this._getMapboxState().isCheckingConnection) {
            if (this._retryTimeoutId) {
                clearTimeout(this._retryTimeoutId);
                this._retryTimeoutId = null;
            }
            const delay = MAPBOX_CONFIG.CONNECTION?.AUTO_RETRY_DELAY || 5000;
            this._retryTimeoutId = setTimeout(() => this.retryConnection(), delay);
        }
    },

    /**
     * Handles browser 'offline' event.
     * @private
     */
    _handleOffline() {
        this._getMapboxState().isInternetConnected = false;
    },

    /**
     * Retries internet connection check and map initialization.
     * @async
     * @returns {Promise<void>}
     */
    async retryConnection() {
        const state = this._getMapboxState();
        if (this.mapBoxGlJs || state.isCheckingConnection) return;

        state.isCheckingConnection = true;
        let isConnected = false;
        try {
            isConnected = await this.checkInternetConnection(true);
        } finally {
            state.isCheckingConnection = false;
        }
        state.isInternetConnected = isConnected;

        if (isConnected) {
            this._connectionNotificationShown = false;
            if (!state.assetsLoaded || !state.settings || state.settingsFailed) {
                // Only fetch settings and load assets if connected
                await this.fetchSettings();
                // No awaited here because we want to set assetsLoaded in the state inside loadAssets after they are loaded
                this.loadAssets();
            }
        } else {
            this.showNoInternetNotification();
        }
    },

    // -----------------------------------------------------------------
    // MAP INITIALIZATION
    // -----------------------------------------------------------------

    /**
     * Builds configuration object for Mapbox GL JS map initialization.
     * Validates settings and prepares all necessary options.
     * @returns {Object} Map configuration object or empty object if validation fails
     */
    mapOptions() {
        if (!this.validateSettings()) return {};

        const state = this._getMapboxState();
        const settings = state.settings;
        const mapEl = this.containerElement;

        // Resolve style: map 'osm-tiles' key to actual OSM style object
        let resolvedStyle = this.defaultMapStyle || settings.style || MAPBOX_CONFIG.DEFAULT_STYLE;
        const isOsm = resolvedStyle === 'osm-tiles';
        if (isOsm) {
            resolvedStyle = MAPBOX_STYLES.OSM;
        }

        const options = {
            accessToken: settings.access_token,
            container: mapEl.el.getAttribute('id'),
            style: resolvedStyle,
            center: this.defaultMapCenter,
            zoom: MAPBOX_CONFIG.DEFAULT_ZOOM,
            antialias: MAPBOX_CONFIG.PERFORMANCE.ANTIALIAS,
            optimizeForTerrain: MAPBOX_CONFIG.PERFORMANCE.OPTIMIZE_FOR_TERRAIN,
            projection: this.defaultMapProjection || settings.projection || 'globe',
            language: settings.language || 'en',
        };

        // Standard style config (not applicable to OSM raster tiles)
        if (!isOsm) {
            options.config = {
                basemap: {
                    theme: settings.theme || this.defaultStyleConfig.theme || 'default',
                    lightPreset: settings.light_preset || this.defaultStyleConfig.lightPreset || 'day',
                    show3dObjects: this.show3dFeatures || false,
                },
            };
        }

        return options;
    },

    /**
     * Initializes the Mapbox GL JS map instance.
     * Silently returns without throwing if the map is already initialized or
     * if the resolved options are invalid (e.g. missing access token).
     * @throws {Error} When the mapboxgl.Map constructor fails
     */
    initializeMap() {
        if (this.mapBoxGlJs) {
            console.warn('Mapbox GL JS is already initialized.');
            return;
        }
        const options = this.mapOptions();
        if (!options || !options.accessToken) {
            console.warn('Mapbox GL JS options are not properly configured.');
            this.notificationService.add(
                _t('Mapbox GL JS cannot be initialized due to invalid configuration. Missing access token.'),
                { type: 'danger' }
            );
            return;
        }
        try {
            const mapBoxGlJs = this._createMapInstance(options);
            this.mapBoxGlJs = mapBoxGlJs;
            this.onMapReady(mapBoxGlJs);
        } catch (error) {
            console.error('Failed to initialize Mapbox GL JS: ', error);
            this.notificationService.add(
                _t('Failed to initialize Mapbox GL JS. Please check the console for details.'),
                { type: 'danger', sticky: true }
            );
            throw error;
        }
    },

    /**
     * Waits for the map 'load' event, racing against component destruction.
     * Sets isMapReady and isMapLoaded on state once the map has loaded.
     * The race prevents the promise from hanging indefinitely if the component
     * is destroyed before the map finishes loading.
     * @async
     * @param {mapboxgl.Map} map - The newly created map instance
     * @returns {Promise<void>}
     */
    async onMapReady(map) {
        // Race load against component destruction. _cleanUp() calls
        // so without the race the promise would hang indefinitely after teardown.
        const mapIsLoaded = new Promise((resolve) => {
            map.once('load', resolve);
        });
        await Promise.race([mapIsLoaded, this._destroyPromise]);

        if (!this._isComponentDestroyed) {
            const state = this._getMapboxState();
            // Map is ready for interaction
            state.isMapReady = true;
            state.isMapLoaded = true;
        }
    },

    /**
     * Creates the actual Mapbox GL JS map instance.
     * @private
     * @param {Object} options - Map configuration options
     * @returns {mapboxgl.Map}
     */
    _createMapInstance(options) {
        window.mapboxgl.accessToken = options.accessToken;
        const map = new window.mapboxgl.Map(options);
        return map;
    },

    /**
     * Checks if the map is ready for use.
     * @returns {boolean}
     */
    isMapboxReady() {
        const { isMapReady, assetsLoaded, isMapLoaded } = this._getMapboxState();
        return isMapReady && assetsLoaded && isMapLoaded && this.mapBoxGlJs !== null;
    },

    // -----------------------------------------------------------------
    // CONFIGURATION GETTERS (non-getter methods)
    // -----------------------------------------------------------------

    /**
     * Gets the merged style configuration.
     * @returns {Object}
     */
    getStyleConfig() {
        return Object.assign({}, this.defaultStyleConfig, this.userStyleConfig);
    },

    /**
     * Determines if user style configuration differs from defaults.
     * @returns {boolean}
     */
    _shouldStyleConfigBeApplied() {
        const userStyleConfig = this.userStyleConfig;
        if (!userStyleConfig) {
            return false;
        }
        const defaultStyleConfig = this.defaultStyleConfig;
        if (!defaultStyleConfig) {
            return false;
        }
        return !!(
            userStyleConfig &&
            Object.keys(userStyleConfig).length &&
            JSON.stringify(userStyleConfig) !== JSON.stringify(defaultStyleConfig)
        );
    },

    // -----------------------------------------------------------------
    // STYLE MANAGEMENT
    // -----------------------------------------------------------------

    /**
     * Applies style configuration to the map.
     * @param {Object} config - Style configuration object
     * @returns {boolean}
     */
    applyStyleConfig(config = {}) {
        if (!this.isMapboxReady()) return false;

        let styleApplied = true;
        const styleConfig = { ...this.getStyleConfig(), ...config };

        Object.entries(styleConfig).forEach(([property, value]) => {
            try {
                this.mapBoxGlJs.setConfigProperty('basemap', property, value);
            } catch (error) {
                console.warn(`Failed to set style config property ${property}:`, error);
                styleApplied = false;
            }
        });
        return styleApplied;
    },

    /**
     * Changes the map style at runtime without losing custom data.
     * @param {string} styleUrl - Mapbox style URL
     * @param {Object} config - Optional style configuration
     */
    setMapStyle(styleUrl, config = {}) {
        if (!this.isMapboxReady()) return;
        this.setMapStylePreserveData(styleUrl, config);
    },

    /**
     * Changes map style while preserving all custom sources and layers.
     * @param {string} styleUrl - New style URL
     * @param {Object} config - Style configuration
     */
    setMapStylePreserveData(styleUrl, config = {}) {
        if (!this.isMapboxReady()) return;

        // A style change still in flight may already be partway through replacing the style,
        // so reuse its snapshot and drop its pending restore instead of taking a new one.
        const pendingStyleChange = this._pendingStyleChange;
        if (pendingStyleChange) {
            this.mapBoxGlJs.off('style.load', pendingStyleChange.restore);
        }
        const customData = pendingStyleChange ? pendingStyleChange.customData : this._getCustomMapData();

        const restoreData = () => {
            this._pendingStyleChange = null;
            this._restoreCustomMapData(customData);
            if (this.isStandardStyle(styleUrl) && Object.keys(config).length > 0) {
                this.applyStyleConfig(config);
            }
            this._reapplyDisplayOptions(styleUrl);
            this._onStyleChangeComplete();
        };
        this._pendingStyleChange = { customData, restore: restoreData };

        // Use diff for Mapbox-to-Mapbox URL style changes; full replacement otherwise
        const currentSprite = this.mapBoxGlJs.getStyle()?.sprite;
        const isCurrentMapboxStyle = typeof currentSprite === 'string' || Array.isArray(currentSprite);
        const isNewMapboxStyle = typeof styleUrl === 'string' && styleUrl.startsWith('mapbox://');
        const useDiff = isCurrentMapboxStyle && isNewMapboxStyle;

        try {
            this.mapBoxGlJs.once('style.load', restoreData);
            this.mapBoxGlJs.setStyle(styleUrl, { diff: useDiff });
        } catch (error) {
            console.error('Failed to change style while preserving data: ', error);
            this.mapBoxGlJs.off('style.load', restoreData);
            this._pendingStyleChange = null;
            this.notificationService.add(_t('Failed to change map style'), {
                type: 'danger',
            });
        }
    },

    /**
     * Gets all custom sources and layers.
     * @private
     * @returns {Object}
     */
    _getCustomMapData() {
        const style = this.mapBoxGlJs.getStyle();
        const customData = {
            sources: {},
            layers: [],
        };

        Object.keys(style.sources || {}).forEach((sourceId) => {
            if (this._isCustomSource(sourceId)) {
                customData.sources[sourceId] = style.sources[sourceId];
            }
        });

        const layers = style.layers || [];
        layers.forEach((layer, index) => {
            if (this._isCustomLayer(layer)) {
                // Keep the next base layer so the custom layer can be re-inserted at the same depth
                const nextBaseLayer = layers.slice(index + 1).find((next) => !this._isCustomLayer(next));
                customData.layers.push({ layer, beforeId: nextBaseLayer?.id });
            }
        });

        return customData;
    },

    /**
     * Restores custom sources and layers after style change.
     * @private
     * @param {Object} customData
     */
    _restoreCustomMapData(customData) {
        if (!this.isMapboxReady()) return;
        let hasFailures = false;

        Object.keys(customData.sources).forEach((sourceId) => {
            if (this.mapBoxGlJs.getSource(sourceId)) return;
            try {
                this.mapBoxGlJs.addSource(sourceId, customData.sources[sourceId]);
            } catch (error) {
                hasFailures = true;
                console.error(`Failed to restore source ${sourceId}:`, error);
            }
        });

        customData.layers.forEach(({ layer, beforeId }) => {
            if (this.mapBoxGlJs.getLayer(layer.id)) return;
            // Layers with a slot are already positioned by the slot; beforeId only applies otherwise
            const before = !layer.slot && beforeId && this.mapBoxGlJs.getLayer(beforeId) ? beforeId : undefined;
            try {
                this.mapBoxGlJs.addLayer(layer, before);
            } catch (error) {
                hasFailures = true;
                console.error(`Failed to restore layer ${layer.id}:`, error);
            }
        });

        if (hasFailures) {
            this._triggerDataReload();
        }
    },

    /**
     * Determines if a source is custom (not part of the base style).
     * @private
     * @param {string} sourceId
     * @returns {boolean}
     */
    _isCustomSource(sourceId) {
        const baseStyleSources = ['mapbox://styles/mapbox', 'composite', 'mapbox-', 'osm-tiles'];
        const isBaseSource =
            baseStyleSources.some((pattern) => sourceId.includes(pattern)) || sourceId.startsWith('mapbox://');
        return !isBaseSource;
    },

    /**
     * Determines if a layer is custom (not part of the base style).
     * @private
     * @param {Object} layer
     * @returns {boolean}
     */
    _isCustomLayer(layer) {
        if (!layer.source) return false;
        if (this._isCustomSource(layer.source)) {
            return true;
        }
        const customLayerPatterns = ['geojson', 'custom', 'user', 'data'];
        return customLayerPatterns.some(
            (pattern) =>
                layer.id.toLowerCase().includes(pattern) ||
                (layer.source && layer.source.toLowerCase().includes(pattern))
        );
    },

    /**
     * Reapplies persisted display-option toggles (label visibility, 3D
     * features) after a style change, since a freshly loaded style always
     * resets to its own defaults (labels and 3D objects visible).
     * @private
     * @param {string|Object} styleUrl - The newly applied style
     */
    _reapplyDisplayOptions(styleUrl) {
        if (!this.showMapLabels) {
            this._setLabelLayersVisibility(false);
        }
        if (this.isStandardBaseStyle(styleUrl) && !this.show3dFeatures) {
            try {
                this.mapBoxGlJs.setConfigProperty('basemap', 'show3dObjects', false);
            } catch (error) {
                console.warn('Failed to reapply 3D features toggle:', error);
            }
        }
    },

    /**
     * Called when style change is complete. Override in child classes.
     * @protected
     */
    _onStyleChangeComplete() {
        // Override in child classes if needed
    },

    /**
     * Triggers a data reload when restoration fails. Override in child classes.
     * @protected
     */
    _triggerDataReload() {
        // Override in child classes to re-render data
    },

    /**
     * Checks if a style is a Standard style.
     * @param {string} styleUrl
     * @returns {boolean}
     */
    isStandardStyle(styleUrl) {
        return typeof styleUrl === 'string' && styleUrl.includes('standard');
    },

    /**
     * Checks if a style is exactly the Mapbox Standard style (not Standard
     * Satellite). The `show3dObjects` config toggle is only exposed for
     * this exact style.
     * @param {string} styleUrl
     * @returns {boolean}
     */
    isStandardBaseStyle(styleUrl) {
        return styleUrl === MAPBOX_STYLES.STANDARD;
    },

    // -----------------------------------------------------------------
    // STYLE SWITCHER UI
    // -----------------------------------------------------------------

    /**
     * Renders the style switcher UI into the map container.
     */
    renderStyleSwitcher() {
        if (!this.enableStyleSwitcher || !this.isMapboxReady()) {
            return;
        }

        try {
            // Clean up any existing switcher to avoid duplicates (important for hot reloads and dynamic rendering)
            this.cleanUpStyleSwitcher();

            const switcherHTML = this.createStyleSwitcherHTML();
            const container = document.createElement('div');
            container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
            container.innerHTML = switcherHTML;

            this._styleSwitcherControl = {
                onAdd: () => container,
                onRemove: () => container.remove(),
            };
            this.mapBoxGlJs.addControl(this._styleSwitcherControl, 'top-left');
            this.attachStyleSwitcherEvents();
        } catch (error) {
            console.warn('Could not render style switcher:', error);
        }
    },

    /**
     * Creates the HTML for the style switcher.
     * @returns {string}
     */
    createStyleSwitcherHTML() {
        const styles = this.getAvailableStyles();
        const settings = this._getMapboxState().settings || {};
        const isDefaultStyle = this.defaultMapStyle ? true : false;
        const mapStyle = (isDefaultStyle ? this.defaultMapStyle : settings.style) || MAPBOX_CONFIG.DEFAULT_STYLE;
        const currentStyleObj = styles.find((s) => s.url === mapStyle || s.key === mapStyle);
        const currentStyle = currentStyleObj ? currentStyleObj.key : 'standard';

        const isStandardStyle = this.isStandardStyle(mapStyle);
        return renderToString('base_mapbox_gl.MapboxDisplayControl', {
            styles,
            currentStyle,
            isStandardStyle,
            isOsmStyle: currentStyle === 'osm-tiles',
            isStandardBaseStyle: this.isStandardBaseStyle(mapStyle),
            showLabels: this.showMapLabels,
            show3dFeatures: this.show3dFeatures,
            currentLightPreset: settings.light_preset || this.defaultStyleConfig.lightPreset || 'day',
            currentTheme: settings.theme || this.defaultStyleConfig.theme || 'default',
            currentLanguage: settings.language || 'en',
            languageSupported: MAPBOX_LANGUAGES,
        });
    },

    /**
     * Gets available map styles for the switcher.
     * @returns {Array}
     */
    getAvailableStyles() {
        return [
            {
                key: 'standard',
                url: MAPBOX_STYLES.STANDARD,
                label: 'Standard',
                description: 'Modern 3D style with dynamic lighting',
                icon: 'fa fa-map-o',
            },
            {
                key: 'standard-satellite',
                url: MAPBOX_STYLES.STANDARD_SATELLITE,
                label: 'Satellite',
                description: 'Satellite imagery with standard styling',
                icon: 'fa fa-globe',
            },
            {
                key: 'streets',
                url: MAPBOX_STYLES.STREETS,
                label: 'Streets',
                description: 'Classic street map style',
                icon: 'fa fa-road',
            },
            {
                key: 'outdoors',
                url: MAPBOX_STYLES.OUTDOORS,
                label: 'Outdoors',
                description: 'Terrain and outdoor features',
                icon: 'fa fa-tree',
            },
            {
                key: 'satellite-streets',
                url: MAPBOX_STYLES.SATELLITE_STREETS,
                label: 'Hybrid',
                description: 'Satellite with street labels',
                icon: 'fa fa-map-signs',
            },
            {
                key: 'osm-tiles',
                url: MAPBOX_STYLES.OSM,
                label: 'OSM',
                description: 'OpenStreetMap',
                icon: 'fa fa-map',
            },
            {
                key: 'light-v11',
                url: MAPBOX_STYLES.LIGHT,
                label: 'Light',
                description: 'Light theme with minimalistic design',
                icon: 'fa fa-sun-o',
            },
            {
                key: 'dark-v11',
                url: MAPBOX_STYLES.DARK,
                label: 'Dark',
                description: 'Dark theme with minimalistic design',
                icon: 'fa fa-moon-o',
            },
        ];
    },

    /**
     * Resolves a style key to its URL/object from available styles.
     * @param {string} key
     * @returns {string|Object|null}
     */
    getStyleByKey(key) {
        const styles = this.getAvailableStyles();
        const style = styles.find((s) => s.key === key);
        return style ? style.url : null;
    },

    /**
     * Attaches event listeners to the style switcher.
     */
    attachStyleSwitcherEvents() {
        try {
            const container = this.containerElement.el;
            const switcher = container.querySelector('.o_mapbox_style_switcher');
            if (!switcher) return;

            const toggle = switcher.querySelector('.o_mapbox_style_switcher_toggle');
            const content = switcher.querySelector('.o_mapbox_style_switcher_content');
            const styleOptions = switcher.querySelectorAll('.o_mapbox_style_option');
            const lightPreset = switcher.querySelector('.o_mapbox_light_preset');
            const theme = switcher.querySelector('.o_mapbox_theme');
            const language = switcher.querySelector('.o_mapbox_language_preset');
            const showLabels = switcher.querySelector('.o_mapbox_show_labels');
            const show3dFeatures = switcher.querySelector('.o_mapbox_show_3d_features');

            const boundHandlers = {
                toggleClick: (e) => this.handleToggleClick(e, content, toggle),
                styleClick: (e, button) => this.handleStyleClick(e, button, switcher, content, toggle),
                configChange: () => this.applyCurrentStyleConfig(switcher),
                languageChange: (e) => this.applyChangeLanguage(e),
                showLabelsChange: (e) => this.applyChangeShowLabels(e),
                show3dFeaturesChange: (e) => this.applyChangeShow3dFeatures(e),
            };

            if (toggle) {
                toggle.addEventListener('click', boundHandlers.toggleClick);
                this.styleSwitcherListeners.set(toggle, {
                    event: 'click',
                    handler: boundHandlers.toggleClick,
                });
            }

            styleOptions.forEach((button) => {
                const styleClickHandler = (e) => boundHandlers.styleClick(e, button);
                button.addEventListener('click', styleClickHandler);
                this.styleSwitcherListeners.set(button, {
                    event: 'click',
                    handler: styleClickHandler,
                });
            });

            [lightPreset, theme].forEach((select) => {
                if (select) {
                    select.addEventListener('change', boundHandlers.configChange);
                    this.styleSwitcherListeners.set(select, {
                        event: 'change',
                        handler: boundHandlers.configChange,
                    });
                }
            });

            if (language) {
                language.addEventListener('change', boundHandlers.languageChange);
                this.styleSwitcherListeners.set(language, {
                    event: 'change',
                    handler: boundHandlers.languageChange,
                });
            }

            if (showLabels) {
                showLabels.addEventListener('change', boundHandlers.showLabelsChange);
                this.styleSwitcherListeners.set(showLabels, {
                    event: 'change',
                    handler: boundHandlers.showLabelsChange,
                });
            }

            if (show3dFeatures) {
                show3dFeatures.addEventListener('change', boundHandlers.show3dFeaturesChange);
                this.styleSwitcherListeners.set(show3dFeatures, {
                    event: 'change',
                    handler: boundHandlers.show3dFeaturesChange,
                });
            }

            // Initialize disabled state for OSM
            const currentStyleKey = switcher.dataset.currentStyle;
            if (currentStyleKey === 'osm-tiles' && language) {
                language.disabled = true;
            }
        } catch (error) {
            console.error('Could not attach style switcher events:', error);
        }
    },

    /**
     * Handles toggle click for style switcher visibility.
     * @param {Event} e
     * @param {HTMLElement} content
     * @param {HTMLElement} toggle
     */
    handleToggleClick(e, content, toggle) {
        e.preventDefault();
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        toggle.classList.toggle('active', !isVisible);
        toggle.querySelector('.fa').classList.toggle('fa-close', !isVisible);
        toggle.querySelector('.fa').classList.toggle('fa-paint-brush', isVisible);
    },

    /**
     * Handles style selection button click.
     * @param {Event} e
     * @param {HTMLElement} button
     * @param {HTMLElement} switcher
     * @param {HTMLElement} content
     * @param {HTMLElement} toggle
     */
    handleStyleClick(e, button, switcher, content, toggle) {
        e.preventDefault();
        e.stopPropagation();
        const styleKey = button.dataset.styleKey;
        const styleUrl = this.getStyleByKey(styleKey);
        if (!styleUrl) return;
        this.selectMapStyle(styleKey, styleUrl, switcher);

        if (window.innerWidth < MAPBOX_CONFIG.STYLE_SWITCHER.MOBILE_BREAKPOINT) {
            content.style.display = 'none';
            toggle.classList.remove('active');
        }
    },

    /**
     * Selects a map style and updates the UI.
     * @param {string} styleKey
     * @param {string|Object} styleUrl
     * @param {HTMLElement} switcher
     */
    selectMapStyle(styleKey, styleUrl, switcher) {
        const currentStyleKey = switcher.dataset.currentStyle;
        const isCurrentStyle = currentStyleKey === styleKey;
        const settings = this._getMapboxState().settings || {};

        const config = this.isStandardStyle(styleUrl)
            ? {
                  lightPreset:
                      switcher.querySelector('.o_mapbox_light_preset')?.value || settings.light_preset || 'day',
                  theme: switcher.querySelector('.o_mapbox_theme')?.value || settings.theme || 'default',
              }
            : {};

        const languageSelect = switcher.querySelector('.o_mapbox_language_preset');

        // OSM raster tiles don't carry Mapbox's language field, so localized labels aren't available.
        if (styleKey === 'osm-tiles') {
            if (languageSelect) {
                languageSelect.disabled = true;
            }
        } else if (currentStyleKey === 'osm-tiles') {
            if (languageSelect) {
                languageSelect.disabled = false;
            }
        }

        // Labels are not available for OSM raster tiles (no vector label layers);
        // 3D features are only available for the exact Mapbox Standard style.
        const showLabelsCheckbox = switcher.querySelector('.o_mapbox_show_labels');
        if (showLabelsCheckbox) {
            showLabelsCheckbox.disabled = styleKey === 'osm-tiles';
        }
        const show3dFeaturesCheckbox = switcher.querySelector('.o_mapbox_show_3d_features');
        if (show3dFeaturesCheckbox) {
            show3dFeaturesCheckbox.disabled = !this.isStandardBaseStyle(styleUrl);
        }

        if (!isCurrentStyle) {
            this.setMapStyle(styleUrl, config);
        } else if (this.isStandardStyle(styleUrl)) {
            this.applyStyleConfig(config);
        }

        // Update UI
        switcher.dataset.currentStyle = styleKey;
        const configPanel = switcher.querySelector('.o_mapbox_style_config');
        if (configPanel) {
            configPanel.style.display = this.isStandardStyle(styleUrl) ? 'block' : 'none';
        }

        switcher.querySelectorAll('.o_mapbox_style_option').forEach((btn) => {
            const isActive = btn.dataset.styleKey === styleKey;
            btn.className = `o_mapbox_style_option btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-secondary'}`;
        });
    },

    /**
     * Applies current style configuration from the switcher.
     * @param {HTMLElement} switcher
     */
    applyCurrentStyleConfig(switcher) {
        const currentStyleKey = switcher.dataset.currentStyle;
        const styleUrl = this.getStyleByKey(currentStyleKey);
        if (styleUrl && this.isStandardStyle(styleUrl)) {
            const config = {
                lightPreset: switcher.querySelector('.o_mapbox_light_preset')?.value || 'day',
                theme: switcher.querySelector('.o_mapbox_theme')?.value || 'default',
            };
            this.applyStyleConfig(config);
        }
    },

    /**
     * Applies language change to the map.
     * @param {Event} e
     */
    applyChangeLanguage(e) {
        const language = e.target.value;
        if (this.mapBoxGlJs && language) {
            this.mapBoxGlJs.setLanguage(language);
        }
    },

    /**
     * Toggles visibility of label layers (symbol layers rendering a
     * text-field) in the active style. Not wired for OSM raster tiles,
     * which carry no vector label layers.
     * @param {Event} e
     */
    applyChangeShowLabels(e) {
        const show = e.target.checked;
        this.showMapLabels = show;
        this._setLabelLayersVisibility(show);
    },

    /**
     * Toggles 3D features (buildings, landmarks) via the Mapbox Standard
     * style's `show3dObjects` config property. Only wired when the exact
     * Standard style ('mapbox://styles/mapbox/standard') is active.
     * @param {Event} e
     */
    applyChangeShow3dFeatures(e) {
        const show = e.target.checked;
        this.show3dFeatures = show;
        if (!this.isMapboxReady()) return;
        try {
            this.mapBoxGlJs.setConfigProperty('basemap', 'show3dObjects', show);
        } catch (error) {
            console.warn('Failed to toggle 3D features:', error);
        }
    },

    /**
     * Sets the visibility layout property on every label layer of the
     * active style, or — for styles that support the Standard basemap
     * config (an `imports` entry with id 'basemap') — the equivalent
     * config properties.
     * @private
     * @param {boolean} show
     */
    _setLabelLayersVisibility(show) {
        if (!this.isMapboxReady()) return;

        const mapStyle = this.mapBoxGlJs.getStyle();
        const supportsBasemapConfig =
            Array.isArray(mapStyle?.imports) && mapStyle.imports.some((i) => i.id === 'basemap');

        if (supportsBasemapConfig) {
            ['showPlaceLabels', 'showPointOfInterestLabels', 'showRoadLabels', 'showTransitLabels'].forEach(
                (property) => {
                    try {
                        this.mapBoxGlJs.setConfigProperty('basemap', property, show);
                    } catch (error) {
                        console.warn(`Failed to set label config property ${property}:`, error);
                    }
                }
            );
            return;
        }

        (mapStyle?.layers || []).forEach((layer) => {
            if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
                try {
                    this.mapBoxGlJs.setLayoutProperty(layer.id, 'visibility', show ? 'visible' : 'none');
                } catch (error) {
                    console.warn(`Failed to toggle visibility for label layer ${layer.id}:`, error);
                }
            }
        });
    },

    // -----------------------------------------------------------------
    // MAP CONTROLS
    // -----------------------------------------------------------------

    /**
     * Adds navigation, scale, and fullscreen controls to the map,
     * renders the style switcher, and applies any pending user style configuration.
     */
    addMapControl() {
        if (!this.isMapboxReady()) return;

        const controlPosition = this.mapControlPosition;

        const scaleControl = new window.mapboxgl.ScaleControl();
        this.mapBoxGlJs.addControl(scaleControl, controlPosition.scale || 'bottom-left');

        const navigationControl = new window.mapboxgl.NavigationControl();
        this.mapBoxGlJs.addControl(navigationControl, controlPosition.navigation || 'bottom-right');

        const fullscreenControl = new window.mapboxgl.FullscreenControl();
        this.mapBoxGlJs.addControl(fullscreenControl, controlPosition.fullscreen || 'bottom-right');

        if (this.enablePitchToggle) {
            this._pitchToggleControl = new MapboxPitchToggleControl();
            this.mapBoxGlJs.addControl(this._pitchToggleControl, controlPosition.pitchToggle || 'bottom-right');
        }

        if (this.enableFlyToZoom) {
            this._flyToZoomControl = new MapboxFlyToZoomControl();
            this.mapBoxGlJs.addControl(this._flyToZoomControl, controlPosition.flyToZoom || 'bottom-right');
        }

        if (this.enableTerrainToggle) {
            this._terrainControl = new MapboxTerrainControl();
            this.mapBoxGlJs.addControl(this._terrainControl, controlPosition.terrain || 'bottom-right');
        }

        if (this.enableGlobeToggle) {
            const options = this.mapOptions();
            this._globeToggleControl = new MapboxGlobeToggleControl({
                defaultProjection: options.projection || 'globe',
            });
            this.mapBoxGlJs.addControl(this._globeToggleControl, controlPosition.globeToggle || 'bottom-right');
        }

        this.renderStyleSwitcher();
        const userStyleConfig = this.userStyleConfig;
        if (this._shouldStyleConfigBeApplied()) {
            this.applyStyleConfig(userStyleConfig);
        }
    },

    /**
     * Called when the map is fully loaded and ready for interaction
     * Override this method in child classes to perform actions when the map is fully loaded
     */
    onMapLoaded() {
        this.addMapControl();
    },

    // -----------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------

    /**
     * Cleans up style switcher event listeners and DOM elements.
     */
    cleanUpStyleSwitcher() {
        for (const [element, { event, handler }] of this.styleSwitcherListeners) {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        }
        this.styleSwitcherListeners.clear();

        try {
            if (this._styleSwitcherControl && this.mapBoxGlJs) {
                this.mapBoxGlJs.removeControl(this._styleSwitcherControl);
            }
        } catch (error) {
            console.debug('Could not remove style switcher control:', error);
        }
        this._styleSwitcherControl = null;
    },

    /**
     * Cleanup method: removes map instance and resets state.
     */
    cleanUp() {
        window.removeEventListener('online', this._boundHandleOnline);
        window.removeEventListener('offline', this._boundHandleOffline);

        this._isComponentDestroyed = true;

        if (this._destroyResolve) {
            this._destroyResolve();
            this._destroyResolve = null;
        }

        this._destroyPromise = null;

        if (this._retryTimeoutId) {
            clearTimeout(this._retryTimeoutId);
            this._retryTimeoutId = null;
        }

        if (this._checkInternetTimeoutId) {
            clearTimeout(this._checkInternetTimeoutId);
            this._checkInternetTimeoutId = null;
        }

        this.cleanUpStyleSwitcher();

        try {
            if (this._pitchToggleControl && this.mapBoxGlJs) {
                this.mapBoxGlJs.removeControl(this._pitchToggleControl);
            }
        } catch (error) {
            console.debug('Could not remove pitch toggle control:', error);
        }
        this._pitchToggleControl = null;

        try {
            if (this._flyToZoomControl && this.mapBoxGlJs) {
                this.mapBoxGlJs.removeControl(this._flyToZoomControl);
            }
        } catch (error) {
            console.debug('Could not remove fly-to-zoom control:', error);
        }
        this._flyToZoomControl = null;

        try {
            if (this._terrainControl && this.mapBoxGlJs) {
                this.mapBoxGlJs.removeControl(this._terrainControl);
            }
        } catch (error) {
            console.debug('Could not remove terrain control:', error);
        }
        this._terrainControl = null;

        try {
            if (this._globeToggleControl && this.mapBoxGlJs) {
                this.mapBoxGlJs.removeControl(this._globeToggleControl);
            }
        } catch (error) {
            console.debug('Could not remove globe toggle control:', error);
        }
        this._globeToggleControl = null;

        if (this.mapBoxGlJs) {
            this.mapBoxGlJs.remove();
            this.mapBoxGlJs = null;
        }
    },

    // -----------------------------------------------------------------
    // ERROR DISPLAY
    // -----------------------------------------------------------------

    /**
     * Shows error content in the map container.
     * @private
     * @param {string} msg
     */
    _showErrorContent(msg) {
        try {
            const mapEl = this.containerElement;
            if (mapEl && mapEl.el) {
                const mapInfoEl = mapEl.el.parentElement.querySelector('.o_mapboxgl_view_startpoint');
                if (mapInfoEl) {
                    const divEl = document.createElement('div');
                    divEl.className = 'text-muted small';
                    const p1El = document.createElement('p');
                    p1El.className = 'mb-1';
                    const iconEl = document.createElement('i');
                    iconEl.className = 'fa fa-2x fa-warning d-block text-center p-2';
                    p1El.appendChild(iconEl);
                    p1El.appendChild(
                        document.createTextNode(
                            _t('Failed to load Mapbox. Please check javascript console for errors.')
                        )
                    );
                    const p2El = document.createElement('p');
                    p2El.className = 'mb-1';
                    p2El.textContent = msg;
                    divEl.appendChild(p1El);
                    divEl.appendChild(p2El);
                    mapInfoEl.textContent = '';
                    mapInfoEl.appendChild(divEl);
                }
            }
        } catch (error) {
            console.warn('Could not display error content:', error);
        }
    },

    /**
     * Displays an error in the map container when Mapbox assets fail to load.
     */
    showErrorAssetsContent() {
        const msg = _t('Failed to load Mapbox assets, please make sure you are connected to the internet.');
        this._showErrorContent(msg);
    },

    /**
     * Displays an error in the map container when no Mapbox access token is configured.
     */
    showErrorAccessTokenContent() {
        const msg = _t('Mapbox Token is required, please add your Mapbox Token in the settings.');
        this._showErrorContent(msg);
    },
};

// =====================================================================
// GETTER DESCRIPTORS (applied via Object.defineProperties)
//
// Each entry is a configurable, enumerable property descriptor with a
// backing private field (double-underscore prefix) so that subclasses
// can override the default by assigning to the property name directly.
// =====================================================================

const mapboxGlCoreGetters = {
    /**
     * URL for the Mapbox GL JS script asset.
     * Defaults to the locally bundled file under /base_mapbox_gl/static/lib/.
     * @type {string}
     */
    asset_mapbox_js_url: {
        get() {
            return (
                this.__asset_mapbox_gl_url ??
                `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_CONFIG.VERSION}/mapbox-gl.js`
            );
        },
        set(value) {
            this.__asset_mapbox_gl_url = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * URL for the Mapbox GL JS stylesheet asset.
     * Defaults to the locally bundled file under /base_mapbox_gl/static/lib/.
     * @type {string}
     */
    asset_mapbox_css_url: {
        get() {
            return (
                this.__asset_mapbox_css_url ??
                `https://api.mapbox.com/mapbox-gl-js/v${MAPBOX_CONFIG.VERSION}/mapbox-gl.css`
            );
        },
        set(value) {
            this.__asset_mapbox_css_url = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Default map center as [longitude, latitude]. Defaults to [0, 0] (Null Island).
     * @type {[number, number]}
     */
    defaultMapCenter: {
        get() {
            return this.__default_map_center ?? [0.0, 0.0]; // [longitude, latitude] - Null Island
        },
        set(value) {
            this.__default_map_center = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Default map style key or URL. When set, takes precedence over the server-side
     * settings value. Defaults to null (falls back to settings or MAPBOX_CONFIG.DEFAULT_STYLE).
     * @type {string|null}
     */
    defaultMapStyle: {
        get() {
            return this.__default_map_style ?? null;
        },
        set(value) {
            this.__default_map_style = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Default map projection (e.g. 'globe', 'mercator'). When set, takes precedence
     * over the server-side settings value. Defaults to null (falls back to settings or 'globe').
     * @type {string|null}
     */
    defaultMapProjection: {
        get() {
            return this.__default_map_projection ?? null;
        },
        set(value) {
            this.__default_map_projection = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Default style configuration applied at map initialization.
     * Contains lightPreset ('day' | 'dawn' | 'dusk' | 'night') and theme ('default' | 'faded' | 'monochrome').
     * Assigning merges with the existing defaults rather than replacing them.
     * @type {{ lightPreset: string, theme: string }}
     */
    defaultStyleConfig: {
        get() {
            return (
                this.__default_style_config ?? {
                    lightPreset: 'day',
                    theme: 'default',
                }
            );
        },
        set(value) {
            this.__default_style_config = Object.assign({}, this.defaultStyleConfig, value);
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Effective style configuration derived from server settings (light_preset, theme).
     * Can be overridden by assigning an object, which is merged with the current value.
     * Used by _shouldStyleConfigBeApplied() and applyStyleConfig() to determine
     * whether a post-load style update is needed.
     * @type {{ lightPreset?: string, theme?: string }}
     */
    userStyleConfig: {
        get() {
            const settings = this._getMapboxState().settings || {};
            const config = {};
            if (settings.light_preset) {
                config.lightPreset = settings.light_preset;
            }
            if (settings.theme) {
                config.theme = settings.theme;
            }
            return this.__user_style_config ?? config;
        },
        set(value) {
            this.__user_style_config = Object.assign({}, this.userStyleConfig, value);
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether map labels (place, road, POI, transit) are currently shown.
     * Defaults to true. Not applicable to OSM raster tiles.
     * @type {boolean}
     */
    showMapLabels: {
        get() {
            return this.__show_map_labels ?? true;
        },
        set(value) {
            this.__show_map_labels = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether 3D features (buildings, landmarks) are shown. Defaults to
     * false. Only applicable when the active style is exactly
     * 'mapbox://styles/mapbox/standard'.
     * @type {boolean}
     */
    show3dFeatures: {
        get() {
            return this.__show_3d_features ?? false;
        },
        set(value) {
            this.__show_3d_features = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the style switcher control is rendered on the map. Defaults to true.
     * @type {boolean}
     */
    enableStyleSwitcher: {
        get() {
            return this.__enable_style_switcher ?? true;
        },
        set(value) {
            this.__enable_style_switcher = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the pitch toggle button (flat/tilted view) is rendered on the map. Defaults to true.
     * @type {boolean}
     */
    enablePitchToggle: {
        get() {
            return this.__enable_pitch_toggle ?? true;
        },
        set(value) {
            this.__enable_pitch_toggle = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the fly-to-zoom button is rendered on the map. Defaults to true.
     * @type {boolean}
     */
    enableFlyToZoom: {
        get() {
            return this.__enable_fly_to_zoom ?? false;
        },
        set(value) {
            this.__enable_fly_to_zoom = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the 3D terrain toggle button is rendered on the map. Defaults to false.
     * @type {boolean}
     */
    enableTerrainToggle: {
        get() {
            return this.__enable_terrain_toggle ?? false;
        },
        set(value) {
            this.__enable_terrain_toggle = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the Globe/Mercator projection toggle button is rendered on the map. Defaults to true.
     * @type {boolean}
     */
    enableGlobeToggle: {
        get() {
            return this.__enable_globe_toggle ?? true;
        },
        set(value) {
            this.__enable_globe_toggle = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Positions for the built-in map controls.
     * Valid positions: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'.
     * Assigning merges with the existing defaults rather than replacing them.
     * @type {{ navigation: string, fullscreen: string, scale: string, pitchToggle: string, flyToZoom: string, terrain: string, globeToggle: string }}
     */
    mapControlPosition: {
        get() {
            return (
                this.__map_control_position ?? {
                    navigation: 'bottom-right',
                    fullscreen: 'bottom-right',
                    scale: 'bottom-left',
                    pitchToggle: 'bottom-right',
                    flyToZoom: 'bottom-right',
                    terrain: 'bottom-right',
                    globeToggle: 'bottom-right',
                }
            );
        },
        set(value) {
            this.__map_control_position = Object.assign({}, this.mapControlPosition, value);
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the currently active map style uses OSM raster tiles.
     * Determined by inspecting source keys of the live map style.
     * @type {boolean}
     */
    isOSMStyle: {
        get() {
            const style = this.mapBoxGlJs?.getStyle();
            const styleSources = style?.sources || {};
            let isOSMStyle = false;
            for (const sourceKey in styleSources) {
                if (sourceKey.toLowerCase().includes('osm')) {
                    isOSMStyle = true;
                    break;
                }
            }
            return isOSMStyle;
        },
        set() {},
        configurable: true,
        enumerable: true,
    },

    /**
     * The active Mapbox GL JS map instance, or null if not yet initialized / already destroyed.
     * @type {mapboxgl.Map|null}
     */
    mapBoxGlJs: {
        get() {
            return this.__mapBoxGlJs ?? null;
        },
        set(value) {
            this.__mapBoxGlJs = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Timeout ID for the scheduled retryConnection() call after the browser comes back online.
     * @type {number|null}
     */
    _retryTimeoutId: {
        get() {
            return this.__retryTimeoutId ?? null;
        },
        set(value) {
            this.__retryTimeoutId = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Timeout ID for the AbortController signal used in checkInternetConnection().
     * @type {number|null}
     */
    _checkInternetTimeoutId: {
        get() {
            return this.__checkInternetTimeoutId ?? null;
        },
        set(value) {
            this.__checkInternetTimeoutId = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the "no internet connection" notification has already been shown.
     * Prevents duplicate notifications; reset to false when the browser comes back online.
     * @type {boolean}
     */
    _connectionNotificationShown: {
        get() {
            return this.__connectionNotificationShown ?? false;
        },
        set(value) {
            this.__connectionNotificationShown = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Map of DOM elements to their registered event listeners for the style switcher.
     * Used by cleanUpStyleSwitcher() to remove all listeners without needing named references.
     * @type {Map<HTMLElement, { event: string, handler: Function }>}
     */
    styleSwitcherListeners: {
        get() {
            if (!this._styleSwitcherListeners) {
                this._styleSwitcherListeners = new Map();
            }
            return this._styleSwitcherListeners;
        },
        set(value) {
            this._styleSwitcherListeners = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Whether the component/mixin has been destroyed.
     * Set to true in cleanUp(); checked in onMapReady() to skip post-load state updates.
     * @type {boolean}
     */
    _isComponentDestroyed: {
        get() {
            return this.__isComponentDestroyed ?? false;
        },
        set(value) {
            this.__isComponentDestroyed = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Resolve function for _destroyPromise. Called in cleanUp() to settle the race
     * in onMapReady() when the component is destroyed before the map finishes loading.
     * @type {Function|null}
     */
    _destroyResolve: {
        get() {
            return this.__destroyResolve ?? null;
        },
        set(value) {
            this.__destroyResolve = value;
        },
        configurable: true,
        enumerable: true,
    },

    /**
     * Promise that resolves when the component is destroyed (via cleanUp()).
     * Used in onMapReady() as the losing side of a Promise.race() so the map
     * load wait does not hang after teardown.
     * @type {Promise<void>}
     */
    _destroyPromise: {
        get() {
            if (!this.__destroyPromise) {
                this.__destroyPromise = new Promise((resolve) => {
                    this._destroyResolve = resolve;
                });
            }
            return this.__destroyPromise;
        },
        set(value) {
            this.__destroyPromise = value;
        },
        configurable: true,
        enumerable: true,
    },
};

// =====================================================================
// PUBLIC API
// =====================================================================

/**
 * Applies all shared Mapbox GL core methods and getters to a prototype.
 *
 * @param {Object} prototype - The prototype to augment
 *
 * @example
 * import { applyMapboxGlCore } from './mapbox_gl_core';
 *
 * class MyMapComponent extends Component {
 *     _getMapboxState() { return this.state; }
 *     // ...
 * }
 * applyMapboxGlCore(MyMapComponent.prototype);
 */
export function applyMapboxGlCore(prototype) {
    Object.assign(prototype, mapboxGlCoreMethods);
    Object.defineProperties(prototype, mapboxGlCoreGetters);
}
