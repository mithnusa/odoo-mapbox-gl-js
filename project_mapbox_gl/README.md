# Project Mapbox GeoJSON

## Overview

This module adds interactive Mapbox map views and GeoJSON geometry drawing to Odoo's Project module. Projects and Tasks each get their own mapbox view and a "Site Area" tab on the form where geographic data can be drawn and stored.

## What It Does

Extends `project.project` and `project.task` with geographic fields, a drawing canvas, and a new "Mapbox" view type. On installation the mapbox view is injected into the standard Project and Task menus automatically; on uninstallation it is removed cleanly.

## Key Features

- **Mapbox view for Projects**: Displays all projects that have geographic data on an interactive Mapbox map, with colour coding and project name labels. Clicking a project opens a sidebar with a "View Tasks" shortcut.
- **Mapbox view for Tasks**: Displays tasks on an interactive Mapbox map. Each task's parent project geometry is rendered as an orange context overlay so spatial relationships are visible at a glance.
- **Site tab on Projects**: Draw polygons, lines, points, circles, rectangles, and text label annotations on a mapbox inside the project form. Area is calculated and stored automatically. Includes a colour picker and an HTML notes field.
- **Site tab on Tasks**: Same full drawing canvas as the project form. The parent project's geometry is rendered beneath the task's drawing as five orange layers (polygon fill, dashed outline, plain point circle, label anchor, and label text). The project's total area is displayed as a read-only figure below the canvas.
- **Label annotations**: Place named text labels anywhere on the map. Click the label button in the toolbar, click the mapbox to position it, and enter the text. Labels are stored alongside other geometry and can be edited or deleted at any time.
- **Automatic menu integration**: The mapbox view is added to all standard Project and Task window actions on install and removed on uninstall — no manual configuration required.

## Dependencies

- `project`
- `web_view_mapbox_gl_draw`
- `web_widget_mapbox_gl`

## Installation

1. Install the module through Odoo Apps.
2. Make sure a Mapbox access token is configured in Settings → Technical → System Parameters (`mapbox.access_token`).

## Basic Usage

1. Open the **Projects** list and click the mapbox icon to switch to the Mapbox view.
2. Open any project, go to the **Site** tab, and draw geographic features directly on the map.
3. Click **Save** in the drawing toolbar to commit the geometry to the record.
4. Open a **Task**, go to the **Site** tab to draw task-level geometry. The parent project's geometry is shown as an orange overlay (fill, outline, points, and labels) and its area is displayed below the canvas.
5. Use the **label button** (font icon) in the drawing toolbar to place a named text annotation — click the button, click the mapbox to position it, then type the label text.

## Related Modules

- `web_view_mapbox_gl_draw`: Provides the `mapbox_gl` view type used by both the Project and Task mapbox views.
- `web_widget_mapbox_gl`: Provides the `mapbox_gl_draw_geojson` form widget used in the Site tabs.
- `base_mapbox_gl`: Core Mapbox GL configuration and API token management (required transitively).
