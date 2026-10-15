import { formatArea, formatLength, DRAW_CIRCLE_MODE, DRAW_RECTANGLE_MODE } from './utils';

const MEASUREMENT_MODES = new Set(['draw_polygon', 'draw_line_string', 'direct_select', DRAW_RECTANGLE_MODE]);

/**
 * Displays live measurements while the user draws on a Mapbox GL Draw instance:
 *   - A cursor-following overlay showing area (polygons) or total length (lines)
 *   - Per-segment length labels centred on each edge
 *
 * Usage:
 *   const lm = new LiveMeasurement(map, () => mapboxDraw);
 *   lm.attach();                    // creates overlay and label container
 *   lm.onModeChange(mode);          // call whenever draw mode changes
 *   lm.destroy();                   // removes all DOM elements and listeners
 */
export class LiveMeasurement {
    constructor(map, getMapboxDraw) {
        this._map = map;
        this._getMapboxDraw = getMapboxDraw;
        this._overlay = null;
        this._labelsContainer = null;
        this._segmentLabelEls = [];
        this._isActive = false;
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMapClick = this._handleMapClick.bind(this);
        this._rectangleCorner1 = null;
        this._rafId = null;
    }

    attach() {
        if (this._overlay) return;

        // Cursor-following summary overlay (area / total length)
        const el = document.createElement('div');
        Object.assign(el.style, {
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.65)',
            color: '#ffffff',
            padding: '5px 9px',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: '1.6',
            pointerEvents: 'none',
            zIndex: '10',
            display: 'none',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
        });
        this._map.getContainer().appendChild(el);
        this._overlay = el;

