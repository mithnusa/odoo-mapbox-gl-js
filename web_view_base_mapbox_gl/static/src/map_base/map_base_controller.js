import { _t } from '@web/core/l10n/translation';
import { OfflinePlugin } from '@web/core/offline/offline_plugin';
import { Layout } from '@web/search/layout';
import { useModelWithSampleData } from '@web/model/model';
import { evaluateBooleanExpr } from '@web/core/py_js/py';
import { usePager } from '@web/search/pager_hook';
import { useService } from '@web/core/utils/hooks';
import { OfflineActionHelper } from '@web/views/offline_action_helper';
import { user } from '@web/core/user';
import { extractFieldsFromArchInfo } from '@web/model/relational_model/utils';
import { download } from '@web/core/network/download';
import { FormViewDialog } from '@web/views/view_dialogs/form_view_dialog';
import { omit } from '@web/core/utils/objects';
import { ActionMenus, STATIC_ACTIONS_GROUP_NUMBER } from '@web/search/action_menus/action_menus';
import { standardViewProps } from '@web/views/standard_view_props';
import { MultiRecordViewButton } from '@web/views/view_button/multi_record_view_button';
import { useSetupAction } from '@web/search/action_hook';
import { useViewButtons } from '@web/views/view_button/view_button_hook';
import { session } from '@web/session';
import { useSearchBarToggler } from '@web/search/search_bar/search_bar_toggler';
import { SelectionBox } from '@web/views/view_components/selection_box';
import { ViewButton } from '@web/views/view_button/view_button';
import { executeButtonCallback } from '@web/views/view_button/view_button_hook';
import { CogMenu } from '@web/search/cog_menu/cog_menu';
import { DropdownItem } from '@web/core/dropdown/dropdown_item';
import { useExportRecords, useDeleteRecords } from '@web/views/view_hook';
import { OfflineSearchBar } from '@web/search/search_bar/offline_search_bar';
import { MapboxGlSearchBar } from './map_base_searchbar';

import { Component, onWillStart, onWillPatch, usePlugin, proxy, signal, t, useProps } from '@odoo/owl';
import { render, useLayoutEffect, useSubEnv } from '@web/owl2/utils';

// Constants
const VIEW_TYPES = {
    MAPBOX_GL: 'mapbox_gl',
    FORM: 'form',
    LIST: 'list',
};

export class BaseMapboxGlController extends Component {
    static template = 'web_view_base_mapbox_gl.BaseMapView';
    static components = {
        Layout,
        ActionMenus,
        ViewButton,
        CogMenu,
        SelectionBox,
        MultiRecordViewButton,
        DropdownItem,
        OfflineActionHelper,
        OfflineSearchBar,
        SearchBar: MapboxGlSearchBar,
    };
    static propsSchema = {
        ...standardViewProps,
        Model: t.function(),
        Renderer: t.function(),
        buttonTemplate: t.string(),
        archInfo: t.object(),
        showButtons: t.boolean().optional(true),
        allowSelectors: t.boolean().optional(true),
        onSelectionChanged: t.function().optional(),
        readonly: t.boolean().optional(),
        createRecord: t.function().optional(() => () => {}),
        selectRecord: t.function().optional(() => () => {}),
    };
    props = useProps(this.constructor.propsSchema);

