import { MapboxGlGeolocateController } from '@web_view_mapbox_gl_geolocate/views/mapbox_gl_geolocate/mapbox_gl_geolocate_controller';

export class MapboxGlContactsController extends MapboxGlGeolocateController {
    /**
     * Get the configuration for the Mapbox GL JS view.
     * @override
     * @returns {Object} The configuration for the Mapbox GL JS view.
     */
    get viewMapConfig() {
        const baseConfig = super.viewMapConfig;
        const sidebarAvatarField = this.archInfo.sidebarAvatarField;
        if (sidebarAvatarField) {
            if (this.props.fields?.[sidebarAvatarField] === undefined) {
                throw new Error(
                    `Sidebar avatar field "${sidebarAvatarField}" is not found. Please check your view definition.`
                );
            } else {
                baseConfig.sidebarAvatarField = sidebarAvatarField;
            }
        }
        return { ...baseConfig };
    }
}
