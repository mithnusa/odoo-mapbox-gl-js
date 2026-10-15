/** @odoo-module **/

import { useService } from '@web/core/utils/hooks';
import { Component, onWillUnmount, onWillStart, useState, useEffect, useSubEnv } from '@odoo/owl';
import { generateUUID4 } from './utils';
import { applyMapboxGlCore } from './mapbox_gl_core';

/**
 * Base OWL component for Mapbox GL JS integration in Odoo.
 *
 * Handles asset loading, settings management, map initialization,
 * style switching, and cleanup via shared core methods from mapbox_gl_core.js.
 *
 * **Required:** Subclasses must implement:
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
 * @extends {Component}
 */
export class BaseMapboxGlComponent extends Component {
    /**
     * Returns the reactive Mapbox state object.
     * Used by shared core methods to access state uniformly.
     * @returns {Object}
     */
    _getMapboxState() {
        return this.mapboxState;
    }

    /**
     * Initializes services, reactive state, online/offline listeners,
     * OWL lifecycle hooks, and sub-environment.
     *
     * Registers:
     * - onWillStart: checks internet connectivity, fetches settings, loads assets
     * - useEffect: initializes the map once assets, container, and settings are ready
     * - useEffect: calls onMapLoaded() once the map is fully loaded
     * - onWillUnmount: cleans up the map instance and all listeners
     */
    setup() {
        this.notificationService = useService('notification');

        this.mapboxState = useState({
            isMapReady: false,
            assetsLoaded: false,
            isMapLoaded: false,
            settings: null,
            settingsFailed: false,
            isInternetConnected: null,
            isCheckingConnection: false,
        });

        // Set up browser online/offline event listeners for connection state changes
        this._boundHandleOnline = () => this._handleOnline();
        this._boundHandleOffline = () => this._handleOffline();
        window.addEventListener('online', this._boundHandleOnline);
        window.addEventListener('offline', this._boundHandleOffline);

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
                return; // Don't proceed with loading if no connection
            }

            // Only fetch settings and load assets if connected
            await this.fetchSettings();
            // No awaited here because we want to set assetsLoaded in the state inside loadAssets after they are loaded
            this.loadAssets();
        });

        useEffect(
            (assetsLoaded, settings, isInternetConnected, containerEl) => {
                if (assetsLoaded && settings && isInternetConnected && containerEl) {
                    if (!containerEl.getAttribute('id')) {
                        containerEl.setAttribute('id', generateUUID4());
                    }
                    this.initializeMap();
                }
            },
            () => {
                const { assetsLoaded, settings, isInternetConnected } = this._getMapboxState();
                return [assetsLoaded, settings, isInternetConnected, this.containerElement?.el];
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

        useSubEnv({
            getMapbox: () => this.mapBoxGlJs,
            getIsMapReady: this.isMapboxReady.bind(this),
            getSettings: () => this._getMapboxState().settings,
            retryConnection: () => this.retryConnection(),
        });
    }

    /**
     * Abstract getter that must be implemented by subclasses.
     * Must return an object with an `.el` property pointing to the map container DOM element.
     *
     * @abstract
     * @returns {{ el: HTMLElement }} DOM element reference for the map container
     * @throws {Error} When not implemented by a subclass
     */
    get containerElement() {
        throw new Error('containerElement getter must be implemented by subclasses of BaseMapboxGlComponent.');
    }
}

// Apply all shared methods and getters from core
applyMapboxGlCore(BaseMapboxGlComponent.prototype);