    setup() {
        this.uiService = useService('ui');
        this.dialogService = useService('dialog');
        this.actionService = useService('action');
        this.notificationService = useService('notification');

        this.rootRef = signal.ref();

        this.archInfo = this.props.archInfo;
        this.offlinePlugin = usePlugin(OfflinePlugin);
        this.activeActions = this.props.archInfo.activeActions;
        this.multiEdit = this.props.archInfo.multiEdit;
        this.optionalActiveFields = {};
        this.model = proxy(useModelWithSampleData(this.props.Model, this.modelParams, this.modelOptions));

        this.archiveEnabled =
            'active' in this.props.fields
                ? !this.props.fields.active.readonly
                : 'x_active' in this.props.fields
                  ? !this.props.fields.x_active.readonly
                  : false;

        onWillStart(async () => {
            this.isExportEnable = await user.hasGroup('base.group_allow_export');
        });

        useSubEnv({ model: this.model });

        useViewButtons(this.rootRef, {
            beforeExecuteAction: this.beforeExecuteActionButton.bind(this),
            afterExecuteAction: this.afterExecuteActionButton.bind(this),
            reload: () => this.model.load(),
        });

        useSetupAction({
            rootRef: this.rootRef,
            getLocalState: () => {
                return {
                    activeBars: this.progressBarState?.activeBars,
                    modelState: this.model.exportState(),
                };
            },
            getOrderBy: () => this.model.root.orderBy,
            getContext: () => {
                const optionalShow = Object.keys(this.optionalActiveFields).filter(
                    (name) => this.optionalActiveFields[name]
                );
                return optionalShow.length ? { list_optional_show: optionalShow } : {};
            },
            reload: () => this.model.load(),
        });

        usePager(() => {
            const { count, hasLimitedCount, isGrouped, limit, offset } = this.model.root;
            if (!isGrouped) {
                return {
                    offset: offset,
                    limit: limit,
                    total: count,
                    onUpdate: async ({ offset, limit }, hasNavigated) => {
                        await this.model.root.load({ limit, offset });
                        if (hasNavigated) {
                            this.onPageChange();
                        }
                    },
                    updateTotal: !isGrouped && hasLimitedCount ? () => this.model.root.fetchCount() : undefined,
                };
            }
        });

        useLayoutEffect(
            () => {
                this.onSelectionChanged();
            },
            () => [this.model.root.selection.length, this.model.root.isDomainSelected]
        );

        this.firstLoad = true;
        onWillPatch(() => {
            this.firstLoad = false;
        });
        this.searchBarToggler = useSearchBarToggler();

        this.exportRecords = useExportRecords(this.env, this.props.context, () => this.getExportableFields());

        this.deleteRecordsWithConfirmation = useDeleteRecords(this.model);
    }

    /**
     * Get model parameters for initialization
     * Extracts fields, groupBy info, and configuration from archInfo
     * @returns {Object} Model parameters with config, groupByInfo, limits, and hooks
     */
    get modelParams() {
        const { activeFields, fields } = extractFieldsFromArchInfo(this.archInfo, this.props.fields);

        const groupByInfo = {};
        if (this.archInfo.groupBy?.fields) {
            for (const fieldName in this.archInfo.groupBy.fields) {
                const fieldNodes = this.archInfo.groupBy.fields[fieldName].fieldNodes;
                const fields = this.archInfo.groupBy.fields[fieldName].fields;
                groupByInfo[fieldName] = extractFieldsFromArchInfo({ fieldNodes }, fields);
            }
        }

        const modelConfig = this.props.state?.modelState?.config || {
            resModel: this.props.resModel,
            fields,
            activeFields,
            openGroupsByDefault: false,
        };

        const viewConfig = this.viewMapConfig;
        return {
            config: modelConfig,
            state: this.props.state?.modelState,
            groupByInfo,
            limit: this.archInfo.limit || this.props.limit,
            countLimit: this.archInfo.countLimit,
            defaultOrderBy: this.archInfo.defaultOrder,
            defaultGroupBy: this.archInfo.defaultGroupBy,
            groupsLimit: this.archInfo.groupsLimit || Number.MAX_SAFE_INTEGER,
            multiEdit: !this.props.readonly && this.archInfo.multiEdit,
            activeIdsLimit: session.active_ids_limit,
            hooks: {
                onRecordSaved: this.onRecordSaved.bind(this),
                onWillSaveRecord: this.onWillSaveRecord.bind(this),
            },
            viewConfig,
        };
    }

