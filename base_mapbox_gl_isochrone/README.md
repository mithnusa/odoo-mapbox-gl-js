# Base Mapbox GL JS Isochrone

## Overview

This module provides a reusable "can this location be reached within N minutes" building block. It computes a single travel-time or travel-distance zone (an isochrone) around a record's coordinates and stores the result, so other modules — such as field service dispatch matching — can reuse it without recomputing anything.

## What It Does

Adds the ability for any Odoo model with coordinates to compute and store a reachable-area zone (for example, "everywhere reachable in 20 minutes by car" or "everywhere within 5 km on foot"). The zone is computed on demand, not automatically, since each computation counts against Mapbox's API usage. It also provides a map field that shows the stored zone on an interactive map.

## Key Features

- **On-Demand Zone Computation**: Compute a zone for a record whenever you need it — no automatic recomputation or background jobs
- **Three Travel Profiles**: Driving, walking, or cycling
- **Time or Distance Zones**: Define the zone by travel time (1 to 60 minutes) or by travel distance (1 to 100,000 meters)
- **Outdated Zone Detection**: An indicator flags when a record's coordinates, travel profile, or time/distance settings have changed since its zone was last computed. It updates as you edit the record and never triggers a new API call
- **Map Display**: A map field shows the zone on an interactive map, fitted to the zone, with a marker at the record's location and the standard map controls (zoom, style switcher, fullscreen). The total area of the zone and the farthest distance it reaches from the record's location are shown below the map, in both metric and imperial units
- **Safe Handling of Changes**: Switching between time and distance clears the current zone and shows a warning, so an old zone is never shown for new settings
- **Controlled API Usage**: Only users who can edit a record can recompute its zone, and at most 10 records can be recomputed at once

## Dependencies

- `base_mapbox_gl`
- `web_view_mapbox_gl_draw`

## Installation

1. Install the module through Odoo Apps
2. Make sure the Mapbox access token is set in the Mapbox GL settings (computing a zone requires it)
3. This module adds no menus or views on its own — install an application-specific module that uses it (for example, a field service dispatch module)

## Basic Usage

This is a technical building block, not a standalone feature. It becomes usable once another installed module adds it to one of its own records (for example, a technician or a service location) and exposes a "Recompute" action on that record's form. After the zone is computed, it is stored on the record and can be shown on the map field.

## Related Modules

- `base_mapbox_gl`: Core configuration and Mapbox API access for the whole suite
- `web_view_mapbox_gl_draw`: Provides the GeoJSON storage field this module reuses to hold the computed zone
- `fieldservice_dispatch_mapbox_gl`: Uses this module to match field service orders to technicians by reachable zone
