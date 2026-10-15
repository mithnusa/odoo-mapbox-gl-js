import { useService } from '@web/core/utils/hooks';
import { validateGeoJson } from '@base_mapbox_gl/utils/utils';
import { LABEL_POINT_STYLE } from '@web_view_base_mapbox_gl/map_base/utils';
import { MapboxGlDrawRenderer } from '@web_view_mapbox_gl_draw/views/mapbox_gl/mapbox_gl_renderer';
import { MapboxGlDrawSidebarProjectProject } from './mapbox_gl_sidebar';

export class MapboxGlRendererProjectProject extends MapboxGlDrawRenderer {
    static components = {
        ...MapboxGlDrawRenderer.components,
        Sidebar: MapboxGlDrawSidebarProjectProject,
    };

    /**
     * @override
     */
    setup() {
        super.setup();
        this.actionService = useService('action');
        this.orm = useService('orm');
    }

    /**
     * Trigger the "View Tasks" window action for a project record.
     * Calls `project.project.action_view_tasks` on the server and opens the
     * resulting action in the current client. Errors are logged but do not
     * surface to the user because this is a non-critical navigation shortcut.
     * @param {Object} record - Sidebar record object with a `resId` property
     */
    _actionViewTasks(record) {
        this.orm
            .call('project.project', 'action_view_tasks', [record.resId])
            .then((action) => {
                if (action) {
                    this.actionService.doAction(action);
                }
            })
            .catch((e) => {
                console.error('Failed to load task action for record', record.resId, e);
            });
    }

    /**
     * Extend the base sidebar props with the task-navigation callback.
     * @override
     * @returns {Object} Props object for the sidebar component
     */
    get sidebarProps() {
        return Object.assign({}, super.sidebarProps, {
            onActionViewTask: this._actionViewTasks.bind(this),
        });
    }
}

const PROJECT_GEOJSON_FIELD = 'mapbox_project_geojson';
const PROJECT_ID_FIELD = 'project_id';
const PROJECT_COLOR = '#ff5100';

/**
 * Renderer for `project.task` map view.
 * Extends the standard draw renderer to overlay each task's parent project
 * geometry as a read-only context layer beneath the task's own geometry.
 */
export class MapboxGlRendererProjectTask extends MapboxGlDrawRenderer {
    /**
     * @override
     */
    setup() {
        super.setup();
        /** @type {Map<number, Object>} keyed by project id, value is a GeoJSON FeatureCollection */
        this.projectGeoJson = new Map();
        /** @type {Set<string>} Mapbox GL source IDs currently added to the map */
        this.projectSourceIds = new Set();
        /** @type {Set<string>} Mapbox GL layer IDs currently added to the map */
        this.projectLayerIds = new Set();
    }

    /**
     * Extract and parse the parent project's GeoJSON and id from a task record.
     *
     * Returns an empty object when either the project id or the GeoJSON field
     * is absent or cannot be parsed, so callers can safely destructure without
     * an explicit null check on each property.
     *
     * @param {Object} record - An Odoo task record with a `data` payload
     * @returns {{ projectId: Object, projectGeoJson: Object }|{}}
     */
    getRecordProjectGeoJsonData(record) {
        let geojson = record.data?.[PROJECT_GEOJSON_FIELD] ?? false;
        const projectId = record.data?.[PROJECT_ID_FIELD] ?? false;

        if (!geojson || !projectId) {
            return {};
        }

        try {
            if (typeof geojson === 'string') {
                geojson = JSON.parse(geojson);
            } else if (typeof geojson !== 'object') {
                return {};
            }
        } catch {
            return {};
        }

        return { projectId, projectGeoJson: geojson };
    }

    /**
     * Clear the project GeoJSON accumulator at the start of each render cycle
     * so that stale project overlays from the previous cycle are not re-rendered.
     *
     * Must be cleared here — before `commitRecordToMap` is called for any record —
     * rather than in `addGeoJsonSource`, which runs AFTER all records are processed.
     *
     * Bumps `_projectRenderId` so that `commitRecordToMap` calls belonging to
     * a render cycle this one supersedes (still in flight if a new call starts
     * mid-batch) can detect they're stale and skip writing to projectGeoJson,
     * instead of interleaving with this cycle's writes.
     * @override
     */
    async renderGeolocationData() {
        this._projectRenderId = (this._projectRenderId || 0) + 1;
        this.projectGeoJson.clear();
        return super.renderGeolocationData();
    }

