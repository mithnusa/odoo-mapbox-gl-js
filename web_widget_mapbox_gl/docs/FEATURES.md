# Web Widget Mapbox GL - Features

## Drawing Tools

### Point Drawing

**What it does**: Allows placing single point markers anywhere on the map.

**Why it matters**: Capture precise locations for facilities, landmarks, or reference points.

**How it works**: Select the point tool and click on the map to place a marker. Multiple points can be added.

---

### Line Drawing

**What it does**: Creates connected line segments by clicking multiple points.

**Why it matters**: Define routes, paths, boundaries, or linear features like pipelines or roads.

**How it works**: Select the line tool, click to add vertices, and double-click to finish the line.

---

### Polygon Drawing

**What it does**: Creates closed shapes by connecting clicked points.

**Why it matters**: Define areas, zones, territories, or any enclosed region.

**How it works**: Select the polygon tool, click to add vertices, and close the shape by clicking the first point or double-clicking.

---

### Shape Editing

**What it does**: Allows modifying existing geometries by moving vertices or entire shapes.

**Why it matters**: Refine boundaries without redrawing from scratch.

**How it works**: Select a shape to enter edit mode. Drag vertices to adjust the shape, or drag the shape itself to move it.

---

### Shape Deletion

**What it does**: Removes selected geometries from the map.

**Why it matters**: Clean up mistakes or remove outdated shapes.

**How it works**: Select shapes and click the delete tool, or use the trash tool to clear all geometries.

---

### Circle Drawing

**What it does**: Creates circular polygon shapes by clicking a center point and then clicking to set the radius.

**Why it matters**: Draw radius-based areas (coverage zones, proximity rings) without complex polygon drawing.

**How it works**: Activate the circle mode from the toolbar, click to place the center, then click a second point to set the radius. The circle is stored as a 64-vertex polygon approximation using Turf.js.

---

### Rectangle Drawing

**What it does**: Creates axis-aligned rectangular polygon shapes by clicking two opposite corners.

**Why it matters**: Quickly draw rectangular areas such as plots, buildings, or bounding boxes without the overhead of manual polygon drawing.

**How it works**: Activate the rectangle mode from the toolbar, click to place the first corner, then click the opposite corner to finalize. The rectangle is stored as a closed 5-point Polygon.

---

### Polygon Cut

**What it does**: Splits one or more existing polygons by drawing a cutting polygon over them.

**Why it matters**: Divide territories, parcels, or zones into separate parts without redrawing from scratch.

**How it works**: Activate the cut mode from the toolbar (scissors icon), then draw a polygon over the areas to cut. All overlapping polygons are split using a geometric difference operation via Turf.js. The original polygons are replaced with the resulting pieces.

---

### Undo / Redo

**What it does**: Steps backward or forward through the drawing history to reverse or reapply recent changes.

**Why it matters**: Mistakes made while drawing can be undone without starting over, making the editing experience faster and less frustrating.

**How it works**: The toolbar includes Undo and Redo buttons. Up to 20 snapshots of the drawing state are maintained. Undo reverts to the previous snapshot; Redo reapplies a reverted step. Keyboard shortcuts Ctrl+Z (Undo) and Ctrl+Y or Ctrl+Shift+Z (Redo) also work. The buttons are disabled when there is nothing further to undo or redo.

---

### Text Label Annotations

**What it does**: Places custom text labels at any point on the map and allows editing them after placement.

**Why it matters**: Annotate specific locations with descriptive text — mark landmarks, add notes to areas, or identify points of interest without adding them as data records.

**How it works**: Click the Label button (font icon) in the toolbar to enter placement mode; the cursor changes to a crosshair. Click anywhere on the map to open a dialog where you type the label text (up to 100 characters, multi-line supported). The label appears anchored to a small point marker at the clicked location. To edit an existing label, click its marker to select it — the toolbar button switches to an edit icon; clicking it reopens the dialog pre-filled with the current text. Labels are visible in both edit and readonly display modes.

---

## Geometry Support

### Multi-Geometry Types

**What it does**: Supports all standard GeoJSON geometry types including multi-part geometries.

**Why it matters**: Handle complex scenarios like disconnected territories or multiple parcels in one record.

**How it works**: Draw multiple shapes - they're all stored together as a FeatureCollection in the JSON field.

---

### GeoJSON Format

**What it does**: Stores geometry data in standard GeoJSON format.

**Why it matters**: Industry-standard format that works with other GIS tools and mapping libraries.

**How it works**: All drawn shapes are automatically converted to GeoJSON FeatureCollection format.

---

## Measurements

### Live Measurements While Drawing

**What it does**: Shows a real-time area or length overlay that follows the cursor as you draw, with per-segment length labels at the midpoint of each edge.

**Why it matters**: Lets users see the size of a shape as they draw it, removing the need to finish and then measure separately.

**How it works**: While in polygon or line drawing mode, a floating overlay near the cursor displays the current total area (polygons, in m²/ha/km²) or total length (lines, in m/km). Each edge of the in-progress shape also shows a distance label positioned at its midpoint. The overlay updates continuously as the cursor moves.

---

### Measurements Toggle

**What it does**: Shows or hides area and perimeter labels on all completed features with a single toolbar button click.

