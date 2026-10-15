import logging
from odoo import fields
from odoo.http import request, route
from odoo.addons.portal.controllers.portal import CustomerPortal

_logger = logging.getLogger(__name__)


class CustomerPortalPinpointAddress(CustomerPortal):
    def _prepare_address_form_values(self, partner_sudo, *args, **kwargs):
        values = super()._prepare_address_form_values(
            partner_sudo, *args, **kwargs
        )
        address_parts = [
            partner_sudo.street,
            partner_sudo.street2,
            partner_sudo.city,
            partner_sudo.state_id.name if partner_sudo.state_id else None,
            partner_sudo.zip,
            partner_sudo.country_id.name if partner_sudo.country_id else None,
        ]
        partner_full_address = ", ".join(
            p.strip() for p in address_parts if p and p.strip()
        )
        partner_simplified_address = ", ".join(
            p.strip()
            for p in [
                partner_sudo.city,
                partner_sudo.state_id.name if partner_sudo.state_id else None,
                (
                    partner_sudo.country_id.name
                    if partner_sudo.country_id
                    else None
                ),
            ]
            if p and p.strip()
        )
        values.update(
            {
                "partner_full_address": partner_full_address,
                "partner_simplified_address": partner_simplified_address,
            }
        )
        return values

    @route(["/my/address/pinpoint"], type="jsonrpc", auth="user", website=True)
    def pinpoint_address(self, partner_id, latitude, longitude):
        try:
            partner = int(partner_id)
            partner_latitude = float(latitude)
            partner_longitude = float(longitude)
        except (ValueError, TypeError):
            return {
                "status": "error",
                "message": self.env._(
                    "Invalid input data. Please provide valid partner ID, latitude, and longitude."
                ),
            }

        partner_sudo = request.env["res.partner"].sudo().browse(partner)
        if not partner_sudo.exists():
            return {
                "status": "error",
                "message": self.env._("The specified partner does not exist."),
            }

        if not partner_sudo._can_be_edited_by_current_customer():
            return {
                "status": "error",
                "message": self.env._(
                    "You do not have permission to update this address location."
                ),
            }

        # Validate latitude and longitude values
        if not (-90 <= partner_latitude <= 90) or not (
            -180 <= partner_longitude <= 180
        ):
            return {
                "status": "error",
                "message": self.env._(
                    "Invalid latitude or longitude values. Latitude must be between -90 and 90, and longitude must be between -180 and 180."
                ),
            }

        try:
            partner_sudo.write(
                {
                    "partner_latitude": partner_latitude,
                    "partner_longitude": partner_longitude,
                    "date_localization": fields.Date.today(),
                }
            )
            return {
                "status": "success",
                "message": self.env._("Address location updated successfully"),
            }
        except Exception as e:
            _logger.error(
                "Error updating address location for partner %s: %s",
                partner_id,
                str(e),
            )
            return {
                "status": "error",
                "message": self.env._(
                    "Failed to update address location. Please try again."
                ),
            }