    /**
     * Commit a task record's own geometry to the map, then collect the parent
     * project's GeoJSON into `this.projectGeoJson` for later rendering.
     *
     * Project GeoJSON is not rendered here — it is applied in bulk by
     * `_renderProjectGeoJsonLayer` after all records have been processed.
     * Errors in the project layer collection are intentionally caught and
     * warned rather than thrown, so a bad project record cannot block the
     * task's own geometry from rendering.
     *
     * @override
     * @param {Object} record - The task record to process
     * @param {string} featureColor - Resolved fill colour for the task features
     * @returns {Promise<void>}
     */
    async commitRecordToMap(record, featureColor) {
        const renderId = this._projectRenderId;
        await super.commitRecordToMap(record, featureColor);
        try {
            const { projectId, projectGeoJson } = this.getRecordProjectGeoJsonData(record);
            if (!projectId?.id || !validateGeoJson(projectGeoJson)) {
                return;
            }
            // A newer renderGeolocationData() cycle has started and cleared
            // projectGeoJson since this record's processing began — discard
            // this write rather than interleaving with the newer cycle's data.
            if (renderId !== this._projectRenderId) {
                return;
            }
            this.projectGeoJson.set(projectId.id, projectGeoJson);
        } catch {
            // bad project record — skip without blocking the task's own geometry
        }
    }

    /**
     * Remove all project context layers and their GeoJSON sources from the map.
     *
     * Iterates `projectSourceIds`, removes every Mapbox GL layer whose
     * `source` matches the source ID, then removes the source itself.
     * Clears `projectSourceIds` when done.
     *
     * Safe to call when the map has not yet loaded — exits immediately if
     * `this.mapBoxGlJs` is falsy. Also guards against a null style (possible
     * during a style reload) by defaulting to an empty layer list.
     * @private
     */
    _cleanUpProjectGeoJsonLayers() {
        if (!this.mapBoxGlJs) {
            return;
        }
        const map = this.mapBoxGlJs;
        for (const layerId of this.projectLayerIds) {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
        }
        this.projectLayerIds.clear();
        for (const sourceId of this.projectSourceIds) {
            if (map.getSource(sourceId)) map.removeSource(sourceId);
        }
        this.projectSourceIds.clear();
    }

    /**
     * Render the parent project GeoJSON as a read-only context overlay.
     *
     * Performs an incremental diff against the currently rendered set:
     * - Projects removed from the result → their layers and source are torn down.
     * - Projects already on the map → `setData()` refreshes data without
     *   rebuilding layers or re-tiling.
     * - New projects → source and five layers are added via `_addProjectLayers`.
     * @private
     */
    _renderProjectGeoJsonLayer() {
        if (!this.mapBoxGlJs) return;
        const map = this.mapBoxGlJs;

        // Remove layers/sources for projects no longer in the current set
        const wantedSourceIds = new Set([...this.projectGeoJson.keys()].map((id) => `project-${id}-geojson-source`));
        for (const sourceId of [...this.projectSourceIds]) {
            if (wantedSourceIds.has(sourceId)) continue;
            const projectId = sourceId.slice('project-'.length, sourceId.lastIndexOf('-geojson-source'));
            for (const layerId of [
                `project-${projectId}-fill-layer`,
                `project-${projectId}-line-layer`,
                `project-${projectId}-point-layer`,
                `project-${projectId}-point-with-label-layer`,
                `project-${projectId}-symbol-label-layer`,
            ]) {
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                this.projectLayerIds.delete(layerId);
            }
            if (map.getSource(sourceId)) map.removeSource(sourceId);
            this.projectSourceIds.delete(sourceId);
        }

        // Update existing sources or add new ones
        for (const [projectId, projectGeoJson] of this.projectGeoJson.entries()) {
            const sourceId = `project-${projectId}-geojson-source`;
            if (map.getSource(sourceId)) {
                map.getSource(sourceId).setData(projectGeoJson);
            } else {
                this.projectSourceIds.add(sourceId);
                map.addSource(sourceId, {
                    type: 'geojson',
                    data: projectGeoJson,
                });
                this._addProjectLayers(projectId, sourceId);
            }
        }
    }

