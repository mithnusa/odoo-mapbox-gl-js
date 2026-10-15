export const DRAW_CIRCLE_MODE = 'draw_circle';
export const DRAW_RECTANGLE_MODE = 'draw_rectangle';
export const POLYGON_CUT_MODE = 'polygon_cut_mode';

export const READONLY_SOURCE_ID = 'readonly-drawing-source';
export const READONLY_FILL_LAYER_ID = 'readonly-drawing-fill-layer';
export const READONLY_LINE_LAYER_ID = 'readonly-drawing-line-layer';
export const READONLY_POINT_LAYER_ID = 'readonly-drawing-point-layer';
export const READONLY_LABEL_LAYER_ID = 'readonly-drawing-label-layer';

export const DRAW_COLOR_INACTIVE = '#e74c3c';
export const DRAW_COLOR_ACTIVE = '#c0392b';
export const DRAW_COLOR_STATIC = '#404040';

export const DRAW_STYLES = [
    {
        id: 'gl-draw-polygon-fill-inactive',
        type: 'fill',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        paint: {
            'fill-color': DRAW_COLOR_INACTIVE,
            'fill-outline-color': DRAW_COLOR_INACTIVE,
            'fill-opacity': 0.1,
        },
    },
    {
        id: 'gl-draw-polygon-fill-active',
        type: 'fill',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
        paint: {
            'fill-color': DRAW_COLOR_ACTIVE,
            'fill-outline-color': DRAW_COLOR_ACTIVE,
            'fill-opacity': 0.1,
        },
    },
    {
        id: 'gl-draw-polygon-midpoint',
        type: 'circle',
        filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
        paint: { 'circle-radius': 3, 'circle-color': DRAW_COLOR_ACTIVE },
    },
    {
        id: 'gl-draw-polygon-stroke-inactive',
        type: 'line',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': DRAW_COLOR_INACTIVE, 'line-width': 2 },
    },
    {
        id: 'gl-draw-polygon-stroke-active',
        type: 'line',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
            'line-color': DRAW_COLOR_ACTIVE,
            'line-dasharray': [0.2, 2],
            'line-width': 2,
        },
    },
    {
        id: 'gl-draw-line-inactive',
        type: 'line',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': DRAW_COLOR_INACTIVE, 'line-width': 2 },
    },
    {
        id: 'gl-draw-line-active',
        type: 'line',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
            'line-color': DRAW_COLOR_ACTIVE,
            'line-dasharray': [0.2, 2],
            'line-width': 2,
        },
    },
    {
        id: 'gl-draw-polygon-and-line-vertex-stroke-inactive',
        type: 'circle',
        filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
        paint: { 'circle-radius': 5, 'circle-color': '#ffffff' },
    },
    {
        id: 'gl-draw-polygon-and-line-vertex-inactive',
        type: 'circle',
        filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
        paint: { 'circle-radius': 3, 'circle-color': DRAW_COLOR_ACTIVE },
    },
    {
        id: 'gl-draw-point-point-inactive',
        type: 'circle',
        filter: [
            'all',
            ['==', 'active', 'false'],
            ['==', '$type', 'Point'],
            ['==', 'meta', 'feature'],
            ['!=', 'mode', 'static'],
            ['!has', 'user_odoo_user_label'],
        ],
        paint: { 'circle-radius': 6, 'circle-color': DRAW_COLOR_INACTIVE },
    },
    {
        id: 'gl-draw-point-label-anchor-inactive',
        type: 'circle',
        filter: [
            'all',
            ['==', 'active', 'false'],
            ['==', '$type', 'Point'],
            ['==', 'meta', 'feature'],
            ['!=', 'mode', 'static'],
            ['has', 'user_odoo_user_label'],
        ],
        paint: {
            'circle-radius': 4,
            'circle-color': '#555555',
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
        },
    },
    {
        id: 'gl-draw-point-stroke-active',
        type: 'circle',
        filter: ['all', ['==', '$type', 'Point'], ['==', 'active', 'true'], ['!=', 'meta', 'midpoint']],
        paint: { 'circle-radius': 11, 'circle-color': '#ffffff' },
    },
    {
        id: 'gl-draw-point-active',
        type: 'circle',
        filter: ['all', ['==', '$type', 'Point'], ['!=', 'meta', 'midpoint'], ['==', 'active', 'true']],
        paint: { 'circle-radius': 8, 'circle-color': DRAW_COLOR_ACTIVE },
    },
    {
        id: 'gl-draw-polygon-fill-static',
        type: 'fill',
        filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']],
        paint: {
            'fill-color': DRAW_COLOR_STATIC,
            'fill-outline-color': DRAW_COLOR_STATIC,
            'fill-opacity': 0.1,
        },
    },
    {
        id: 'gl-draw-polygon-stroke-static',
        type: 'line',
        filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': DRAW_COLOR_STATIC, 'line-width': 2 },
    },
    {
        id: 'gl-draw-line-static',
        type: 'line',
        filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'LineString']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': DRAW_COLOR_STATIC, 'line-width': 2 },
    },
    {
        id: 'gl-draw-point-static',
        type: 'circle',
        filter: ['all', ['==', 'mode', 'static'], ['==', '$type', 'Point']],
        paint: { 'circle-radius': 7, 'circle-color': DRAW_COLOR_STATIC },
    },
    {
        id: 'gl-draw-point-label-text',
        type: 'symbol',
        filter: ['all', ['==', '$type', 'Point'], ['has', 'user_odoo_user_label']],
        layout: {
            'text-field': ['get', 'user_odoo_user_label'],
            'text-size': 13,
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-anchor': 'top',
            'text-offset': [0, 0.8],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
        },
        paint: {
            'text-color': '#1a1a1a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
        },
    },
];

export function formatArea(m2) {
    if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
    if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`;
    return `${Math.round(m2).toLocaleString()} m²`;
}

export function formatLength(meters) {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
}
