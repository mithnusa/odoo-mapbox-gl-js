# Route Planner - Features

## Route Management

### Multi-Stop Route Planning

**What it does**: Lets you create routes with a departure point and as many stops as needed, each linked to a geocoded contact address.

**Why it matters**: Provides a structured way to plan and track multi-stop journeys for deliveries, customer visits, field service, or any scenario that involves visiting multiple locations.

**How it works**: Each route has one departure location and an ordered list of stops. Stops are selected from contacts that have valid GPS coordinates. The stop order can be adjusted by dragging rows in the stops list while the route is in Draft state.

---

### Route Lifecycle

**What it does**: Routes move through a defined set of states with clear action buttons at each transition.

**Why it matters**: Ensures routes are properly validated before dispatch and provides visibility into where each route stands — whether it is being prepared, confirmed, active, or completed.

**States**:

- **Draft** — Route is being prepared; all fields are editable; route can be deleted
- **Confirmed** — Route has been validated and is ready to dispatch; fields are locked
- **In Progress** — Driver has departed; stop statuses can be updated
- **Done** — All stops are completed; route is closed
- **Cancelled** — Route was cancelled; can be reset to Draft to start over

**Transitions**:

- **Confirm**: validates route type requirements, that at least one stop is set, and GPS coordinates; moves Draft → Confirmed
- **Start Route**: moves Confirmed → In Progress
- **Done**: checks no stop is still in the None or Arrived state before allowing (Done and Cancelled/Skipped stops don't block it); moves In Progress → Done
- **Cancel**: moves Confirmed or In Progress → Cancelled; marks all stops as Cancelled/Skipped
- **Set to Draft**: resets Cancelled → Draft; resets all stop states to None

---

### Distance and Duration Summary

**What it does**: Shows total route distance and estimated duration on the route form, aggregated from per-leg values on each stop.

**Why it matters**: Gives dispatchers an at-a-glance summary of the route's scope without manually adding up individual segments.

**How it works**: Each stop stores the distance and duration from the previous point. The route sums these across all stops to produce totals displayed in the Route Summary section.

---

### Service Duration per Stop

**What it does**: Lets dispatchers record how long a driver is expected to spend at each stop, separate from travel time — covering activities like package drop-off, customer meetings, equipment inspection, or field repairs.

**Why it matters**: Travel time alone understates how long a route takes. A route with five 30-minute stops takes 2.5 hours longer than the driving time suggests. Without service duration, `arrival_date` is always earlier than reality.

**How it works**: Each stop has a `Service Duration` field (in hours, displayed as HH:MM). When a stop is added to a route, it pre-fills from the route type's default service duration. Dispatchers can override it per stop. The route shows a `Total Service Duration` summary in the Route Summary section.

---

### Default Service Duration on Route Types

**What it does**: Sets a type-level default for how long stops typically take on routes of that type, so dispatchers don't have to enter it manually for every stop.

**Why it matters**: Different operations have different norms — a delivery route might default to 15 minutes per stop while a field service route defaults to 1 hour. Configuring this once on the route type saves repetitive data entry and ensures consistent planning assumptions across the team.

**How it works**: Each route type has a `Default Service Duration` field. When a new stop is added to a route of that type, the value is automatically applied. Dispatchers can still override individual stops that deviate from the norm.

---

### Estimated Arrival Date

**What it does**: Automatically calculates and displays an estimated date and time when the route is expected to conclude.

**Why it matters**: Gives dispatchers a realistic reference for when a route will finish, accounting for both driving time and time spent at each stop.

**How it works**: Computed as `departure_date` + travel time + total service duration across all stops. Updates automatically when departure date, stop distances/durations, or service durations change. Shown as read-only on the form and list view. Because both travel and service durations are estimates, the arrival date is indicative and may differ from actual completion time.

---

### Calendar View

**What it does**: Displays routes on an interactive calendar using the departure date as the event start and the estimated arrival date as the event end.

**Why it matters**: Lets dispatchers quickly spot scheduling conflicts, busy periods, and gaps across the team's route schedule at a glance.

**How it works**: The calendar is accessible from the Route Planner action alongside the kanban, list, and form views. Events are color-coded by route state. Day, week, month, and year scales are available. New routes cannot be created directly from the calendar — they must be created from the kanban or list view.

---

### Automatic Sequence Numbering

**What it does**: Assigns a unique sequential reference number to each route when it is created.

**Why it matters**: Makes routes easy to identify and reference in communication, reports, and other records.

**How it works**: When a route is confirmed, the system generates a reference using the sequence configured on its route type, falling back to the default `route.planner` sequence if the route type doesn't have its own. The default format is `RP-YYYY.MM.XXXX`, where `YYYY.MM` is the year and month of confirmation and `XXXX` is a zero-padded counter (e.g., `RP-2024.05.0001`). Until confirmed, a route is identified by a temporary draft placeholder name rather than its final reference.

---

## Route Types

### Configurable Route Types

**What it does**: Defines categories of routes, each with a name, color, departure label, default service duration, and configurable field requirements.

**Why it matters**: Different operations (deliveries, customer visits, field service) have different mandatory data and different norms for time spent at each stop. Route types enforce the right requirements automatically and pre-fill sensible defaults, preventing incomplete routes from being confirmed and reducing repetitive data entry.

**How it works**: Administrators create and manage route types from the **Route Type** menu in the Route Planner app. Each type can independently require vehicle, driver, and/or departure date before confirmation, and can set a default service duration that applies to all new stops on routes of that type. The route type color is shown in the route list for quick visual identification. A route type can also be assigned its own sequence for generating route reference numbers (visible to Technical Settings users), overriding the application-wide default.

---

### Built-in "Route" Type

**What it does**: Provides a default "Route" type that requires vehicle, driver, and departure date.

**Why it matters**: Ensures the application is ready to use immediately after installation without needing custom configuration.

**How it works**: Installed automatically with the module. Sets vehicle required, driver required, and departure date required to true.

---

## Stops

### Stop Status Tracking

**What it does**: Each stop on a route has its own state that can be updated as the driver progresses.

**Why it matters**: Provides real-time visibility into which stops the driver has reached, completed, or skipped.

**States**:

- **None** — Stop has not been visited yet; driver is still on the way
- **Arrived** — Driver has reached this stop and is performing the on-site work
- **Done** — Stop completed
- **Cancelled/Skipped** — Stop was skipped or cancelled

---

### Per-Stop Notes

**What it does**: Each stop has two note fields — one for dispatcher instructions and one for the driver to fill in during the visit.

**Why it matters**: Allows dispatchers to pass delivery or visit instructions to the driver, and drivers to record observations at each stop.

**How it works**: "Stop Note" is filled by the dispatcher before the route starts. "Note by Driver" is filled during or after the visit. Both are visible in the stop list and detail form.

---

### Coordinate Validation

**What it does**: Validates that the departure and all stops have valid GPS coordinates before the route can be confirmed.

**Why it matters**: Prevents routes with missing or invalid locations from being dispatched, which would cause routing failures.

**How it works**: Confirmation checks that the departure and every stop have non-zero coordinates; (0, 0) is treated as unset. Separately, whenever a stop's coordinates are set, they must fall within valid latitude (-90 to 90) and longitude (-180 to 180) ranges. Each stop also enforces uniqueness of address and coordinates per route.

---

### Geocoding Integration

**What it does**: Allows dispatchers to geocode the departure location or any stops that are missing GPS coordinates directly from the route form, without leaving the application.

**Why it matters**: Routes cannot be confirmed unless all locations have valid coordinates. Built-in geocoding removes the need to navigate to each contact record and geocode it manually.

**How it works**: When the departure or any stop is missing valid coordinates, the form displays an alert banner with a dedicated geocoding button. Clicking it calls the configured geocoding provider for the affected address. Stop geocoding processes up to 25 stops per click; if more than 25 stops need it, you're asked to fix some first and try again. When the OpenStreetMap provider is active, requests are throttled to one per second to respect its rate limits; other providers run without the added delay. If a location already has valid coordinates, the stored values are used directly without making an API call.

---

### Coordinate Snapshots

**What it does**: Stores a copy of each location's GPS coordinates directly on the route and stop records at the time they are set or geocoded.

**Why it matters**: Prevents subsequent changes to a partner's address or coordinates from silently updating an existing route's geography. A confirmed or in-progress route keeps the coordinates it was planned with, even if the contact record is later updated.

**How it works**: When a departure or stop partner is assigned, the system copies the partner's current `partner_latitude` and `partner_longitude` into snapshot fields on the route or line record. After that, the snapshot only updates automatically if the partner's own coordinates change while the route is still in Draft — a Confirmed or In Progress route keeps the coordinates it was planned with, even if the contact's address is later edited elsewhere in Odoo. The route's own Geolocate button can still refresh a stop or departure after confirmation, as long as that stop hasn't already been marked Done, Arrived, or Cancelled/Skipped.

---

### Departure Cannot Be a Stop

**What it does**: Prevents the departure location from being added as a drop-off stop on the same route.

**Why it matters**: A departure that is also a stop creates an ambiguous routing loop and is generally a data entry error.

**How it works**: A database constraint raises a validation error if the departure partner appears in the stop list.

---

## Fleet Integration

### Vehicle Assignment

**What it does**: Links a fleet vehicle to a route.

**Why it matters**: Connects route planning to the fleet management module, enabling vehicle tracking and capacity planning.

**How it works**: The vehicle field shows a simplified read-only vehicle list for selection. When a vehicle is selected, the driver is automatically populated from the vehicle's assigned driver employee.

---

### Driver Assignment

**What it does**: Assigns a responsible driver to the route.

**Why it matters**: Identifies who will be executing the route and is required when the route type mandates a driver.

**How it works**: The driver can be set manually or auto-filled when a vehicle is selected. It is locked once the route moves out of Draft.

---

## Security & Access Control

### User Role

**What it does**: Grants access to create and manage routes, with visibility limited to the user's own routes within their company.

**Why it matters**: Prevents users from viewing or modifying routes that belong to other team members.

**How it works**: Users can create, read, edit, and delete their own Draft routes. Non-draft routes cannot be deleted.

---

### Administrator Role

**What it does**: Grants full visibility across all routes in all companies, with the same deletion restriction as the User role.

**Why it matters**: Administrators need a complete view of all routes to manage operations and assist other users.

**How it works**: Administrators can read and edit all routes regardless of the responsible user or company. Only Draft routes can be deleted, even for administrators.

---

## Chatter & Activities

### Message History

**What it does**: Records all changes to tracked fields (status, responsible user, driver, vehicle, route type, departure date, name) in the route's message history.

**Why it matters**: Provides a complete audit trail showing who changed what and when on each route.

**How it works**: Uses Odoo's `mail.thread` mixin. Fields marked with `tracking=True` automatically log changes to the chatter.

---

### Activity Scheduling

**What it does**: Allows scheduling follow-up activities (calls, emails, tasks) directly on a route record.

**Why it matters**: Keeps route-related tasks organized within the route record rather than in separate to-do lists.

**How it works**: Uses Odoo's `mail.activity.mixin`. The activity button appears on the route form alongside the chatter.
