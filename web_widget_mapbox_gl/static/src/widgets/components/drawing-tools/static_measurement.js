/**
 * Renders static per-segment and summary (area / total-length) labels on all
 * completed Mapbox GL Draw features using the same DOM-pill style as
 * LiveMeasurement.  Labels are repositioned on every map 'move' event so they
 * stay aligned as the user pans or zooms.
 *
 * Usage:
 *   const sm = new StaticMeasurement(map, () => mapboxDraw);
 *   sm.attach();          // creates the container (hidden by default)
 *   sm.toggle();          // show/hide; returns new enabled state
 *   sm.update();          // recompute from current draw features (no-op if off)
 *   sm.suspend();         // hide without changing enabled state (draw/edit mode)
 *   sm.resume();          // restore + recompute if enabled
 *   sm.destroy();         // remove DOM and listeners
 */

import { formatArea, formatLength } from './utils';

export class StaticMeasurement {
    constructor(map, getMapboxDraw) {
        this._map = map;
        this._getMapboxDraw = getMapboxDraw;
        this._enabled = false;
        this._suspended = false;
        this._container = null;
        this._segmentEls = [];
        this._summaryEls = [];
        // Each entry: { coords: [lng, lat], label: string, type: 'segment'|'summary' }
        this._labelData = [];
        this._rafId = null;
        this._onMove = () => {
            if (this._rafId) cancelAnimationFrame(this._rafId);
            this._rafId = requestAnimationFrame(() => {
                this._rafId = null;
                this._updatePositions();
            });
        };
    }

    get isEnabled() {
        return this._enabled;
    }

