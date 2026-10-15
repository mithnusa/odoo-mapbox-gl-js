/**
 * Rectangle Draw Mode for MapboxDraw
 *
 * Allows users to draw axis-aligned rectangles by clicking one corner
 * and dragging to the opposite corner. The rectangle is stored as a
 * 5-vertex closed Polygon ring.
 *
 * @returns {Object} An object containing the rectangle draw mode configuration
 */

export const DRAW_RECTANGLE_MODE = 'draw_rectangle';

/**
 * Build a closed rectangle polygon ring from two opposite corners
 * @param {Array} corner1 - [lng, lat] first corner
 * @param {Object} lngLat - {lng, lat} opposite corner
 * @returns {Array|null} Nested coordinate array [[...ring]] or null if degenerate
 */
function buildRectangleCoords(corner1, lngLat) {
    if (
        !lngLat ||
        typeof lngLat.lng !== 'number' ||
        typeof lngLat.lat !== 'number' ||
        !isFinite(lngLat.lng) ||
        !isFinite(lngLat.lat)
    ) {
        return null;
    }

    const [lng1, lat1] = corner1;
    const lng2 = lngLat.lng;
    const lat2 = lngLat.lat;

    // Degenerate: zero-area rectangle
    if (lng1 === lng2 || lat1 === lat2) return null;

    return [
        [
            [lng1, lat1],
            [lng2, lat1],
            [lng2, lat2],
            [lng1, lat2],
            [lng1, lat1],
        ],
    ];
}

export function createRectangleMode() {
    const RectangleMode = {
        ...window.MapboxDraw.modes.draw_polygon,
    };

    /**
     * Initialize the rectangle drawing mode
     */
    RectangleMode.onSetup = function () {
        const polygon = this.newFeature({
            type: 'Feature',
            properties: {
                isRectangle: true,
                corner1: [],
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[]],
            },
        });

        this.addFeature(polygon);
        this.clearSelectedFeatures();
        this.updateUIClasses({ mouse: 'add' });
        this.setActionableState({ trash: true });

        return {
            polygon,
            corner1: null,
        };
    };

    /**
     * Handle click events - first click sets corner, second finalizes
     */
    RectangleMode.onClick = function (state, e) {
        if (!state.corner1) {
            state.corner1 = [e.lngLat.lng, e.lngLat.lat];
        } else {
            const coords = buildRectangleCoords(state.corner1, e.lngLat);
            if (coords) {
                state.polygon.setCoordinates(coords);
            }
            return this.changeMode('simple_select', { featureIds: [state.polygon.id] });
        }
    };

    /**
     * Handle mouse move - update rectangle preview after first corner is set
     */
    RectangleMode.onMouseMove = function (state, e) {
        if (!state.corner1) return;

        const coords = buildRectangleCoords(state.corner1, e.lngLat);
        if (coords) {
            state.polygon.setCoordinates(coords);
        }
    };

    /**
     * Handle stop - clean up if rectangle was not finalized
     */
    RectangleMode.onStop = function (state) {
        this.updateUIClasses({ mouse: 'none' });
        this.activateUIButton();

        // Feature may have been deleted before onStop fires (e.g. Escape key or rapid mode change)
        if (this.getFeature(state.polygon.id) === undefined) {
            this.setActionableState({ trash: false });
            return;
        }

        const coords = state.polygon.getCoordinates();
        if (!state.corner1 || !coords || !coords[0] || coords[0].length === 0) {
            this.deleteFeature([state.polygon.id], { silent: true });
        }

        this.setActionableState({ trash: false });
    };

    /**
     * Convert to display features (for rendering)
     */
    RectangleMode.toDisplayFeatures = function (state, geojson, display) {
        // Guard the in-progress rectangle polygon: skip display until it has real
        // coordinate data, otherwise Mapbox GL JS throws during the render pass and
        // aborts rendering of all other features.
        if (geojson.properties.id === state.polygon.id) {
            const coords = geojson.geometry.coordinates;
            if (!coords || !coords[0] || !coords[0][0]) return;
        }
        display(geojson);
    };

    /**
     * Handle keyboard events - Escape cancels
     */
    RectangleMode.onKeyUp = function (state, e) {
        if (e.keyCode === 27) {
            this.deleteFeature([state.polygon.id], { silent: true });
            this.changeMode('simple_select');
        }
    };

    /**
     * Handle tap events (mobile) - same as click
     */
    RectangleMode.onTap = RectangleMode.onClick;

    return {
        [DRAW_RECTANGLE_MODE]: RectangleMode,
    };
}