    /**
     * Add the five Mapbox GL layers that render a single project's context
     * geometry. Registers all layer IDs in `projectLayerIds` for cleanup.
     * @param {number} projectId
     * @param {string} sourceId
     * @private
     */
    _addProjectLayers(projectId, sourceId) {
        const map = this.mapBoxGlJs;

        const fillId = `project-${projectId}-fill-layer`;
        const lineId = `project-${projectId}-line-layer`;
        const pointId = `project-${projectId}-point-layer`;
        const anchorId = `project-${projectId}-point-with-label-layer`;
        const symbolId = `project-${projectId}-symbol-label-layer`;
        this.projectLayerIds.add(fillId);
        this.projectLayerIds.add(lineId);
        this.projectLayerIds.add(pointId);
        this.projectLayerIds.add(anchorId);
        this.projectLayerIds.add(symbolId);

        // Polygon fill
        map.addLayer({
            id: fillId,
            type: 'fill',
            source: sourceId,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: { 'fill-color': PROJECT_COLOR, 'fill-opacity': 0.15 },
            slot: 'middle',
        });

        // Dashed outline for lines and polygon borders
        map.addLayer({
            id: lineId,
            type: 'line',
            source: sourceId,
            filter: [
                'in',
                ['geometry-type'],
                ['literal', ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString']],
            ],
            paint: {
                'line-color': PROJECT_COLOR,
                'line-width': 1,
                'line-dasharray': [4, 4],
            },
            slot: 'middle',
        });

        // Point circle — features without a label
        map.addLayer({
            id: pointId,
            type: 'circle',
            source: sourceId,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['!', ['has', 'odoo_user_label']],
            ],
            paint: {
                'circle-radius': 6,
                'circle-color': PROJECT_COLOR,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
            },
            slot: 'middle',
        });

        // Label anchor circle — points that carry a text label
        map.addLayer({
            id: anchorId,
            type: 'circle',
            source: sourceId,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['has', 'odoo_user_label'],
            ],
            paint: {
                'circle-radius': LABEL_POINT_STYLE.SIZE,
                'circle-color': PROJECT_COLOR,
                'circle-stroke-color': LABEL_POINT_STYLE.STROKE_COLOR,
                'circle-stroke-width': 2,
            },
            slot: 'middle',
        });

        // Label text — slot 'top' so it floats above all geometry
        map.addLayer({
            id: symbolId,
            type: 'symbol',
            source: sourceId,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['has', 'odoo_user_label'],
            ],
            layout: {
                'text-field': ['get', 'odoo_user_label'],
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-size': 12,
                'text-offset': [0, 0.4],
                'text-anchor': 'top',
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: {
                'text-color': PROJECT_COLOR,
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
            },
            slot: 'top',
        });
    }

    /**
     * Skip project context layers when tearing down task layers.
     *
     * The base `removeMapLayers()` removes every custom layer it finds,
     * which would silently destroy the project overlay layers.  Those layers
     * are managed exclusively by `_renderProjectGeoJsonLayer()` and
     * `_cleanUpProjectGeoJsonLayers()` — they should survive normal
     * `updateMap()` cycles and only be torn down on component unmount or when
     * the project set changes.
     * @override
     */
    removeMapLayers() {
        if (!this.isMapboxReady() || !this.mapBoxGlJs) return;
        this.removeFeatureInteractions();
        const { layers } = this._getCustomMapData();
        if (Array.isArray(layers) && layers.length > 0) {
            for (const layer of layers) {
                if (!this.projectLayerIds.has(layer.id)) {
                    this._removeMapLayer(layer);
                }
            }
        }
    }

    /**
     * Add all geometry layers then overlay the project context layers.
     * @override
     */
    addGeometryLayers() {
        super.addGeometryLayers();
        this._renderProjectGeoJsonLayer();
    }

    /**
     * Tear down project context layers before the base class cleans up the
     * rest of the map, ensuring no orphaned sources remain.
     * @override
     */
    cleanUp() {
        this._cleanUpProjectGeoJsonLayers();
        this.projectGeoJson.clear();
        this.projectLayerIds.clear();
        super.cleanUp();
    }
}
