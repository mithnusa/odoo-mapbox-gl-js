/**
 * Available Mapbox style options
 */
export const MAPBOX_STYLES = {
    STANDARD: 'mapbox://styles/mapbox/standard',
    STANDARD_SATELLITE: 'mapbox://styles/mapbox/standard-satellite',
    // Legacy styles for backward compatibility
    STREETS: 'mapbox://styles/mapbox/streets-v12',
    SATELLITE_STREETS: 'mapbox://styles/mapbox/satellite-streets-v12',
    OUTDOORS: 'mapbox://styles/mapbox/outdoors-v12',
    NAVIGATION_DAY: 'mapbox://styles/mapbox/navigation-day-v1',
    NAVIGATION_NIGHT: 'mapbox://styles/mapbox/navigation-night-v1',
    LIGHT: 'mapbox://styles/mapbox/light-v11',
    DARK: 'mapbox://styles/mapbox/dark-v11',
    OSM: {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
            'osm-tiles': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
        },
        layers: [
            {
                id: 'osm-tiles',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
            },
        ],
    },
};

/**
 * Mapbox configuration constants
 */
export const MAPBOX_CONFIG = {
    VERSION: '3.33.0', // Mapbox GL JS version
    // Rendering performance
    MAX_FEATURES_PER_BATCH: 50000, // Maximum features to process per batch
    VIEWPORT_PADDING: 0.1, // Padding around viewport for culling (10%)

    // Memory management
    FEATURE_POOL_SIZE: 100000, // Pre-allocated feature object pool
    GC_INTERVAL: 30000, // Garbage collection interval (30s)
    MEMORY_THRESHOLD: 0.8, // Memory usage threshold for cleanup

    // Visual styling
    DEFAULT_COLORS: {
        FILL: 'rgba(70, 130, 180, 0.3)', // Steel blue with 30% opacity
        STROKE: 'rgba(25, 25, 112, 1.0)', // Midnight blue
        SELECTED_FILL: 'rgba(255, 215, 0, 0.8)', // Gold with transparency
        SELECTED_STROKE: 'rgba(255, 140, 0, 1.0)', // Dark orange
    },

    // Interactive features
    HOVER_RADIUS: 10, // Pixels for hover detection
    SELECT_RADIUS: 15, // Pixels for selection detection
    ANIMATION_DURATION: 300, // Milliseconds for smooth transitions

    // Other plugin
    MAPBOX_SEARCH_VERSION: '1.6.0', // Mapbox Search plugin version
    MAPBOX_DRAW_VERSION: '1.5.2', // Mapbox Draw plugin version

    DEFAULT_STYLE: MAPBOX_STYLES.STANDARD,
    DEFAULT_ZOOM: 9,
    DEFAULT_CENTER: [0.0, 0.0],
    STYLE_SWITCHER: {
        POSITION: { top: '10px', left: '10px' },
        ANIMATION_DURATION: 200,
        MOBILE_BREAKPOINT: 768,
        Z_INDEX: 1000,
    },
    PERFORMANCE: {
        ANTIALIAS: true,
        OPTIMIZE_FOR_TERRAIN: false,
        ASSET_CACHE_TIMEOUT: 5 * 60 * 1000, // 5 minutes
    },
    CONNECTION: {
        CHECK_TIMEOUT: 5000, // 5 seconds verification timeout
        AUTO_RETRY_DELAY: 5000, // Wait 5s after browser reports online before retry
    },
};

export const TURF_CONFIG = {
    VERSION: '7.4.0', // Turf.js version
};

export const STROKE_CONFIG = {
    DEFAULT_WIDTH: 2.5, // Default stroke width in pixels
    HOVER_WIDTH: 3, // Stroke width on hover in pixels
    MIN_WIDTH: 1.5, // Minimum stroke width in pixels
    MAX_WIDTH: 5, // Maximum stroke width in pixels
};

export const DEFAULT_COLOR = '#F06050';
export const DEFAULT_COLOR_RGBA = [240, 96, 80, 1];

