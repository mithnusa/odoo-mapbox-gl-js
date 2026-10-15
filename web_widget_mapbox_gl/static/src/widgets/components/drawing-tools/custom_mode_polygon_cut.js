import { _t } from '@web/core/l10n/translation';

/**
 * Polygon Cut Mode for MapboxDraw
 *
 * Based on: https://github.com/ReyhaneMasumi/mapbox-gl-draw-cut-polygon-mode
 * Adapted for latest Mapbox GL JS and Odoo integration
 *
 * This mode allows users to cut existing polygons by drawing a cutting polygon.
 * The implementation follows the reference repository's approach but simplified
 * for direct integration without external dependencies.
 */

export const POLYGON_CUT_MODE = 'polygon_cut_mode';

/**
 * Creates a custom polygon cut mode for MapboxDraw
 *
 * This mode allows users to cut existing polygons by drawing a cutting polygon over them.
 * The cutting polygon will be used to perform a geometric difference operation on selected polygons.
 *
 * Optimized for performance with large feature sets through:
 * - Pre-computed bounding box calculations to avoid repeated expensive operations
 * - Efficient spatial filtering using bounding box intersection checks
 * - Enhanced error handling to prevent browser freezing on complex geometries
 * - Proper MultiPolygon support and property preservation
 * - Individual feature error isolation to ensure partial operation success
 *
 * @returns {Object} An object containing the polygon cut mode configuration
 * @throws {Error} If Turf.js is not available
 *
 * @example
 * const cutMode = createPolygonCutMode(() => draw);
 * const draw = new MapboxDraw({
 *   modes: {
 *     ...MapboxDraw.modes,
 *     ...cutMode
 *   }
 * });
 *
 * // Usage: Select polygons, then activate cut mode to draw cutting polygon
 * draw.changeMode('polygon_cut_mode');
 */