    getExportableFields() {
        const { activeFields, fields } = this.model.root;
        // Columns currently visible in the view (not invisible and, if optional, toggled on).
        const visibleColumns = new Set(
            this.props.archInfo.columns
                .filter((col) => col.type === 'field')
                .filter((col) => !evaluateBooleanExpr(col.column_invisible, this.props.context))
                .filter((col) => !col.optional || this.optionalActiveFields[col.name])
                .map((col) => col.name)
        );
        return Object.keys(activeFields)
            .map((fieldName) => fields[fieldName])
            .filter(Boolean)
            .filter((field) => visibleColumns.has(field.name))
            .filter((field) => field.exportable !== false)
            .filter((field) => field.type !== 'properties');
    }

    /**
     * Hook called after a record has been saved
     * Override in child classes to perform custom actions after save
     * @param {Object} record - The saved record
     */
    async onRecordSaved(record) {}

    /**
     * Hook called before a record is saved
     * Override in child classes to validate or modify the record before save
     * @param {Object} record - The record about to be saved
     * @returns {Promise<boolean|void>} Return false to prevent save
     */
    async onWillSaveRecord(record) {}

    /**
     * Handle selection changes and notify parent component
     * Triggered when record selection state changes
     * @returns {Promise<void>}
     */
    async onSelectionChanged() {
        if (this.props.onSelectionChanged) {
            const resIds = await this.model.root.getResIds(true);
            this.props.onSelectionChanged(resIds);
        }
    }

    /**
     * Download exported data in specified format
     * @param {Array} fields - List of field definitions to export
     * @param {boolean} import_compat - Whether to include external IDs for re-import
     * @param {string} format - Export format (e.g., 'xlsx', 'csv')
     * @returns {Promise<void>}
     */
    async downloadExport(fields, import_compat, format) {
        let ids = false;
        if (!this.isDomainSelected) {
            const resIds = await this.getSelectedResIds();
            ids = resIds.length > 0 && resIds;
        }
        const exportedFields = fields.map((field) => ({
            name: field.name || field.id,
            label: field.label || field.string,
            store: field.store,
            type: field.field_type || field.type,
        }));
        if (import_compat) {
            exportedFields.unshift({ name: 'id', label: _t('External ID') });
        }
        await download({
            data: {
                data: JSON.stringify({
                    import_compat,
                    context: this.props.context,
                    domain: this.model.root.domain,
                    fields: exportedFields,
                    groupby: this.model.root.groupBy,
                    ids,
                    model: this.model.root.resModel,
                }),
            },
            url: `/web/export/${format}`,
        });
    }

    /**
     * Get confirmation dialog properties for archive action
     * Override in child classes to customize body, confirmLabel, confirm, or cancel;
     * defaults are supplied by DynamicList.toggleArchiveWithConfirmation().
     * @returns {Object} {}
     */
    get archiveDialogProps() {
        return {};
    }

    /**
     * Get action menu items combining static and dynamic actions
     * Merges built-in actions (export, archive, delete) with custom actions from props
     * @returns {Object} Object with action and print menu item arrays
     */
    get actionMenuItems() {
        const { actionMenus } = this.props.info || {};
        const staticActionItems = Object.entries(this.getStaticActionMenuItems())
            .filter(([key, item]) => item.isAvailable === undefined || item.isAvailable())
            .sort(([k1, item1], [k2, item2]) => (item1.sequence || 0) - (item2.sequence || 0))
            .map(([key, item]) =>
                Object.assign({ key, groupNumber: STATIC_ACTIONS_GROUP_NUMBER }, omit(item, 'isAvailable'))
            );

        return {
            action: [...staticActionItems, ...(actionMenus?.action || [])],
            print: actionMenus?.print,
        };
    }

    /**
     * Get confirmation dialog properties for delete action
     * @returns {Object} {}
     */
    get deleteConfirmationDialogProps() {
        return {};
    }

