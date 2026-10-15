import { _t } from '@web/core/l10n/translation';
import { MapboxGlDrawController } from '@web_view_mapbox_gl_draw/views/mapbox_gl/mapbox_gl_controller';

export class MapboxGlDrawContactAreaController extends MapboxGlDrawController {
    openGeoJSONUploadWizard() {
        this.model.action.doAction({
            name: _t('Import GeoJSON'),
            type: 'ir.actions.act_window',
            res_model: 'geojson.upload.wizard',
            views: [[false, 'form']],
            target: 'new',
            context: {
                default_target_model: this.props.resModel,
            },
        });
    }
}
