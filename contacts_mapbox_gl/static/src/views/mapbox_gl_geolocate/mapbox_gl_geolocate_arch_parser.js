import { MapboxGlGeolocateArchParser } from '@web_view_mapbox_gl_geolocate/views/mapbox_gl_geolocate/mapbox_gl_geolocate_arch_parser';

export class MapboxGlContactArchParser extends MapboxGlGeolocateArchParser {
    /**
     * @override
     * @param {*} xmlDoc
     * @param {*} node
     * @param {*} attrs
     */
    parseMapboxGlAttrs(xmlDoc, node, attrs) {
        super.parseMapboxGlAttrs(xmlDoc, node, attrs);

        const sidebarAvatarField = node.getAttribute('sidebar_avatar');
        attrs.sidebarAvatarField = sidebarAvatarField;
    }
}
