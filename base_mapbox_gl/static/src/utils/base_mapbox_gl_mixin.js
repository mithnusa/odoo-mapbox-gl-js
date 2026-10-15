/** @odoo-module **/

import { useService } from '@web/core/utils/hooks';
import { onWillUnmount, onWillStart, useState, useEffect, useSubEnv } from '@odoo/owl';
import { generateUUID4 } from './utils';
import { applyMapboxGlCore } from './mapbox_gl_core';

/**
 * Mixin that adds Mapbox GL JS functionality to any OWL component.
 *
 * Enables any OWL component to integrate Mapbox GL JS without requiring
 * inheritance from BaseMapboxGlComponent. It handles asset loading,
 * settings management, map initialization, style switching, and cleanup.
 *
 * Use this mixin when your component already extends another base class
 * (e.g., ListRenderer, FormRenderer).
 *
 * **Required:** The consuming class must implement:
 * - `containerElement` getter — returns `{ el: HTMLElement }` for the map container
 *
 * **Optional overrides (defined in mapbox_gl_core.js):**
 * - `onMapLoaded()` — called when the map is fully loaded and controls are ready
 * - `defaultMapCenter` — default center coordinates `[lng, lat]`
 * - `defaultMapStyle` — default Mapbox style URL or key
 * - `defaultMapProjection` — default projection (default: `'globe'`)
 * - `defaultStyleConfig` — default style configuration object
 * - `enableStyleSwitcher` — whether to show the style switcher (default: `true`)
 * - `asset_mapbox_js_url` — custom Mapbox GL JS script URL
 * - `asset_mapbox_css_url` — custom Mapbox GL JS stylesheet URL
 * - `_onStyleChangeComplete()` — hook called after a style change completes
 * - `_triggerDataReload()` — hook called to reload data when style restoration fails
 *
 * @param {Function} Base - The OWL base class to extend
 * @returns {Function} Extended class with Mapbox GL JS capabilities
 */
export function withMapboxGl(Base) {
    class MapboxGlMixin extends Base {
        // ============================================
        // STATE ACCESS
        // ============================================

        /**
         * Returns the reactive Mapbox state object.
         * Used by shared core methods to access state uniformly.
         * @returns {Object}
         */
        _getMapboxState() {
            return this.mapboxState;
        }

        // ============================================
        // SETUP AND INITIALIZATION
        // ============================================

        /**
         * Initializes Mapbox state, services, OWL lifecycle hooks, and sub-environment.
         * Always calls super.setup() first to preserve the inheritance chain.
         */
        setup() {
            super.setup();

            this._initializeMapboxProperties();
            this._initializeMapboxState();
            this._setupMapboxHooks();
            this._setupMapboxEnvironment();
        }

        /**
         * Resolves and stores OWL services needed by the core (notification).
         * @private
         */
        _initializeMapboxProperties() {
            this.notificationService = useService('notification');
        }

        /**
         * Creates the reactive Mapbox state object and registers browser online/offline listeners.
         * @private
         */
        _initializeMapboxState() {
            this.mapboxState = useState({
                isMapReady: false,
                assetsLoaded: false,
                isMapLoaded: false,
                settings: null,
                isInternetConnected: null,
                isCheckingConnection: false,
            });

            // Set up browser online/offline event listeners for connection state changes
            this._boundHandleOnline = () => this._handleOnline();
            this._boundHandleOffline = () => this._handleOffline();
            window.addEventListener('online', this._boundHandleOnline);
            window.addEventListener('offline', this._boundHandleOffline);
        }

        /**
         * Registers OWL lifecycle hooks for Mapbox:
         * - onWillStart: checks internet connectivity, fetches settings, loads assets
         * - useEffect: initializes the map once assets, container, and settings are ready
         * - useEffect: calls onMapLoaded() once the map is fully loaded
         * - onWillUnmount: cleans up the map instance and all listeners
         * @private
         */
        _setupMapboxHooks() {
            onWillStart(async () => {
                const state = this._getMapboxState();
                // Check internet connection first before anything else
                state.isCheckingConnection = true;
                let isConnected = false;
                try {
                    isConnected = await this.checkInternetConnection(true);
                } finally {
                    state.isCheckingConnection = false;
                }
                state.isInternetConnected = isConnected;

                if (!isConnected) {
                    this.showNoInternetNotification();
                    return;
                }

                // Only fetch settings and load assets if connected
                await this.fetchSettings();
                // No awaited here because we want to set assetsLoaded in the state inside loadAssets after they are loaded
                this.loadAssets();
            });

            useEffect(
                (assetsLoaded, containerEl, settings, isInternetConnected) => {
                    if (assetsLoaded && containerEl.el && settings && isInternetConnected) {
                        if (!containerEl.el.getAttribute('id')) {
                            containerEl.el.setAttribute('id', generateUUID4());
                        }
                        this.initializeMap();
                    }
                },
                () => {
                    const state = this._getMapboxState();
                    try {
                        return [state.assetsLoaded, this.containerElement, state.settings, state.isInternetConnected];
                    } catch (error) {
                        return [state.assetsLoaded, {}, state.settings, state.isInternetConnected];
                    }
                }
            );

            useEffect(
                (isMapLoaded, isMapReady) => {
                    if (isMapLoaded && isMapReady) {
                        this.onMapLoaded();
                    }
                },
                () => [this._getMapboxState().isMapLoaded, this._getMapboxState().isMapReady]
            );

            onWillUnmount(() => {
                this.cleanUp();
            });
        }

        /**
         * Exposes map utilities to the component sub-tree via useSubEnv:
         * getMapbox, getIsMapReady, getSettings, retryConnection.
         * @private
         */
        _setupMapboxEnvironment() {
            useSubEnv({
                getMapbox: () => this.mapBoxGlJs,
                getIsMapReady: this.isMapboxReady.bind(this),
                getSettings: () => this._getMapboxState().settings,
                retryConnection: this.retryConnection.bind(this),
            });
        }

        // ============================================
        // ABSTRACT / REQUIRED METHODS
        // ============================================

        /**
         * Abstract getter that must be implemented by child classes
         *
         * @abstract
         * @returns {Object} DOM element reference with .el property
         * @throws {Error} When not implemented by child class
         */
        get containerElement() {
            throw new Error(
                'containerElement getter must be implemented by classes using withMapboxGl() mixin. ' +
                    'It should return an object with an .el property containing the DOM element for the map. ' +
                    'Example: return this.mapRef; where mapRef is created with useRef("mapContainer")'
            );
        }
    }

    // Apply all shared methods and getters from core
    applyMapboxGlCore(MapboxGlMixin.prototype);

    return MapboxGlMixin;
}
