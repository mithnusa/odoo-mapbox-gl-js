# Web View Base Mapbox GL - Features

## View Infrastructure

### New View Type Registration

**What it does**: Registers "mapbox_gl" as a valid view type in Odoo's view system.

**Why it matters**: Allows map views to be defined in XML just like form, list, or kanban views, following Odoo's standard patterns.

**How it works**: Extends Odoo's view registry so you can add `<mapbox_gl>` view definitions and include "mapbox_gl" in window action view modes.

---

### XML View Definition Support

**What it does**: Enables parsing of map-specific attributes from XML view definitions.

**Why it matters**: Developers can configure map behavior declaratively in XML, specifying which fields to display, how to group data, and map appearance settings.

**How it works**: The architecture parser extracts map-specific attributes and field configurations from the view XML.

---

## Record Display

### Record Sidebar

**What it does**: Displays a scrollable list of records next to the map.

**Why it matters**: Users can browse records in a familiar list format while seeing their geographic positions on the map.

**How it works**: Shows record information based on the fields defined in the view. Clicking a record in the sidebar highlights it on the map.

---

### Map-Record Synchronization

**What it does**: Keeps the sidebar and map in sync - selecting on one updates the other.

**Why it matters**: Provides a seamless experience where users can work with records either through the list or the map.

**How it works**: Click a marker on the map to open or navigate to the record (typically opens the form view). Click a record in the sidebar to center the map on its location.

---

### Popup Information

**What it does**: Shows record details in a popup when hovering over map features.

**Why it matters**: Users get quick information without needing to click or navigate away from the map.

**How it works**: Hovering over a marker or shape displays a popup with key record fields. The popup disappears when moving away.

---

## Data Management

### Grouping Support

**What it does**: Groups map records by any field, with collapsible sections in the sidebar.

**Why it matters**: Makes it easier to work with large datasets by organizing records into logical groups (by status, category, region, etc.).

**How it works**: Use Odoo's standard "Group By" feature. Groups appear as collapsible sections in the sidebar. Expanding a group shows its records on the map.

---

### Batch Record Selection

**What it does**: Allows selecting multiple records on the map for bulk operations.

**Why it matters**: Users can perform actions (export, delete, update) on many records at once without selecting them individually.

**How it works**: Checkboxes appear next to records. A "Select All" option is available. Selected records can be acted upon using the action menu.

---

### Box-Zoom Selection

**What it does**: Hold Shift and drag a rectangle on the map to select all markers within the drawn area.

**Why it matters**: Users can quickly select a geographic cluster of records with a single gesture instead of clicking each one individually.

**How it works**: Hold Shift and drag to draw a selection rectangle over the map. All markers within the rectangle are added to the current selection. Already-selected records outside the box remain selected. A maximum of 1000 features can be selected in a single box-zoom operation; a warning is shown if the limit is exceeded.

---

### Shift+Click Selection

**What it does**: Hold Shift and click a marker to toggle its selection state without opening the record.

**Why it matters**: Provides a fast way to build up a selection of individual records directly on the map without leaving the map view.

**How it works**: Shift+clicking a marker toggles it in or out of the current selection. Normal (non-Shift) clicks still open the record as usual.

---

### Pager Integration

**What it does**: Works with Odoo's standard pagination for datasets too large to display at once.

**Why it matters**: Maintains performance when working with thousands of records by loading them in manageable pages.

**How it works**: The familiar pager controls appear above the map. Navigate between pages to see different subsets of records.

---

## Search & Filtering

### Search Bar Integration

**What it does**: Provides full compatibility with Odoo's search bar for filtering map records.

**Why it matters**: Users can find specific records using the same search interface they use in list and kanban views.

**How it works**: Type in the search bar to filter records. The map updates to show only matching records.

---

### Filter & Favorite Support

**What it does**: Works with Odoo's filter system including saved favorites.

**Why it matters**: Users can create and reuse complex filter combinations to focus on specific subsets of data.

**How it works**: Use the filter menu to add conditions. Save frequently used filters as favorites for quick access.

---

### Single Group-By Enforcement

**What it does**: Limits the map view to one active group-by at a time and notifies the user if a second one is selected.

**Why it matters**: Map views render each group with a distinct color and collapsible sidebar section. Multiple simultaneous group-bys would produce ambiguous coloring and an unmanageable sidebar.

**How it works**: If the user selects a second active group-by from the search bar, a notification appears: "Only one active group is allowed at a time." The previous group-by remains active. The user must remove the existing group-by before adding a different one.

---

## Actions & Operations

### Action Menu Integration

**What it does**: Provides access to standard Odoo actions from within the map view.

**Why it matters**: Users don't need to switch views to perform common operations like export, delete, or archive.

**How it works**: The action menu (gear icon) provides options based on selected records and user permissions.

---

### Export Functionality

**What it does**: Allows exporting visible or selected records from the map view.

**Why it matters**: Users can extract data for reporting or external use without leaving the map.

**How it works**: Select records and choose Export from the action menu. Choose fields and format as usual.

---

### Record Operations

**What it does**: Enables creating, editing, and deleting records from the map view.

**Why it matters**: Full CRUD operations are available without switching to form or list views.

**How it works**: Use the Create button for new records. Click a record to open it for editing. Use the action menu for deletion.

---

## Map Interaction

### Center Map Button

**What it does**: Re-fits the map zoom and position to show all currently visible features with one click.

**Why it matters**: After panning or zooming manually, users can quickly return to a view that shows all their data without manually adjusting the map.

**How it works**: A **Center Map** button appears in the view's button bar. Clicking it re-calculates the bounding box of all visible features and animates the map to fit them with consistent padding.

---

### Feature Highlighting

**What it does**: Visually highlights the currently selected or hovered feature on the map.

**Why it matters**: Provides clear visual feedback about which record is active or being inspected.

**How it works**: Selected features change color or style. Hovered features show a highlight effect.

---

### Automatic Bounds Fitting

**What it does**: Automatically adjusts the map zoom and position to show all relevant features.

**Why it matters**: Ensures users see their data without manual zooming and panning.

**How it works**: When data loads or filters change, the map automatically fits to show all visible features with appropriate padding.

---

### Debounced Updates

**What it does**: Prevents excessive map updates during rapid user interactions.

**Why it matters**: Keeps the interface responsive even when many changes happen quickly (like rapid filtering or scrolling).

**How it works**: Map rendering is debounced to batch multiple quick changes into a single update.

---

## Performance

### Batch Record Processing

**What it does**: Processes large datasets in batches to prevent browser freezing.

**Why it matters**: Maintains a responsive interface even when loading hundreds or thousands of records.

**How it works**: Records are processed in configurable batch sizes with idle-time yielding to keep the UI responsive.

---

### Data Caching

**What it does**: Caches processed record data to avoid redundant calculations.

**Why it matters**: Improves performance when navigating between pages or toggling groups.

**How it works**: Once a record's map data is calculated, it's cached for reuse until the record changes.

---

## Sidebar Controls

### Sidebar Record Actions

**What it does**: Provides quick actions for each record and group directly in the sidebar without opening the full form.

**Why it matters**: Common operations are accessible at a glance for every record in the list.

**How it works**: Each record row shows a color indicator and an open button that navigates to the record form. Group rows have a "show records" button that opens a filtered list view for that group. When a group has more records than are currently loaded in the sidebar, a "see more" link appears to load the remainder.
