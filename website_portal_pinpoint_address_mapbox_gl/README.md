# Website Portal Pinpoint Address - Mapbox GL

## Overview

This module adds an interactive Mapbox map to the portal "My Address" form. Portal users can visually pinpoint their exact location by dragging a marker on the map, or let the module automatically geocode their address to suggest a starting point.

## What It Does

Adds a button to the portal address form that opens a map dialog. If the user has no stored coordinates yet, the map automatically geocodes their address and places the marker there. The user then drags the marker to their exact location and saves — the coordinates are stored on their partner record.

## Key Features

- **Pinpoint button**: Opens the map dialog. Shows as amber ("Set Location on Map") when no location is set yet, and green ("Update Location on Map") when coordinates already exist.
- **Auto-geocoding**: When opening the dialog for the first time, the module automatically geocodes the partner's address and places the marker at the suggested location — no manual navigation needed.
- **Geocoding fallback**: If the full address returns no result, the module retries with a simplified version (city, state, country only).
- **Draggable marker**: A red marker can be dragged to any location. The map re-centers on the marker after each drag.
- **Saves on confirm**: Clicking Save writes the marker's coordinates to the partner record.
- **Pre-filled location**: If coordinates already exist, the map opens centered on the existing location with the marker placed there.

## Dependencies

- `website`
- `portal`
- `base_mapbox_gl`

## Installation

1. Install the module through Odoo Apps.
2. Ensure a Mapbox API token is configured in Settings → General Settings: Mapbox GL JS.

## Basic Usage

1. Log in as a portal user and go to **My Account → Address**.
2. Click the **Set Location on Map** button.
3. The map opens with the marker automatically placed near your address.
4. Drag the red marker to your exact location.
5. Click **Save**.

## Related Modules

- `base_mapbox_gl`: Core Mapbox configuration and shared map components
- `website_route_planner_mapbox_gl`: Portal map interface for route planning
