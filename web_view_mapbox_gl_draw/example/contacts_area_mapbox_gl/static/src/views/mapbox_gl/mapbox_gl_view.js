import { registry } from '@web/core/registry';
import { mapboxGlDrawView } from '@web_view_mapbox_gl_draw/views/mapbox_gl/mapbox_gl_view';

import { MapboxGlDrawContactAreaController } from './mapbox_gl_controller';

export const mapboxGlDrawContactAreaView = {
    ...mapboxGlDrawView,
    Controller: MapboxGlDrawContactAreaController,
    buttonTemplate: 'contacts_area_mapbox_gl.MapboxGlViewContactArea.Buttons',
};

registry.category('views').add('mapbox_gl_draw_contacts_area', mapboxGlDrawContactAreaView);
