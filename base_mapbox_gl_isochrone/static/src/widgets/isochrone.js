import { _t } from '@web/core/l10n/translation';
import { registry } from '@web/core/registry';
import { user } from '@web/core/user';
import { debounce } from '@web/core/utils/timing';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { onWillUpdateProps, signal, useProps, t } from '@odoo/owl';

import { MapboxGlSearch } from '@base_mapbox_gl/components/mapbox_search/mapbox_search';
import { BaseMapboxGlComponent } from '@base_mapbox_gl/utils/base_mapbox_gl';
import { MAPBOX_CONFIG, TURF_CONFIG } from '@base_mapbox_gl/utils/utils';
import { MEASUREMENT_CONFIG } from '@web_view_base_mapbox_gl/map_base/utils';
import { formatAreaMeasurement, formatLengthMeasurement } from '@web_view_mapbox_gl_draw/views/mapbox_gl/utils';

const ISOCHRONE_ID = 'isochrone';
const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

/**
 * Call `callback([lng, lat])` for every position of any GeoJSON coordinates
 * array (Point, LineString, Polygon, MultiPolygon, ...).
 */
function forEachPosition(coordinates, callback) {
    if (typeof coordinates[0] === 'number') {
        callback(coordinates);
    } else {
        coordinates.forEach((coords) => forEachPosition(coords, callback));
    }
}

export class MapboxIsochroneField extends BaseMapboxGlComponent {
    static template = 'base_mapbox_gl_isochrone.GeoJsonIsochroneField';
    static components = {
        Search: MapboxGlSearch,
    };
    static propsSchema = {
        ...standardFieldProps,
        mapStyleUrl: t.string().optional(true),
        latField: t.string().optional(true),
        lonField: t.string().optional(true),
    };
    props = useProps(this.constructor.propsSchema);

    setup() {
        super.setup();
        this.validatePropsOptions();
        this.mapRef = signal.ref();
        this.debounceRenderGeoJsonIsochrone = debounce(this.renderGeoJsonIsochrone.bind(this), 300);

        onWillUpdateProps(() => {
            this.debounceRenderGeoJsonIsochrone();
        });
    }

    validatePropsOptions() {
        const { mapStyleUrl, latField, lonField } = this.props;
        if (mapStyleUrl) {
            if (typeof mapStyleUrl !== 'string' || !mapStyleUrl.startsWith('mapbox://')) {
                throw new Error(
                    'Invalid widget "mapbox_gl_draw_isochrone" option: "map_style_url". It should be a valid Mapbox style URL starting with "mapbox://".'
                );
            }
        }

        const fieldNames = this.props.record.fieldNames;
        if (latField && !fieldNames.includes(latField)) {
            throw new Error(
                'Invalid widget "mapbox_gl_draw_isochrone" option: "latField". It should be a string of field name. It should also exist in the record field names.'
            );
        }
        if (lonField && !fieldNames.includes(lonField)) {
            throw new Error(
                'Invalid widget "mapbox_gl_draw_isochrone" option: "lonField". It should be a string of field name. It should also exist in the record field names.'
            );
        }
    }

    /**
     * @override
     * @returns {boolean}
     */
    checkAssetsLoaded() {
        return super.checkAssetsLoaded() && !!window.MapboxDraw && !!window.turf;
    }

    /**
     * @override
     * @returns {Array <string>}
     */
    assetJS() {
        const assetJs = super.assetJS();
        assetJs.add(
            `https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v${MAPBOX_CONFIG.MAPBOX_DRAW_VERSION}/mapbox-gl-draw.js`
        );
        assetJs.add(`https://unpkg.com/@turf/turf@${TURF_CONFIG.VERSION}/turf.min.js`);
        return assetJs;
    }

    /**
     * @override
     * @returns {Array <string>}
     */
    assetCSS() {
        const assetCss = super.assetCSS();
        assetCss.add(
            `https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v${MAPBOX_CONFIG.MAPBOX_DRAW_VERSION}/mapbox-gl-draw.css`
        );
        return assetCss;
    }

