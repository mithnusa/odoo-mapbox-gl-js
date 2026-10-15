import { Interaction } from '@web/public/interaction';
import { registry } from '@web/core/registry';
import { _t } from '@web/core/l10n/translation';
import { MapboxPinpointAddressDialog } from '../components/mapbox_dialog/mapbox_dialog';

export class AddressFormPinPointAddressMapbox extends Interaction {
    static selector = '.o_customer_address_fill';
    static selectorHas = '.mapbox_pinpoint_address';
    dynamicContent = {
        '#pinpoint_address': {
            't-on-click': this._onClickPinPointAddress.bind(this),
        },
    };

    _onClickPinPointAddress(ev) {
        const target = ev.currentTarget;
        const partnerId = parseInt(target.dataset.partnerId);
        const { partnerLatitude, partnerLongitude } = this._getPartnerLocation(target);
        const partnerFullAddress = target.dataset.partnerFullAddress;
        const partnerSimplifiedAddress = target.dataset.partnerSimplifiedAddress;

        if (!Number.isFinite(partnerId)) {
            this.services.notification.add(_t('Invalid partner ID. Cannot open the map dialog.'), { type: 'danger' });
            return;
        }

        this.services.dialog.add(MapboxPinpointAddressDialog, {
            partnerId,
            partnerFullAddress,
            partnerSimplifiedAddress,
            partnerLatitude,
            partnerLongitude,
            callbackUpdateLocation: this._updateAddressLocation.bind(this),
        });
    }

    _updateAddressLocation(latitude, longitude) {
        const button = this.el.querySelector('#pinpoint_address');
        if (button) {
            const { partnerLatitude, partnerLongitude } = this._getPartnerLocation(button);
            if (partnerLatitude === 0.0 && partnerLongitude === 0.0) {
                button.classList.remove('btn-outline-warning');
                button.classList.add('btn-outline-success');
                button.innerHTML = `
                <i class="fa fa-map-marker fa-fw" aria-hidden="true"></i>
                <span>${_t('Update Location on Map')}</span>
                `;
            }
        }
        this.el.querySelector('#pinpoint_address').dataset.partnerLatitude = latitude;
        this.el.querySelector('#pinpoint_address').dataset.partnerLongitude = longitude;
    }

    _getPartnerLocation(element) {
        const partnerLatitude = parseFloat(element.dataset.partnerLatitude);
        const partnerLongitude = parseFloat(element.dataset.partnerLongitude);
        return {
            partnerLatitude: Number.isFinite(partnerLatitude) ? partnerLatitude : 0.0,
            partnerLongitude: Number.isFinite(partnerLongitude) ? partnerLongitude : 0.0,
        };
    }
}

registry
    .category('public.interactions')
    .add(
        'website_portal_pinpoint_address_mapbox_gl.address_form_pinpoint_address_mapbox_gl',
        AddressFormPinPointAddressMapbox
    );
