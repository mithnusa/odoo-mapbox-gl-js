import { visitXML } from '@web/core/utils/xml';
import { Field } from '@web/views/fields/field';
import { stringToOrderBy } from '@web/search/utils/order_by';
import { getActiveActions, processButton } from '@web/views/utils';
import { exprToBoolean } from '@web/core/utils/strings';
import { GroupListArchParser } from '@web/views/list/list_arch_parser';

export class BaseMapboxGlArchParser {
    get defaultLimit() {
        return 100;
    }

    processButton(node) {
        return processButton(node);
    }

    parse(xmlDoc, models, modelName) {
        const className = xmlDoc.getAttribute('class') || null;
        const jsClass = xmlDoc.getAttribute('js_class');

        const fields = models[modelName].fields;

        const groupListArchParser = new GroupListArchParser();

        const viewTitle = xmlDoc.getAttribute('string') || 'Mapbox';

        const fieldNodes = {};
        const mapBoxGlAttr = {};
        const fieldNextIds = {};
        const creates = [];

        let nextId = 0;
        let buttonId = 0;
        const columns = [];
        let headerButtons = [];

        const groupBy = {
            buttons: {},
            fields: {},
        };

        visitXML(xmlDoc, (node) => {
            if (node.tagName === 'field') {
                const fieldInfo = Field.parseFieldNode(node, models, modelName, 'mapbox_gl', jsClass);
                if (!(fieldInfo.name in fieldNextIds)) {
                    fieldNextIds[fieldInfo.name] = 0;
                }
                const fieldId = `${fieldInfo.name}_${fieldNextIds[fieldInfo.name]++}`;
                fieldNodes[fieldId] = fieldInfo;
                node.setAttribute('field_id', fieldId);
                const label = fieldInfo.field.label;
                columns.push({
                    ...fieldInfo,
                    id: `column_${nextId++}`,
                    className: node.getAttribute('class'), // for oe_edit_only and oe_read_only
                    optional: node.getAttribute('optional') || false,
                    type: 'field',
                    fieldType: fieldInfo.type,
                    hasLabel: !(fieldInfo.field.label === false || exprToBoolean(fieldInfo.attrs.nolabel) === true),
                    label: (fieldInfo.widget && label && label.toString()) || fieldInfo.string,
                });
            } else if (node.tagName === 'control') {
                for (const childNode of node.children) {
                    if (childNode.tagName === 'button') {
                        creates.push({
                            type: 'button',
                            ...this.processButton(childNode),
                        });
                    } else if (childNode.tagName === 'create') {
                        creates.push({
                            type: 'create',
                            context: childNode.getAttribute('context'),
                            string: childNode.getAttribute('string'),
                        });
                    }
                }
                return false;
            } else if (node.tagName === 'groupby' && node.getAttribute('name')) {
                const fieldName = node.getAttribute('name');
                const coModelName = fields[fieldName].relation;
                const groupByArchInfo = groupListArchParser.parse(node, models, coModelName);
                groupBy.buttons[fieldName] = groupByArchInfo.buttons;
                groupBy.fields[fieldName] = {
                    fieldNodes: groupByArchInfo.fieldNodes,
                    fields: models[coModelName].fields,
                };
                return false;
            } else if (node.tagName === 'header') {
                headerButtons = [...node.children].map((node) => ({
                    ...this.processButton(node),
                    type: 'button',
                    id: buttonId++,
                }));
                return false;
            } else if (node.tagName === 'mapbox_gl') {
                this.parseMapboxGlAttrs(xmlDoc, node, mapBoxGlAttr);
            }
        });
        return {
            creates,
            columns,
            className,
            fieldNodes,
            headerButtons,
            viewTitle,
            xmlDoc,
            groupBy,
            ...mapBoxGlAttr,
        };
    }

    parseMapboxGlAttrs(xmlDoc, node, attrs) {
        const activeActions = {
            ...getActiveActions(xmlDoc),
            exportXlsx: exprToBoolean(xmlDoc.getAttribute('export_xlsx'), true),
        };
        attrs.activeActions = activeActions;
        attrs.multiEdit = activeActions.edit ? exprToBoolean(node.getAttribute('multi_edit') || '') : false;

        const limitAttr = node.getAttribute('limit');
        attrs.limit = limitAttr ? parseInt(limitAttr, 10) : this.defaultLimit;

        const countLimitAttr = node.getAttribute('count_limit');
        attrs.countLimit = countLimitAttr && parseInt(countLimitAttr, 10);

        const groupsLimitAttr = node.getAttribute('groups_limit');
        attrs.groupsLimit = groupsLimitAttr && parseInt(groupsLimitAttr, 10);

        attrs.defaultOrder = stringToOrderBy(xmlDoc.getAttribute('default_order') || null);

        // custom open action when clicking on record row
        const action = xmlDoc.getAttribute('action');
        const type = xmlDoc.getAttribute('type');
        attrs.openAction = action && type ? { action, type } : null;

        const colorField = xmlDoc.getAttribute('color_field');
        attrs.__geoColor = colorField;

        const mapStyleUrl = xmlDoc.getAttribute('map_style_url');
        attrs.mapStyleUrl = mapStyleUrl;

        const mapProjection = xmlDoc.getAttribute('map_projection');
        attrs.mapProjection = mapProjection;

        const centerCoordinates = xmlDoc.getAttribute('center');
        attrs.centerCoordinates = centerCoordinates;

        const titleField = xmlDoc.getAttribute('title_field');
        attrs.titleField = titleField;

        const descriptionField = xmlDoc.getAttribute('description_field');
        attrs.descriptionField = descriptionField;

        const onCreate = xmlDoc.getAttribute('on_create');
        attrs.onCreate = onCreate;

        const defaultGroupBy = xmlDoc.getAttribute('default_group_by');
        attrs.defaultGroupBy = defaultGroupBy;
    }
}
