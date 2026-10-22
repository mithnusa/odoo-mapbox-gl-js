import { RelationalModel } from '@web/model/relational_model/relational_model';
import { DynamicGroupList } from '@web/model/relational_model/dynamic_group_list';
import { Group } from '@web/model/relational_model/group';
import { Record } from '@web/model/relational_model/record';
import { Domain } from '@web/core/domain';
import { KeepLast } from '@web/core/utils/concurrency';
import { parseRecord, generateRandomColor } from './utils';

export class BaseMapboxGlGroup extends Group {
    /**
     * Override
     */
    setup() {
        super.setup(...arguments);
        this.groupColor = generateRandomColor();
        this.markerColor = this.groupColor; // Keep both for compatibility
    }

    get groupByLabel() {
        return this.groupByField ? this.groupByField.string : '';
    }

    async groupRecords() {
        if (this.list.records.length) {
            return this.list.records;
        }
        await this.list.load();
        return this.list.records;
    }

    get dataView() {
        let other = {};
        let geolocation = {};
        if (this.model.viewConfig && this.records) {
            const record = this.records[0]; // we only care the first record
            if (record && record.data) {
                const data = parseRecord(record, this.model.viewConfig, true);
                geolocation = data.geolocation;
                other = Object.assign({}, data.other, { groupColor: this.groupColor });
            }
        }
        return { geolocation, other };
    }
}

export class BaseMapboxGlDynamicGroupList extends DynamicGroupList {
    /**
     * Override
     */
    setup() {
        super.setup(...arguments);
        // Initialize defaultGroupBy once during setup instead of lazily inside the getter
        if (!this.model.defaultGroupBy && this.config.groupBy?.length) {
            this.model.defaultGroupBy = this.config.groupBy.slice(0, 1);
        }
    }

    /**
     * Override
     */
    get groupBy() {
        const defaultGroupBy = this.model.defaultGroupBy;
        if (defaultGroupBy) {
            return Array.isArray(defaultGroupBy) ? defaultGroupBy : [defaultGroupBy];
        }
        // only one groupBy is allowed
        return this.config.groupBy ? this.config.groupBy.slice(0, 1) : this.config.groupBy;
    }
}

export class BaseMapboxGlModel extends RelationalModel {
    /**
     * Override
     * @param {*} params
     * @param {*} services
     */
    setup(params, services) {
        super.setup(...arguments);
        this.viewConfig = params.viewConfig || {};
        this.unLocatedCount = 0;
        // Dedicated KeepLast — this.keepLast is used internally by
        // RelationalModel for record loads and must not be shared
        this._countKeepLast = new KeepLast();
    }
    /**
     * Override
     * @param {*} currentConfig
     * @param {*} params
     * @returns
     */
    _getNextConfig(currentConfig, params) {
        const nextConfig = super._getNextConfig(currentConfig, params);
        // Capture the search domain before the geolocation filter is added:
        // the ungeolocated count/list must follow the same search scope
        this._searchDomain = nextConfig.domain ?? [];
        const mapDomain = this.mapDomain;
        if (mapDomain && mapDomain.length) {
            // add domain for geolocation fields
            nextConfig.domain = Domain.and([nextConfig.domain ?? [], mapDomain]).toList();
        }
        return nextConfig;
    }

    /**
     * Override
     * @param {*} params
     */
    async load(params = {}) {
        const res = await super.load(params);
        await this._updateUnlocatedRecordCount(this.config, params);
        return res;
    }

    /**
     * Whether the view is configured with searchable geolocation fields
     * @returns {boolean}
     */
    _hasSearchableGeoFields() {
        return Boolean(
            this.viewConfig &&
                this.viewConfig.latField &&
                this.viewConfig.lngField &&
                this.config.fields[this.viewConfig.latField] &&
                this.config.fields[this.viewConfig.lngField] &&
                this.config.fields[this.viewConfig.latField].searchable &&
                this.config.fields[this.viewConfig.lngField].searchable
        );
    }

