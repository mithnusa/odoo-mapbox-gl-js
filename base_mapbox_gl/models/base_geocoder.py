import requests
import logging
from urllib.parse import quote

from odoo import api, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class BaseGeocoder(models.AbstractModel):
    _inherit = 'base.geocoder'

    @api.model
    def _call_mapbox(self, addr, **kw):
        if not isinstance(addr, str) or not addr.strip():
            _logger.warning(
                'Mapbox Geocoding skipped: empty or blank address provided'
            )
            return None

        IrConfigSudo = self.env['ir.config_parameter'].sudo()
        mapbox_token = IrConfigSudo.get_param(
            'base_mapbox_gl.access_token', default=''
        )
        if not mapbox_token:
            raise UserError(
                self.env._(
                    'Mapbox access token is not configured. Please set it in the Mapbox GL settings.'
                )
            )

        url = f'https://api.mapbox.com/geocoding/v5/mapbox.places/{quote(addr)}.json'
        params = {
            'access_token': mapbox_token,
            'limit': kw.get('limit', 1),
        }
        if 'proximity' in kw:
            params['proximity'] = kw['proximity']
        if 'country' in kw:
            params['country'] = kw['country']

        web_base_url = IrConfigSudo.get_param('web.base.url', default='')
        headers = {'Referer': web_base_url} if web_base_url else {}

        try:
            response = requests.get(
                url, params=params, headers=headers, timeout=5
            )
            response.raise_for_status()
            json_data = response.json()

            if not (features := json_data.get('features', [])):
                _logger.warning(
                    'Mapbox Geocoding returned no results for address: %s',
                    addr,
                )
                return None

            longitude, latitude = features[0]['geometry']['coordinates']
            return float(latitude), float(longitude)
        except requests.RequestException as e:
            _logger.error('Mapbox Geocoding API request failed: %s', e)
            self._raise_query_error(e)
        except (ValueError, TypeError, KeyError) as e:
            _logger.error('Error parsing Mapbox Geocoding response: %s', e)
            return None
        except Exception as e:
            _logger.error('Unexpected error during Mapbox Geocoding: %s', e)
            return None
