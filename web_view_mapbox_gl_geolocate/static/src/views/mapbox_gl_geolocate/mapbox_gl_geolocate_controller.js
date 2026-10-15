import { BaseMapboxGlController } from '@web_view_base_mapbox_gl/map_base/map_base_controller';

export class MapboxGlGeolocateController extends BaseMapboxGlController {
    /**
     * Get the configuration for the Mapbox GL JS view.
     * @override
     * @returns {Object} The configuration for the Mapbox GL JS view.
     */
    get viewMapConfig() {
        const baseConfig = super.viewMapConfig;
        const { lngField, latField, enableHeatmap, enableClustering } = this.archInfo;

        if (this.props.fields[lngField] === undefined || lngField === undefined) {
            throw new Error(`GeoJSON field "${lngField}" is not found. Please check your view definition.`);
        }

        if (this.props.fields[latField] === undefined || latField === undefined) {
            throw new Error(`GeoJSON field "${latField}" is not found. Please check your view definition.`);
        }

        return {
            ...baseConfig,
            latField,
            lngField,
            enableHeatmap,
            enableClustering,
        };
    }
}
