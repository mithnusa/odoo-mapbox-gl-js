import { exprToBoolean } from '@web/core/utils/strings';
import { BaseMapboxGlArchParser } from '@web_view_base_mapbox_gl/map_base/map_base_arch_parser';

export class MapboxGlGeolocateArchParser extends BaseMapboxGlArchParser {
    parseMapboxGlAttrs(xmlDoc, node, attrs) {
        super.parseMapboxGlAttrs(xmlDoc, node, attrs);
        attrs.lngField = node.getAttribute('lng_field') || null;
        attrs.latField = node.getAttribute('lat_field') || null;
        attrs.enableHeatmap = exprToBoolean(node.getAttribute('enable_heatmap'), false);
        attrs.enableClustering = exprToBoolean(node.getAttribute('enable_clustering'), false);
        attrs.__geoColor = node.getAttribute('color_field') || null;
    }
}
