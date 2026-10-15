/**
 * Circle Draw Mode for MapboxDraw
 *
 * Allows users to draw circles on the map by clicking a center point, then
 * clicking again to set the radius (a live preview follows the cursor in
 * between). The circle is stored as a 64-vertex polygon approximation using
 * Turf.js.
 *
 * @returns {Object} An object containing the circle draw mode configuration
 */
import { DRAW_CIRCLE_MODE } from './utils';

// Maximum circle radius in kilometers. This is a sanity bound against a stray or
// mis-registered click producing an absurdly large circle — it does not affect
// rendering cost, since turf.circle always emits a fixed 64-point ring regardless
// of radius.
const MAX_RADIUS_KM = 1000;

/**
 * Generate a circle polygon from a center point and a cursor position
 * @param {Array} center - [lng, lat] center coordinates
 * @param {Object} lngLat - {lng, lat} cursor position
 * @returns {Object|null} { feature, radius } or null if radius is zero or coordinates are invalid
 */
function generateCircle(center, lngLat) {
    // Validate coordinates
    if (
        !lngLat ||
        typeof lngLat.lng !== 'number' ||
        typeof lngLat.lat !== 'number' ||
        !isFinite(lngLat.lng) ||
        !isFinite(lngLat.lat) ||
        lngLat.lng < -180 ||
        lngLat.lng > 180 ||
        lngLat.lat < -90 ||
        lngLat.lat > 90
    ) {
        return null;
    }

    const radius = window.turf.distance(window.turf.point(center), window.turf.point([lngLat.lng, lngLat.lat]), {
        units: 'kilometers',
    });
    if (radius <= 0 || radius > MAX_RADIUS_KM) return null;
    return {
        feature: window.turf.circle(center, radius, { steps: 64, units: 'kilometers' }),
        radius,
    };
}

export function createCircleMode() {
    if (!window.turf) {
        throw new Error('Turf.js is required for Circle Draw Mode.');
    }

    const CircleMode = {
        ...window.MapboxDraw.modes.draw_polygon,
    };

    /**
     * Initialize the circle drawing mode
     */
    CircleMode.onSetup = function () {
        const polygon = this.newFeature({
            type: 'Feature',
            properties: {
                isCircle: true,
                center: [],
                radiusInKm: 0,
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[]],
            },
        });

        this.addFeature(polygon);
        this.clearSelectedFeatures();
        this.updateUIClasses({ mouse: 'add' });
        this.setActionableState({
            trash: true,
        });

        return {
            polygon,
            center: null,
            currentVertexPosition: 0,
            finalized: false,
        };
    };

    /**
     * Handle click events - first click sets center, second finalizes
     */
    CircleMode.onClick = function (state, e) {
        if (!state.center) {
            // First click: set center
            state.center = [e.lngLat.lng, e.lngLat.lat];
        } else {
            // Second click: finalize the circle
            const result = generateCircle(state.center, e.lngLat);
            if (result) {
                state.polygon.setCoordinates(result.feature.geometry.coordinates);
                state.polygon.properties.center = state.center;
                state.polygon.properties.radiusInKm = result.radius;
                state.finalized = true;
            }

            return this.changeMode('simple_select', { featureIds: [state.polygon.id] });
        }
    };

    /**
     * Handle mouse move - update circle preview after center is set
     */
    CircleMode.onMouseMove = function (state, e) {
        if (!state.center) return;

        const result = generateCircle(state.center, e.lngLat);
        if (result) {
            state.polygon.setCoordinates(result.feature.geometry.coordinates);
            state.polygon.properties.center = state.center;
            state.polygon.properties.radiusInKm = result.radius;
        }
    };

    /**
     * Handle stop - clean up if circle was not finalized
     */
    CircleMode.onStop = function (state) {
        this.updateUIClasses({ mouse: 'none' });
        this.activateUIButton();

        // Feature may have been deleted before onStop fires (e.g. Escape key or rapid mode change)
        if (this.getFeature(state.polygon.id) === undefined) {
            this.setActionableState({ trash: false });
            return;
        }

        // Only a successful second click (see onClick) sets state.finalized. Any other way
        // out of this mode (switching tools, Escape, etc.) discards the in-progress circle,
        // regardless of whether a preview was drawn via onMouseMove.
        if (!state.finalized) {
            this.deleteFeature([state.polygon.id], { silent: true });
        }

        this.setActionableState({ trash: false });
    };

    /**
     * Convert to display features (for rendering)
     */
    CircleMode.toDisplayFeatures = function (state, geojson, display) {
        // Guard the in-progress circle polygon: getCoordinates() on an empty ring returns
        // [[undefined]], which causes Mapbox GL JS to throw during the render pass and
        // aborts rendering of all other features (they visually disappear until the next
        // valid render). Skip display until the polygon has real coordinate data.
        if (geojson.properties.id === state.polygon.id) {
            const coords = geojson.geometry.coordinates;
            if (!coords || !coords[0] || !coords[0][0]) return;
        }
        display(geojson);
    };

    /**
     * Handle keyboard events - Escape cancels
     */
    CircleMode.onKeyUp = function (state, e) {
        if (e.keyCode === 27) {
            // Escape key
            if (this.getFeature(state.polygon.id) !== undefined) {
                this.deleteFeature([state.polygon.id], { silent: true });
            }
            this.changeMode('simple_select');
        }
    };

    /**
     * Handle tap events (mobile) - same as click
     */
    CircleMode.onTap = CircleMode.onClick;

    return {
        [DRAW_CIRCLE_MODE]: CircleMode,
    };
}
