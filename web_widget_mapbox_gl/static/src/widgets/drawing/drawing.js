import { _t } from '@web/core/l10n/translation';
import { registry } from '@web/core/registry';
import { standardFieldProps } from '@web/views/fields/standard_field_props';
import { signal, t, useProps } from '@odoo/owl';
import { useSubEnv } from '@web/owl2/utils';

import { MapboxGlSearch } from '@base_mapbox_gl/components/mapbox_search/mapbox_search';
import { BaseMapboxGlComponent } from '@base_mapbox_gl/utils/base_mapbox_gl';
import { MAPBOX_CONFIG, TURF_CONFIG } from '@base_mapbox_gl/utils/utils';

import { MapboxGlDrawing } from '../components/drawing-tools/drawing-tools';

export class MapboxGlDrawingField extends BaseMapboxGlComponent {
    static template = 'web_widget_mapbox_gl.DrawingField';
    static components = {
        Drawing: MapboxGlDrawing,
        Search: MapboxGlSearch,
    };
    static propsSchema = {
        ...standardFieldProps,
        areaField: t.string().optional(),
        defaultCenter: t.array().optional(),
        mapStyleUrl: t.string().optional(),
        mapProjection: t.string().optional(),
    };
    props = useProps(this.constructor.propsSchema);

    setup() {
        super.setup();
        this.validatePropsOptions();
        this.mapRef = signal.ref();

        useSubEnv({
            getIsMapReady: this.isMapboxReady.bind(this),
            isMapLoaded: () => this.mapboxState.isMapLoaded,
            getMapbox: () => this.mapBoxGlJs,
            notificationService: this.notificationService,
            getContainerElement: () => this.containerElement(),
        });
    }

    get enableTerrainToggle() {
        return true;
    }

    get mapControlPosition() {
        return Object.assign({}, super.mapControlPosition, {
            fullscreen: 'bottom-left',
            navigation: 'bottom-left',
            pitchToggle: 'bottom-left',
            terrain: 'bottom-left',
            globeToggle: 'bottom-left',
        });
    }

    validatePropsOptions() {
        const { areaField, defaultCenter, mapStyleUrl } = this.props;
        if (defaultCenter) {
            if (
                !Array.isArray(defaultCenter) ||
                defaultCenter.length !== 2 ||
                !defaultCenter.every((coord) => typeof coord === 'number')
            ) {
                throw new Error(
                    'Invalid widget "mapbox_gl_drawing" option: "default_center". It should be an array of two numbers [lng, lat].'
                );
            }
        }
        if (mapStyleUrl) {
            if (typeof mapStyleUrl !== 'string' || !mapStyleUrl.startsWith('mapbox://')) {
                throw new Error(
                    'Invalid widget "mapbox_gl_drawing" option: "map_style_url". It should be a valid Mapbox style URL starting with "mapbox://".'
                );
            }
        }
        if (areaField) {
            const fieldNames = this.props.record.fieldNames;
            if (typeof areaField !== 'string' || areaField.trim() === '' || !fieldNames.includes(areaField)) {
                throw new Error(
                    'Invalid widget "mapbox_gl_drawing" option: "field_area". It should be a non-empty string representing a field name. Ensure the field exists in the model and is included in the view.'
                );
            }
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

    async handleSave(features, totalArea) {
        if (features) {
            const values = {
                [this.props.name]: features,
            };

            if (this.props.areaField) {
                values[this.props.areaField] = totalArea || 0;
            }

            try {
                await this.props.record.update(values);
            } catch {
                this.notificationService.add(_t('Failed to save shape changes'), { type: 'danger' });
            }
        }
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

    get geoJson() {
        return this.getGeoJson();
    }

    get defaultMapStyle() {
        return this.props.mapStyleUrl || null;
    }

    get defaultMapProjection() {
        return this.props.mapProjection || null;
    }
}

export const mapboxGlDrawingField = {
    component: MapboxGlDrawingField,
    displayName: _t('Mapbox Draw'),
    supportedTypes: ['json'],
    extractProps: ({ options }) => ({
        areaField: options?.field_area,
        defaultCenter: options?.default_center,
        mapStyleUrl: options?.map_style_url,
        mapProjection: options?.map_projection,
    }),
};

registry.category('fields').add('mapbox_gl_draw_geojson', mapboxGlDrawingField);