export const WIDGET_COLOR_PICKER_COLOR = [
    null,
    '#ee2d2d', // Red
    '#dc8534', // Orange
    '#e8bc1d', // Yellow
    '#5793dd', // Light blue
    '#9f628f', // Dark purple
    '#db8865', // Salmon pink
    '#41a9a2', // Medium blue
    '#304ae0', // Dark blue
    '#ee2f8b', // Fuchsia
    '#61c36e', // Green
    '#9972e6', // Purple
];

export const MAPBOX_LANGUAGES = [
    { code: 'ar', title: 'Arabic' },
    { code: 'my', title: 'Burmese' },
    { code: 'cs', title: 'Czech' },
    { code: 'da', title: 'Danish' },
    { code: 'eo', title: 'Esperanto' },
    { code: 'gl', title: 'Galician' },
    { code: 'de', title: 'German' },
    { code: 'el', title: 'Greek' },
    { code: 'en', title: 'English (US)' },
    { code: 'en-GB', title: 'English (UK)' },
    { code: 'es', title: 'Spanish' },
    { code: 'fi', title: 'Finnish' },
    { code: 'fr', title: 'French' },
    { code: 'he', title: 'Hebrew' },
    { code: 'hu', title: 'Hungarian' },
    { code: 'id', title: 'Indonesian' },
    { code: 'it', title: 'Italian' },
    { code: 'ja', title: 'Japanese' },
    { code: 'ko', title: 'Korean' },
    { code: 'nl', title: 'Dutch' },
    { code: 'no', title: 'Norwegian' },
    { code: 'pl', title: 'Polish' },
    { code: 'pt-BR', title: 'Portuguese (Brazil)' },
    { code: 'pt-PT', title: 'Portuguese (Portugal)' },
    { code: 'ro', title: 'Romanian' },
    { code: 'ru', title: 'Russian' },
    { code: 'sk', title: 'Slovak' },
    { code: 'sl', title: 'Slovenian' },
    { code: 'sv', title: 'Swedish' },
    { code: 'th', title: 'Thai' },
    { code: 'tr', title: 'Turkish' },
    { code: 'uk', title: 'Ukrainian' },
    { code: 'vi', title: 'Vietnamese' },
    { code: 'zh-Hans', title: 'Simplified Chinese' },
    { code: 'zh-Hant', title: 'Traditional Chinese' },
    { code: 'yo', title: 'Yoruba' },
];

export function getHexColorPicker(index) {
    return WIDGET_COLOR_PICKER_COLOR[index] || DEFAULT_COLOR;
}

/**
 * Generates a unique identifier for DOM elements
 * Uses crypto.randomUUID() when available, falls back to timestamp + random
 *
 * @returns {string} Unique identifier
 */
export function generateUUID4() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Common named CSS colors lookup table
 * @private
 */
const NAMED_COLORS = {
    black: '#000000',
    white: '#FFFFFF',
    red: '#FF0000',
    green: '#008000',
    blue: '#0000FF',
    yellow: '#FFFF00',
    cyan: '#00FFFF',
    magenta: '#FF00FF',
    gray: '#808080',
    grey: '#808080',
    orange: '#FFA500',
    purple: '#800080',
    brown: '#A52A2A',
    pink: '#FFC0CB',
    lime: '#00FF00',
    navy: '#000080',
    teal: '#008080',
    maroon: '#800000',
    olive: '#808000',
    silver: '#C0C0C0',
    // Add more as needed
};

/**
 * Normalize color to hex format
 * Converts any CSS color format (hex, rgb, rgba, named) to uppercase hex
 * @param {string} color - Color in any CSS format
 * @returns {string} Normalized color in hex format (#RRGGBB)
 */
