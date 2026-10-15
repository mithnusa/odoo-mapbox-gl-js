// web_view_mapbox_gl_geolocate/static/tests/mapbox_gl_geolocate_view.test.js
import { describe, test, expect } from '@odoo/hoot';
import { Domain } from '@web/core/domain';
import {
    defineModels,
    fields,
    findComponent,
    mockService,
    models,
    mountView,
    serverState,
} from '@web/../tests/web_test_helpers';

import { MapboxGlGeolocateArchParser } from '@web_view_mapbox_gl_geolocate/views/mapbox_gl_geolocate/mapbox_gl_geolocate_arch_parser';
import { MapboxGlGeolocateController } from '@web_view_mapbox_gl_geolocate/views/mapbox_gl_geolocate/mapbox_gl_geolocate_controller';
import { BaseMapboxGlModel } from '@web_view_base_mapbox_gl/map_base/map_base_model';
import { MapboxGlGeolocateRenderer } from '@web_view_mapbox_gl_geolocate/views/mapbox_gl_geolocate/mapbox_gl_geolocate_renderer';
import { mockMapboxGlApi, waitUntil } from './helpers/mapbox_gl_test_helpers';

class Country extends models.Model {
    _name = 'res.country';

    name = fields.Char();
    _records = [
        { id: 1, name: 'North' },
        { id: 2, name: 'South' },
    ];
}

class Partner extends models.Model {
    _name = 'res.partner';

    name = fields.Char();
    contact_address = fields.Char();
    country_id = fields.Many2one({ string: 'Country', relation: 'res.country' });
    partner_latitude = fields.Float();
    partner_longitude = fields.Float();

    _records = [
        {
            id: 1,
            name: 'Located A',
            contact_address: 'Street A',
            partner_latitude: 10.0,
            partner_longitude: 10.5,
            country_id: 1,
        },
        {
            id: 2,
            name: 'Located B',
            contact_address: 'Street B',
            partner_latitude: 11.0,
            partner_longitude: 11.5,
            country_id: 2,
        },
        {
            id: 3,
            name: 'No coords',
            contact_address: 'None',
            // Unset, same as a real Float field: Odoo's ORM serializes an
            // unset partner_latitude/partner_longitude as 0.0, never
            // `false` (unlike Char/Many2one). mapDomain's exclusion domain
            // (`field != 0.0`) relies on that, and the hoot mock server's
            // domain matcher uses strict JS equality (`false !== 0.0`), so
            // a literal `false` here would silently bypass the filter.
            partner_latitude: 0.0,
            partner_longitude: 0.0,
            country_id: 1,
        },
    ];
}

// The mock server resolves the current user (env["res.users"].browse(uid))
// on every RPC, not just when a field references res.users — it must
// always be registered, even though nothing in this view touches it.
class Users extends models.Model {
    _name = 'res.users';

    name = fields.Char();
    _records = [{ id: serverState.userId, name: 'Mitchell Admin' }];

    // Matches core's ResUsers mock model — some access-rights check in the
    // view stack (e.g. group-gated buttons/menus) calls this on every mount.
    has_group() {
        return true;
    }
}

defineModels([Partner, Users, Country]);

/**
 * Builds a bare instance whose prototype chain is the real class — every
 * method/getter it doesn't have its own copy of resolves to the real,
 * unmodified implementation. Lets the class's business logic (getters,
 * coordinate math, popup content building) be exercised directly, without
 * mounting OWL components or faking Mapbox GL JS at all.
 */
function makeInstance(Klass, props) {
    return Object.assign(Object.create(Klass.prototype), props);
}

function getMapController(view) {
    return findComponent(view, (c) => c instanceof MapboxGlGeolocateController);
}

function getMapRenderer(view) {
    return findComponent(view, (c) => c instanceof MapboxGlGeolocateRenderer);
}

const ARCH = `
    <mapbox_gl js_class="mapbox_gl_geolocate" lat_field="partner_latitude" lng_field="partner_longitude" title_field="name" description_field="contact_address">
        <field name="name"/>
        <field name="contact_address"/>
        <field name="partner_latitude"/>
        <field name="partner_longitude"/>
    </mapbox_gl>
`;

