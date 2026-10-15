# Contacts Mapbox GL - Features

## Map View

### Contact Map View

**What it does**: Adds a Map view to the Contacts application where all geocoded contacts appear as markers on an interactive Mapbox map.

**Why it matters**: Gives you a geographic picture of your customer base, partners, and suppliers without leaving the Contacts application.

**How it works**: The Map view is added to the Contacts action alongside list, kanban, form, and activity views. Contacts with valid latitude and longitude coordinates appear as circle markers. Contacts without coordinates are not shown.

---

### Marker Clustering

**What it does**: Groups nearby contacts into numbered cluster bubbles when the map is zoomed out.

**Why it matters**: Prevents the map from becoming cluttered when there are many contacts in the same area, making it easier to read at a glance.

**How it works**: At lower zoom levels, contacts within a certain radius are merged into a single circle showing the count. Clicking a cluster zooms the map in to reveal the individual markers inside.

---

### Overlap Separation

**What it does**: When multiple contacts share exactly the same address coordinates, they are automatically spread out in a circular arrangement around the shared location.

**Why it matters**: Without this, contacts at the same address would stack on top of each other and become unclickable.

**How it works**: Each contact placed at an already-occupied coordinate is shifted outward by a small offset, distributed evenly around a circle. Dotted lines connect each shifted marker back to the original shared location, so it is clear they belong together. The lines appear at higher zoom levels.

---

### Shifted Marker Indicator in Popup

**What it does**: Shows a blue info icon in the hover popup of any contact whose marker has been offset from their true address location.

**Why it matters**: Lets users know that the marker's visible position on the map is not the contact's actual coordinate, and that the dotted line connects it back to the real location.

**How it works**: When a contact's marker has been distributed away from its original coordinates, an info circle icon with a tooltip appears in the popup. The tooltip reads: "This marker has been shifted to avoid overlap with other markers. The line points to its original location."

---

## Contact Display

### Avatar in Sidebar

**What it does**: Shows each contact's photo next to their name in the map sidebar list.

**Why it matters**: Makes it easier to visually identify contacts when scrolling through the sidebar, especially for contacts you recognise by face.

**How it works**: The sidebar list is extended to display the contact's avatar image (24×24) before each record entry.

---

### Avatar in Marker Popup

**What it does**: Displays the contact's photo in the popup that appears when clicking a map marker.

**Why it matters**: Provides immediate visual confirmation that you are looking at the right contact.

**How it works**: The marker popup is extended to include a 64×64 contact image alongside the name and address information.

---

### Contact Address in Sidebar

**What it does**: Shows the full formatted address under the contact name in the sidebar.

**Why it matters**: Lets you see address details without needing to click through to the contact form.

**How it works**: The contact's formatted address field is displayed as the secondary line beneath the name in each sidebar entry.

---

## Marker Customization

### Custom Marker Colors

**What it does**: Each contact can be assigned a specific color that is used for their marker on the Contacts map.

**Why it matters**: Allows visual grouping or categorization of contacts — for example, distinguishing customers from suppliers, or prioritizing key accounts.

**How it works**: A **Marker Color** field (Odoo color index) is added to the contact record with a default value so new contacts always have a color assigned. The selected color is applied to that contact's circle marker on the Contacts map view.

---

### Color Picker on Contact Form

**What it does**: Provides a color selection control in the Geo Localization section of the contact form.

**Why it matters**: Makes choosing a marker color straightforward without needing to know color codes.

**How it works**: In the **Geo Localization** section, a color picker widget lets you select a color from the available palette. The change is visible on the map after saving.

---

## Geocoding

### Automatic Geocoding

**What it does**: Automatically assigns map coordinates to contacts that have an address but no latitude/longitude values.

**Why it matters**: Newly created contacts will not appear on the map until they are geocoded. The automatic task ensures they are added progressively without manual intervention.

**How it works**: A scheduled task runs every 12 hours and processes up to 80 contacts per run — those that have a country and at least one address field (street, street 2, city, or zip) but are missing coordinates. When using the OpenStreetMap provider, it adds a 1-second delay between requests to respect rate limits; contacts geocoded by other providers are processed without that delay.

---

## Selection

### Shift-Click Multi-Selection

**What it does**: Lets you select multiple contacts on the map by holding Shift and clicking individual markers.

**Why it matters**: Useful when you need to work with a specific set of contacts that are not all in one area.

**How it works**: Hold Shift and click any marker to add it to the current selection. Selected markers are highlighted differently from unselected ones.

---

### Box Selection

**What it does**: Lets you draw a rectangle on the map to select all contacts within that area.

**Why it matters**: Efficiently selects a group of contacts in a defined geographic region without clicking each one individually.

**How it works**: Hold Shift and drag on the map canvas to draw a selection box. All contacts whose markers fall inside the box are selected when you release. Because clustering is always enabled in the Contacts map view, any cluster bubbles within the selection rectangle are also expanded and their individual contacts selected — up to 100 contacts per cluster. If a cluster is too large, a warning is shown prompting you to zoom in and select a smaller area.