export function normalizeColor(color) {
    if (!color || typeof color !== 'string') {
        return color;
    }

    const trimmedColor = color.trim();

    // Already in hex format - normalize to uppercase
    if (trimmedColor.startsWith('#')) {
        const hex = trimmedColor.slice(1);

        // Short hex (#RGB)
        if (hex.length === 3) {
            return '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        // Full hex (#RRGGBB)
        if (hex.length === 6) {
            return trimmedColor.toUpperCase();
        }

        // Invalid hex
        return color;
    }

    // Handle rgb() or rgba() format
    if (trimmedColor.startsWith('rgb')) {
        const match = trimmedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);

            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }
    }

    // Handle named colors - check lookup table first
    const lowerColor = trimmedColor.toLowerCase();
    if (NAMED_COLORS[lowerColor]) {
        return NAMED_COLORS[lowerColor];
    }

    if (!document?.body) {
        // If DOM is not available, we can't use the fallback method
        return color;
    }

    // Fallback: use canvas for unknown named colors (cleaner than DOM)
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');

        // Use a sentinel value to detect if the browser rejects the color
        ctx.fillStyle = '#010101';
        ctx.fillStyle = trimmedColor;

        // If the browser rejected the color, fillStyle stays as the sentinel
        if (ctx.fillStyle !== '#010101') {
            ctx.fillRect(0, 0, 1, 1);
            const imageData = ctx.getImageData(0, 0, 1, 1).data;

            return (
                '#' +
                ((1 << 24) + (imageData[0] << 16) + (imageData[1] << 8) + imageData[2])
                    .toString(16)
                    .slice(1)
                    .toUpperCase()
            );
        }
    } catch (e) {
        console.warn('Failed to normalize color:', trimmedColor, e);
    }

    // If all else fails, return original color
    return color;
}

/**
 * Parse color to RGB components
 * @param {string} color - Color in hex, rgb, or named format
 * @returns {{r: number, g: number, b: number}} RGB components (0-255)
 * @private
 */