    getGeoJson(props) {
        const dataProps = props === undefined ? this.props : props;
        const value = dataProps.record.data[this.props.name];
        if (!value) return {};
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return parsed;
        } catch {
            return {};
        }
    }

    /**
     * Format a measurement in both unit systems with one of the suite's
     * formatters (they share the (value, locale, decimals, unitSystem)
     * signature).
     * @returns {{metric: string, imperial: string}}
     */
    _formatMeasurement(formatter, value) {
        const lang = user.context.lang;
        return {
            metric: formatter(value, lang),
            imperial: formatter(value, lang, 2, MEASUREMENT_CONFIG.UNITS.IMPERIAL),
        };
    }

    /**
     * Total area of the isochrone zone, formatted for display in metric
     * (m², ha or km²) and imperial (ft², ac or mi²) units.
     * Turf computes a geodesic approximation in m², summed over all features.
     * Memoized on the field value: turf is only run when the zone changes.
     * @returns {{metric: string, imperial: string}|false} false when there is no zone to measure
     */
    get isochroneArea() {
        if (!window.turf) return false;

        const value = this.props.record.data[this.props.name];
        if (value !== this._areaValue) {
            this._areaValue = value;
            this._areaLabel = this._computeAreaLabel();
        }
        return this._areaLabel;
    }

    _computeAreaLabel() {
        const geoJson = this.getGeoJson();
        if (geoJson?.type !== 'FeatureCollection' || !geoJson.features?.length) return false;
        try {
            const areaM2 = window.turf.area(geoJson);
            return areaM2 > 0 ? this._formatMeasurement(formatAreaMeasurement, areaM2) : false;
        } catch {
            // malformed geometry: show no area rather than break the field
            return false;
        }
    }

    /**
     * Farthest distance from the record's location to the edge of the zone,
     * formatted for display in metric (m or km) and imperial (ft, yd or mi)
     * units. Measured from the location currently on the record, so it is
     * only meaningful while the zone is up to date.
     * Memoized on the field value and the location.
     * @returns {{metric: string, imperial: string}|false} false when there is no zone or no location
     */
    get isochroneReach() {
        if (!window.turf) return false;

        const origin = this._getOrigin();
        const value = this.props.record.data[this.props.name];
        const originKey = origin ? origin.join() : '';
        if (value !== this._reachValue || originKey !== this._reachOriginKey) {
            this._reachValue = value;
            this._reachOriginKey = originKey;
            this._reachLabel = origin ? this._computeReachLabel(origin) : false;
        }
        return this._reachLabel;
    }

    _computeReachLabel(origin) {
        const geoJson = this.getGeoJson();
        if (geoJson?.type !== 'FeatureCollection') return false;
        try {
            let maxKm = 0;
            for (const feature of geoJson.features || []) {
                if (!feature.geometry?.coordinates) continue;
                forEachPosition(feature.geometry.coordinates, (position) => {
                    maxKm = Math.max(maxKm, window.turf.distance(origin, position));
                });
            }
            return maxKm > 0 ? this._formatMeasurement(formatLengthMeasurement, maxKm) : false;
        } catch {
            // malformed geometry: show no reach rather than break the field
            return false;
        }
    }

    /**
     * @override
     * @returns {Object} Mapbox map options
     */
    mapOptions() {
        const options = super.mapOptions();
        const defaultCenter = this.props.defaultCenter;
        if (defaultCenter && Array.isArray(defaultCenter) && defaultCenter.length === 2) {
            options.center = defaultCenter;
        }

        options.cooperativeGestures = true;
        return options;
    }

    /**
     * @override
     */
    get containerElement() {
        return this.mapRef;
    }

    get defaultMapStyle() {
        return this.props.mapStyleUrl || null;
    }

    onMapLoaded() {
        super.onMapLoaded();
        this.debounceRenderGeoJsonIsochrone();
    }

    renderGeoJsonIsochrone() {
        const map = this.mapBoxGlJs;
        if (!map) return;

        const value = this.props.record.data[this.props.name];
        const hasChanged = value !== this._renderedValue;
        const parsed = this.getGeoJson();
        const data = parsed?.type === 'FeatureCollection' ? parsed : EMPTY_FEATURE_COLLECTION;

        const source = map.getSource(ISOCHRONE_ID);
        if (!source) {
            map.addSource(ISOCHRONE_ID, { type: 'geojson', data });
        } else if (hasChanged) {
            source.setData(data);
        }

        if (!map.getLayer(ISOCHRONE_ID)) {
            map.addLayer({
                id: ISOCHRONE_ID,
                type: 'fill',
                source: ISOCHRONE_ID,
                slot: 'middle',
                paint: {
                    'fill-color': '#f04c4c',
                    'fill-opacity': 0.3,
                    'fill-outline-color': '#d10404',
                },
            });
        }

        // Only move the camera when the isochrone itself changed, so panning
        // is not overridden by unrelated record updates or style switches.
        if (hasChanged) {
            this._renderedValue = value;
            this._fitToGeoJson(map, data);
        }
        this._renderMarker(map);
    }

    _fitToGeoJson(map, geoJson) {
        const bounds = new window.mapboxgl.LngLatBounds();
        for (const feature of geoJson.features) {
            if (feature.geometry?.coordinates) {
                forEachPosition(feature.geometry.coordinates, (position) => bounds.extend(position));
            }
        }
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 20, maxZoom: 16 });
        }
    }

    /**
     * The record's location, i.e. the point the isochrone is computed around.
     * @returns {number[]|null} [lng, lat], or null when it is not set
     */
    _getOrigin() {
        const { latField, lonField, record } = this.props;
        if (!latField || !lonField) return null;

        const lng = Number(record.data[lonField]);
        const lat = Number(record.data[latField]);
        // Odoo unset floats are 0, so (0, 0) means "no origin".
        return Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? [lng, lat] : null;
    }

    _renderMarker(map) {
        const origin = this._getOrigin();
        if (!origin) {
            this.marker?.remove();
            this.marker = null;
            return;
        }
        if (this.marker) {
            this.marker.setLngLat(origin);
        } else {
            this.marker = new window.mapboxgl.Marker({ color: '#314ccd' }).setLngLat(origin).addTo(map);
        }
    }

    cleanUp() {
        // A pending debounced render would otherwise run against a removed map.
        this.debounceRenderGeoJsonIsochrone.cancel();
        if (this.marker) {
            this.marker.remove();
            this.marker = null;
        }
        if (this.mapBoxGlJs) {
            if (this.mapBoxGlJs.getLayer(ISOCHRONE_ID)) {
                this.mapBoxGlJs.removeLayer(ISOCHRONE_ID);
            }
            if (this.mapBoxGlJs.getSource(ISOCHRONE_ID)) {
                this.mapBoxGlJs.removeSource(ISOCHRONE_ID);
            }
        }
        super.cleanUp();
    }
}

export const mapboxIsochroneField = {
    component: MapboxIsochroneField,
    displayName: _t('Mapbox Isochrone'),
    supportedTypes: ['json'],
    extractProps: ({ options }) => ({
        mapStyleUrl: options?.map_style_url,
        latField: options?.field_lat,
        lonField: options?.field_lon,
    }),
};

registry.category('fields').add('mapbox_gl_draw_isochrone', mapboxIsochroneField);
