# Web View Base Mapbox GL

## Overview

This is the foundation module for Mapbox GL JS map views in Odoo. It introduces a new "mapbox_gl" view type and provides the core infrastructure that specialized map modules build upon.

## What It Does

Adds the framework needed to display Odoo records on interactive Mapbox maps. This module provides the building blocks (controller, renderer, model, sidebar) that other modules extend to create specific map experiences like territory mapping or location tracking.

Think of this module as the blueprint - it doesn't display maps on its own, but enables other modules to do so.

## Key Features

- **New View Type**: Adds "mapbox_gl" as a valid Odoo view type alongside form, list, and kanban
- **Record Sidebar**: Displays a list of records alongside the map for easy navigation
- **Map-Record Sync**: Clicking a record highlights it on the map; clicking the map shows record details
- **Batch Selection**: Select multiple records on the map for bulk operations
- **Box-Zoom Selection**: Hold Shift and drag to draw a rectangle that selects all markers within it
- **Shift+Click Selection**: Hold Shift and click a marker to toggle its selection without opening the record
- **Grouping Support**: Group records by any field and collapse/expand groups on the map
- **Pager Integration**: Works with Odoo's standard pagination for large datasets
- **Search Integration**: Full compatibility with Odoo's search bar, filters, and group by
- **Action Menus**: Access standard Odoo actions (export, delete, archive) from the map view
- **Popup Information**: Hover over map features to see record details in popups
- **Center Map Button**: Re-fits the map to show all visible features with one click
- **Single Group-By Limit**: Only one active group-by is permitted at a time; a notification appears if a second one is selected

## Dependencies

- `base_mapbox_gl`

## Installation

1. Install the module through Odoo Apps
2. This module activates automatically when you install any module that depends on it

## Basic Usage

This module is not used directly. Instead, install one of the extending modules:
- **web_view_mapbox_gl_draw**: For displaying shapes and territories
- **web_view_mapbox_gl_geolocate**: For displaying location markers

## Related Modules

- `base_mapbox_gl`: Core Mapbox configuration (required)
- `web_view_mapbox_gl_draw`: Adds GeoJSON geometry rendering
- `web_view_mapbox_gl_geolocate`: Adds coordinate-based point mapping
- `web_widget_mapbox_gl`: Map widgets for form fields
