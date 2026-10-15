import { formatNumber, MEASUREMENT_CONFIG } from '@web_view_base_mapbox_gl/map_base/utils';

/**
 * Calculate the distance between two geographic coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @param {string} unit - Unit of measurement ('metric' or 'imperial')
 * @returns {number} Distance in kilometers or miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    const R =
        unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL
            ? MEASUREMENT_CONFIG.EARTH_RADIUS_MILES
            : MEASUREMENT_CONFIG.EARTH_RADIUS_KM;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate the area of a polygon using the spherical excess formula
 * @param {Array} coordinates - Array of [lng, lat] coordinates forming the polygon
 * @param {string} unit - Unit of measurement ('metric' or 'imperial')
 * @returns {number} Area in square kilometers or square miles
 */
export function calculatePolygonArea(coordinates, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    if (coordinates.length < 3) return 0;

    const R =
        unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL
            ? MEASUREMENT_CONFIG.EARTH_RADIUS_MILES
            : MEASUREMENT_CONFIG.EARTH_RADIUS_KM;

    let area = 0;
    const coords = coordinates.slice(); // Copy array

    // Ensure polygon is closed
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
    }

    for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];

        area += (lon2 - lon1) * (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
    }

    area = Math.abs((area * R * R * Math.PI) / 360);
    return area;
}

/**
 * Calculate the total length of a linestring
 * @param {Array} coordinates - Array of [lng, lat] coordinates
 * @param {string} unit - Unit of measurement ('metric' or 'imperial')
 * @returns {number} Total length in kilometers or miles
 */
export function calculateLineStringLength(coordinates, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    if (coordinates.length < 2) return 0;

    let totalLength = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const [lon1, lat1] = coordinates[i];
        const [lon2, lat2] = coordinates[i + 1];
        totalLength += calculateDistance(lat1, lon1, lat2, lon2, unit);
    }

    return totalLength;
}

/**
 * Calculate the area of a circle given its radius
 * @param {number} radius - Radius in kilometers or miles
 * @returns {number} Area in square kilometers or square miles
 */
export function calculateCircleArea(radius) {
    return Math.PI * Math.pow(radius, 2);
}

/**
 * Calculate the radius of a circle from polygon coordinates
 * @param {Array} polygonCoords
 * @param {string} unit
 * @returns {number} radius in kilometers or miles
 */
export function calculateCircleRadius(polygonCoords, unit = MEASUREMENT_CONFIG.UNITS.METRIC) {
    // Assuming polygonCoords is an array of linear rings, take the first ring
    const firstRing = polygonCoords[0];
    if (firstRing.length < 2) return 0;

    // Calculate the centroid of the polygon
    let sumLat = 0;
    let sumLng = 0;
    firstRing.forEach(([lng, lat]) => {
        sumLat += lat;
        sumLng += lng;
    });
    const centroidLat = sumLat / firstRing.length;
    const centroidLng = sumLng / firstRing.length;

    // Calculate the distance from the centroid to the first point as radius
    const [firstLng, firstLat] = firstRing[0];
    const radius = calculateDistance(centroidLat, centroidLng, firstLat, firstLng, unit);

    return radius;
}

/**
 * Calculate circle measurements: area and diameter
 * @param {Number} radius
 * @returns {Object} area and diameter
 */
export function calculateCircleMeasurements(radius) {
    const area = calculateCircleArea(radius);
    const diameter = radius * 2;
    return { area, diameter };
}

/**
 * Format point count with appropriate singular/plural form
 * @param {number} count - The number of points
 * @returns {string} Formatted point count string
 */
export function formatPointCount(count) {
    return `${formatNumber(count, 0)} ${count === 1 ? 'point' : 'points'}`;
}

export function formatMeasurement(value, type, unit = MEASUREMENT_CONFIG.UNITS.METRIC, locale = 'en-US') {
    if (type === 'distance') {
        if (unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
            if (value < 0.1) {
                // Very short distances in feet with no decimals for readability
                const feet = value * 5280;
                return `${formatNumber(feet, 0, locale)} ft`;
            } else if (value < 1) {
                // Short distances in feet with 1 decimal
                const feet = value * 5280;
                return `${formatNumber(feet, 1, locale)} ft`;
            } else {
                // Longer distances in miles
                return `${formatNumber(value, 2, locale)} mi`;
            }
        } else {
            if (value < 0.001) {
                // Very short distances in centimeters
                const cm = value * 100000;
                return `${formatNumber(cm, 0, locale)} cm`;
            } else if (value < 1) {
                // Short distances in meters
                const meters = value * 1000;
                return `${formatNumber(meters, meters < 10 ? 1 : 0, locale)} m`;
            } else {
                // Longer distances in kilometers
                return `${formatNumber(value, 2, locale)} km`;
            }
        }
    } else if (type === 'area') {
        if (unit === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
            if (value < 0.0015625) {
                // Very small areas in square feet
                const sqFeet = value * 27878400; // 1 sq mile = 27,878,400 sq ft
                return `${formatNumber(sqFeet, 0, locale)} ft²)`;
            } else if (value < 1) {
                // Small to medium areas in acres
                const acres = value * 640;
                return `${formatNumber(acres, acres < 1 ? 2 : 1, locale)} acres`;
            } else {
                // Large areas in square miles
                return `${formatNumber(value, 2, locale)} m²`;
            }
        } else {
            if (value < 0.01) {
                // Small areas in square meters
                const sqMeters = value * 1000000;
                return `${formatNumber(sqMeters, sqMeters < 100 ? 1 : 0, locale)} m²`;
            } else if (value < 1) {
                // Medium areas in hectares
                const hectares = value * 100;
                return `${formatNumber(hectares, 2, locale)} ha`;
            } else {
                // Large areas in square kilometers
                return `${formatNumber(value, 2, locale)} km²`;
            }
        }
    }
    return formatNumber(value, 2, locale);
}