    /**
     * Filter for geolocation fields
     * @returns {Array} domain for map
     */
    get mapDomain() {
        if (this._mapDomainCache !== undefined) {
            return this._mapDomainCache;
        }
        let result = [];
        if (this._hasSearchableGeoFields()) {
            // Odoo serializes an unset Float as 0.0, so 0.0 is treated as
            // "not geolocated" alongside null/false.
            const nullValues = [null, false];
            let latDomain = [[this.viewConfig.latField, 'not in', nullValues]];
            let lngDomain = [[this.viewConfig.lngField, 'not in', nullValues]];

            if (this.config.fields[this.viewConfig.latField].related) {
                const related_source = this.config.fields[this.viewConfig.latField].related.split('.')[0];
                latDomain = Domain.and([latDomain, [[related_source, 'not in', nullValues]]]).toList();
            }
            if (this.config.fields[this.viewConfig.lngField].related) {
                const related_source = this.config.fields[this.viewConfig.lngField].related.split('.')[0];
                lngDomain = Domain.and([lngDomain, [[related_source, 'not in', nullValues]]]).toList();
            }
            result = Domain.and([latDomain, lngDomain]).toList();
        }
        this._mapDomainCache = result;
        return result;
    }

    get notGeolocatedDomain() {
        if (this._unlocatedDomainCache !== undefined) {
            return this._unlocatedDomainCache;
        }
        let result = [];
        if (this._hasSearchableGeoFields()) {
            const nullValues = [null, false];
            // Complement of mapDomain: a record is not geolocated when ANY
            // required coordinate source is missing — hence OR, not AND.
            const parts = [[[this.viewConfig.latField, 'in', nullValues]], [[this.viewConfig.lngField, 'in', nullValues]]];
            for (const fieldName of [this.viewConfig.latField, this.viewConfig.lngField]) {
                const related = this.config.fields[fieldName].related;
                if (related) {
                    parts.push([[related.split('.')[0], 'in', nullValues]]);
                }
            }
            result = Domain.or(parts).toList();
        }
        this._unlocatedDomainCache = result;
        return result;
    }

    /**
     * Domain matching the records excluded from the map by the current
     * search: current search scope AND missing geolocation. Reusable by
     * the controller (e.g. an action listing the non-geolocated records)
     * so any list opened from the count can never disagree with it.
     * @returns {Array} combined domain
     */
    get unlocatedRecordsDomain() {
        const notGeolocated = this.notGeolocatedDomain;
        if (!notGeolocated.length) {
            return [];
        }
        return Domain.and([this._searchDomain ?? [], notGeolocated]).toList();
    }

    async _updateUnlocatedRecordCount(config, params) {
        // `params.domain` is present on every model-driven load (useModel's
        // getSearchParams always includes 'domain' from SEARCH_KEYS), so it
        // must be re-synced every call, not just the first — otherwise the
        // unlocated count keeps scoring against the domain from initial
        // mount and never reflects a later search. Bare `this.model.load()`
        // calls (reload button, action-menu refresh) omit params entirely,
        // so `params.domain` is undefined there — keep the last known scope
        // in that case instead of resetting it.
        if (params.domain !== undefined) {
            this._searchDomain = params.domain;
        }
        const domain = this.unlocatedRecordsDomain;
        if (!domain.length || this.useSampleModel) {
            this.unLocatedCount = 0;
            return;
        }
        this.unLocatedCount = await this._countKeepLast.add(
            this.orm.searchCount(this.config.resModel, domain, {
                context: this.config.context,
            })
        );
    }
}

export class BaseMapboxRecord extends Record {
    get dataView() {
        if (!this.model || !this.model.viewConfig) {
            return {};
        }
        return parseRecord(this, this.model.viewConfig) || {};
    }
}

BaseMapboxGlModel.Group = BaseMapboxGlGroup;
BaseMapboxGlModel.DynamicGroupList = BaseMapboxGlDynamicGroupList;
BaseMapboxGlModel.Record = BaseMapboxRecord;
