import { MapboxGlGeolocateRenderer } from '@web_view_mapbox_gl_geolocate/views/mapbox_gl_geolocate/mapbox_gl_geolocate_renderer';
import { MapboxGlContactSidebar } from './mapbox_gl_geolocate_sidebar';

export class MapboxGlContactRenderer extends MapboxGlGeolocateRenderer {
    static templatePopupContent = 'contacts_mapbox_gl.PopupContent';
    static components = {
        ...MapboxGlGeolocateRenderer.components,
        Sidebar: MapboxGlContactSidebar,
    };

    /**
     * @override
     */
    get sidebarProps() {
        return Object.assign({}, super.sidebarProps, { fieldAvatar: this.props.archInfo.sidebarAvatarField });
    }

    /**
     * @override
     */
    prepareMarkerPopupData(data, feature) {
        const popupData = super.prepareMarkerPopupData(data, feature);
        const { sidebarAvatarField } = this.props.archInfo;
        if (sidebarAvatarField && this.props.list?.resModel && data && data.resId) {
            popupData.avatarUrl = `/web/image/${this.props.list.resModel}/${data.resId}/${sidebarAvatarField}`;
        }
        return popupData;
    }
}