**Why it matters**: Provides quick access to measurement data for all shapes without selecting them individually, and can be hidden to reduce visual clutter.

**How it works**: Click the measurements button in the toolbar to toggle the static label overlay. When enabled, each completed polygon displays its area at its centroid and per-segment length labels along its edges. Line features show per-segment distances. Labels are hidden automatically when a shape enters draw or edit mode, and restored when editing ends. The toggle button is disabled during active drawing.

---

## Calculations

### Automatic Area Calculation

**What it does**: Calculates the total area of all polygons and saves it to a specified field.

**Why it matters**: Get accurate area measurements without manual calculation or external tools.

**How it works**: Uses Turf.js geodesic area calculation. Configure `field_area` option to specify where to save the result.

---

### Area Saved on Commit

**What it does**: Calculates total polygon area and saves it to the configured field when the Save button is clicked.

**Why it matters**: Keeps the area field in sync with the drawn geometry without manual calculation.

**How it works**: When the Save button is clicked, Turf.js calculates the geodesic area of all polygon features and writes the result in m² to the field specified in the `field_area` option.

---

## Navigation

### Location Search

**What it does**: Provides a search box to find and navigate to any address or place.

**Why it matters**: Quickly jump to the right location instead of manually panning and zooming.

**How it works**: Type an address or place name. Select from suggestions to center the map on that location.

---

### Custom Default Center

**What it does**: Sets the initial map position when the widget loads.

**Why it matters**: Start users at a relevant location instead of a generic world view.

**How it works**: Configure `default_center` option with [longitude, latitude] coordinates.

---

## Map Appearance

### Style Switcher

**What it does**: Allows changing the map style while editing.

**Why it matters**: Switch between street, satellite, or other styles for better visibility.

**How it works**: Use the built-in style switcher control to change map appearance on the fly.

---

### Custom Map Style

**What it does**: Overrides the default map style for specific widgets.

**Why it matters**: Use satellite imagery for property mapping, streets for urban planning, etc.

**How it works**: Configure `map_style_url` option with any Mapbox style URL.

---

### Custom Projection

**What it does**: Sets the map projection type for the widget.

**Why it matters**: Some projections work better for specific regions or use cases.

**How it works**: Configure `map_projection` option to override the system default.

---

## Display Modes

### Readonly Display Mode

**What it does**: Displays geometries as static, non-editable shapes when the form is in readonly state.

**Why it matters**: Users can view boundary data without accidentally modifying it, providing a clear distinction between viewing and editing.

**How it works**: When the form is readonly, drawing tools are hidden and geometries are rendered as static map layers. Polygons show with fill and outline, lines display as strokes, points appear as circles, and text label annotations remain visible.

---

### Editable Mode

**What it does**: Provides full drawing and editing capabilities when the form is in edit mode.

**Why it matters**: Users can create and modify geometries only when explicitly editing the record.

**How it works**: Drawing controls appear automatically when the form enters edit mode, allowing full geometry manipulation.

---

## Form Integration

### JSON Field Storage

**What it does**: Stores geometry data in Odoo's JSON field type.

**Why it matters**: Native Odoo field type with full ORM support and database storage.

**How it works**: Apply the widget to any JSON field - geometry data is automatically serialized and saved.

---

### Save Button

**What it does**: Commits drawn geometry changes to the Odoo record when the user clicks the Save button in the draw toolbar.

**Why it matters**: Gives users explicit control over when changes are persisted, preventing accidental overwrites mid-edit.

**How it works**: The Save button (floppy disk icon) is added to the draw toolbar and becomes highlighted when unsaved changes exist. Clicking it collects all current features, calculates the total area, and saves both to the record via the Odoo form update API.

---

## Validation

### Option Validation

**What it does**: Validates widget configuration options at runtime.

**Why it matters**: Catches configuration errors early with clear error messages.

**How it works**: Checks that `default_center` is valid coordinates, `field_area` exists, and style URLs are properly formatted.

---

### GeoJSON Validation

**What it does**: Validates geometry data before saving.

**Why it matters**: Prevents invalid data from being stored in the database.

**How it works**: Parses and validates GeoJSON structure, handling parsing errors gracefully.

---

## Performance

### Asset Lazy Loading

**What it does**: Loads Mapbox GL Draw and Turf.js libraries only when needed.

**Why it matters**: Reduces initial page load time when the widget isn't visible.

**How it works**: External libraries are loaded on-demand when the widget initializes.

---

### Resource Cleanup

**What it does**: Properly disposes of map resources when the widget is destroyed.

**Why it matters**: Prevents memory leaks in long-running sessions.

**How it works**: Map instance, drawing controls, and event listeners are cleaned up on unmount.

---

## Import & Export

### GeoJSON File Upload

**What it does**: Allows importing geometry data from GeoJSON files.

**Why it matters**: Users can upload existing boundary data instead of redrawing manually.

**How it works**: Upload dialog accepts .geojson or .json files and loads them into the drawing canvas.

---

### GeoJSON File Download

**What it does**: Exports all drawn geometries as a downloadable GeoJSON file.

**Why it matters**: Users can save their work for backup, share with others, or use in external GIS tools.

**How it works**: Click the download button to export all features as a .geojson file named `mapbox_drawings_{record_id}.geojson`.
