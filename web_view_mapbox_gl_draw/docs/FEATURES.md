# Web View Mapbox GL Draw - Features

## Geometry Rendering

### GeoJSON Geometry Support

**What it does**: Renders all standard GeoJSON geometry types including Points, Lines, Polygons, MultiPoints, MultiLines, MultiPolygons, and GeometryCollections.

**Why it matters**: You can visualize any geographic shape stored in your records, from simple points to complex multi-part boundaries.

**How it works**: The module parses GeoJSON from your record's JSON field and creates appropriate Mapbox layers for each geometry type.

---

### Multi-layer Rendering

**What it does**: Renders features using separate layers for fills, strokes, and points, each with their own styling and interaction states.

**Why it matters**: Creates professional-looking maps with proper visual hierarchy - filled areas, distinct borders, and visible vertices, plus separate hover and selected states.

**How it works**: Each feature is rendered using multiple Mapbox layers: default state, hover state, and selected state. Polygon interiors get fill layers, boundaries get stroke layers, and point geometries get circle layers.

---

### Color Coding

**What it does**: Allows each feature to have a custom color based on a field value with automatically darkened stroke borders.

**Why it matters**: Visually distinguish features by category, status, or any other attribute (e.g., different colors for different territory types) while maintaining clear boundaries.

**How it works**: Specify a color field in the view definition. The module applies that color to each feature's fill and automatically generates a darker stroke color using the darkenColor utility function.

---

## Measurements

### Area Calculation

**What it does**: Automatically calculates the area of polygon features, displayed in m², ha, or km² depending on the feature's size.

**Why it matters**: Know the size of territories, zones, or properties without manual measurement or external tools.

**How it works**: Uses the Turf.js library to calculate geodesic area, accounting for the Earth's curvature for accurate results. Small areas show in m², medium areas in ha, and large areas in km².

---

### Perimeter Calculation

**What it does**: Calculates the perimeter (boundary length) of polygon features.

**Why it matters**: Useful for fencing estimates, boundary surveys, or understanding the complexity of a shape.

**How it works**: Measures the total length of all edges in a polygon using Turf.js geodesic calculations.

---

### Length Calculation

**What it does**: Calculates the total length of line features, displayed in cm, m, or km depending on the distance.

**Why it matters**: Essential for route planning, pipeline measurements, or any linear distance calculations.

**How it works**: Sums the geodesic distance along all segments of a line feature using Turf.js. Short distances show in cm or m, longer distances in km.

---

### Point Count

**What it does**: Displays the number of vertices in polygon and line features.

**Why it matters**: Indicates the complexity and precision of a geometry - more points mean more detailed boundaries.

**How it works**: Counts all coordinate pairs in the geometry, including all rings in multi-polygons.

---

### Coordinate Display

**What it does**: Shows precise coordinates for point features in degrees North/South and East/West format.

**Why it matters**: Provides exact location information in a human-readable format.

**How it works**: Formats longitude and latitude with directional indicators (N/S/E/W) and appropriate decimal precision.

---

## User Interaction

### Hover Highlighting

**What it does**: Visually highlights features when the mouse hovers over them with enhanced stroke and fill opacity — including when hovering over text label symbols.

**Why it matters**: Provides immediate visual feedback about which feature the user is interacting with before clicking, regardless of whether they hover the geometry or its label.

**How it works**: Separate hover layers with enhanced styling (increased stroke width from 2px to 2.5px and adjusted opacity) are shown for the currently hovered feature. Hover state is reset using geometry-type + empty resId filter expressions so the reset never conflicts with layer definitions. Both the label (`GEOJSON_LABEL`) and label anchor circle (`GEOJSON_CIRCLE_LABEL`) layers are included in the hover detection set.

---

### Feature Selection

**What it does**: Allows clicking features or their text labels to select them and view their details in the sidebar with distinct visual styling.

**Why it matters**: Users can focus on specific features to see full record information, measurements, and metadata — clicking anywhere on a feature (fill, stroke, point, or label) works reliably.

**How it works**: Selected features get distinct visual styling through dedicated selected-state fill, stroke, and circle layers. The label and label anchor circle layers are also included in the click detection set, so clicking a text annotation selects the underlying record. Details (title, description, measurements, point count) appear in the sidebar with an option to open the full record. The `originalProperties` internal field is stripped from popup values to keep displayed data clean.

---

### Text Label Annotations

**What it does**: Renders text symbol labels on the map for point features that carry an `odoo_user_label` property, with a circle anchor underneath the text.

**Why it matters**: Allows imported or drawn GeoJSON features to carry user-defined text annotations that are always visible on the map and can be clicked or hovered like any other feature.

**How it works**: Two dedicated layers handle label annotation points: `GEOJSON_CIRCLE_LABEL` renders the anchor circle using the feature's color, and `GEOJSON_LABEL` renders the text symbol from the `odoo_user_label` property. Both layers use the `top` slot so they float above geometry layers. Regular draw points (without `odoo_user_label`) are filtered out of these layers and rendered in the standard circle layer instead. The `odoo_user_label` property is promoted to the top-level feature properties so Mapbox GL JS style expressions can access it directly.

---

### Sidebar Information Panel

