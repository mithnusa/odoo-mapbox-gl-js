import { registry } from '@web/core/registry';
import { mapboxGlGeolocateView } from '@web_view_mapbox_gl_geolocate/views/mapbox_gl_geolocate/mapbox_gl_geolocate_view';

import { MapboxGlContactArchParser } from './mapbox_gl_geolocate_arch_parser';
import { MapboxGlContactRenderer } from './mapbox_gl_geolocate_renderer';
import { MapboxGlContactsController } from './mapbox_gl_geolocate_controller';

export const mapboxGlGeolocateContactsView = {
    ...mapboxGlGeolocateView,
    ArchParser: MapboxGlContactArchParser,
    Renderer: MapboxGlContactRenderer,
    Controller: MapboxGlContactsController,
};

registry.category('views').add('mapbox_gl_geolocate_contacts', mapboxGlGeolocateContactsView);
