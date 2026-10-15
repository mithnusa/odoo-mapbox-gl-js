{
    'name': 'Route Planner',
    'summary': 'Standalone application for multi-stop route planning with lifecycle management, fleet integration, and route type configuration',
    'description': '''
Route Planner
=============

A dedicated top-level application for planning and tracking multi-stop
routes. Covers the full route lifecycle from drafting to completion, with
fleet integration, configurable route types, and built-in TSP optimization
algorithms used by the Mapbox extension.

Key Features
------------
* Multi-stop routes — departure point plus an ordered, drag-reorderable
  list of stops, each linked to a geocoded contact address
* Route lifecycle — five states: Draft, Confirmed, In Progress, Done, and
  Cancelled; clear transition buttons on the form view
* Route types — configurable categories (name, color, departure label,
  default service duration) that control which fields are required before
  confirmation; a built-in "Route" type is included
* Vehicle & driver assignment — links fleet vehicles and drivers; selecting
  a vehicle auto-fills the driver from the vehicle's assigned employee
* Distance & duration summary — total travel distance and estimated
  duration aggregated from per-leg values on each stop
* Service duration per stop — time spent at each stop (drop-off, meeting,
  repair); defaults from the route type, overridable per stop
* Estimated arrival date — calculated from departure date, travel time,
  and total service duration; updates automatically
* Stop status tracking — each stop has its own state: None, Arrived, Done,
  or Cancelled/Skipped
* Per-stop notes — dispatcher instructions and a driver note field per stop
* Calendar view — routes displayed by departure date, color-coded by state,
  with day/week/month/year scales
* Automatic sequence numbering — routes receive a sequential reference
  (e.g. RP/00001) on creation
* Role-based access control — User role (own routes only) and Administrator
  role (all routes); only Draft routes can be deleted
* Chatter & activities — full message history and activity scheduling on
  every route record
* TSP algorithms — nearest-neighbor heuristic and 2-opt improvement, used
  by the Mapbox extension for local route optimization before API calls
* Generic origin tracking — a route can record which record generated it
  (origin_res_model/origin_res_id), shown as a readable "Source" on the
  form, list, and search views; other apps can create a route and its
  stops in one call via _create_from_stops(); confirming a route posts a
  note back to its origin record automatically
* Route Stops menu — every stop across every route, independently
  browsable, searchable, and filterable by status, without opening each
  route individually
* Per-stop attachments — a stop's own photos/signatures (from the driver
  portal) are queryable directly via attachment_ids/attachment_count,
  reusing ir.attachment's existing res_model/res_id polymorphism
''',
    'license': 'LGPL-3',
    'author': 'Yopi Angi (Mithnusa)',
    'website': 'https://github.com/mithnusa',
    'support': 'yopiangi@gmail.com',
    'category': 'Extra Tools',
    'version': '19.0.1.2.1',
    'depends': ['base_geolocalize', 'contacts', 'hr_fleet'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/data_ir_sequence.xml',
        'data/data_route_type.xml',
        'views/fleet_vehicle.xml',
        'views/route_type.xml',
        'views/route_planner.xml',
        'views/route_planner_line.xml',
        'views/route_menu.xml',
    ],
}
