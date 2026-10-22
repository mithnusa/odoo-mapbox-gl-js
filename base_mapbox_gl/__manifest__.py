# -*- coding: utf-8 -*-
{
    "name": "Base Mapbox GL JS",
    "summary": "Core Mapbox GL JS library, configuration, and shared map components",
    "description": """
Base Mapbox GL JS
=================

Foundation module that powers all Mapbox GL JS integrations.

Key Features
------------
* Centralized Mapbox API token configuration via System Parameters
* Dynamic asset loader for Mapbox GL JS (CSS + JS) with error handling
* Shared map core: styles, language switching, geocoding, and display controls
* Reusable BaseMapboxGlComponent and MapboxGlMixin for building map views and widgets
* Mapbox Search component for address lookup
* 10 built-in map styles (streets, satellite, terrain, and more)

This module is a technical dependency — it provides no standalone UI.
Install one of the application-specific Mapbox modules to add map views
to Contacts, Partners, or other models.
    """,
    "license": "LGPL-3",
    "author": "Yopi Angi",
    "website": "https://www.mithnusa.com",
    "support": "yopiangi@gmail.com",
    "category": "Hidden",
    "version": "20.0.1.0.0",
    "depends": ["web", "base_geolocalize"],
    "data": [
        "data/data.xml",
        "views/res_config_settings.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "base_mapbox_gl/static/src/utils/**/*",
            "base_mapbox_gl/static/src/components/**/*",
        ],
        "web.assets_unit_tests": [
            "base_mapbox_gl/static/tests/**/*",
        ],
    },
}
