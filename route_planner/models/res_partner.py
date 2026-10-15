from odoo import models
from odoo.fields import Domain
from .utils import (
    ROUTE_STATE_DRAFT,
    ROUTE_STATE_DONE,
    ROUTE_STATE_CANCELLED,
    ROUTE_STATE_IN_PROGRESS,
    ROUTE_STOP_STATE_DONE,
    ROUTE_STOP_STATE_ARRIVED,
    ROUTE_STOP_STATE_CANCELLED_OR_SKIPPED,
)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    def write(self, vals):
        """Propagate partner coordinate changes to route planner snapshot fields.
        Uses context keys to control domain scope:
        - update_route_stop=True: relax the stop-line domain to include non-done, non-arrived, non-cancelled stops
        - update_route_departure=True: relax the departure domain to include non-done, non-in-progress, non-cancelled routes
        Only fires when coordinates are written as non-zero (0.0 means geocoding failed or cleared).
        """
        res = super().write(vals)

        # If the partner's geolocation has changed, update related route stops
        if any(
            field in vals and vals[field] != 0.0
            for field in [
                'partner_latitude',
                'partner_longitude',
            ]
        ):
            # Route stops
            domain_stops = Domain('stop_id', 'in', self.ids)
            if self.env.context.get('update_route_stop'):
                domain_stops = Domain.AND(
                    [
                        domain_stops,
                        Domain(
                            'state',
                            'not in',
                            (
                                ROUTE_STOP_STATE_DONE,
                                ROUTE_STOP_STATE_ARRIVED,
                                ROUTE_STOP_STATE_CANCELLED_OR_SKIPPED,
                            ),
                        ),
                    ]
                )
            else:
                domain_stops = Domain.AND(
                    [
                        domain_stops,
                        Domain(
                            'route_planner_id.state', '=', ROUTE_STATE_DRAFT
                        ),
                    ]
                )

            route_line_ids = self.env['route.planner.line'].search(
                domain_stops
            )
            for line in route_line_ids:
                # Recompute geolocation for the stop
                if (
                    line.stop_id.partner_latitude != 0.0
                    and line.stop_id.partner_longitude != 0.0
                ):
                    line.write(
                        {
                            'stop_latitude': line.stop_id.partner_latitude,
                            'stop_longitude': line.stop_id.partner_longitude,
                            'stop_address': line.stop_id.contact_address,
                        }
                    )

            # Route departures
            domain_route = Domain('departure_id', 'in', self.ids)
            if self.env.context.get('update_route_departure'):
                domain_route = Domain.AND(
                    [
                        domain_route,
                        Domain(
                            'state',
                            'not in',
                            (
                                ROUTE_STATE_DONE,
                                ROUTE_STATE_IN_PROGRESS,
                                ROUTE_STATE_CANCELLED,
                            ),
                        ),
                    ]
                )
            else:
                domain_route = Domain.AND(
                    [
                        domain_route,
                        Domain('state', '=', ROUTE_STATE_DRAFT),
                    ]
                )

            route_ids = self.env['route.planner'].search(domain_route)
            for route in route_ids:
                if (
                    route.departure_id.partner_latitude != 0.0
                    and route.departure_id.partner_longitude != 0.0
                ):
                    route.write(
                        {
                            'departure_latitude': route.departure_id.partner_latitude,
                            'departure_longitude': route.departure_id.partner_longitude,
                            'departure_address': route.departure_id.contact_address,
                        }
                    )
        return res