/**
 * Format area measurement with appropriate unit based on size and unit system
 * Supports both metric (m², ha, km²) and imperial (sq ft, ac, sq mi) units
 * @param {number} areaInSquareMeter - Area value in square meters
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} locale - Locale for number formatting (default: 'en-US')
 * @param {string} unitSystem - Unit system to use: 'metric' or 'imperial' (default: 'metric')
 * @returns {string} Formatted area string with appropriate unit
 */
export function formatAreaMeasurement(
    areaInSquareMeter,
    locale = 'en-US',
    decimals = 2,
    unitSystem = MEASUREMENT_CONFIG.UNITS.METRIC
) {
    if (!Number.isFinite(areaInSquareMeter)) {
        console.warn('Invalid area provided for formatting:', areaInSquareMeter);
        return areaInSquareMeter;
    }

    let area = areaInSquareMeter;
    let unit = 'm²';

    if (unitSystem === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
        // Imperial unit conversions
        // 1 acre = 4046.86 m², 1 sq mi = 2589988.11 m², 1 sq ft = 0.092903 m²
        const SQ_METER_TO_SQ_FEET = 10.7639;
        const SQ_METER_TO_ACRES = 0.000247105;
        const SQ_METER_TO_SQ_MILES = 0.000000386102;
        const ACRES_PER_SQ_MILE = 640;

        if (areaInSquareMeter >= ACRES_PER_SQ_MILE / SQ_METER_TO_ACRES) {
            // Use square miles for large areas (>= 640 acres)
            area = areaInSquareMeter * SQ_METER_TO_SQ_MILES;
            unit = 'mi²';
        } else if (areaInSquareMeter >= 1 / SQ_METER_TO_ACRES) {
            // Use acres for medium areas (>= 1 acre)
            area = areaInSquareMeter * SQ_METER_TO_ACRES;
            unit = 'ac';
        } else {
            // Use square feet for small areas
            area = areaInSquareMeter * SQ_METER_TO_SQ_FEET;
            unit = 'ft²';
        }
    } else {
        // Metric unit conversions
        if (areaInSquareMeter >= 1000000) {
            area = areaInSquareMeter / 1000000;
            unit = 'km²';
        } else if (areaInSquareMeter >= 10000) {
            area = areaInSquareMeter / 10000;
            unit = 'ha';
        }
    }

    const value = formatNumber(area, decimals, locale);

    return `${value} ${unit}`;
}

/**
 * Format length measurement with appropriate unit based on distance and unit system
 * Supports both metric (cm, m, km) and imperial (in, ft, yd, mi) units
 * @param {number} lengthInKilometers - Length value in kilometers
 * @param {string} locale - Locale for number formatting (default: 'en-US')
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {string} unitSystem - Unit system to use: 'metric' or 'imperial' (default: 'metric')
 * @returns {string} Formatted length string with appropriate unit
 */
export function formatLengthMeasurement(
    lengthInKilometers,
    locale = 'en-US',
    decimals = 2,
    unitSystem = MEASUREMENT_CONFIG.UNITS.METRIC
) {
    if (!Number.isFinite(parseFloat(lengthInKilometers))) {
        console.warn('Invalid length provided for formatting:', lengthInKilometers);
        return lengthInKilometers;
    }

    let length = lengthInKilometers;
    let unit = 'km';

    if (unitSystem === MEASUREMENT_CONFIG.UNITS.IMPERIAL) {
        // Imperial unit conversions from kilometers
        // 1 km = 0.621371 mi, 1 km = 1093.61 yd, 1 km = 3280.84 ft, 1 km = 39370.1 in
        const KM_TO_INCHES = 39370.1;
        const KM_TO_FEET = 3280.84;
        const KM_TO_YARDS = 1093.61;
        const KM_TO_MILES = 0.621371;

        if (lengthInKilometers >= 1.60934) {
            // Use miles for long distances (>= 1 mile, which is ~1.609 km)
            length = lengthInKilometers * KM_TO_MILES;
            unit = 'mi';
        } else if (lengthInKilometers >= 0.0009144) {
            // Use yards for medium distances (>= 1 yard, which is ~0.0009144 km)
            length = lengthInKilometers * KM_TO_YARDS;
            unit = 'yd';
        } else if (lengthInKilometers >= 0.0003048) {
            // Use feet for shorter distances (>= 1 foot, which is ~0.0003048 km)
            length = lengthInKilometers * KM_TO_FEET;
            unit = 'ft';
        } else {
            // Use inches for very short distances
            length = lengthInKilometers * KM_TO_INCHES;
            unit = 'in';
        }
    } else {
        // Metric unit conversions
        if (lengthInKilometers >= 1) {
            // Use kilometers for long distances
            length = lengthInKilometers;
            unit = 'km';
        } else if (lengthInKilometers >= 0.001) {
            // Use meters for medium distances (>= 1 meter, which is 0.001 km)
            length = lengthInKilometers * 1000;
            unit = 'm';
        } else {
            // Use centimeters for short distances (< 1 meter)
            length = lengthInKilometers * 100000;
            unit = 'cm';
        }
    }

    const value = formatNumber(length, decimals, locale);

    return `${value} ${unit}`;
}
