# Route Planner

## Overview

This is the base application module for multi-stop route planning in Odoo. It introduces the Route Planner application with all core models, state lifecycle management, security rules, and route type configuration. Other modules in the suite extend this foundation with Mapbox map visualization, API-based route calculation, and portal access for drivers.

## What It Does

Provides a standalone Route Planner application where you can define routes with a departure point, an ordered list of stops, and optional vehicle and driver assignments. Routes move through a structured lifecycle from Draft through to Done. Each stop tracks per-leg distance and duration. Route types let you define which fields are mandatory and give each type a distinct color for easy identification in the list.

## Key Features

- **Route Planner Application**: A dedicated top-level application with its own menu
- **Multi-Stop Routes**: Define a departure point and an ordered list of stops, each linked to a geocoded contact address
- **Route Lifecycle**: Five states — Draft, Confirmed, In Progress, Done, and Cancelled — with clear transition buttons on the form
- **Route Types**: Configurable types (name, color, departure title, default service duration) that control which fields are required before confirming
- **Vehicle & Driver Assignment**: Link fleet vehicles and drivers to a route; selecting a vehicle auto-fills the driver
- **Distance & Duration Summary**: Total distance and estimated travel duration are aggregated from per-leg values and shown on the route form
- **Service Duration per Stop**: Track time spent at each stop (drop-off, customer meeting, repair, etc.); defaults from the route type, overridable per stop
- **Estimated Arrival Date**: Automatically calculated from departure date, travel time, and total service duration at all stops
- **Per-Stop Notes**: Two note fields per stop — one for dispatcher instructions, one for driver notes
- **Stop Status Tracking**: Each stop has its own state (None, Arrived, Cancelled/Skipped, Done)
- **Address Geocoding**: Geocode departure and stop locations directly from the route form using your configured geocoding provider (rate-limited automatically when using OpenStreetMap); missing or invalid coordinates are flagged with an alert banner
- **Calendar View**: View routes by departure date on a calendar with day, week, month, and year scales, color-coded by state
- **Role-Based Access Control**: Separate User and Administrator roles; users see only their own routes; only Draft routes can be deleted
- **Chatter & Activities**: Full message history and activity scheduling on every route record
- **Automatic Sequence Numbering**: Routes are assigned sequential reference numbers automatically

## Dependencies

- `base_geolocalize`
- `contacts`
- `hr_fleet`

## Installation

1. Install the module through Odoo Apps
2. Go to **Route Planner** in the main menu
3. Configure route types under **Route Planner → Route Type** if needed

## Basic Usage

1. Open the **Route Planner** application
2. Click **Create** to start a new route
3. Set the **Departure** location (must have GPS coordinates)
4. Add **Stops** in the desired visit order
5. Assign a **Vehicle** and **Driver** if required by the route type
6. Click **Confirm** to validate and lock the route
7. Click **Start Route** when the driver departs
8. Click **Done** when all stops are completed

## Route States

| State | Description |
| --- | --- |
| Draft | Route is being prepared; all fields are editable |
| Confirmed | Validated and ready to dispatch; fields are locked |
| In Progress | Driver is on the road |
| Done | All stops completed; route is closed |
| Cancelled | Route was cancelled; can be reset to Draft |

## Related Modules

- `route_planner_mapbox_gl`: Adds Mapbox map visualization and API-based route calculation
- `contacts_route_planner_mapbox_gl`: Creates routes from selected contacts on the map
- `delivery_route_planner_mapbox_gl`: Creates delivery routes from batch transfers
- `website_route_planner_mapbox_gl`: Portal interface for drivers
