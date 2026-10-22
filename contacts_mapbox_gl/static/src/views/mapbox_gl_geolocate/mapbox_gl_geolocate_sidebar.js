import { t } from '@odoo/owl';
import { BaseMapboxGlSidebar } from '@web_view_base_mapbox_gl/map_base/map_base_sidebar';

export class MapboxGlContactSidebar extends BaseMapboxGlSidebar {
    static propsSchema = {
        ...BaseMapboxGlSidebar.propsSchema,
        fieldAvatar: t.string().optional(),
    };
    static recordItemTemplate = 'contacts_mapbox_gl.RecordItemAvatar';

    getAvatarUrl(record) {
        if (!this.props.fieldAvatar) {
            return null;
        }
        const avatarUrl = `/web/image/${record.resModel}/${record.resId}/${this.props.fieldAvatar}`;
        return avatarUrl;
    }
}
