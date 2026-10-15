import { normalizeColor, getHexColorPicker, DEFAULT_COLOR } from '@base_mapbox_gl/utils/utils';

// Regular expression to match hex, rgb/rgba, and hsl/hsla color formats
const HEX_COLOR_REGEX = /(?:#|0x)(?:[a-f0-9]{3}|[a-f0-9]{6})\b|(?:rgb|hsl)a?\([^\)]*\)/gi;

// Layer configuration for Mapbox GL JS - Supports all GeoJSON geometry types
export const LAYER_CONFIG = {
    GEOJSON_FILL: 'geojson-fill',
    GEOJSON_CIRCLE: 'geojson-circle',
    GEOJSON_STROKE: 'geojson-stroke',
    GEOJSON_SYMBOL: 'geojson-symbol',
    GEOJSON_CIRCLE_LABEL: 'geojson-circle-label',
    GEOJSON_LABEL: 'geojson-label',
    GEOJSON_FILL_HOVERED: 'geojson-fill-hovered-data',
    GEOJSON_CIRCLE_HOVERED: 'geojson-circle-hovered-data',
    GEOJSON_STROKE_HOVERED: 'geojson-stroke-hovered-data',
    GEOJSON_SYMBOL_HOVERED: 'geojson-symbol-hovered-data',
    GEOJSON_FILL_SELECTED: 'geojson-fill-selected-data',
    GEOJSON_CIRCLE_SELECTED: 'geojson-circle-selected-data',
    GEOJSON_STROKE_SELECTED: 'geojson-stroke-selected-data',
    GEOJSON_SYMBOL_SELECTED: 'geojson-symbol-selected-data',
};

export const SOURCE_CONFIG = {
    GEOJSON_SOURCE: 'geojson-data-source',
};

// Fixed styling for label annotation points (not data-driven)
export const LABEL_POINT_STYLE = {
    SIZE: 4,
    COLOR: '#555555',
    STROKE_COLOR: '#ffffff',
};

// Feature styling configuration
export const FEATURE_STYLES = {
    CIRCLE: {
        RADIUS: { DEFAULT: 4, HOVER: 6, SELECTED: 8 },
        OPACITY: { DEFAULT: 0.9, HOVER: 1, SELECTED: 1 },
        STROKE_WIDTH: { DEFAULT: 1.5, HOVER: 2.5, SELECTED: 3 },
    },
    POLYGON: {
        FILL_OPACITY: { DEFAULT: 0.4, HOVER: 0.2, SELECTED: 0.7 },
        STROKE_WIDTH: { DEFAULT: 2.5, HOVER: 5, SELECTED: 5 },
    },
    LINE: {
        WIDTH: { DEFAULT: 2, HOVER: 4, SELECTED: 6 },
        OPACITY: { DEFAULT: 0.8, HOVER: 1, SELECTED: 1 },
    },
    COLORS: {
        HOVER: {
            FILL: 'rgba(1, 209, 8, 0.99)',
            STROKE: 'rgba(163, 255, 167, 0.99)',
            CIRCLE: 'rgba(1, 209, 8, 0.99)',
        },
        SELECTED: {
            FILL: '#ff3d0d',
            STROKE: '#a3001b',
            CIRCLE: '#ff3d0d',
        },
    },
    TRANSITIONS: {
        DURATION: 300,
        EASING: 'ease-out',
    },
};

/**
 * Configuration for measurement calculations and display
 * Supports both metric and imperial unit systems with appropriate precision
 */
export const MEASUREMENT_CONFIG = {
    EARTH_RADIUS_KM: 6371, // Earth radius in kilometers
    EARTH_RADIUS_MILES: 3959, // Earth radius in miles
    UNITS: {
        METRIC: 'metric', // Metric system (km, m, ha, sq km)
        IMPERIAL: 'imperial', // Imperial system (mi, ft, ac, sq mi)
    },
    DISTANCE_PRECISION: 2, // Decimal places for distance measurements
    AREA_PRECISION: 2, // Decimal places for area measurements
    COORDINATE_PRECISION: 6, // Decimal places for coordinate display
};

/**
 * Calculate the centroid (geometric center) of a polygon ring
 * Uses the simple arithmetic mean of all coordinates
 * @param {Array<Array<number>>} coordinates - Array of [longitude, latitude] coordinate pairs
 * @returns {Array<number>} The centroid as [longitude, latitude], or [0, 0] if invalid
 */
export function calculatePolygonCentroid(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return [0, 0];
    }

    let x = 0;
    let y = 0;
    const length = coordinates.length;

    for (let i = 0; i < length; i++) {
        x += coordinates[i][0];
        y += coordinates[i][1];
    }

    return [x / length, y / length];
}