**What it does**: Shows selected feature's detailed information in a sidebar panel including title, description, measurements, and point count.

**Why it matters**: Provides comprehensive feature information and quick access to open the full record without leaving the map view.

**How it works**: When a feature is selected by clicking, the sidebar displays the title field, description field, calculated measurements (area/perimeter/length based on geometry type), point count, and an "Open Record" button.

---

## Data Management

### Auto-filter Records Without Geometry

**What it does**: Automatically excludes records where the GeoJSON field is null or contains an empty FeatureCollection from the map view.

**Why it matters**: Users only see records that actually have geometry — empty records do not appear on the map and do not generate blank entries in the sidebar.

**How it works**: When the GeoJSON field is a `SearchableJson` type (the recommended field type for this module), the model appends a domain filter that requires the field to be non-null and not equal to `{"type":"FeatureCollection","features":[]}`. Standard `Json` fields are not filtered.

---

### SearchableJson Field Type

**What it does**: Provides a custom Odoo field type optimized for storing and querying GeoJSON data.

**Why it matters**: Enables efficient database searches on JSON content using PostgreSQL's native JSONB capabilities.

**How it works**: Extends Odoo's JSON field with custom operators (`json_eq`, `json_contains`, etc.) that translate to PostgreSQL JSONB queries.

---

### JSON Containment Queries

**What it does**: Allows searching for records where the JSON field contains specific structures.

**Why it matters**: Find all records with a particular geometry type or property without parsing JSON in application code.

**How it works**: Uses PostgreSQL's `@>` operator to check if the stored JSON contains the query pattern.

---

### JSON Equality Queries

**What it does**: Allows searching for records with exact JSON matches.

**Why it matters**: Find records with precisely matching geometry or properties.

**How it works**: Compares normalized JSON strings for exact structural equality.

---

## View Configuration

### Geometry Field Mapping

**What it does**: Specifies which field contains the GeoJSON geometry data.

**Why it matters**: Allows flexibility in model design - use any field name for your geometry data.

**How it works**: The `geojson_field` attribute in the view XML points to your GeoJSON field.

---

### Title Field Configuration

**What it does**: Configures which field value appears as the title for each record in the sidebar and popups.

**Why it matters**: Display meaningful record identifiers (name, reference, etc.) for easy identification.

**How it works**: The `title_field` attribute maps to any text field on your model.

---

### Description Field Configuration

**What it does**: Adds a secondary line of information below the title in popups.

**Why it matters**: Show additional context (description, status, category) without opening the record.

**How it works**: The `description_field` attribute maps to any text field on your model.

---

### Custom Map Style

**What it does**: Allows overriding the default map style for specific views.

**Why it matters**: Use different base maps for different use cases (satellite for property, streets for delivery zones).

**How it works**: The `map_style_url` attribute accepts any Mapbox style URL.

---

### Custom Projection

**What it does**: Allows setting a specific map projection for the view.

**Why it matters**: Some projections work better for specific regions or use cases.

**How it works**: The `map_projection` attribute overrides the system default projection.

---

## Performance

### Efficient Layer Updates

**What it does**: Updates only changed features rather than re-rendering the entire map.

**Why it matters**: Keeps the interface responsive when working with many features or frequent data changes.

**How it works**: Compares feature data and updates only the modified sources and layers.

---

### Debounced Rendering

**What it does**: Batches rapid changes into single render operations.

**Why it matters**: Prevents performance issues when many updates happen in quick succession.

**How it works**: Uses configurable debounce delays to consolidate multiple update requests.

---

### Turf.js Integration

**What it does**: Leverages the Turf.js library for all geospatial calculations and geometry operations.

**Why it matters**: Provides accurate, well-tested measurement algorithms using geodesic calculations that account for Earth's curvature.

**How it works**: Loads Turf.js as an additional asset and uses its functions for area, length, centroid, and bounds calculations. All measurements are geodesic (great circle) distances rather than simple Euclidean distances.

---

## Map Interaction

### 3D Terrain Toggle

**What it does**: Shows a terrain button on every draw map that enables real-elevation 3D terrain with hillshading.

**Why it matters**: Geographic shapes such as territories, delivery zones, and property boundaries are easier to interpret when the underlying terrain — hills, valleys, and elevation changes — is visible.

**How it works**: This view type enables the 3D terrain control by default (the base module's control is off by default). Clicking the button loads a digital elevation model, applies hillshading beneath all labels, and tilts the camera to 80° pitch. Clicking again removes the terrain and resets to a flat view. Terrain is automatically re-applied after style changes.

---

### Auto-Fit Bounds

**What it does**: Automatically zooms and pans the map to show all features when the view loads or data changes.

**Why it matters**: Ensures all features are visible without manual map navigation.

**How it works**: Calculates the bounding box of all features and fits the map view with appropriate padding (100px) and maximum zoom (level 15). For single point features, zooms to level 15 centered on the point.

---

### Animated Transitions

**What it does**: Smoothly animates map movements when focusing on features or fitting bounds.

**Why it matters**: Provides a polished user experience with smooth transitions rather than jarring jumps.

**How it works**: Uses Mapbox's flyTo and fitBounds methods with 1-second animation duration for smooth camera transitions.
