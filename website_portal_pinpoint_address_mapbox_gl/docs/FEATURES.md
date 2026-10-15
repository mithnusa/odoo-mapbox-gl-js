# Website Portal Pinpoint Address - Mapbox GL — Features

## Address Form Integration

### Pinpoint Button
**What it does**: Adds a button to the portal address form that opens the map dialog.

**Why it matters**: Without this, portal users have no way to set or update their geographic coordinates — those fields are invisible on the standard address form.

**How it works**: The button reads the partner's current coordinates from the page and passes them to the map dialog when clicked. Its appearance reflects the current state: amber ("Set Location on Map") when no coordinates are stored, green ("Update Location on Map") when coordinates already exist.

---

### State-Aware Button Label
**What it does**: Shows different labels depending on whether the partner has existing coordinates.

**Why it matters**: Gives the user instant feedback on whether they've already pinpointed their address or are doing it for the first time.

**How it works**: The QWeb template checks whether both `partner_latitude` and `partner_longitude` are non-zero and switches the button style and label accordingly.

---

## Map Dialog

### Auto-Geocoding on First Open
**What it does**: When a user opens the map for the first time (no stored coordinates), the module automatically geocodes their address and places the marker at the suggested location.

**Why it matters**: New users don't have to navigate the map from scratch — the marker starts near their actual address, ready to fine-tune by dragging.

**How it works**: On map load, if coordinates are `(0, 0)`, a geocoding request is fired using the partner's full address (street, city, state, zip, country). If the full address returns no result, a second attempt is made with a simplified address (city, state, country only). The marker is placed at the first successful result.

---

### Geocoding Fallback Strategy

**What it does**: Retries geocoding with a shorter address if the full address produces no result.

**Why it matters**: Full addresses sometimes fail due to formatting differences or missing street data. The simplified fallback (city + state + country) is more likely to return a usable region to start from.

**How it works**: Both the Mapbox and Nominatim geocoding paths follow the same two-step strategy: try `partner_full_address` first, then `partner_simplified_address`. All failures are silent — if neither attempt succeeds, the map opens at a world view (zoom level 3).

---

### Interactive Draggable Marker
**What it does**: Displays a red draggable marker on the map that the user repositions to their exact address.

**Why it matters**: Clicking and dragging is far more intuitive for setting a precise location than typing raw coordinates.

**How it works**: The marker is created using Mapbox GL JS and marked as draggable. After each drag, the map gently re-centers on the new marker position.

---

### Pre-filled Existing Location

**What it does**: When the partner already has stored coordinates, the map opens centered on that location with the marker already placed there.

**Why it matters**: Users updating an existing location see exactly where their current pin is, making it easy to make small adjustments.

**How it works**: The existing `partner_latitude` and `partner_longitude` values are passed to the dialog and used to initialize the marker and fly the map to zoom level 16.

---

### Save to Partner Record
**What it does**: Clicking Save writes the marker's coordinates to the partner's `partner_latitude`, `partner_longitude`, and `date_localization` fields.

**Why it matters**: The saved coordinates are immediately available to other modules that use partner geolocation (route planning, map views, distance calculations).

**How it works**: A JSON-RPC call to `/my/address/pinpoint` is made on confirm. The server validates the input and ownership before writing, then returns a success or error status that the dialog reflects as a notification.

---

## Security

### Ownership Validation
**What it does**: The server ensures a portal user can only update addresses they are permitted to edit.

**Why it matters**: Prevents a portal user from modifying another customer's coordinates by manipulating the request.

**How it works**: The controller uses Odoo's built-in `_can_be_edited_by_current_customer()` check, which permits editing the user's own partner and any child addresses (delivery, invoice, other) within their commercial group. Coordinates are also validated to be within geographic bounds (latitude −90 to 90, longitude −180 to 180) before being written.
