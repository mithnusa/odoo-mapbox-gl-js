import { t } from '@odoo/owl';
import { BaseMapboxGlSidebar } from '@web_view_base_mapbox_gl/map_base/map_base_sidebar';

export class MapboxGlDrawSidebarProjectProject extends BaseMapboxGlSidebar {
    static recordItemTemplate = 'project_mapbox_gl.RecordItem';
    static propsSchema = {
        ...BaseMapboxGlSidebar.propsSchema,
        onActionViewTask: t.function(),
    };
}
