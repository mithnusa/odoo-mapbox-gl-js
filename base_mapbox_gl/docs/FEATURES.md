# Base Mapbox GL JS - Features

## Configuration & Settings

### Access Token Management

**What it does**: Stores your Mapbox API token in Odoo's system parameters.

**Why it matters**: All Mapbox services require authentication. Storing the token centrally means you configure it once, and every map-enabled feature across your Odoo instance uses it automatically.

**How it works**: Enter your token in **Settings > General Settings > Integrations > Mapbox GL JS**. It is saved securely and made available to all maps at runtime.

---

### Preset Map Styles

**What it does**: Provides 10 ready-to-use Mapbox styles selectable from the Settings form.

**Why it matters**: You can pick a visual style that matches your brand or use case without needing a Mapbox Studio account.

**Available presets**:

- **Standard** — Modern 3D style with dynamic lighting and buildings
- **Standard Satellite** — Aerial imagery with the Standard style overlay
- **Streets** — Classic road map
- **Outdoors** — Terrain and trail-focused style
- **Light** — Minimal light background
- **Dark** — Minimal dark background
- **Satellite Streets (Hybrid)** — Aerial imagery with road and label overlay
- **Navigation Day** — High-contrast style for in-vehicle navigation (day)
- **Navigation Night** — High-contrast style for in-vehicle navigation (night)
- **OpenStreetMap Layer** — Community-maintained raster tiles (Mercator only)

---

### Custom Style URL

**What it does**: Allows you to use a style you designed in Mapbox Studio instead of a preset.

**Why it matters**: If you have a branded or purpose-built map style, you can apply it to all maps in your Odoo instance without any additional configuration.

**How it works**: Enter your Mapbox Studio style URL in the Custom Style URL field. When set, it takes precedence over the preset style selection.

---

## Visual Customization

### Lighting Presets

**What it does**: Sets the simulated time-of-day lighting on Standard style maps.

**Why it matters**: Lighting affects the overall mood and readability of the map. Night mode reduces eye strain in dark environments; Day provides maximum clarity.

**Available options**: Dawn, Day, Dusk, Night. Applies to Standard and Standard Satellite styles only.

---

### Theme Options

**What it does**: Applies a color scheme to Standard style maps.

**Why it matters**: Themes let you reduce the visual intensity of the basemap so that your data markers stand out more clearly.

**Available options**: Default, Faded, Monochrome. Applies to Standard and Standard Satellite styles only.

---

### Map Projection

**What it does**: Changes how the Earth is represented on the map — as a 3D globe or a flat 2D surface.

**Why it matters**: Globe is the most realistic and visually engaging; the flat Mercator projection is the familiar, standard web-map view.

**Available projections**:

- **Globe** — 3D spherical view (default)
- **Mercator** — Standard flat web map

Set the default in Settings, or let users switch between the two on any map with the on-map Globe/Mercator toggle button (see below).

---

### Multi-language Map Labels

**What it does**: Displays country names, city names, and street names on the map in your chosen language.

**Why it matters**: International teams can view maps in their native language, improving readability and usability.

**How it works**: Select from 36 supported languages in Settings. Labels update across all maps in the instance. Language can also be changed per-map using the on-map style switcher.

---

## On-Map Controls

### Style Switcher

**What it does**: Adds an interactive panel directly on the map that lets users change the map style, lighting, theme, and language without leaving the view.

**Why it matters**: Users can adjust the map to their preference on-the-fly without needing access to system settings.

**How it works**: A paint-brush button appears on the map. Clicking it opens a panel with six style buttons (Standard, Satellite, Streets, Outdoors, Hybrid, OSM) and dropdowns for lighting, theme, and language. Changes take effect immediately and custom data layers are preserved when switching styles. The language dropdown is disabled while the OSM style is active, since OpenStreetMap raster tiles don't carry Mapbox's language field.

---

### Navigation Controls

**What it does**: Adds zoom in/out buttons and a compass to the map.

**Why it matters**: Provides familiar navigation tools for users who prefer buttons over mouse gestures or trackpad pinch.

**How it works**: Navigation and fullscreen controls appear at the bottom-right of every map; the scale bar appears at the bottom-left.

---

### Fullscreen Mode

**What it does**: Expands the map to fill the entire browser window.

**Why it matters**: Gives users more screen space to explore dense data, especially with many markers or complex routes.

**How it works**: A fullscreen button is included in the map controls. Press Escape or click again to return to normal view.

---

### Scale Bar

**What it does**: Shows a real-world distance indicator on the map that updates as you zoom in and out.

**Why it matters**: Helps users understand the geographic scale of what they are looking at when planning routes or analysing distribution.

**How it works**: The scale bar appears in the bottom-left corner and adjusts its unit automatically based on zoom level.

---

### 2D/3D View Toggle

**What it does**: Adds a button to the map that switches between a flat top-down view and a tilted 3D perspective. Enabled by default.

**Why it matters**: The 3D perspective makes terrain, building heights, and route elevation easier to read; the flat 2D view is better for precise area inspection and data overlays.

**How it works**: The toggle button displays the current mode label (2D or 3D). Clicking it animates the map smoothly to a 60-degree pitch for 3D mode or returns to 0-degree pitch for 2D mode. The button state stays in sync if the pitch is changed through other means such as dragging.

---

### Globe/Mercator Toggle

**What it does**: Adds a button to the map that switches the projection between a 3D globe and the flat Mercator view. Enabled by default.

