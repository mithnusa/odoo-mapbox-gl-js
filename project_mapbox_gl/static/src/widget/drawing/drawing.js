import { _t } from '@web/core/l10n/translation';
import { registry } from '@web/core/registry';
import { MapboxGlDrawingField, mapboxGlDrawingField } from '@web_widget_mapbox_gl/widgets/drawing/drawing';
import { LABEL_POINT_STYLE } from '@web_view_base_mapbox_gl/map_base/utils';

const PROJECT_GEOJSON_FIELD = 'mapbox_project_geojson';

const PROJECT_SOURCE_ID = 'project-project-geojson-source';
const PROJECT_FILL_LAYER_ID = 'project-project-geojson-fill-layer';
const PROJECT_LINE_LAYER_ID = 'project-project-geojson-line-layer';
const PROJECT_POINT_LAYER_ID = 'project-project-geojson-point-layer';
const PROJECT_POINT_LABEL_LAYER_ID = 'project-project-geojson-point-label-layer';
const PROJECT_LABEL_LAYER_ID = 'project-project-geojson-label-layer';
const PROJECT_COLOR = '#ff6a00';

/**
 * Drawing field widget for `project.task` form views.
 *
 * Extends the base drawing widget to overlay the parent project's stored
 * GeoJSON as a read-only context layer beneath the task's own editable
 * geometry. The map is also pre-centred and bounded to the project's
 * geographic extent when it first loads.
 */
export class MapboxGlDrawingFieldProjectTask extends MapboxGlDrawingField {
    /**
     * Extend the base map options with bounds derived from the parent
     * project's GeoJSON so the initial viewport frames the project area.
     * Falls back to the base options when the project has no geometry.
     * @override
     * @returns {Object} Mapbox GL map initialisation options
     */
    mapOptions() {
        const options = super.mapOptions();
        const { maxBounds, bboxCenter } = this.projectGeoJsonBbox;
        if (maxBounds) {
            options.bounds = maxBounds;
            options.fitBoundsOptions = {
                padding: 100,
                maxZoom: 15,
            };
        }
        if (bboxCenter) {
            options.center = bboxCenter;
        }
        return options;
    }

    /**
     * After the map finishes loading, render the parent project context layer.
     * @override
     */
    onMapLoaded() {
        super.onMapLoaded();
        this.renderProjectGeoJsonLayer();
    }