describe('arch parser', () => {
    // Pure parsing logic — no mountView, no mapboxgl, no OWL involved.
    function parseArch(archXml) {
        const xmlDoc = new DOMParser().parseFromString(archXml, 'text/xml').documentElement;
        return new MapboxGlGeolocateArchParser().parse(xmlDoc, { 'res.partner': { fields: {} } }, 'res.partner');
    }

    test('lat_field/lng_field attributes are parsed into latField/lngField', () => {
        const archInfo = parseArch(`<mapbox_gl js_class="mapbox_gl_geolocate" lat_field="partner_latitude" lng_field="partner_longitude"/>`);
        expect(archInfo.latField).toBe('partner_latitude');
        expect(archInfo.lngField).toBe('partner_longitude');
    });

    test('latField/lngField default to null when the attributes are absent', () => {
        const archInfo = parseArch(`<mapbox_gl js_class="mapbox_gl_geolocate"/>`);
        expect(archInfo.latField).toBe(null);
        expect(archInfo.lngField).toBe(null);
    });

    test('enableHeatmap and enableClustering default to false', () => {
        const archInfo = parseArch(`<mapbox_gl js_class="mapbox_gl_geolocate" lat_field="lat" lng_field="lng"/>`);
        expect(archInfo.enableHeatmap).toBe(false);
        expect(archInfo.enableClustering).toBe(false);
    });

    test('enable_heatmap and enable_clustering attributes are parsed as booleans', () => {
        const archInfo = parseArch(
            `<mapbox_gl js_class="mapbox_gl_geolocate" lat_field="lat" lng_field="lng" enable_heatmap="1" enable_clustering="1"/>`
        );
        expect(archInfo.enableHeatmap).toBe(true);
        expect(archInfo.enableClustering).toBe(true);
    });

    test('color_field is exposed as __geoColor', () => {
        const archInfo = parseArch(`<mapbox_gl js_class="mapbox_gl_geolocate" lat_field="lat" lng_field="lng" color_field="marker_color"/>`);
        expect(archInfo.__geoColor).toBe('marker_color');
    });
});

describe('controller viewMapConfig', () => {
    // Asserted directly against the controller's prototype (no mountView):
    // the error is thrown from a plain getter used while building the
    // model's params during Controller setup — a synchronous throw inside
    // component construction that Hoot flags as a global "unverified
    // error" regardless of whether mountView()'s own promise also
    // rejects, so rejects.toThrow() here would just report noise.
    function baseArchInfo(overrides = {}) {
        return {
            lngField: 'partner_longitude',
            latField: 'partner_latitude',
            enableHeatmap: false,
            enableClustering: false,
            titleField: null,
            descriptionField: null,
            mapStyleUrl: null,
            mapProjection: null,
            __geoColor: null,
            ...overrides,
        };
    }

    test('throws when lngField is not declared on the model', () => {
        const controller = makeInstance(MapboxGlGeolocateController, {
            archInfo: baseArchInfo({ lngField: 'missing_field' }),
            props: { fields: { partner_latitude: {} } },
        });
        expect(() => controller.viewMapConfig).toThrow(/GeoJSON field "missing_field" is not found/);
    });

    test('throws when latField is not declared on the model', () => {
        const controller = makeInstance(MapboxGlGeolocateController, {
            archInfo: baseArchInfo({ latField: 'missing_field' }),
            props: { fields: { partner_longitude: {} } },
        });
        expect(() => controller.viewMapConfig).toThrow(/GeoJSON field "missing_field" is not found/);
    });

    test('throws when lngField is undefined', () => {
        const controller = makeInstance(MapboxGlGeolocateController, {
            archInfo: baseArchInfo({ lngField: undefined }),
            props: { fields: { partner_latitude: {} } },
        });
        expect(() => controller.viewMapConfig).toThrow();
    });

    test('merges latField/lngField/enableHeatmap/enableClustering into the base config', () => {
        const controller = makeInstance(MapboxGlGeolocateController, {
            archInfo: baseArchInfo({ enableHeatmap: true, enableClustering: true }),
            props: { fields: { partner_latitude: {}, partner_longitude: {} } },
        });
        expect(controller.viewMapConfig).toEqual({
            title: null,
            subTitle: null,
            mapStyleUrl: null,
            mapProjection: null,
            __geoColor: null,
            latField: 'partner_latitude',
            lngField: 'partner_longitude',
            enableHeatmap: true,
            enableClustering: true,
        });
    });
});