    /**
     * Get static action menu items (export, archive, unarchive, duplicate, delete)
     * Each item includes availability check, icon, description, and callback
     * @returns {Object} Map of action items with their configurations
     */
    getStaticActionMenuItems() {
        const list = this.model.root;
        const isM2MGrouped = list.groupBy.some((groupBy) => {
            const fieldName = groupBy.split(':')[0];
            return list.fields[fieldName].type === 'many2many';
        });
        return {
            export: {
                isAvailable: () => this.isExportEnable,
                sequence: 10,
                icon: 'upload',
                description: _t('Export'),
                callback: () => this.exportRecords(),
            },
            duplicate: {
                isAvailable: () => this.activeActions.duplicate && !isM2MGrouped,
                sequence: 30,
                icon: 'content_copy',
                description: _t('Duplicate'),
                callback: () => this.duplicateRecords(),
            },
            archive: {
                isAvailable: () => this.archiveEnabled && !isM2MGrouped,
                availableOffline: true,
                sequence: 40,
                icon: 'archive',
                description: _t('Archive'),
                callback: () => this.model.root.toggleArchiveWithConfirmation(true, this.archiveDialogProps),
            },
            unarchive: {
                isAvailable: () => this.archiveEnabled && !isM2MGrouped,
                availableOffline: true,
                sequence: 45,
                icon: 'unarchive',
                description: _t('Unarchive'),
                callback: () => this.model.root.toggleArchiveWithConfirmation(false),
            },
            delete: {
                isAvailable: () => this.activeActions.delete && !isM2MGrouped,
                availableOffline: true,
                sequence: 50,
                icon: 'delete',
                iconClass: 'oi-filled',
                description: _t('Delete'),
                class: 'text-danger',
                callback: () => this.onDeleteSelectedRecords(),
            },
        };
    }

    /**
     * Clear all record selections
     * Deselects all currently selected records in the view
     * @returns {void}
     */
    discardSelection() {
        this.model.root.records.forEach((record) => {
            record.toggleSelection(false);
        });
    }

    /**
     * Show confirmation dialog before deleting selected records
     */
    async onDeleteSelectedRecords() {
        this.deleteRecordsWithConfirmation(this.deleteConfirmationDialogProps);
    }

    /**
     * Hook called before executing an action button
     * Saves edited record before action execution (except for cancel)
     * @param {Object} clickParams - Button click parameters
     * @returns {Promise<void|boolean>}
     */
    async beforeExecuteActionButton(clickParams) {
        if (clickParams.special !== 'cancel' && this.model.root.editedRecord) {
            return this.model.root.editedRecord.save();
        }
    }

    /**
     * Hook called after an action button is executed
     * Override in child classes to perform cleanup or additional actions
     * @param {Object} clickParams - Parameters from the button click
     */
    async afterExecuteActionButton(clickParams) {}

    /**
     * Center the map view to fit all visible features
     * Triggers map centering via event bus or re-renders the view
     * @returns {void}
     */
    centerMap() {
        if (this.props.allowSelectors) {
            this.uiService.bus.trigger('mapbox-center-map');
        } else {
            render(this, true);
        }
    }

    /**
     * Get resource IDs of all selected records
     * @returns {Promise<Array<number>>} Array of selected record IDs
     */
    getSelectedResIds() {
        return this.model.root.getResIds(true);
    }

    /**
     * Duplicate all selected records
     * Creates copies of selected records in the database
     * @returns {Promise<void>}
     */
    async duplicateRecords() {
        return this.model.root.duplicateRecords();
    }