/**
 * Calculate the centroid of a GeoJSON feature for popup positioning
 * Handles all GeoJSON geometry types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon)
 * @param {Object} feature - GeoJSON feature object with geometry property
 * @param {Object} feature.geometry - GeoJSON geometry object
 * @param {string} feature.geometry.type - Geometry type (Point, LineString, Polygon, etc.)
 * @param {Array} feature.geometry.coordinates - Coordinate array structure based on geometry type
 * @returns {Array<number>} The centroid as [longitude, latitude], or [0, 0] if invalid
 */
export function calculateFeatureCentroid(feature) {
    if (!feature || !feature.geometry) {
        return [0, 0]; // Default fallback
    }

    const geometry = feature.geometry;

    try {
        switch (geometry.type) {
            case 'Point':
                return geometry.coordinates;

            case 'MultiPoint':
                // Average of all points
                const points = geometry.coordinates;
                const avgLng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
                const avgLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
                return [avgLng, avgLat];

            case 'LineString':
                // Middle point of the line
                const coords = geometry.coordinates;
                const midIndex = Math.floor(coords.length / 2);
                return coords[midIndex];

            case 'MultiLineString':
                // First line's middle point
                const firstLine = geometry.coordinates[0];
                const midIdx = Math.floor(firstLine.length / 2);
                return firstLine[midIdx];

            case 'Polygon':
                // Centroid of the polygon's outer ring
                return calculatePolygonCentroid(geometry.coordinates[0]);

            case 'MultiPolygon':
                // Centroid of the first polygon's outer ring
                return calculatePolygonCentroid(geometry.coordinates[0][0]);

            default:
                return [0, 0];
        }
    } catch (error) {
        console.warn('Error calculating feature centroid:', error);
        return [0, 0];
    }
}

/**
 * Extract coordinates from GeoJSON geometry and call callback for each coordinate
 * Iterates through all coordinate pairs in the geometry structure and invokes the callback
 * with longitude and latitude values
 * @param {Object} geometry - GeoJSON geometry object with type and coordinates
 * @param {string} geometry.type - Geometry type (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon)
 * @param {Array} geometry.coordinates - Coordinate array structure based on geometry type
 * @param {Function} callback - Function called for each coordinate pair: callback(longitude, latitude)
 * @returns {void}
 */
export function extractCoordinatesFromGeometry(geometry, callback) {
    const { type, coordinates } = geometry;

    switch (type) {
        case 'Point':
            callback(coordinates[0], coordinates[1]);
            break;
        case 'LineString':
            coordinates.forEach((coord) => callback(coord[0], coord[1]));
            break;
        case 'Polygon':
            coordinates[0].forEach((coord) => callback(coord[0], coord[1]));
            break;
        case 'MultiPoint':
            coordinates.forEach((coord) => callback(coord[0], coord[1]));
            break;
        case 'MultiLineString':
            coordinates.forEach((line) => {
                line.forEach((coord) => callback(coord[0], coord[1]));
            });
            break;
        case 'MultiPolygon':
            coordinates.forEach((polygon) => {
                polygon[0].forEach((coord) => callback(coord[0], coord[1]));
            });
            break;
    }
}

/**
 * Calculate bounding box for a single GeoJSON geometry
 * Recursively extracts all coordinates and computes the minimum and maximum longitude/latitude values
 * @param {Object} geometry - GeoJSON geometry object with coordinates
 * @param {string} geometry.type - Geometry type
 * @param {Array} geometry.coordinates - Coordinate array structure
 * @returns {Object} Bounding box object with properties:
 *   - {number} minX - Minimum longitude
 *   - {number} minY - Minimum latitude
 *   - {number} maxX - Maximum longitude
 *   - {number} maxY - Maximum latitude
 * @private
 */