    /**
     * Add (or refresh) the parent project's read-only geometry overlay.
     *
     * If the GeoJSON source already exists the data is updated in place and
     * the method returns early — layers are only added once to avoid
     * duplicate layer errors on prop updates.
     *
     * Five layers are added in draw order (bottom → top):
     * 1. Polygon fill (15 % opacity)
     * 2. Dashed outline for polygons and lines
     * 3. Plain circle for non-label points
     * 4. Smaller anchor circle for label annotation points
     * 5. Symbol layer for label text
     *
     * All geometry uses `PROJECT_COLOR` to visually distinguish the project
     * boundary from the task's own data-driven colours.
     */
    renderProjectGeoJsonLayer() {
        const geoJson = this.projectGeoJson;
        if (!this.mapBoxGlJs || !geoJson?.features?.length) {
            return;
        }
        const map = this.mapBoxGlJs;

        // If source already exists, refresh data and leave layers intact
        if (map.getSource(PROJECT_SOURCE_ID)) {
            map.getSource(PROJECT_SOURCE_ID).setData(geoJson);
            return;
        }

        map.addSource(PROJECT_SOURCE_ID, {
            type: 'geojson',
            data: geoJson,
        });

        // Polygon fill
        map.addLayer({
            id: PROJECT_FILL_LAYER_ID,
            type: 'fill',
            source: PROJECT_SOURCE_ID,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
            paint: {
                'fill-color': PROJECT_COLOR,
                'fill-opacity': 0.15,
            },
            slot: 'middle',
        });

        // Dashed outline for polygon borders and lines
        map.addLayer({
            id: PROJECT_LINE_LAYER_ID,
            type: 'line',
            source: PROJECT_SOURCE_ID,
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

        // Plain point circle — features without a label property
        map.addLayer({
            id: PROJECT_POINT_LAYER_ID,
            type: 'circle',
            source: PROJECT_SOURCE_ID,
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
            id: PROJECT_POINT_LABEL_LAYER_ID,
            type: 'circle',
            source: PROJECT_SOURCE_ID,
            filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
                ['has', 'odoo_user_label'],
            ],
            paint: {
                'circle-radius': LABEL_POINT_STYLE.SIZE,
                'circle-color': PROJECT_COLOR,
                'circle-stroke-width': 2,
                'circle-stroke-color': LABEL_POINT_STYLE.STROKE_COLOR,
            },
            slot: 'middle',
        });

        // Label text for annotation points
        map.addLayer({
            id: PROJECT_LABEL_LAYER_ID,
            type: 'symbol',
            source: PROJECT_SOURCE_ID,
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
     * Parse the parent project's GeoJSON from the related field on the record.
     *
     * Accepts an optional `props` argument so callers that hold a reference to
     * incoming next-props (e.g. `onWillUpdateProps`) can read the future value
     * without waiting for `this.props` to update. Defaults to `this.props` when
     * omitted.
     *
     * Returns `null` when the field is empty or the value cannot be parsed,
     * so callers can distinguish "no data" from "empty FeatureCollection".
     *
     * @param {Object} [props] - Optional props to read from; defaults to `this.props`
     * @returns {Object|null} Parsed GeoJSON object, or `null` on failure
     */
    getProjectGeoJson(props) {
        const dataProps = props ?? this.props;
        const value = dataProps.record.data[PROJECT_GEOJSON_FIELD];
        if (!value) return null;
        try {
            return typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
            console.warn('Failed to parse project GeoJSON field value', e);
            return null;
        }
    }

    /**
     * Compute the Turf.js bounding box and centre point for the parent
     * project's GeoJSON. Used by {@link mapOptions} to set the initial
     * viewport.
     *
     * Returns an empty object when the project has no features so that
     * callers can safely destructure without an explicit null check.
     *
     * @returns {{ bbox: Array, bboxCenter: Array, maxBounds: Array }|{}}
     */
    get projectGeoJsonBbox() {
        const geoJson = this.projectGeoJson;
        if (geoJson?.features?.length > 0) {
            const bbox = window.turf.bbox(geoJson);
            const bboxCenter = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
            const maxBounds = [
                [bbox[0], bbox[1]], // southwest
                [bbox[2], bbox[3]], // northeast
            ];
            return { bbox, bboxCenter, maxBounds };
        }
        return {};
    }

    /**
     * Convenience getter that returns the parsed parent project GeoJSON for
     * the current props. Returns `null` when no data is available.
     * @returns {Object|null}
     */
    get projectGeoJson() {
        return this.getProjectGeoJson();
    }

    /**
     * Remove all project context layers and their shared source from the map,
     * then delegate to the base class for cleanup of the task's own geometry.
     *
     * Layers are removed in reverse add order (top → bottom) before the source
     * is removed, which is required by Mapbox GL JS.
     * @override
     */
    cleanUp() {
        const map = this.mapBoxGlJs;
        if (map) {
            for (const layerId of [
                PROJECT_LABEL_LAYER_ID,
                PROJECT_POINT_LABEL_LAYER_ID,
                PROJECT_POINT_LAYER_ID,
                PROJECT_LINE_LAYER_ID,
                PROJECT_FILL_LAYER_ID,
            ]) {
                if (map.getLayer(layerId)) map.removeLayer(layerId);
            }
            if (map.getSource(PROJECT_SOURCE_ID)) {
                map.removeSource(PROJECT_SOURCE_ID);
            }
        }
        super.cleanUp();
    }
}

export const mapboxGlDrawingFieldProjectTask = {
    ...mapboxGlDrawingField,
    component: MapboxGlDrawingFieldProjectTask,
    displayName: _t('Mapbox Draw Project Task'),
};

registry.category('fields').add('mapbox_gl_draw_geojson_project_task', mapboxGlDrawingFieldProjectTask);
