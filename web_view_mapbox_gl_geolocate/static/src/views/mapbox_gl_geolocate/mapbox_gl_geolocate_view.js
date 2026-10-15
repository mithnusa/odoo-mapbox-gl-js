import { registry } from '@web/core/registry';
import { baseMapboxGlView } from '@web_view_base_mapbox_gl/map_base/map_base_view';

import { MapboxGlGeolocateArchParser } from './mapbox_gl_geolocate_arch_parser';
import { MapboxGlGeolocateController } from './mapbox_gl_geolocate_controller';
import { MapboxGlGeolocateRenderer } from './mapbox_gl_geolocate_renderer';

export const mapboxGlGeolocateView = {
    ...baseMapboxGlView,
    ArchParser: MapboxGlGeolocateArchParser,
    Controller: MapboxGlGeolocateController,
    Renderer: MapboxGlGeolocateRenderer,
};

registry.category('views').add('mapbox_gl_geolocate', mapboxGlGeolocateView);