export function calculateFeatureBounds(geometry) {
    if (!geometry || !geometry.coordinates) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let coords = [];

    const extractCoordinatesFunc = (coordArray) => {
        if (typeof coordArray[0] === 'number') {
            coords.push(coordArray);
        } else {
            coordArray.forEach(extractCoordinatesFunc);
        }
    };

    try {
        extractCoordinatesFunc(geometry.coordinates);

        if (coords.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        const lngs = coords.map((coord) => coord[0]);
        const lats = coords.map((coord) => coord[1]);

        return {
            minX: Math.min(...lngs),
            minY: Math.min(...lats),
            maxX: Math.max(...lngs),
            maxY: Math.max(...lats),
        };
    } catch (error) {
        console.error('Error calculating feature bounds:', error);
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
}

/**
 * Calculate the bounding box that encompasses all features in a collection
 * Iterates through all features and computes the overall minimum and maximum coordinates
 * @param {Array<Object>} features - Array of GeoJSON feature objects
 * @returns {Object} Bounding box object with properties:
 *   - {number} minLng - Minimum longitude across all features
 *   - {number} minLat - Minimum latitude across all features
 *   - {number} maxLng - Maximum longitude across all features
 *   - {number} maxLat - Maximum latitude across all features
 */
export function calculateFeaturesBounds(features) {
    if (!features || features.length === 0) {
        return { minLng: 0, minLat: 0, maxLng: 0, maxLat: 0 };
    }

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    features.forEach((feature) => {
        if (feature.geometry && feature.geometry.coordinates) {
            extractCoordinatesFromGeometry(feature.geometry, (lng, lat) => {
                minLng = Math.min(minLng, lng);
                minLat = Math.min(minLat, lat);
                maxLng = Math.max(maxLng, lng);
                maxLat = Math.max(maxLat, lat);
            });
        }
    });

    return { minLng, minLat, maxLng, maxLat };
}

/**
 * Generate a random color from a predefined set of distinct, high-contrast colors
 * Uses a curated color palette to ensure good visual distinction between map features
 * @returns {string} A hex color string (e.g., '#E53E3E')
 */
export function generateRandomColor() {
    // a set of distinct unique contrasty colors
    const uniqueContrastyColors = [
        '#FF0000', // – Red
        '#00FF00', // – Lime
        '#0000FF', // – Blue
        '#FFFF00', // – Yellow
        '#FF00FF', // – Magenta
        '#00FFFF', // – Cyan
        '#FFA500', // – Orange
        '#800080', // – Purple
        '#008000', // – Dark Green
        '#000080', // – Navy
        '#FFC0CB', // – Pink
        '#A52A2A', // – Brown
        '#808000', // – Olive
        '#008080', // – Teal
        '#FF1493', // – Deep Pink
        '#7FFF00', // – Chartreuse
        '#DC143C', // – Crimson
        '#40E0D0', // – Turquoise
        '#2F4F4F', // – Dark Slate Gray
        '#FFD700', // – Gold
    ];
    return uniqueContrastyColors[Math.floor(Math.random() * uniqueContrastyColors.length)];
}

/**
 * Parse Odoo record data and extract geolocation and display information
 * Converts record fields into a structured format for map display
 * @param {Object} record - Odoo record object with data and field definitions
 * @param {Object} viewConfig - View configuration with field mappings (lat, lng, title, etc.)
 * @param {boolean} isGrouped - Whether the record is part of a grouped view
 * @returns {Object} Parsed data with geolocation and other properties
 */
export function parseRecord(record, viewConfig = {}, isGrouped = false) {
    function getFieldValue(fieldName) {
        let value = '';
        if (!fieldName || !record.fields[fieldName]) {
            return value;
        }
        switch (record.fields[fieldName].type) {
            case 'many2one':
                value = (record.data[fieldName] || {}).display_name || '';
                break;
            case 'selection':
                let selection = record.fields[fieldName].selection.find((s) => s[0] === record.data[fieldName]);
                value = selection ? selection[1] : '';
                break;
            case 'char':
            case 'text':
            case 'datetime':
            case 'date':
                value = record.data[fieldName] || '';
                break;
            case 'float':
            case 'integer':
            case 'monetary':
                value = record.data[fieldName] || 0;
                break;
            case 'binary': // expected binary of an image
                value = `/web/image/${record.resModel}/${record.resId}/${fieldName}`;
                break;
            case 'json':
                value = record.data[fieldName] ? record.data[fieldName] : {};
                break;
            default:
                value = null;
        }
        return value;
    }

    const other = {};
    let geolocation = false;

    const { lat, lng, ...otherFields } = viewConfig;

    if (!otherFields.title) {
        otherFields.title = 'display_name';
    }

    if (isGrouped) {
        other['__geoColor'] = generateRandomColor();
    }

    if (record.data) {
        if (lat && lng) {
            const latitude = getFieldValue(lat);
            const longitude = getFieldValue(lng);
            if (latitude !== 0.0 && longitude !== 0.0) {
                geolocation = { lat: latitude, lng: longitude };
            }
        }

        Array.from(Object.keys(otherFields)).forEach((config) => {
            const fieldName = otherFields[config];
            const val = getFieldValue(fieldName);
            other[config] = val;
        });

        if (otherFields.__geoColor) {
            const color = record.data[otherFields.__geoColor];
            if (color !== undefined && color !== null) {
                if (typeof color === 'string' || (!color && typeof color !== 'number')) {
                    try {
                        other['__geoColor'] = normalizeColor(color);
                    } catch (error) {
                        console.warn('Failed to normalize color, using default color.', error);
                        other['__geoColor'] = DEFAULT_COLOR;
                    }
                } else if (typeof color === 'number') {
                    other['__geoColor'] = processColor(color);
                }
            } else {
                other['__geoColor'] = processColor(otherFields.__geoColor);
            }
        }
        if (!other['__geoColor']) {
            other['__geoColor'] = DEFAULT_COLOR;
        }
    }
    return { geolocation, other };
}

/**
 * Get or generate the data view for a record
 * Returns the cached dataView if it has valid data, otherwise parses the record
 * @param {Object} record - Odoo record object
 * @param {Object} record.dataView - Cached data view (if available)
 * @param {Object} viewAttrs - View configuration attributes (field mappings)
 * @returns {Object} Data view object with geolocation and other properties
 */
export function getRecordDataView(record, viewAttrs) {
    let dataView = record.dataView || {};
    // Check if dataView has valid data in the 'other' property
    const hasValidData = dataView?.other && Object.keys(dataView.other).length > 0;
    if (!hasValidData) {
        dataView = parseRecord(record, viewAttrs);
    }
    return dataView;
}

/**
 * Process marker color value and return normalized color
 * Handles numeric color picker values, hex/rgb/hsl strings, and other color formats
 * @param {number|string} color - The color value from the record data or field configuration
 * @returns {string} Normalized color value (defaults to DEFAULT_COLOR if invalid)
 */
export function processColor(color) {
    let markerColor = null;

    if (typeof color === 'number') {
        markerColor = getHexColorPicker(color);
    } else if (color && HEX_COLOR_REGEX.test(color)) {
        markerColor = color;
    } else if (color) {
        markerColor = normalizeColor(color);
    }

    return markerColor || DEFAULT_COLOR;
}

/**
 * Format a number with specified decimal places and locale
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} locale - Locale string for formatting (default: 'en-US')
 * @returns {string|number} Formatted number string or original value if invalid
 */
export function formatNumber(num, decimals = 2, locale = 'en-US') {
    if (!Number.isFinite(num)) {
        console.warn('Invalid number provided for formatting:', num);
        return num;
    }

    const toLocale = locale ? locale.replace('_', '-') : navigator.language || 'en-US';
    try {
        const value = num.toLocaleString(toLocale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
        return value;
    } catch (e) {
        console.error('Error formatting number:', e);
        const value = num.toFixed(decimals);
        return value;
    }
}

/**
 * Serialize an object to a JSON string with sorted keys
 * @param {Object} obj
 * @returns
 */
export function sortedKeyStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        const arrayItems = obj.map((item) => sortedKeyStringify(item));
        return `[${arrayItems.join(',')}]`;
    }

    const keys = Object.keys(obj).sort();
    const keyValuePairs = keys.map((key) => {
        const valueStr = sortedKeyStringify(obj[key]);
        return `"${key}":${valueStr}`;
    });
    return `{${keyValuePairs.join(',')}}`;
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