describe('model mapDomain', () => {
    // Also asserted directly against the model's prototype — pure getter
    // logic, no need to fetch real records through a mounted view for it.
    function makeModel(overrides = {}) {
        return makeInstance(BaseMapboxGlModel, {
            viewConfig: { latField: 'lat', lngField: 'lng' },
            config: { fields: { lat: { searchable: true }, lng: { searchable: true } } },
            ...overrides,
        });
    }

    test('is empty when latField/lngField are not configured', () => {
        const model = makeInstance(BaseMapboxGlModel, { viewConfig: {}, config: { fields: {} } });
        expect(model.mapDomain).toEqual([]);
    });

    test('is empty when either field is not searchable', () => {
        const model = makeModel({ config: { fields: { lat: { searchable: false }, lng: { searchable: true } } } });
        expect(model.mapDomain).toEqual([]);
    });

    test('excludes null/false/0.0 coordinates but includes any other value', () => {
        const model = makeModel();
        const domain = new Domain(model.mapDomain);
        expect(domain.contains({ lat: 10.0, lng: 20.0 })).toBe(true);
        // Odoo serializes an unset Float as 0.0
        expect(domain.contains({ lat: 0.0, lng: 20.0 })).toBe(false);
        expect(domain.contains({ lat: 10.0, lng: 0.0 })).toBe(false);
        expect(domain.contains({ lat: false, lng: 20.0 })).toBe(false);
        expect(domain.contains({ lat: 10.0, lng: false })).toBe(false);
    });

    test('adds a domain on the related source field when latField is related', () => {
        const model = makeModel({
            config: {
                fields: {
                    lat: { searchable: true, related: 'partner_id.latitude' },
                    lng: { searchable: true },
                },
            },
        });
        const domain = new Domain(model.mapDomain);
        expect(domain.contains({ lat: 10.0, lng: 20.0, partner_id: 5 })).toBe(true);
        expect(domain.contains({ lat: 10.0, lng: 20.0, partner_id: false })).toBe(false);
    });
});

describe('overlapping marker coordinate shifting', () => {
    // getRecordGeoJsonData() and its private helpers are pure, framework-
    // free logic — no mounted map is needed to exercise the overlap
    // handling that's this module's signature feature.
    function makeRenderer() {
        return makeInstance(MapboxGlGeolocateRenderer, {
            coordinateUsageMap: new Map(),
            centerMarkerMap: new Map(),
            props: { viewAttrs: { lngField: 'lng', latField: 'lat', title: 'name' } },
        });
    }

    test('the first record at a coordinate keeps its original position', () => {
        const renderer = makeRenderer();
        const geoJson = renderer.getRecordGeoJsonData({ resId: 1, data: { lng: 10, lat: 20, name: 'A' } });
        const feature = geoJson.features[0];
        expect(feature.properties.isShifted).toBe(false);
        expect(feature.geometry.coordinates).toEqual([10, 20]);
    });

    test('a second record at the same coordinate is shifted away from the center', () => {
        const renderer = makeRenderer();
        renderer.getRecordGeoJsonData({ resId: 1, data: { lng: 10, lat: 20, name: 'A' } });
        const geoJson = renderer.getRecordGeoJsonData({ resId: 2, data: { lng: 10, lat: 20, name: 'B' } });
        const feature = geoJson.features[0];
        expect(feature.properties.isShifted).toBe(true);
        expect(feature.geometry.coordinates).not.toEqual([10, 20]);
        expect(feature.properties.centerMarkerCoordinates).toEqual([10, 20]);
    });

    test('records at distinct coordinates are never shifted', () => {
        const renderer = makeRenderer();
        renderer.getRecordGeoJsonData({ resId: 1, data: { lng: 10, lat: 20, name: 'A' } });
        const geoJson = renderer.getRecordGeoJsonData({ resId: 2, data: { lng: 30, lat: 40, name: 'B' } });
        expect(geoJson.features[0].properties.isShifted).toBe(false);
    });

    test('returns null when coordinates are missing or non-finite', () => {
        const renderer = makeRenderer();
        const geoJson = renderer.getRecordGeoJsonData({ resId: 1, data: { lng: false, lat: 20, name: 'A' } });
        expect(geoJson).toBe(null);
    });

    test('skipShift bypasses the circular offset even for a repeated coordinate', () => {
        const renderer = makeRenderer();
        renderer.getRecordGeoJsonData({ resId: 1, data: { lng: 10, lat: 20, name: 'A' } });
        const geoJson = renderer.getRecordGeoJsonData({ resId: 2, data: { lng: 10, lat: 20, name: 'B' } }, true);
        expect(geoJson.features[0].properties.isShifted).toBe(false);
        expect(geoJson.features[0].geometry.coordinates).toEqual([10, 20]);
    });
});

