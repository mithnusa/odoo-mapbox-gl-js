import { registry } from '@web/core/registry';

import { BaseMapboxGlArchParser } from './map_base_arch_parser';
import { BaseMapboxGlModel } from './map_base_model';
import { BaseMapboxGlController } from './map_base_controller';
import { BaseMapboxGlRenderer } from './map_base_renderer';

export const baseMapboxGlView = {
    type: 'mapbox_gl',
    display_name: 'Mapbox',
    ArchParser: BaseMapboxGlArchParser,
    Controller: BaseMapboxGlController,
    Model: BaseMapboxGlModel,
    Renderer: BaseMapboxGlRenderer,
    buttonTemplate: 'web_view_base_mapbox_gl.BaseMapView.Buttons',

    props: (genericProps, view) => {
        const { ArchParser } = view;
        const { arch, relatedModels, resModel } = genericProps;
        const archInfo = new ArchParser().parse(arch, relatedModels, resModel);

        return {
            ...genericProps,
            Model: view.Model,
            Renderer: view.Renderer,
            buttonTemplate: view.buttonTemplate,
            archInfo,
        };
    },
};

registry.category('views').add('mapbox_gl', baseMapboxGlView);