    /**
     * Open record in form view
     * Uses custom openAction if configured, otherwise delegates to props.selectRecord
     * @param {Object} record - The record to open
     * @returns {Promise<void>}
     */
    async openRecord(record) {
        if (this.archInfo.openAction?.action && this.archInfo.openAction?.type) {
            this.actionService.doActionButton({
                name: this.archInfo.openAction.action,
                type: this.archInfo.openAction.type,
                resModel: record.resModel,
                resId: record.resId,
                resIds: record.resIds,
                context: record.context,
                onClose: async () => {
                    await record.model.root.load();
                },
            });
        } else {
            const activeIds = this.model.root.records.map((datapoint) => datapoint.resId);
            this.props.selectRecord(record.resId, { activeIds });
        }
    }

    /**
     * Handle create button click event
     * Wraps createRecord call in button callback handler
     * @returns {Promise<void>}
     */
    async onClickCreate() {
        return executeButtonCallback(this.rootRef(), () => this.createRecord());
    }

    /**
     * Create a new record
     * Delegates to props.createRecord for actual creation logic
     * @returns {Promise<void>}
     */
    async createRecord() {
        await this.props.createRecord();
    }

    /**
     * Open form view in a dialog window
     * @param {Object} record - The record to display
     */
    async showRecord(record) {
        if (record) {
            this.dialogService.add(FormViewDialog, {
                title: this._getRecordName(record),
                resModel: record.resModel,
                resId: record.resId,
                context: record.context,
                readonly: this.props.readonly,
                onRecordSaved: async (record) => {
                    this.actionService.doAction({
                        type: 'ir.actions.act_window_close',
                    });
                    await record.load();
                    record.model.notify();
                    await this.model.root.load();
                },
            });
        }
    }

    /**
     * Show records matching a domain in list/form view
     * Opens a new action with filtered records, excluding mapbox_gl view
     * @param {string} title - Action title/name
     * @param {Array} domain - Odoo domain filter
     * @param {string} [target='current'] - Action target ('current', 'new', etc.)
     * @returns {void}
     */
    showRecordsByDomain(title, domain, target) {
        target = target || 'current';
        let action = null;
        if (this.actionService.currentController?.action?.views) {
            // Odoo view format: [view_id, view_type]
            // Exclude mapbox_gl view from available views
            const views = this.actionService.currentController.action.views.filter(
                (view) => view[1] !== VIEW_TYPES.MAPBOX_GL
            );
            const view_mode = views.map((view) => view[1]).join(',');
            if (views.length > 0) {
                action = {
                    views,
                    view_mode,
                    name: title,
                    type: 'ir.actions.act_window',
                    res_model: this.model.root.resModel,
                    domain: domain,
                    target: target,
                };
            }
        }
        if (!action) {
            action = {
                name: title,
                type: 'ir.actions.act_window',
                res_model: this.model.root.resModel,
                views: [
                    [false, 'list'],
                    [false, 'form'],
                ],
                view_mode: 'list,form',
                domain: domain,
                target: target,
            };
        }
        if (action && this.model.action) {
            this.actionService.doAction(action);
        }
    }

    showUnlocatedRecords() {
        const domain = this.model.unlocatedRecordsDomain;
        if (!domain.length) return;
        this.showRecordsByDomain(_t('Unlocated'), domain);
    }

    /**
     * Get display name of record from available fields
     * Tries titleField, name, then display_name in order
     * @param {Object} record - The record object
     * @returns {string} The display name or empty string if not found
     */
    _getRecordName(record) {
        if (this.props.archInfo.titleField && this.props.archInfo.titleField in record.data) {
            return record.data[this.props.archInfo.titleField];
        } else if ('name' in record.data) {
            return record.data.name;
        } else if ('display_name' in record.data) {
            return record.data.display_name;
        } else {
            return '';
        }
    }

    // --- Getters ---
    /**
     * Check if the user can create new records
     * @returns {boolean} True if create action is allowed
     */
    get canCreate() {
        return this.props.archInfo.activeActions.create;
    }

    /**
     * Get the CSS class name for the component
     * @returns {string} Class name from props
     */
    get className() {
        return this.props.className;
    }

