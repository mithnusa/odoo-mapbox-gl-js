import { registry } from '@web/core/registry';
import { mapboxGlDrawView } from '@web_view_mapbox_gl_draw/views/mapbox_gl/mapbox_gl_view';
import { MapboxGlRendererProjectProject, MapboxGlRendererProjectTask } from './mapbox_gl_renderer';

export const mapboxGlDrawViewProjectProject = {
    ...mapboxGlDrawView,
    Renderer: MapboxGlRendererProjectProject,
};

export const mapboxGlDrawViewProjectTask = {
    ...mapboxGlDrawView,
    Renderer: MapboxGlRendererProjectTask,
};

registry.category('views').add('mapbox_gl_draw_project', mapboxGlDrawViewProjectProject);

registry.category('views').add('mapbox_gl_draw_project_task', mapboxGlDrawViewProjectTask);
