import { BaseMapboxGlArchParser } from '@web_view_base_mapbox_gl/map_base/map_base_arch_parser';

export class MapboxGlDrawArchParser extends BaseMapboxGlArchParser {
    parseMapboxGlAttrs(xmlDoc, node, attrs) {
        super.parseMapboxGlAttrs(xmlDoc, node, attrs);
        const geoJsonField = xmlDoc.getAttribute('geojson_field');
        attrs.geoJsonField = geoJsonField;
    }
}
