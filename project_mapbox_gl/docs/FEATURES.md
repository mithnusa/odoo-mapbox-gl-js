# Project Mapbox GeoJSON - Features

## Map Views

### Project Map View

**What it does**: Adds a "Map" view to the Projects list that displays all projects with geographic data on an interactive Mapbox map. Clicking a project opens a sidebar that includes a "View Tasks" button to navigate directly to the project's task list.

**Why it matters**: Gives project managers a spatial overview of where projects are located without leaving Odoo, and provides a one-click path from the map to the related tasks.

**How it works**: Each project is represented on the map using the geometry stored in its `mapbox_geojson` field, coloured according to the project's `mapbox_color` value and labelled with the project name and customer. The sidebar's "View Tasks" action calls `project.project.action_view_tasks` on the server and opens the result as a standard Odoo window action.

---

### Task Map View

**What it does**: Adds a "Map" view to the Tasks list that displays tasks on an interactive Mapbox map. The parent project's geometry is rendered as an orange context overlay beneath each task's own geometry.

**Why it matters**: Lets teams see which tasks are tied to specific locations, understand the geographic spread of work across a project, and instantly see whether a task's geometry falls within the project boundary.

**How it works**: Each task is shown on the map using its own `mapbox_geojson` field, labelled with the task name and parent project. For each unique parent project found in the visible tasks, a dedicated GeoJSON source is added to the map and five orange overlay layers are rendered (polygon fill, dashed outline, plain point circle, label anchor circle, and label text) using `PROJECT_COLOR` (`#ff5100`) so the project boundary is visually distinct from the task's own data-driven colours.

---

## Geographic Data Drawing

### Project Site Drawing Canvas

**What it does**: Adds a "Site Area" tab to the project form with a full drawing canvas where users can draw polygons, lines, points, circles, rectangles, and text label annotations on a Mapbox map.

**Why it matters**: Stores the complete geographic footprint of a project — including named site markers — directly on the project record, keeping spatial and project data in one place.

**How it works**: The tab contains the `mapbox_gl_draw_geojson` widget. Changes are committed only when the Save button inside the drawing toolbar is clicked. The default map centre is set to Jakarta, Indonesia. The toolbar includes undo/redo, GeoJSON import/export, measurement toggle, and the label annotation tool.

---

### Task Site Drawing Canvas

**What it does**: Adds a "Site Area" tab to the task form with the same drawing canvas as the project form, plus an orange overlay of the parent project's full geometry rendered beneath the task's own drawing.

**Why it matters**: Allows task-level geographic data to be stored separately from the parent project's geometry while keeping the project boundary visible as spatial context — useful when a task covers a specific sub-area of the project site.

**How it works**: Uses the `mapbox_gl_draw_geojson_project_task` widget variant. On map load it reads `mapbox_project_geojson` (a related field from the parent project) and renders it as five separate layers, all in orange (`#ff6a00`):

1. Polygon fill at 15 % opacity
2. Dashed outline for polygon borders and lines
3. Plain circle (radius 6 px) for non-label points
4. Smaller anchor circle (`LABEL_POINT_STYLE.SIZE`) for label annotation points
5. Symbol layer rendering the `label` property as text above the anchor

The task's own editable geometry sits on top. The map viewport is also initialised to the project's bounding box so the site is immediately visible.

---

### Label Annotations

**What it does**: Lets users place named text markers anywhere on the map directly from the drawing toolbar, on both project and task Site tabs.

**Why it matters**: Enables teams to annotate specific locations — entrances, hazard zones, key reference points — without requiring a separate layer or external tool.

**How it works**: Clicking the label button (font icon) in the toolbar activates placement mode (crosshair cursor). The user then clicks anywhere on the map to position the label; a dialog opens to enter the text (up to the configured character limit). The label is stored as a GeoJSON `Point` feature with a `properties.label` string alongside other drawn features in the same `mapbox_geojson` field. Labels survive save, load, import, and export unchanged. To edit a label, click the point to select it — the toolbar button changes to "Edit Label" — then click it again to update the text. To delete a label, select it and click the trash button.

---

## Area Measurement

### Automatic Area Calculation — Projects

**What it does**: Calculates and stores the total enclosed area of all drawn polygons on a project whenever the drawing is saved.

**Why it matters**: Eliminates manual area calculations and keeps the measured area in sync with the drawn geometry.

**How it works**: The drawing widget computes the geodesic area (in m²) using Turf.js and writes it to the `mapbox_area` field on save. The value is displayed below the drawing canvas with a formatted m² unit label.

---

### Automatic Area Calculation — Tasks

**What it does**: Same automatic area calculation as projects, applied to each task's own drawn geometry.

**Why it matters**: Enables task-level area tracking independent of the parent project.

**How it works**: Identical to the project implementation — the `mapbox_area` field on `project.task` is updated on save.

---

## Project Context in Tasks

### Parent Project Area on Task Form

**What it does**: Shows the parent project's total area (read-only) at the top of the task's Site tab.

**Why it matters**: Gives context when drawing task-level geometry — team members can immediately see the total project footprint alongside the task's own drawing.

**How it works**: A related `Float` field (`mapbox_project_area`) reads the value directly from `project_id.mapbox_area` and is displayed as a read-only label above the drawing canvas.

---

## Visual Customisation

### Colour Picker — Projects and Tasks

**What it does**: Lets users assign a colour to each project and task, which is reflected in the map view markers.

**Why it matters**: Makes it easier to distinguish between different projects or tasks when multiple records are visible on the map simultaneously.

**How it works**: An integer `mapbox_color` field is rendered with the `color_picker` widget in the form view and read by the map view renderer to apply per-record colour styling.

---

## Notes

### HTML Notes Field — Projects and Tasks

**What it does**: Provides a rich-text notes field on the Site tab of both the project and task forms.

**Why it matters**: Allows site-specific notes, observations, or instructions to be stored alongside the geographic data rather than mixed into the general project or task description.

**How it works**: A standard Odoo `Html` field (`mapbox_notes`) rendered with the `html` widget inside the Site tab.

---

## Automatic Menu Integration

### Post-Install Hook

**What it does**: Automatically adds the "Mapbox" view button to the standard Project and Task menus when the module is installed.

**Why it matters**: No manual configuration is needed — the map view appears immediately in the view switcher after installation.

**How it works**: The `post_init_hook` appends `mapbox_gl` to the `view_mode` of four standard Project window actions (`open_view_project_all`, `open_view_project_all_group_stage`, `open_view_project_all_config`, `open_view_project_all_config_group_stage`) and three Task action (`act_project_project_2_project_task_all`, `action_view_all_task`, and `action_view_my_task`).

---

### Uninstall Hook

**What it does**: Removes the "Map" view button from all Project and Task menus when the module is uninstalled.

**Why it matters**: Leaves the Odoo interface in a clean state with no broken view buttons after removal.

**How it works**: The `uninstall_hook` strips `mapbox_gl` from the `view_mode` of the same five window actions modified during installation.
