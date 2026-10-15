# Base Mapbox GL JS

## Overview

This is the foundation module for all Mapbox GL JS integration in Odoo. It manages your Mapbox configuration, provides geocoding services, bundles the required mapping libraries, and supplies the core building blocks that every other Mapbox module in this suite depends on.

## What It Does

Installs the Mapbox GL JS library into Odoo and wires up centralized settings so every map-enabled feature across your system uses the same token and visual preferences. It also registers Mapbox as a geocoding provider so Odoo can convert addresses to coordinates, and includes a location search component that any map view can embed.

## Key Features

- **Centralized Configuration**: Manage your Mapbox access token and all default map settings from a single place in Odoo's Settings menu
- **10 Preset Map Styles**: Choose from Standard, Standard Satellite, Streets, Outdoors, Light, Dark, Satellite Streets, Navigation Day, Navigation Night, or OpenStreetMap — or supply your own custom Mapbox Studio style URL
- **On-Map Style Switcher**: An interactive control embedded in every map that lets users switch between 6 quick-access styles (Standard, Satellite, Streets, Outdoors, Hybrid, OSM), plus lighting, theme, and language, without leaving the view
- **Globe / Mercator Projection**: Set a default projection in Settings, and let users switch between a 3D globe and a flat Mercator view on the fly with a dedicated on-map toggle button
- **Lighting & Theme Customization**: Four lighting presets (Dawn, Day, Dusk, Night) and three themes (Default, Faded, Monochrome) for Standard styles
- **36 Languages Supported**: Display map labels in Arabic, Chinese, English, French, German, Japanese, Spanish, and many more
- **Mapbox Geocoding**: Adds Mapbox as an address-to-coordinates provider that integrates with Odoo's existing geocoder framework
- **Location Search**: A search box component that finds addresses and points of interest and flies the map to the selected location
- **Navigation Controls**: Zoom buttons, compass, fullscreen toggle, and a distance scale bar are added to every map automatically
- **2D/3D View Toggle**: A button that switches between a flat top-down view and a tilted 3D perspective with a single click
- **Fly-to-Zoom Button**: An optional button map views can enable that flies the map progressively closer using an adaptive zoom step that shrinks as you approach maximum zoom
- **3D Terrain Toggle**: An optional button map views can enable that turns on real-elevation terrain with hillshading and a tilted camera perspective; clicking again returns the map to flat terrain
- **Offline Detection & Auto-Retry**: Detects when the internet is unavailable, shows a clear warning, and automatically retries when connectivity returns
- **CDN-Loaded Libraries**: Loads Mapbox GL JS, Mapbox GL Draw, the Mapbox Search Box SDK, and Turf.js directly from their official CDNs — no separate installation required, and you always get the pinned library versions without bloating your Odoo assets bundle

## Dependencies

- `web`
- `base_geolocalize`

## Installation

1. Install the module through Odoo Apps
2. Go to **Settings > General Settings > Integrations > Mapbox GL JS**
3. Enter your Mapbox Access Token (get one free at [mapbox.com](https://www.mapbox.com))
4. Optionally configure your preferred map style, projection, lighting, theme, and language

## Basic Configuration

| Setting | Description |
| --- | --- |
| Access Token | Your Mapbox API token (required for all maps) |
| Map Style | Select from 10 presets or enter a custom Mapbox Studio style URL |
| Projection | Globe (3D) or Mercator (flat) |
| Lighting | Lighting preset for Standard styles (Dawn / Day / Dusk / Night) |
| Theme | Visual theme for Standard styles (Default / Faded / Monochrome) |
| Language | Language used for all map labels |

## Related Modules

- `web_view_base_mapbox_gl`: Adds a "Map" view type for visualizing Odoo records on a map
- `web_widget_mapbox_gl`: Adds an interactive form field widget for drawing and editing GeoJSON geometry (points, lines, polygons, circles) on an embedded map
- `web_view_mapbox_gl_draw`: Adds a map view that displays stored GeoJSON geometry (polygons, lines, points) with automatic area/length measurements and a details sidebar
- `web_view_mapbox_gl_geolocate`: Adds coordinate-based point mapping with smart overlap handling