    /**
     * Get model loading options
     * Determines whether to load data lazily based on context
     * @returns {Object} Model options configuration
     */
    get modelOptions() {
        return {
            lazy: !this.env.config.isReloadingController && !this.env.inDialog && !!this.props.display.controlPanel,
        };
    }

    /**
     * Get display configuration for the view
     * Hides layout actions when records are selected
     * @returns {Object} Display configuration
     */
    get display() {
        const { controlPanel } = this.props.display;
        if (!controlPanel) {
            return this.props.display;
        }
        return {
            ...this.props.display,
            controlPanel: {
                ...controlPanel,
                actions: !this.hasSelectedRecords,
            },
        };
    }

    /**
     * Check if any records are selected
     * @returns {boolean} True if records are selected or domain selection is active
     */
    get hasSelectedRecords() {
        return this.model.root.selection.length || this.isDomainSelected;
    }

    /**
     * Check if domain selection is active (select all matching domain)
     * @returns {boolean} True if domain selection is active
     */
    get isDomainSelected() {
        return this.model.root.isDomainSelected;
    }

    evalViewModifier(modifier, context) {
        if (modifier === null || modifier === undefined || modifier === '') {
            return false;
        }
        context = context || this.model.root.evalContext;
        return evaluateBooleanExpr(modifier, context);
    }

    /**
     * Check if record selectors should be displayed
     * Hides selectors on small screens
     * @returns {boolean} True if selectors should be shown
     */
    get hasSelectors() {
        return this.props.allowSelectors && !this.uiService.isSmall;
    }

    /**
     * Get map view configuration from arch info
     * Validates that sidebar fields exist in the model
     * @returns {Object} Map configuration with title, subTitle, mapStyleUrl, etc.
     * @throws {Error} If specified sidebar fields don't exist in the model
     */
    get viewMapConfig() {
        const { titleField, descriptionField, mapStyleUrl, mapProjection, __geoColor } = this.archInfo;

        if (titleField && this.props.fields?.[titleField] === undefined) {
            throw new Error(`Title field "${titleField}" is not found. Please check your view definition.`);
        }

        if (descriptionField && this.props.fields?.[descriptionField] === undefined) {
            throw new Error(`Description field "${descriptionField}" is not found. Please check your view definition.`);
        }

        return {
            title: titleField,
            subTitle: descriptionField,
            mapStyleUrl,
            mapProjection,
            __geoColor,
        };
    }

    /**
     * Get props for action menu component
     * Provides selected IDs, context, and action items
     * @returns {Object} Action menu properties
     */
    get actionMenuProps() {
        return {
            getActiveIds: () => this.model.root.selection.map((r) => r.resId),
            context: this.model.root.context,
            domain: this.props.domain,
            items: this.actionMenuItems,
            isDomainSelected: this.model.root.isDomainSelected,
            resModel: this.model.root.resModel,
            onActionExecuted: ({ noReload } = {}) => {
                if (!noReload) {
                    return this.model.load();
                }
            },
        };
    }

    /**
     * Get props for renderer component
     * Provides all necessary data and callbacks for map rendering
     * @returns {Object} Renderer properties
     */
    get rendererProps() {
        return {
            list: this.model.root,
            unLocatedCount: this.model.unLocatedCount,
            archInfo: this.props.archInfo,
            viewAttrs: this.viewMapConfig,
            activeActions: this.activeActions,
            allowSelectors: this.props.allowSelectors,
            readonly: true,
            openRecord: this.openRecord.bind(this),
            onAdd: this.createRecord.bind(this),
            showRecord: this.showRecord.bind(this),
            showRecordsByDomain: this.showRecordsByDomain.bind(this),
            showUnlocatedRecords: this.showUnlocatedRecords.bind(this),
        };
    }

    /**
     * Hook called after pager is updated
     * Override in child classes to perform actions after pagination changes
     */
    async onUpdatedPager() {}

}
