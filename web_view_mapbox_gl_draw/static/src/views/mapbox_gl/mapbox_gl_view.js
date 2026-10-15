import { registry } from '@web/core/registry';
import { baseMapboxGlView } from '@web_view_base_mapbox_gl/map_base/map_base_view';

import { MapboxGlDrawArchParser } from './mapbox_gl_arch_parser';
import { MapboxGlDrawController } from './mapbox_gl_controller';
import { MapboxGlDrawRenderer } from './mapbox_gl_renderer';
import { MapboxGlDrawModel } from './mapbox_gl_model';

export const mapboxGlDrawView = {
    ...baseMapboxGlView,
    ArchParser: MapboxGlDrawArchParser,
    Controller: MapboxGlDrawController,
    Renderer: MapboxGlDrawRenderer,
    Model: MapboxGlDrawModel,
};

registry.category('views').add('mapbox_gl_draw', mapboxGlDrawView);