function parseColorToRgb(color) {
    const hexColor = normalizeColor(color).replace(/^#/, '');
    return {
        r: parseInt(hexColor.substring(0, 2), 16),
        g: parseInt(hexColor.substring(2, 4), 16),
        b: parseInt(hexColor.substring(4, 6), 16),
    };
}

/**
 * Calculate adjustment value for a color component
 * @param {number} currentValue - Current RGB value (0-255)
 * @param {number} amount - Adjustment amount
 * @param {string} direction - 'darken' or 'lighten'
 * @returns {number} Adjusted value to apply
 * @private
 */
function calculateAdjustmentValue(currentValue, amount, direction) {
    if (amount >= 0 && amount <= 1) {
        // Factor-based adjustment
        if (direction === 'darken') {
            // amount = 0 means no change, amount = 1 means fully black
            return currentValue * amount;
        } else {
            // amount = 0 means no change, amount = 1 means fully white
            return (255 - currentValue) * amount;
        }
    } else {
        // Absolute value adjustment
        return amount;
    }
}

/**
 * Format RGB values to color string
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @param {number|null} opacity - Optional opacity (0-1)
 * @returns {string} Formatted color string (hex or rgba)
 * @private
 */
function formatColorOutput(r, g, b, opacity) {
    if (opacity !== null && opacity !== undefined) {
        const alpha = Math.max(0, Math.min(1, opacity));
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Adjust color brightness
 * @param {string} color - Color to adjust (hex, rgb, or named)
 * @param {number} amount - Adjustment amount
 * @param {number|null} opacity - Optional opacity (0-1)
 * @param {string} direction - 'darken' or 'lighten'
 * @returns {string} Adjusted color string
 * @private
 */
function adjustColorBrightness(color, amount, opacity, direction) {
    const { r, g, b } = parseColorToRgb(color);

    const adjustR = calculateAdjustmentValue(r, amount, direction);
    const adjustG = calculateAdjustmentValue(g, amount, direction);
    const adjustB = calculateAdjustmentValue(b, amount, direction);

    const newR = direction === 'darken' ? Math.max(0, Math.round(r - adjustR)) : Math.min(255, Math.round(r + adjustR));

    const newG = direction === 'darken' ? Math.max(0, Math.round(g - adjustG)) : Math.min(255, Math.round(g + adjustG));

    const newB = direction === 'darken' ? Math.max(0, Math.round(b - adjustB)) : Math.min(255, Math.round(b + adjustB));

    return formatColorOutput(newR, newG, newB, opacity);
}

/**
 * Darkens a color by a specified amount with optional opacity
 * @param {string} color - The color to darken (hex, rgb, or named color)
 * @param {number} [amount=50] - The darkening amount. Can be:
 *   - Value > 1: absolute RGB value to subtract from each component (default: 50)
 *   - Value between 0-1: darkening factor where result = color * (1 - amount)
 *     (0 = no change, 1 = fully black, 0.5 = 50% of original brightness)
 * @param {number} [opacity] - Optional opacity value between 0-1. If provided, returns rgba() format, otherwise returns hex
 * @returns {string} The darkened color in hex format (if opacity not specified) or rgba() format
 */
export function darkenColor(color, amount = 50, opacity = null) {
    return adjustColorBrightness(color, amount, opacity, 'darken');
}

/**
 * Lightens a color by a specified amount with optional opacity
 * @param {string} color - The color to lighten (hex, rgb, or named color)
 * @param {number} [amount=50] - The lightening amount. Can be:
 *   - Value > 1: absolute RGB value to add to each component (default: 50)
 *   - Value between 0-1: lightening factor where result = color + (255 - color) * amount
 *     (0 = no change, 1 = fully white, 0.5 = halfway to white)
 * @param {number} [opacity] - Optional opacity value between 0-1. If provided, returns rgba() format, otherwise returns hex
 * @returns {string} The lightened color in hex format (if opacity not specified) or rgba() format
 */
export function lightenColor(color, amount = 50, opacity = null) {
    return adjustColorBrightness(color, amount, opacity, 'lighten');
}

/**
 * Convert hex color to RGBA array
 * @param {*} hex
 * @param {*} alpha
 * @param {*} defaultColor
 * @returns
 */
export function hexToRgba(hex, alpha = 1.0, defaultColor = DEFAULT_COLOR_RGBA) {
    const fallback = defaultColor || DEFAULT_COLOR_RGBA;
    if (!hex || typeof hex !== 'string') {
        console.warn('Invalid color format, defaulting to fill color');
        return fallback; // Default fill color RGBA
    }

    if (alpha < 0 || alpha > 1) {
        console.warn('Alpha value out of range (0-1), defaulting to 1.0');
        alpha = Math.max(0, Math.min(1, alpha));
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), Math.round(alpha * 255)]
        : fallback; // Default fill color RGBA
}

/**
 * Validate geometry coordinates based on geometry type
 * @param {string} type - Geometry type
 * @param {Array} coordinates - Coordinate array
 * @returns {boolean} True if coordinates are valid for the geometry type
 * @private
 */
function validateGeometryCoordinates(type, coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return false;
    }

    switch (type) {
        case 'Point':
            // Point: [lon, lat] or [lon, lat, elevation]
            return (
                coordinates.length >= 2 &&
                coordinates.length <= 3 &&
                coordinates.every((n) => typeof n === 'number' && isFinite(n))
            );

        case 'LineString':
        case 'MultiPoint': {
            // LineString/MultiPoint: array of positions (at least 2 for LineString)
            const minLength = type === 'LineString' ? 2 : 1;
            return (
                coordinates.length >= minLength &&
                coordinates.every(
                    (pos) =>
                        Array.isArray(pos) && pos.length >= 2 && pos.every((n) => typeof n === 'number' && isFinite(n))
                )
            );
        }
        case 'Polygon':
        case 'MultiLineString':
            // Polygon/MultiLineString: array of LineString coordinates
            return coordinates.every((ring) => {
                const isValid =
                    Array.isArray(ring) &&
                    ring.length >= (type === 'Polygon' ? 4 : 2) &&
                    ring.every(
                        (pos) =>
                            Array.isArray(pos) &&
                            pos.length >= 2 &&
                            pos.every((n) => typeof n === 'number' && isFinite(n))
                    );

                // For Polygon, verify ring closure (first point === last point)
                if (type === 'Polygon' && isValid) {
                    const first = ring[0];
                    const last = ring[ring.length - 1];
                    return first[0] === last[0] && first[1] === last[1];
                }

                return isValid;
            });

        case 'MultiPolygon':
            // MultiPolygon: array of Polygon coordinates
            return coordinates.every(
                (polygon) =>
                    Array.isArray(polygon) &&
                    polygon.every(
                        (ring) =>
                            Array.isArray(ring) &&
                            ring.length >= 4 &&
                            ring.every(
                                (pos) =>
                                    Array.isArray(pos) &&
                                    pos.length >= 2 &&
                                    pos.every((n) => typeof n === 'number' && isFinite(n))
                            )
                    )
            );

        default:
            return false;
    }
}

/**
 * Validate GeoJSON object structure
 * Supports all GeoJSON types: FeatureCollection, Feature, and Geometry objects
 * @param {Object} geoJson - The GeoJSON object to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.requireFeatures - Whether to require at least one feature (default: false)
 * @param {boolean} options.validateGeometry - Whether to validate geometry structure (default: false)
 * @param {boolean} options.strict - Whether to enforce strict GeoJSON spec (default: false)
 * @returns {boolean} True if valid GeoJSON structure
 */
export function validateGeoJson(geoJson, options = {}) {
    const { requireFeatures = false, validateGeometry = false, strict = false } = options;

    // Null/undefined check
    if (!geoJson || typeof geoJson !== 'object') {
        return false;
    }

    // Valid GeoJSON types
    const validTypes = [
        'FeatureCollection',
        'Feature',
        'Point',
        'LineString',
        'Polygon',
        'MultiPoint',
        'MultiLineString',
        'MultiPolygon',
        'GeometryCollection',
    ];

    // Check if type is valid
    if (!validTypes.includes(geoJson.type)) {
        return false;
    }

    // Validate FeatureCollection
    if (geoJson.type === 'FeatureCollection') {
        if (!Array.isArray(geoJson.features)) {
            return false;
        }

        // Optional: require at least one feature
        if (requireFeatures && geoJson.features.length === 0) {
            return false;
        }

        // Optional: validate each feature
        if (validateGeometry && geoJson.features.length > 0) {
            return geoJson.features.every((feature) => validateGeoJson(feature, { validateGeometry: true, strict }));
        }

        return true;
    }

    // Validate Feature
    if (geoJson.type === 'Feature') {
        // Feature must have geometry (can be null per spec)
        if (!('geometry' in geoJson)) {
            return false;
        }

        // Geometry can be null (valid per GeoJSON spec)
        if (geoJson.geometry === null) {
            return !strict; // In strict mode, reject null geometries
        }

        // Validate geometry if present and validation enabled
        if (validateGeometry && geoJson.geometry) {
            return validateGeoJson(geoJson.geometry, { validateGeometry: true, strict });
        }

        return true;
    }

    // Validate Geometry objects (Point, LineString, Polygon, etc.)
    if (validTypes.slice(2).includes(geoJson.type)) {
        // All geometry objects must have coordinates (except GeometryCollection)
        if (geoJson.type === 'GeometryCollection') {
            if (!Array.isArray(geoJson.geometries)) {
                return false;
            }

            if (validateGeometry) {
                return geoJson.geometries.every((geom) => validateGeoJson(geom, { validateGeometry: true, strict }));
            }

            return true;
        }

        // Check coordinates exist
        if (!('coordinates' in geoJson)) {
            return false;
        }

        if (!Array.isArray(geoJson.coordinates)) {
            return false;
        }

        // Optional: validate coordinate structure
        if (validateGeometry) {
            return validateGeometryCoordinates(geoJson.type, geoJson.coordinates);
        }

        return true;
    }

    return false;
}
