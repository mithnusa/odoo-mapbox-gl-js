import { onMounted, signal, t, useProps } from '@odoo/owl';
import { Dialog } from '@web/core/dialog/dialog';
import { _t } from '@web/core/l10n/translation';
import { useService } from '@web/core/utils/hooks';
import { rpc } from '@web/core/network/rpc';
import { BaseMapboxGlComponent } from '@base_mapbox_gl/utils/base_mapbox_gl';

export class MapboxPinpointAddressDialog extends BaseMapboxGlComponent {
    static template = 'website_portal_pinpoint_address_mapbox_gl.MapboxPinpointAddressDialog';
    static components = {
        Dialog,
    };
    static propsSchema = {
        title: t.string().optional(_t('Pinpoint Address')),
        close: t.function(),
        callbackUpdateLocation: t.function(),
        partnerId: t.number(),
        partnerLatitude: t.number(),
        partnerLongitude: t.number(),
        partnerFullAddress: t.string(),
        partnerSimplifiedAddress: t.string(),
    };
    props = useProps(this.constructor.propsSchema);

    setup() {
        super.setup();
        this.notificationService = useService('notification');
        this.mapboxRef = signal.ref();
        this.pinPointMarker = null;

        onMounted(() => {
            const el = this.mapboxRef();
            if (!el) return;
            // flex-grow on inner elements only works when every ancestor in the
            // chain has a definite height (not just max-height). Bootstrap modals
            // use max-height by default, so we must set an explicit height here.
            const modalDialog = el.closest('.modal-dialog');
            const modalContent = el.closest('.modal-content');
            const modalBody = el.closest('.modal-body');
            if (modalDialog) modalDialog.style.height = 'calc(100% - 3.5rem)';
            if (modalContent) modalContent.style.height = '100%';
            if (modalBody) {
                modalBody.style.display = 'flex';
                modalBody.style.flexDirection = 'column';
                modalBody.style.flex = '1';
                modalBody.style.minHeight = '0';
            }
        });
    }

    mapOptions() {
        return Object.assign(super.mapOptions(), {
            // disable map rotation to simplify user interaction for pinpointing
            dragRotate: false,
            touchZoomRotate: false,
            maxZoom: 18, // limit max zoom to prevent users from zooming in too much
        });
    }

