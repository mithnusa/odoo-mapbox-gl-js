import { _t } from '@web/core/l10n/translation';
import { Component, t, useProps } from '@odoo/owl';
import { CheckBox } from '@web/core/checkbox/checkbox';
import { Field } from '@web/views/fields/field';
import { useService } from '@web/core/utils/hooks';

export class BaseMapboxGlSidebar extends Component {
    static template = 'web_view_base_mapbox_gl.Sidebar';
    static listGroupOrRecordTemplate = 'web_view_base_mapbox_gl.ListGroupOrRecord';
    static recordItemTemplate = 'web_view_base_mapbox_gl.RecordItem';
    static groupItemTemplate = 'web_view_base_mapbox_gl.GroupItem';
    static components = { CheckBox, Field };
    static propsSchema = {
        header: t.string(),
        title: t.string().optional(),
        unLocatedCount: t.number(),
        subTitle: t.string(),
        getGroupsOrRecords: t.function(),
        toggleGroup: t.function(),
        renderGroupedRecordsFitBounds: t.function(),
        openRecord: t.function(),
        showRecord: t.function(),
        showRecordsByDomain: t.function(),
        pointInMap: t.function(),
        deleteGroupRecords: t.function(),
        handleToggleSelection: t.function(),
        handleCanSelectRecord: t.boolean(),
        handleSelectAll: t.boolean(),
        handleToggleRecordSelection: t.function(),
        showUnlocatedRecords: t.function(),
        allowSelectors: t.boolean(),
        isGrouped: t.boolean(),
    };
    props = useProps(this.constructor.propsSchema);

    setup() {
        this.notificationService = useService('notification');
    }

    get datas() {
        return this.props.getGroupsOrRecords();
    }

    /**
     * Handles the collapse/expand of a group in the sidebar.
     * When expanding: loads group records if empty and centers the map on them.
     * When collapsing: removes group records from the map.
     * @param {Event} ev
     * @param {string} groupKey
     */
    async handleGroupCollapse(ev, groupKey) {
        try {
            const { group } = this.datas.find((data) => data.key === groupKey);
            if (!group) return;

            const isExpanding = !ev.currentTarget?.classList.contains('collapsed');
            if (isExpanding) {
                if (group.list.records.length === 0) {
                    await this.props.toggleGroup(group);
                }
                const datas = this.props.getGroupsOrRecords();
                const groupDatas = datas.filter((data) => data.key === groupKey);
                this.props.renderGroupedRecordsFitBounds(groupDatas);
            } else {
                const datas = this.props.getGroupsOrRecords();
                const groupDatas = datas.filter((data) => data.key === groupKey);
                this.props.deleteGroupRecords(groupDatas);
            }
        } catch (error) {
            console.error('Error in handleGroupCollapse: ', error);
            this.notificationService.add(_t('An error occurred while toggling the group.'), { type: 'warning' });
        }
    }

    selectRecord(record) {
        this.props.handleToggleRecordSelection(record, true);
    }

    actionShowGroupRecords(group) {
        const displayName = group.group.displayName || _t('None');
        const name = group.group.groupByLabel + ' > ' + displayName;
        const domain = group.group.groupDomain;
        this.props.showRecordsByDomain(name, domain);
    }
}
