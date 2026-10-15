# Contacts Mapbox GL

## Overview

This module adds an interactive map view to Odoo Contacts. It lets you see all your contacts plotted on a Mapbox map based on their geocoded addresses, with contact photos visible both in the sidebar list and in the popup that appears when you click a marker.

## What It Does

Adds a **Map** view option to the Contacts application alongside the existing list, kanban, and form views. Each geocoded contact appears as a color-coded circle marker. Contacts sharing the same address are automatically spread apart so they remain individually selectable. A sidebar shows the full contact list in sync with what is visible on the map.

## Key Features

- **Map View in Contacts**: A dedicated map view is available from the Contacts view switcher, no extra steps required
- **Contact Avatars**: Contact photos appear in both the sidebar list and the popup when clicking a marker
- **Contact Address in Sidebar**: Full formatted address is shown as the subtitle under each contact name in the sidebar
- **Custom Marker Colors**: Assign a color to each contact using a color picker on the contact form; that color is used for their map marker
- **Marker Clustering**: At low zoom levels, nearby contacts group into numbered cluster bubbles; clicking a cluster zooms in to reveal individual markers
- **Overlap Separation**: When multiple contacts share the exact same coordinates, they are automatically spread into a circular arrangement with dotted lines connecting them to their shared location
- **Shifted Marker Indicator**: An info icon appears in the popup of any contact whose marker has been offset, with a tooltip pointing back to their true location
- **Multi-Selection**: Hold Shift and click markers to select multiple contacts; draw a selection box by holding Shift and dragging on the map; when clustering is enabled, box selection also captures contacts inside visible cluster bubbles (up to 100 per cluster)
- **Automatic Geocoding**: A scheduled task runs every 12 hours to automatically assign coordinates to contacts that have an address but no latitude/longitude yet

## Dependencies

- `base_geolocalize`
- `contacts`
- `web_view_mapbox_gl_geolocate`

## Installation

1. Install the module through Odoo Apps
2. Ensure your Mapbox access token is configured in Settings
3. Make sure contacts have latitude/longitude coordinates (use the Geo Localization section on the contact form to geocode them)

## Basic Usage

1. Open the **Contacts** application
2. Click the **Map** view icon in the view switcher (top-right)
3. Geocoded contacts appear as circle markers on the map
4. Click any marker to see the contact's name, address, and photo
5. Click a contact in the sidebar to fly the map to their marker
6. Use the sidebar to browse and click records; the map highlights the corresponding marker

## Setting Marker Colors

1. Open a contact's form view
2. Scroll to the **Geo Localization** section
3. Use the **Marker Color** picker to assign a color
4. The contact will display with that color on the map

## Related Modules

- `base_mapbox_gl`: Core Mapbox configuration and access token
- `web_view_mapbox_gl_geolocate`: Base geolocate map view that this module extends
- `base_geolocalize`: Odoo's built-in geocoding for converting addresses to coordinates
