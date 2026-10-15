import time
import logging
from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = "res.partner"

    marker_color = fields.Integer(
        string="Marker Color",
        default=1,
        help="Color of the marker on the map. You can choose a color from the color picker in the partner form view.",
    )

    @api.model
    def action_mapbox_cron_geolocalize(self):
        partner_ids = self.env[self._name].search(
            [
                ("country_id", "!=", False),
                ("partner_latitude", "=", False),
                ("partner_longitude", "=", False),
                "|",
                "|",
                "|",
                ("city", "!=", False),
                ("zip", "!=", False),
                ("street", "!=", False),
                ("street2", "!=", False),
            ],
            limit=80,
        )
        geo_provider_id = self.env["base.geocoder"]._get_provider()
        openstreetmap_provider_id = self.env.ref(
            "base_geolocalize.geoprovider_open_street",
            raise_if_not_found=False,
        )
        is_openstreet_provider = (
            openstreetmap_provider_id
            and geo_provider_id
            and geo_provider_id.tech_name
            == openstreetmap_provider_id.tech_name
        )
        # Need to add pause between partner to avoid hitting API rate limits
        for partner in partner_ids:
            try:
                with self.env.cr.savepoint():
                    partner.geo_localize()
            except Exception:
                _logger.warning(
                    "Failed to geolocalize partner %s (%s)",
                    partner.name,
                    partner.id,
                    exc_info=True,
                )

            if is_openstreet_provider:
                time.sleep(
                    1
                )  # Sleep for 1 second between geolocalization calls
