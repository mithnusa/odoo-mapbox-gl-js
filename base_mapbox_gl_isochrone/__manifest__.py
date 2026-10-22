# -*- coding: utf-8 -*-
{
    "name": "Base Mapbox GL JS Isochrone",
    "summary": "Reusable 'reachable within N minutes' mixin backed by the Mapbox Isochrone API",
    "description": """
Base Mapbox GL JS Isochrone
============================

Foundation mixin for computing and storing a single travel-time isochrone
zone (e.g. "reachable in 20 minutes") against any model that carries
coordinates. Built for field service dispatch matching, but usable by any
future module needing the same "can this location be reached within N
minutes" primitive.

Key Features
------------
* Abstract `base.mapbox.isochrone` mixin adding isochrone profile, minutes,
  GeoJSON result, and computed-on fields to any inheriting model
* Manual "Recompute" action — no automatic recompute or cron, since the
  Mapbox Isochrone API is billed per request and rate-limited
* Passive staleness flag surfaced next to the recompute action, without
  firing an API call on its own
* Server-side computation (plain `requests`), so results are available
  without a map open

This is a technical dependency — it provides no standalone UI or view.
A consuming module must inherit `base.mapbox.isochrone`, set
`_isochrone_coordinate_fields` to its own latitude/longitude field names,
and expose the recompute action in its own views.
    """,
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://www.mithnusa.com",
    "support": "yopiangi@gmail.com",
    "category": "Hidden",
    "version": "20.0.1.0.0",
    "depends": ["base_mapbox_gl", "web_view_mapbox_gl_draw"],
    "assets": {
        "web.assets_backend": [
            "base_mapbox_gl_isochrone/static/src/widgets/*",
        ],
    },
}
