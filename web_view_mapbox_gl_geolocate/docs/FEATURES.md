# Web View Mapbox GL Geolocate - Features

## Marker Display

### Coordinate-Based Mapping
**What it does**: Displays records as point markers using latitude and longitude field values.

**Why it matters**: Works with Odoo's standard geolocation fields without requiring GeoJSON conversion.

**How it works**: Reads separate lat/lng fields from your records and creates GeoJSON Point features for map rendering.

---

### Color-Coded Markers
**What it does**: Assigns colors to markers based on a record field value.

**Why it matters**: Visually categorize markers by status, type, priority, or any other attribute.

**How it works**: Supports Odoo color index integers, named colors (red, blue), or hex codes (#ff0000). Each marker is styled with the specified color.

---

### Automatic Coordinate Filtering
**What it does**: Only displays records that have valid latitude and longitude values.

**Why it matters**: Prevents errors from records with missing or invalid coordinates.

**How it works**: Records without coordinates (null, zero, or invalid) are automatically excluded from the map display.

---

## Overlap Handling

### Smart Marker Distribution
**What it does**: Automatically spreads markers that share the same location in a circular pattern with a ~10 meter radius offset.

**Why it matters**: Prevents markers from stacking on top of each other, making all records visible and clickable even when they share the exact same address.

**How it works**: Detects when multiple records have identical coordinates (within 0.000001 degree tolerance) and distributes them in a circle around the center point. The first marker stays at the true location, subsequent markers are positioned at equal angles around it.

---

### Connection Lines
**What it does**: Draws dotted visual lines connecting distributed markers back to their original shared location.

**Why it matters**: Makes it clear which markers belong to the same address or location by visually grouping them.

**How it works**: Dotted lines (2px width, 2-2 dash pattern) are rendered from each distributed marker to the center point. The line color matches the marker's stroke color; for default-colored markers the lines appear gray (#888888). Lines are only visible at zoom level 17 and above to avoid clutter at lower zoom levels.

---

### Center Point Tracking
**What it does**: Maintains reference to the original location when markers are distributed.

**Why it matters**: Users can identify the true location even when markers are spread out.

**How it works**: The first marker at each location stays at the center, subsequent markers are distributed around it.

---

### Shifted Marker Indicator in Popup

**What it does**: Shows a blue info icon in the hover popup of any marker that has been offset from its true location.

**Why it matters**: Lets users know at a glance that a marker's visible position is not its real coordinate, and that the dotted line connects it to the actual location.

**How it works**: When a marker has been distributed away from its original coordinates, an info circle icon with a tooltip appears in its popup. The tooltip reads: "This marker has been shifted to avoid overlap with other markers. The line points to its original location."

---

## User Interaction

### Hover Popups
**What it does**: Shows record information in a popup when hovering over markers.

**Why it matters**: Quick access to key data without clicking or navigating away.

**How it works**: Popup appears near the cursor showing configured display fields and coordinates.

---

### Click Selection
**What it does**: Allows selecting markers by clicking to view full details.

**Why it matters**: Users can focus on specific records and access all their information.

**How it works**: Selected markers get highlighted styling, and record details appear in the sidebar.

---

### Box-Zoom Selection

**What it does**: Hold Shift and drag a rectangle on the map to select all markers within the drawn area.

**Why it matters**: Users can quickly select a geographic cluster of records with a single gesture instead of clicking each one individually.

**How it works**: Hold Shift and drag to draw a selection rectangle. All markers within the rectangle are added to the current selection. Already-selected records outside the box remain selected. When clustering is enabled, any visible cluster circles within the rectangle are also expanded and their individual records selected — up to 100 records per cluster. If a cluster contains more than 100 records, a warning is shown prompting the user to zoom in and select a smaller area.

---

### Shift+Click Selection

**What it does**: Hold Shift and click a marker to toggle its selection state without opening the record.

**Why it matters**: Provides a fast way to build up a selection of individual records directly on the map without leaving the map view.

**How it works**: Shift+clicking a marker toggles it in or out of the current selection. Normal (non-Shift) clicks still open the record as usual.

---

### Hover Highlighting
**What it does**: Visually highlights markers when the mouse hovers over them.

**Why it matters**: Provides immediate feedback about which marker is being targeted.

**How it works**: A separate hover layer with enhanced styling is displayed for the currently hovered feature.

---

## Coordinate Display

### Human-Readable Coordinates
**What it does**: Displays coordinates in degrees with N/S/E/W directional indicators.

**Why it matters**: More intuitive than raw decimal values for most users.

**How it works**: Converts decimal coordinates to degrees format (e.g., "6.2088° S, 106.8456° E").

---

### Precision Formatting
**What it does**: Shows coordinates with appropriate decimal precision (6 decimal places).

**Why it matters**: Balances accuracy (~0.11 meters) with readability.

**How it works**: Coordinates are formatted consistently across popups and sidebars.

---

## Visualization Options

### Heatmap Layer
**What it does**: Optionally displays a heatmap showing point density at zoom levels 0–9, fading out as you zoom in to zoom level 9.

**Why it matters**: Helps visualize concentrations of locations when zoomed out, without individual markers cluttering the view.

**How it works**: Enable via `enable_heatmap="1"` in the view definition. Color intensity interpolates from blue (sparse) to red (dense). Automatically fades out at zoom 9 where individual markers take over. **Note**: heatmap is disabled and a warning is logged if `enable_clustering` is also set — the two features are mutually exclusive.

---

### Clustering Layer

**What it does**: Optionally groups nearby markers into clusters at zoom levels up to 14, displaying the count of contained records.

**Why it matters**: Prevents map clutter and maintains performance when many markers are present at the same zoom level.

**How it works**: Enable via `enable_clustering="1"` in the view definition. Clusters are colored by record count — blue for fewer than 100, yellow for 100–750, and pink for 750 or more — with sizes of 20px, 30px, and 40px respectively. Clicking a cluster zooms in to the expansion zoom where individual markers become visible. Individual markers not part of any cluster are rendered with their assigned feature color. **Note**: enabling clustering disables the heatmap layer even if `enable_heatmap` is also set.

---

### Multi-layer Rendering
**What it does**: Uses separate layers for default, hover, and selected marker states.

**Why it matters**: Provides clear visual distinction between marker states.

**How it works**: Each state has its own Mapbox layer with appropriate styling applied.

---

## View Configuration

### Latitude/Longitude Field Mapping
**What it does**: Configures which model fields contain the coordinate data.

**Why it matters**: Works with any field names, not just standard Odoo geolocation fields.

**How it works**: The `lat_field` and `lng_field` attributes in view XML map to your model's coordinate fields.

---

### Title and Description Configuration
**What it does**: Configures which fields appear as title and description in the sidebar and popups.

**Why it matters**: Display meaningful record identifiers for easy navigation.

**How it works**: `title_field` and `description_field` attributes map to text fields on your model.

---

### Custom Map Appearance
**What it does**: Allows overriding default map style and projection for specific views.

**Why it matters**: Use satellite imagery for property views, street maps for delivery planning, etc.

**How it works**: Optional `map_style_url` and `map_projection` attributes override system defaults.

---

## Performance

### Batch Marker Processing
**What it does**: Processes large numbers of markers in batches to maintain responsiveness.

**Why it matters**: Keeps the interface smooth even when displaying hundreds or thousands of markers.

**How it works**: Markers are created in batches of 100 with 10ms idle-time yielding between batches, allowing the browser to remain responsive during rendering.

---

### Throttled Mouse Events
**What it does**: Limits the frequency of mouse movement event processing.

**Why it matters**: Prevents performance issues from excessive hover calculations.

**How it works**: Mouse move events are throttled to a configurable interval (100ms default).

---

### Debounced Map Operations
**What it does**: Batches rapid map operations into single updates.

**Why it matters**: Reduces redundant rendering when multiple changes occur quickly, improving performance.

**How it works**: Operations like map centering and point-in-map checks are debounced with a 150ms delay to consolidate multiple rapid updates into a single operation.