export function createPolygonCutMode(getDraw, onError) {
    if (!window.turf) {
        throw new Error('Turf.js is required for Polygon Cut Mode.');
    }

    const PolygonCutMode = {
        ...window.MapboxDraw.modes.draw_polygon,
    }; // Placeholder for the mode definition

    /**
     * Initializes the polygon cut mode
     *
     * Validates that at least one polygon is selected before allowing the cut operation.
     * Filters selected features to only include valid Polygon and MultiPolygon geometries.
     * Creates a new cutting polygon and sets up the drawing state.
     *
     * @returns {Object} The initial state object containing:
     *   - polygon: The cutting polygon feature being drawn
     *   - selectedFeatures: Array of valid polygon GeoJSON features to be cut
     *   - currentVertexPosition: Current vertex position for drawing
     * @throws {Error} If no polygons are selected or no valid polygons found
     */
    PolygonCutMode.onSetup = function () {
        let selectedFeatures = this.getSelected();
        if (!selectedFeatures || selectedFeatures.length === 0) {
            throw new Error(_t('Please select at least one polygon before using the cut tool.'));
        }
        selectedFeatures = selectedFeatures
            .filter((feature) => feature.type === 'Polygon' || feature.type === 'MultiPolygon')
            .map((f) => f.toGeoJSON());

        if (selectedFeatures.length === 0) {
            throw new Error(_t('Please select at least one polygon before using the cut tool.'));
        }

        // limit maximum selection to 100 polygons to avoid performance issues
        if (selectedFeatures.length > 100) {
            throw new Error(_t('Features selected exceed the maximum limit of 100. Limit selection and try again.'));
        }

        const polygon = this.newFeature({
            type: 'Feature',
            properties: {},
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
            selectedFeatures,
            currentVertexPosition: 0,
        };
    };

    /**
     * Handles the completion of polygon cut mode
     *
     * Performs the actual cutting operation when a valid cutting polygon is drawn.
     * Optimized for performance with large feature sets by pre-computing bounding box
     * calculations and using efficient intersection checks. Checks for intersections
     * between the cutting polygon and target polygons, then performs the geometric
     * difference operation to create cut results.
     * Fires a custom 'draw.polygon_cut' event with operation details.
     *
     * Performance optimizations:
     * - Pre-computes cutting polygon bounding box to avoid repeated calculations
     * - Uses efficient bounding box intersection filtering
     * - Enhanced error handling to prevent browser freezing on large datasets
     *
     * @param {Object} state - The current state object from onSetup
     * @param {Object} state.polygon - The cutting polygon feature
     * @param {Array} state.selectedFeatures - Array of polygon features to be cut
     * @param {number} state.currentVertexPosition - Current vertex position
     *
     * @fires draw.polygon_cut When cutting operation is successfully completed
     */
    PolygonCutMode.onStop = function (state) {
        this.updateUIClasses({ mouse: 'none' });
        this.activateUIButton();
        if (this.getFeature(state.polygon.id) === undefined) return;
        // Remove the cursor vertex that Draw keeps while the shape is being drawn
        state.polygon.removeCoordinate(`0.${state.currentVertexPosition}`);

        if (state.polygon && state.polygon.isValid()) {
            // Pre-compute cutting polygon data to avoid repeated calculations
            const cutterGeoJSON = state.polygon.toGeoJSON();
            const cutterBbox = window.turf.bbox(cutterGeoJSON);

            // Reject the cut if the cutter overlaps a polygon that is not selected
            const selectedIds = new Set(state.selectedFeatures.map((feature) => feature.id));
            const overlapsUnselected = getDraw()
                .getAll()
                .features.some(
                    (feature) =>
                        feature.id !== state.polygon.id &&
                        !selectedIds.has(feature.id) &&
                        ['Polygon', 'MultiPolygon'].includes(feature.geometry.type) &&
                        // Cheap bbox check first, same pattern as checkIfCuttingPolygonIntersectsTarget,
                        // before the expensive full-geometry intersect below.
                        checkIfCuttingPolygonIntersectsTarget(cutterGeoJSON, feature, cutterBbox) &&
                        window.turf.intersect(window.turf.featureCollection([cutterGeoJSON, feature])) !== null
                );
            if (overlapsUnselected) {
                this.deleteFeature([state.polygon.id], { silent: true });
                this.changeMode('simple_select', {}, { silent: true });
                this.setActionableState({
                    trash: false,
                });
                onError?.(
                    _t('Only the selected polygons can be cut. Select the polygon you want to cut and try again.')
                );
                return;
            }

            // Perform the cut operation here
            try {
                // Check if cutting polygon intersects any target polygons
                const featuresToCut = [];
                for (const targetFeature of state.selectedFeatures) {
                    if (checkIfCuttingPolygonIntersectsTarget(cutterGeoJSON, targetFeature, cutterBbox)) {
                        featuresToCut.push(targetFeature);
                    }
                }

                if (featuresToCut.length === 0) {
                    this.deleteFeature([state.polygon.id], { silent: true });
                    this.changeMode('simple_select');
                } else {
                    const cutResults = performCutOperation(featuresToCut, state.polygon);
                    if (cutResults.length === 0) {
                        this.deleteFeature([state.polygon.id], { silent: true });
                        this.changeMode('simple_select');
                    } else {
                        const originalFeatureIds = featuresToCut.map((feature) => feature.id);
                        this.deleteFeature(originalFeatureIds, { silent: true });

                        cutResults.forEach((feature) => {
                            const newFeature = this.newFeature(feature);
                            this.addFeature(newFeature);
                        });
                        this.deleteFeature([state.polygon.id], { silent: true });

                        // Fire custom polygon cut event
                        this.map.fire('draw.polygon_cut', {
                            type: 'draw.polygon_cut',
                        });
                    }
                }
            } catch (error) {
                console.error('Error cutting polygon:', error);
                this.deleteFeature([state.polygon.id], { silent: true });
                this.changeMode('simple_select');
                onError?.(_t('An error occurred while cutting the polygon. Please try again.'));
            }
        } else {
            this.deleteFeature([state.polygon.id], { silent: true });
            this.changeMode('simple_select');
        }
        this.setActionableState({
            trash: false,
        });
    };

    /**
     * Checks if a cutting polygon intersects with a target polygon
     *
     * Uses Turf.js bounding box intersection for efficient spatial filtering.
     * Optimized to accept pre-computed bounding box to avoid repeated calculations,
     * significantly improving performance when processing large numbers of features.
     *
     * This function performs a fast bounding box intersection test which is much more
     * efficient than full geometric intersection for initial filtering. For large
     * feature sets, this optimization can reduce computation time from O(n²) to O(n).
     *
     * @param {Object} cutterFeature - The cutting polygon feature (GeoJSON)
     * @param {Object} targetFeature - The target polygon feature (GeoJSON)
     * @param {Array<number>} cutterBbox - Pre-computed bounding box [minX, minY, maxX, maxY] (optional)
     * @returns {boolean} True if bounding boxes intersect (indicating potential polygon intersection), false otherwise
     *
     * @example
     * // Pre-compute bounding box for multiple intersection checks
     * const cutterBbox = turf.bbox(cutter);
     * features.forEach(target => {
     *   if (checkIfCuttingPolygonIntersectsTarget(cutter, target, cutterBbox)) {
     *     // Process intersection
     *   }
     * });
     */
    function checkIfCuttingPolygonIntersectsTarget(cutterFeature, targetFeature, cutterBbox) {
        const turf = window.turf;

        // Use pre-computed bbox if provided, otherwise calculate it
        const actualCutterBbox = cutterBbox || turf.bbox(cutterFeature);
        const targetBbox = turf.bbox(targetFeature);

        // Fast bounding box intersection check
        const intersects =
            actualCutterBbox[0] <= targetBbox[2] &&
            actualCutterBbox[2] >= targetBbox[0] &&
            actualCutterBbox[1] <= targetBbox[3] &&
            actualCutterBbox[3] >= targetBbox[1];

        return intersects;
    }

    /**
     * Performs the geometric cutting operation on selected polygon features
     *
     * Uses Turf.js difference operation to cut selected polygons with the cutting polygon.
     * Optimized for performance and reliability with large feature sets through enhanced
     * error handling and proper geometry validation. Handles both Polygon and MultiPolygon
     * geometries. Each target polygon is processed individually to create the cut results.
     *
     * Performance and reliability improvements:
     * - Enhanced input validation to prevent processing invalid geometries
     * - Proper MultiPolygon support using correct Turf.js constructors
     * - Individual feature error handling to prevent operation failure
     * - Property preservation from original features to cut results
     * - Detailed error logging for debugging complex geometry issues
     *
     * @param {Array<Object>} selectedFeatures - Array of GeoJSON polygon features to be cut
     * @param {Object} cutterFeature - The cutting polygon feature from MapboxDraw
     * @returns {Array<Object>} Array of GeoJSON features representing the cut results
     *
     * @example
     * const results = performCutOperation(selectedPolygons, cuttingPolygon);
     * results.forEach(feature => {
     *   // Add cut result to map - properties are preserved from original
     *   draw.add(feature);
     * });
     *
     * @see {@link https://turfjs.org/docs/api/difference} Turf.js difference documentation
     * @see {@link https://turfjs.org/docs/api/polygon} Turf.js polygon constructor
     * @see {@link https://turfjs.org/docs/api/multiPolygon} Turf.js multiPolygon constructor
     */
    function performCutOperation(selectedFeatures, cutterFeature) {
        const differenceResults = [];
        const cutterGeoJson = cutterFeature.toGeoJSON();

        // Pre-validate cutting polygon
        if (cutterGeoJson?.geometry?.type !== 'Polygon' || !cutterGeoJson.geometry.coordinates) {
            console.error('Invalid cutting polygon geometry:', cutterFeature);
            return differenceResults;
        }

        let cuttingPolygonTurf;
        try {
            cuttingPolygonTurf = window.turf.polygon(cutterGeoJson.geometry.coordinates);
        } catch (error) {
            console.error('Error creating cutting polygon for turf:', error);
            return differenceResults;
        }

        // Process each target feature with enhanced error handling
        selectedFeatures.forEach((targetFeature, index) => {
            try {
                // Validate target feature geometry
                if (
                    !targetFeature?.geometry?.type ||
                    !['Polygon', 'MultiPolygon'].includes(targetFeature.geometry.type) ||
                    !targetFeature.geometry.coordinates
                ) {
                    console.warn(`Skipping invalid target feature at index ${index}:`, targetFeature);
                    return;
                }

                let targetPolygonTurf;

                // Handle both Polygon and MultiPolygon types
                if (targetFeature.geometry.type === 'Polygon') {
                    targetPolygonTurf = window.turf.polygon(targetFeature.geometry.coordinates);
                } else if (targetFeature.geometry.type === 'MultiPolygon') {
                    targetPolygonTurf = window.turf.multiPolygon(targetFeature.geometry.coordinates);
                }

                if (targetPolygonTurf) {
                    // Perform the difference operation
                    const afterCutFeatures = window.turf.difference(
                        window.turf.featureCollection([targetPolygonTurf, cuttingPolygonTurf])
                    );

                    if (afterCutFeatures) {
                        // Preserve original feature properties
                        if (targetFeature.properties) {
                            afterCutFeatures.properties = { ...targetFeature.properties };
                        }
                        differenceResults.push(afterCutFeatures);
                    }
                }
            } catch (error) {
                console.error(`Error cutting polygon at index ${index}:`, {
                    error: error.message,
                    targetFeatureId: targetFeature.id,
                });
            }
        });

        return differenceResults;
    }

    return {
        [POLYGON_CUT_MODE]: PolygonCutMode,
    };
}
