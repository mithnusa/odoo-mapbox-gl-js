import { _t } from '@web/core/l10n/translation';
import { BaseMapboxGlController } from '@web_view_base_mapbox_gl/map_base/map_base_controller';

export class MapboxGlDrawController extends BaseMapboxGlController {
    /**
     * Get the configuration for the Mapbox GL JS view.
     * @override
     * @returns {Object} The configuration for the Mapbox GL JS view.
     */
    get viewMapConfig() {
        const baseConfig = super.viewMapConfig;
        const { geoJsonField } = this.archInfo;

        if (this.props.fields[geoJsonField] === undefined || geoJsonField === undefined) {
            throw new Error(`GeoJSON field "${geoJsonField}" is not found. Please check your view definition.`);
        }

        if (this.props.fields[geoJsonField].type !== 'json') {
            throw new Error(`Field "${geoJsonField}" must be of type "json". Please check your view definition.`);
        }

        return {
            ...baseConfig,
            geoJsonField,
        };
    }
}