**Why it matters**: Lets users flip between the realistic globe and the familiar flat web-map view without going into Settings, on a per-map basis.

**How it works**: Clicking the globe-icon button crossfades the map and swaps the projection. A dark-space backdrop (stars and atmosphere) is applied automatically while the globe is active, even on styles that don't ship their own atmosphere, so the view looks consistent across all map styles. The choice is re-applied automatically after a style change.

---

### Fly-to-Zoom Button

**What it does**: An optional button — off by default, available for map views to enable — that flies the map progressively closer to the current view center using an adaptive zoom step.

**Why it matters**: Provides a one-click way to zoom in without losing the current map center, useful when exploring a specific area step by step.

**How it works**: Each click triggers a smooth flyTo animation. The zoom step adapts automatically — it is larger when the map is zoomed out and gradually shrinks to 1 as the map approaches maximum zoom, preventing overshoot. The button disables itself at maximum zoom.

---

### 3D Terrain Toggle

**What it does**: An optional button — off by default, available for map views to enable — that turns on real-elevation terrain on the map, revealing mountain ranges, valleys, and other physical relief.

**Why it matters**: Flat maps do not convey elevation. Enabling terrain gives immediate spatial context for delivery routes, field locations, or any geographic data where altitude matters.

**How it works**: Clicking the button loads a digital elevation model (DEM) from Mapbox, applies hillshading below all labels, and tilts the camera to 80° pitch so terrain is visible. Clicking again removes the terrain and returns the map to a flat view. Terrain is automatically re-applied if the map style is changed while it is active.

---

## Search & Navigation

### Location Search

**What it does**: Adds a search box to the map for finding addresses, businesses, and points of interest.

**Why it matters**: Users can jump directly to a location by name rather than manually panning and zooming.

**How it works**: A compact search icon appears in the top-right corner of the map. Hovering or clicking expands it into a full search field. Typing a query returns matching results; selecting one flies the map to that location and places a marker. The search respects the language set in the map configuration and biases results to the current visible area.

---

## Geocoding Service

### Mapbox Geocoding Provider

**What it does**: Registers Mapbox as an address-to-coordinates provider within Odoo's geocoder framework.

**Why it matters**: Other Odoo modules that need to place records on a map based on address fields can use Mapbox's geocoding API without any extra configuration.

**How it works**: Odoo's built-in geocoder can be pointed to Mapbox. When a geocoding request is made, this module calls the Mapbox Geocoding API v5 using the stored access token and returns the coordinates.

---

## Connection Handling

### Offline Detection

**What it does**: Checks for internet connectivity before loading map assets and displays a clear message when the connection is unavailable.

**Why it matters**: Mapbox maps require an active internet connection. Without this check, users would see a broken or empty map with no explanation.

**How it works**: On loading a map, the module verifies connectivity by contacting the Mapbox API. If offline, it shows a warning notification instead of attempting to load the map.

---

### Auto-Retry on Reconnection

**What it does**: Automatically attempts to load the map when internet connectivity is restored, without requiring a page refresh.

**Why it matters**: Users who lose and regain connectivity do not need to manually reload the page to get their maps back.

**How it works**: The module listens to the browser's online event. When triggered, it re-checks connectivity and, if confirmed, resumes the normal map loading sequence.

---

## Bundled Libraries

### Included Libraries

**What it does**: Ships the following libraries as local static files so they are served directly from Odoo without relying on external CDNs.

**Why it matters**: Maps load reliably in network-restricted environments, and there is no dependency on external CDN availability or versioning.

**Included**:

- **Mapbox GL JS** — The core mapping library
- **Mapbox GL Draw** — Drawing and editing tools (polygons, lines, points) used by drawing-enabled modules
- **Mapbox Search Box SDK** — Powers the location search component
- **Turf.js** — Geospatial analysis and geometry utilities used by routing and drawing modules

---

## Developer Foundation

### Base Map Component

**What it does**: Provides `BaseMapboxGlComponent`, a reusable OWL component class that other modules extend to create map-based views and widgets.

**Why it matters**: New map features can be built without reimplementing asset loading, settings fetching, map initialization, connectivity handling, or cleanup — all of that is inherited.

**How it works**: Extend `BaseMapboxGlComponent`, implement the `containerElement` getter, and override `onMapLoaded()` to add your own behavior once the map is ready.

---

### Mixin for Existing Components

**What it does**: Provides `withMapboxGl(Base)`, a mixin that adds all Mapbox capabilities to any existing OWL component without requiring a change in its inheritance chain.

**Why it matters**: Some Odoo components (such as `ListRenderer` or `FormRenderer`) already extend a specific base class. The mixin makes it possible to add map functionality to those components without conflicts.

**How it works**: Wrap the base class with `withMapboxGl(Base)` to produce a new class that has full Mapbox functionality alongside whatever the original base provides.

---

### Shared Utility Functions

**What it does**: Exports color manipulation helpers (`darkenColor`, `lightenColor`, `normalizeColor`, `hexToRgba`) and a `validateGeoJson` function used by dependent modules.

**Why it matters**: Keeps common low-level operations consistent across the entire module suite.

**How it works**: Import from `@base_mapbox_gl/utils/utils`. Color functions accept hex, RGB, RGBA, or named CSS colors. `validateGeoJson` supports all GeoJSON types and includes optional strict and geometry-level validation.
