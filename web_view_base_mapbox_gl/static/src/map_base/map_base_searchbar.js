import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { SearchBarMenu } from '@web/search/search_bar_menu/search_bar_menu';
import { SearchBar } from '@web/search/search_bar/search_bar';

export class MapboxGlSearchBarMenu extends SearchBarMenu {
    /**
     * @override
     */
    setup() {
        super.setup();
        this.notificationService = useService('notification');
    }

    /**
     * @override
     */
    onGroupBySelected() {
        super.onGroupBySelected(...arguments);
        let number_of_active_groups = 0;
        this.groupByItems.forEach((value) => {
            if (value.isActive) {
                number_of_active_groups++;
            }
        });
        if (number_of_active_groups > 1) {
            this.notificationService.add(_t('Only one active group is allowed at a time.'), {
                type: 'info',
            });
        }
    }
}

export class MapboxGlSearchBar extends SearchBar {
    static components = {
        ...SearchBar.components,
        SearchBarMenu: MapboxGlSearchBarMenu,
    };
}