describe('popup content', () => {
    test('calculateFeatureMeasurement formats a Point with N/E for positive lat/lng', () => {
        const renderer = Object.create(MapboxGlGeolocateRenderer.prototype);
        const result = renderer.calculateFeatureMeasurement({
            geometry: { type: 'Point', coordinates: [10.123456789, 20.987654321] },
        });
        expect(result.coordinates).toBe('20.987654°N, 10.123457°E');
    });

    test('calculateFeatureMeasurement formats a Point with S/W for negative lat/lng', () => {
        const renderer = Object.create(MapboxGlGeolocateRenderer.prototype);
        const result = renderer.calculateFeatureMeasurement({
            geometry: { type: 'Point', coordinates: [-10.123456789, -20.987654321] },
        });
        expect(result.coordinates).toBe('20.987654°S, 10.123457°W');
    });

    test('calculateFeatureMeasurement returns null for non-Point geometries', () => {
        const renderer = Object.create(MapboxGlGeolocateRenderer.prototype);
        expect(renderer.calculateFeatureMeasurement({ geometry: { type: 'LineString', coordinates: [] } })).toBe(null);
    });

    test('strips the internal originalProperties key from the rendered popup values', () => {
        const renderer = makeInstance(MapboxGlGeolocateRenderer, {});
        const feature = {
            geometry: { type: 'Point', coordinates: [10, 20] },
            properties: {
                color: '#048f86',
                isShifted: false,
                _originalProperties: { source: 'import' },
            },
        };
        const data = { title: 'Feature A', subTitle: 'Some street', resId: 1 };

        const values = renderer.generateMarkerPopupContentValues(data, feature);

        expect(values.originalProperties).toBe(undefined);
        expect(values.isShifted).toBe(false);
    });
});

describe('mounted view', () => {
    test('records without valid coordinates are excluded from the rendered map data', async () => {
        mockMapboxGlApi();

        const view = await mountView({
            type: 'mapbox_gl',
            resModel: 'res.partner',
            arch: ARCH,
        });

        const renderer = getMapRenderer(view);
        await waitUntil(() => renderer.geoJsonData.size > 0);

        // Only the 2 located records ever reach the map — the "No coords"
        // record (lat=0.0, lng=0.0) is excluded by mapDomain before
        // the RPC that fetches records is even sent.
        expect(renderer.props.list.records.length).toBe(2);
        expect(renderer.geoJsonData.size).toBe(2);

        getMapController(view); // sanity: controller resolves under the geolocate view too
    });

    test('clicking a feature opens its record through a form dialog', async () => {
        mockMapboxGlApi();

        let dialogProps;
        mockService('dialog', {
            add(component, props) {
                dialogProps = props;
                return () => {};
            },
        });

        const view = await mountView({
            type: 'mapbox_gl',
            resModel: 'res.partner',
            arch: ARCH,
        });

        const renderer = getMapRenderer(view);
        await waitUntil(() => renderer.geoJsonData.size > 0);

        // Feature interactions are driven through Mapbox's own event
        // system in production; there's no real canvas to click here, so
        // the captured handler is invoked directly instead — same
        // approach as clicking a marker in the analogous google_map test.
        renderer.boundHandleFeatureClick({ features: [{ properties: { resId: 1 } }] });

        expect(dialogProps).not.toBe(undefined);
        expect(dialogProps.resId).toBe(1);
        expect(dialogProps.resModel).toBe('res.partner');
    });
});