    attach() {
        if (this._container) return;
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '0',
            height: '0',
            pointerEvents: 'none',
            overflow: 'visible',
            display: 'none',
        });
        this._map.getContainer().appendChild(container);
        this._container = container;
        this._map.on('move', this._onMove);
    }

    /**
     * Toggle measurements on/off.
     * When turning on, immediately computes and shows labels.
     * @returns {boolean} New enabled state
     */
    toggle() {
        this._enabled = !this._enabled;
        if (this._enabled && !this._suspended) {
            this._container.style.display = '';
            this._recomputeLabels();
        } else {
            this._container.style.display = 'none';
        }
        return this._enabled;
    }

    /**
     * Temporarily hide without changing enabled state (entering draw / edit mode).
     */
    suspend() {
        this._suspended = true;
        if (this._container) this._container.style.display = 'none';
    }

    /**
     * Restore visibility + refresh labels (exiting draw / edit mode).
     */
    resume() {
        this._suspended = false;
        if (this._enabled) {
            if (this._container) this._container.style.display = '';
            this._recomputeLabels();
        }
    }

    /**
     * Recompute labels from the current draw features.
     * No-op when disabled or suspended.
     */
    update() {
        if (this._enabled && !this._suspended) {
            this._recomputeLabels();
        }
    }

    destroy() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        try {
            this._map.off('move', this._onMove);
        } catch {
            // map may already be destroyed
        }
        if (this._container) {
            this._container.remove();
            this._container = null;
        }
        this._segmentEls = [];
        this._summaryEls = [];
        this._labelData = [];
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    /** Reproject all stored geographic positions to screen pixels. */
    _updatePositions() {
        if (!this._container || this._container.style.display === 'none') return;

        let segIdx = 0;
        let sumIdx = 0;

        for (const { coords, type } of this._labelData) {
            const pt = this._map.project(coords);
            if (type === 'segment') {
                const el = this._segmentEls[segIdx++];
                if (el) {
                    el.style.left = `${pt.x}px`;
                    el.style.top = `${pt.y}px`;
                }
            } else {
                const el = this._summaryEls[sumIdx++];
                if (el) {
                    el.style.left = `${pt.x}px`;
                    el.style.top = `${pt.y}px`;
                }
            }
        }
    }

    _recomputeLabels() {
        if (!this._container) return;

        const draw = this._getMapboxDraw();
        if (!draw) return;

        const all = draw.getAll();
        const newData = [];

        for (const feature of all?.features ?? []) {
            const type = feature.geometry?.type;
            if (type === 'Polygon') {
                this._collectPolygonLabels(feature, newData);
            } else if (type === 'LineString') {
                this._collectLineLabels(feature, newData);
            }
        }

        this._labelData = newData;

        const segData = newData.filter((d) => d.type === 'segment');
        const sumData = newData.filter((d) => d.type === 'summary');

        this._syncPool(this._segmentEls, segData.length, 'segment');
        this._syncPool(this._summaryEls, sumData.length, 'summary');

        segData.forEach((d, i) => {
            this._segmentEls[i].textContent = d.label;
        });
        sumData.forEach((d, i) => {
            this._summaryEls[i].textContent = d.label;
        });

        // Hide any leftover elements from a previous (larger) feature set
        for (let i = segData.length; i < this._segmentEls.length; i++) {
            this._segmentEls[i].style.display = 'none';
        }
        for (let i = sumData.length; i < this._summaryEls.length; i++) {
            this._summaryEls[i].style.display = 'none';
        }

        this._updatePositions();
    }

    /** Grow the pool if needed and make the first `count` elements visible. */
    _syncPool(pool, count, type) {
        while (pool.length < count) {
            pool.push(this._createElement(type));
        }
        for (let i = 0; i < count; i++) {
            pool[i].style.display = 'block';
        }
    }

    _createElement(type) {
        const el = document.createElement('div');
        // Match the live-measurement segment / summary styles exactly
        if (type === 'segment') {
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
        } else {
            Object.assign(el.style, {
                position: 'absolute',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#ffffff',
                padding: '5px 9px',
                borderRadius: '4px',
                fontSize: '12px',
                lineHeight: '1.6',
                pointerEvents: 'none',
                display: 'none',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                transform: 'translate(-50%, -50%)',
            });
        }
        this._container.appendChild(el);
        return el;
    }

    _collectPolygonLabels(feature, data) {
        try {
            const ring = feature.geometry.coordinates[0];
            if (!ring || ring.length < 4) return;

            const areaM2 = window.turf.area(feature);
            const centroid = window.turf.centroid(feature);
            data.push({
                coords: centroid.geometry.coordinates,
                label: formatArea(areaM2),
                type: 'summary',
            });

            // Skip segment labels for circles since they are approximated with many vertices;
            const isCircle = feature.properties?.isCircle || feature.properties?.mode === 'circle';
            if (!isCircle) {
                for (let i = 0; i < ring.length - 1; i++) {
                    this._pushSegmentEntry(ring[i], ring[i + 1], data);
                }
            }
        } catch (error) {
            // skip invalid geometry
        }
    }

    _collectLineLabels(feature, data) {
        try {
            const coords = feature.geometry.coordinates;
            if (!coords || coords.length < 2) return;

            const totalM = window.turf.length(feature, { units: 'meters' });
            const midFeature = window.turf.along(feature, totalM / 2000, {
                units: 'kilometers',
            });
            data.push({
                coords: midFeature.geometry.coordinates,
                label: `Total: ${formatLength(totalM)}`,
                type: 'summary',
            });

            for (let i = 0; i < coords.length - 1; i++) {
                this._pushSegmentEntry(coords[i], coords[i + 1], data);
            }
        } catch {
            // skip invalid geometry
        }
    }

    _pushSegmentEntry(from, to, data) {
        try {
            const mid = window.turf.midpoint(window.turf.point(from), window.turf.point(to));
            const lengthM = window.turf.length(window.turf.lineString([from, to]), { units: 'meters' });
            // Skip segments with non-positive length
            if (lengthM <= 0) return;

            data.push({
                coords: mid.geometry.coordinates,
                label: formatLength(lengthM),
                type: 'segment',
            });
        } catch {
            // skip degenerate segment
        }
    }
}
