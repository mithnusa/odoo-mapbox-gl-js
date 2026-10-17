// web_view_mapbox_gl_geolocate/static/tests/helpers/mapbox_gl_test_helpers.js
//
// This view's own boundary beyond the generic Mapbox GL JS fakes (shared
// from base_mapbox_gl — a hard dependency via web_view_base_mapbox_gl):
// checkInternetConnection() is patched on BaseMapboxGlComponent.prototype,
// since this renderer extends that class.
//
// There's a second, smaller vendor boundary: BaseMapboxGlRenderer's own
// template mounts <Search/> (MapboxGlSearch) as soon as mapboxState.isMapReady
// flips true — i.e. right when every test here starts polling. That
// component loads the real Mapbox Search JS bundle and, once loaded, builds
// a real MapboxSearchBox control and immediately calls mapbox.getBounds()/
// getContainer() on it — API our fake map doesn't reproduce faithfully
// enough to trust. initializeSearchBox() is patched to a no-op so that path
// never runs; nothing under test here exercises the search box.

import { patchWithCleanup } from '@web/../tests/web_test_helpers';
import { BaseMapboxGlComponent } from '@base_mapbox_gl/utils/base_mapbox_gl';
import { MapboxGlSearch } from '@base_mapbox_gl/components/mapbox_search/mapbox_search';
import {
    mockCheckInternetConnection,
    mockMapboxGlSettings,
    waitUntil,
} from '@base_mapbox_gl/../tests/helpers/mapbox_gl_test_helpers';

export { waitUntil };

/**
 * Mocks the /web/mapbox_gl/settings RPC, pre-seeds window.mapboxgl so
 * loadAssets() takes its "already loaded" fast path, and patches
 * checkInternetConnection() so mounting never depends on a real network
 * request. Call from a beforeEach() in any test that mounts a
 * *_mapbox_gl(_geolocate) view.
 */
export function mockMapboxGlApi() {
    mockMapboxGlSettings();
    mockCheckInternetConnection(BaseMapboxGlComponent.prototype);

    // See the module docstring above — never build a real search box
    // control against the fake map.
    patchWithCleanup(MapboxGlSearch.prototype, {
        initializeSearchBox() {},
    });
}