        // Zero-size container that holds per-segment length labels
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '0',
            height: '0',
            pointerEvents: 'none',
            overflow: 'visible',
        });
        this._map.getContainer().appendChild(container);
        this._labelsContainer = container;
    }

    /**
     * Call this whenever the Mapbox Draw mode changes.
     * Attaches the mousemove listener when entering a drawing mode,
     * detaches and hides everything when leaving.
     * @param {string} mode
     */
    onModeChange(mode) {
        if (MEASUREMENT_MODES.has(mode)) {
            if (!this._isActive) {
                this._map.on('mousemove', this._onMouseMove);
                this._isActive = true;
            }
            if (mode === DRAW_RECTANGLE_MODE) {
                this._map.on('click', this._onMapClick);
            } else {
                this._map.off('click', this._onMapClick);
                this._rectangleCorner1 = null;
            }
        } else {
            this._deactivate();
        }
    }

    destroy() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._isActive) {
            try {
                this._map.off('mousemove', this._onMouseMove);
            } catch {
                // map may already be destroyed
            }
            this._isActive = false;
        }
        try {
            this._map.off('click', this._onMapClick);
        } catch {
            // map may already be destroyed
        }
        this._rectangleCorner1 = null;
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
        if (this._labelsContainer) {
            this._labelsContainer.remove();
            this._labelsContainer = null;
        }
        this._segmentLabelEls = [];
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    _deactivate() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._isActive) {
            this._map.off('mousemove', this._onMouseMove);
            this._isActive = false;
        }
        this._map.off('click', this._onMapClick);
        this._rectangleCorner1 = null;
        this._hide();
    }

    _handleMapClick(e) {
        const draw = this._getMapboxDraw();
        if (!draw || draw.getMode() !== DRAW_RECTANGLE_MODE) return;
        // First click stores corner1; second click completes the shape and
        // triggers a mode change which resets corner1 via _deactivate.
        if (this._rectangleCorner1 === null) {
            this._rectangleCorner1 = [e.lngLat.lng, e.lngLat.lat];
        }
    }

    _handleMouseMove(e) {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            const draw = this._getMapboxDraw();
            if (!draw || !this._overlay) return;
            if (!MEASUREMENT_MODES.has(draw.getMode())) return;

            const mode = draw.getMode();

            // Rectangle preview is computed directly from stored corner1 + cursor,
            // bypassing getAll() which returns stale coordinates at mousemove time.
            if (mode === DRAW_RECTANGLE_MODE) {
                const preview = this._buildRectanglePreview(e.lngLat);
                if (!preview) {
                    this._hide();
                    return;
                }
                this._render(preview, e.lngLat, mode);
                return;
            }

            // In direct_select the user is dragging a vertex on an existing feature.
            // The selected feature's coordinates are live — no cursor preview needed.
            if (mode === 'direct_select') {
                const selected = draw.getSelected();
                if (!selected?.features?.length) {
                    this._hide();
                    return;
                }
                this._render(selected.features[0], e.lngLat, mode);
                return;
            }

            const all = draw.getAll();
            if (!all?.features?.length) {
                this._hide();
                return;
            }

            // The feature currently being drawn is always the last in the collection
            const active = all.features[all.features.length - 1];
            const preview = this._buildPreview(active, e.lngLat);
            if (!preview) {
                this._hide();
                return;
            }

            this._render(preview, e.lngLat, mode);
        });
    }

    /**
     * Builds a rectangle preview from the stored first corner and the current
     * cursor position, without relying on getAll().
     */
    _buildRectanglePreview(lngLat) {
        if (!this._rectangleCorner1) return null;
        const [lng1, lat1] = this._rectangleCorner1;
        const [lng2, lat2] = [lngLat.lng, lngLat.lat];
        const ring = [
            [lng1, lat1],
            [lng2, lat1],
            [lng2, lat2],
            [lng1, lat2],
            [lng1, lat1],
        ];
        try {
            return window.turf.polygon([ring]);
        } catch {
            return null;
        }
    }

    /**
     * Builds a preview feature by appending the current cursor position as a
     * temporary vertex so the measurement reflects where the shape would be
     * if the user clicked right now.
     */
    _buildPreview(feature, lngLat) {
        const cursor = [lngLat.lng, lngLat.lat];

        if (feature.geometry.type === 'Polygon') {
            const ring = feature.geometry.coordinates[0];
            // Need at least 2 committed points + auto-closing vertex (3 total)
            if (ring.length < 3) return null;
            // Insert cursor before the closing vertex
            const previewRing = [...ring.slice(0, -1), cursor, ring[0]];
            try {
                return window.turf.polygon([previewRing]);
            } catch {
                return null;
            }
        }

        if (feature.geometry.type === 'LineString') {
            const coords = feature.geometry.coordinates;
            if (!coords.length) return null;
            try {
                return window.turf.lineString([...coords, cursor]);
            } catch {
                return null;
            }
        }

        return null;
    }

    /**
     * Updates the cursor overlay and per-segment labels for the given feature.
     * @param {Object} feature  GeoJSON feature
     * @param {Object} lngLat   Mapbox LngLat for cursor overlay positioning
     * @param {string} mode     Current draw mode
     */
    _render(feature, lngLat, mode) {
        const summaryLines = [];
        let segments = [];

        try {
            if (feature.geometry.type === 'Polygon') {
                const areaM2 = window.turf.area(feature);
                summaryLines.push(`Area: ${formatArea(areaM2)}`);
                // Skip segment labels for circles since they are approximated with many vertices;
                if (!this._isCircleFeature(feature, mode)) {
                    segments = this._extractRingSegments(feature.geometry.coordinates[0]);
                }
            } else if (feature.geometry.type === 'LineString') {
                const lengthM = window.turf.length(feature, { units: 'meters' });
                summaryLines.push(`Total: ${formatLength(lengthM)}`);
                segments = this._extractLineSegments(feature.geometry.coordinates);
            }
        } catch {
            this._hide();
            return;
        }

        if (!summaryLines.length) {
            this._hide();
            return;
        }

        // Cursor-following summary overlay
        this._overlay.innerHTML = summaryLines.map((l) => `<div>${l}</div>`).join('');
        const point = this._map.project(lngLat);
        this._overlay.style.left = `${point.x + 15}px`;
        this._overlay.style.top = `${point.y - 10}px`;
        this._overlay.style.display = 'block';

        // Per-segment labels
        this._updateSegmentLabels(segments);
    }

    /**
     * Returns true when a polygon feature should be treated as a circle.
     * Checks the isCircle property AND the vertex count as a fallback, because
     * MapboxDraw may or may not include user properties depending on version.
     */
    _isCircleFeature(feature, mode) {
        if (mode === DRAW_CIRCLE_MODE) return true;
        if (feature.properties?.isCircle || feature.properties?.mode === 'circle') return true;
        // Circles are created with steps:64 → closed ring has exactly 65 vertices.
        const ring = feature.geometry?.coordinates?.[0];
        return ring ? ring.length >= 65 : false;
    }

    /** Extracts consecutive [from, to] pairs from a closed polygon ring. */
    _extractRingSegments(ring) {
        const segs = [];
        for (let i = 0; i < ring.length - 1; i++) {
            segs.push([ring[i], ring[i + 1]]);
        }
        return segs;
    }

    /** Extracts consecutive [from, to] pairs from a linestring coordinate array. */
    _extractLineSegments(coords) {
        const segs = [];
        for (let i = 0; i < coords.length - 1; i++) {
            segs.push([coords[i], coords[i + 1]]);
        }
        return segs;
    }

    /**
     * Creates or reuses label elements for each segment and positions them at
     * the geographic midpoint of the segment.
     * @param {Array} segments  Array of [[lng,lat],[lng,lat]] pairs
     */
    _updateSegmentLabels(segments) {
        for (let i = 0; i < segments.length; i++) {
            const [from, to] = segments[i];

            let midCoords = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
            let lengthM = 0;
            try {
                const line = window.turf.lineString([from, to]);
                midCoords = window.turf.midpoint(window.turf.point(from), window.turf.point(to)).geometry.coordinates;
                lengthM = window.turf.length(line, { units: 'meters' });
            } catch {
                // skip degenerate segment
            }

            const pt = this._map.project(midCoords);

            const el = this._getOrCreateSegmentLabel(i);
            el.textContent = formatLength(lengthM);
            el.style.left = `${pt.x}px`;
            el.style.top = `${pt.y}px`;
            el.style.display = 'block';
        }

        // Hide surplus labels from a previous (longer) feature
        for (let i = segments.length; i < this._segmentLabelEls.length; i++) {
            this._segmentLabelEls[i].style.display = 'none';
        }
    }

    _getOrCreateSegmentLabel(i) {
        if (i < this._segmentLabelEls.length) return this._segmentLabelEls[i];
        const el = document.createElement('div');
        Object.assign(el.style, {
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#ffffff',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '11px',
            pointerEvents: 'none',
            display: 'none',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            transform: 'translate(-50%, -50%)',
        });
        this._labelsContainer.appendChild(el);
        this._segmentLabelEls.push(el);
        return el;
    }

    _clearSegmentLabels() {
        for (const el of this._segmentLabelEls) {
            el.style.display = 'none';
        }
    }

    _hide() {
        if (this._overlay) this._overlay.style.display = 'none';
        this._clearSegmentLabels();
    }
}