    addMapControl() {
        super.addMapControl();
        const navControl = new window.mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false, // we only want to use geolocation for its "locate" functionality, not continuous tracking
        });
        this.mapBoxGlJs.addControl(navControl, 'bottom-right');
    }

    onMapLoaded() {
        super.onMapLoaded();
        const { partnerLatitude, partnerLongitude } = this.props;
        if (this.mapBoxGlJs) {
            this.mapBoxGlJs.resize();
            if (partnerLatitude === 0.0 && partnerLongitude === 0.0) {
                this.mapboxGeolocateAddress();
            } else {
                this.renderLocation(partnerLatitude, partnerLongitude);
            }
        }
    }

    renderLocation(lat, lng) {
        let zoom = 16;
        if (lat === 0.0 && lng === 0.0) {
            // default to world view if no valid coordinates
            zoom = 3;
        }
        const coords = [lng, lat];
        this.mapBoxGlJs.flyTo({
            zoom,
            center: coords,
        });

        if (this.pinPointMarker) {
            this.pinPointMarker.remove();
        }

        this.pinPointMarker = new window.mapboxgl.Marker({
            draggable: true,
            color: '#FF0000',
        })
            .setLngLat(coords)
            .addTo(this.mapBoxGlJs);

        this.pinPointMarker.on('dragend', () => {
            const lngLat = this.pinPointMarker.getLngLat();
            // recenter the map on the new marker position
            this.mapBoxGlJs.easeTo({ center: lngLat });
        });
    }

    async onConfirm() {
        if (this.pinPointMarker && Number.isFinite(this.props.partnerId)) {
            const lngLat = this.pinPointMarker.getLngLat();
            try {
                const resp = await rpc('/my/address/pinpoint', {
                    partner_id: this.props.partnerId,
                    latitude: lngLat.lat,
                    longitude: lngLat.lng,
                });
                if (resp?.status === 'success') {
                    if (typeof this.props.callbackUpdateLocation === 'function') {
                        this.props.callbackUpdateLocation(lngLat.lat, lngLat.lng);
                    }
                    this.notificationService.add(resp?.message || _t('Address location updated successfully.'), {
                        type: 'success',
                    });
                    this.props.close();
                } else {
                    this.notificationService.add(
                        resp?.message ||
                            _t('Failed to update address location. If the problem persists, please contact support.'),
                        { type: 'danger' }
                    );
                }
            } catch (error) {
                this.notificationService.add(_t('An error occurred while updating the address location'), {
                    type: 'danger',
                });
            }
        } else {
            this.props.close();
        }
    }

    async _fetchMapboxGeocode(address, settings) {
        const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
        url.searchParams.set('q', address);
        url.searchParams.set('language', settings.language || 'en');
        url.searchParams.set('limit', '1');
        url.searchParams.set('access_token', settings.access_token);
        const response = await fetch(url.toString());
        if (!response.ok) return null;
        const data = await response.json();
        const feature = data?.features?.[0];
        if (!feature) return null;
        const [lng, lat] = feature.geometry.coordinates;
        return { lat, lng };
    }

    async mapboxGeolocateAddress() {
        const { partnerFullAddress, partnerSimplifiedAddress } = this.props;
        const settings = this._getMapboxState().settings;
        if (!settings?.access_token) return;

        try {
            let coords = null;
            if (partnerFullAddress) {
                coords = await this._fetchMapboxGeocode(partnerFullAddress, settings);
            }
            if (!coords && partnerSimplifiedAddress) {
                coords = await this._fetchMapboxGeocode(partnerSimplifiedAddress, settings);
            }
            // renderLocation() replaces any existing pinPointMarker itself.
            this.renderLocation(coords?.lat ?? 0.0, coords?.lng ?? 0.0);
        } catch {
            // silent — geocoding is best-effort
        }
    }

    async _fetchNominatimGeocode(address) {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', address);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '1');
        // Nominatim's usage policy asks for either a descriptive User-Agent or an
        // identifying Referer. Browsers treat User-Agent as a forbidden header —
        // JS cannot set it; the browser sends its own value regardless of what's
        // passed here. This request relies on the browser's automatic Referer
        // header (this Odoo page) to identify the application instead. For
        // guaranteed compliance, route this through a backend endpoint, where a
        // custom User-Agent can actually be set.
        const response = await fetch(url.toString());
        if (!response.ok) return null;
        const data = await response.json();
        const result = data?.[0];
        if (!result) return null;
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    }

    async nominatimGeolocateAddress() {
        const { partnerFullAddress, partnerSimplifiedAddress } = this.props;

        try {
            let coords = null;
            if (partnerFullAddress) {
                coords = await this._fetchNominatimGeocode(partnerFullAddress);
            }
            if (!coords && partnerSimplifiedAddress) {
                coords = await this._fetchNominatimGeocode(partnerSimplifiedAddress);
            }
            // renderLocation() replaces any existing pinPointMarker itself.
            this.renderLocation(coords?.lat ?? 0.0, coords?.lng ?? 0.0);
        } catch {
            // silent — geocoding is best-effort
        }
    }

    get containerElement() {
        return this.mapboxRef;
    }

    get defaultMapCenter() {
        const { partnerLatitude, partnerLongitude } = this.props;
        if (
            Number.isFinite(partnerLatitude) &&
            Number.isFinite(partnerLongitude) &&
            !(partnerLatitude === 0.0 && partnerLongitude === 0.0)
        ) {
            return [partnerLongitude, partnerLatitude];
        }
        return super.defaultMapCenter;
    }

    get mapControlPosition() {
        return Object.assign(super.mapControlPosition, {
            pitchToggle: 'bottom-left',
        });
    }

    cleanUp() {
        if (this.pinPointMarker) {
            this.pinPointMarker.remove();
            this.pinPointMarker = null;
        }
        super.cleanUp();
    }
}
