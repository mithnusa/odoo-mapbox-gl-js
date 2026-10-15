# -*- coding: utf-8 -*-
{
    'name': 'Project Mapbox GeoJSON',
    'summary': 'Add interactive Mapbox map views and GeoJSON drawing to Projects and Tasks',
    'version': '19.0.1.0.1',
    'author': 'Yopi Angi <yopiangi@gmail.com>',
    'license': 'LGPL-3',
    'maintainer': 'Yopi Angi <yopiangi@gmail.com>',
    'website': 'https://www.mithnusa.com',
    'support': 'info@mithnusa.com',
    'category': 'Project',
    'description': '''
Project Mapbox GeoJSON
======================

Extends Odoo's Project module with interactive Mapbox GL map views and
GeoJSON geometry drawing for both Projects and Tasks.

Features
--------
* Map view for Projects — visualise all projects with geographic data on an
  interactive Mapbox map; injected automatically into the standard Project
  menus on installation and removed cleanly on uninstall.

* Map view for Tasks — visualise tasks on an interactive Mapbox map,
  coloured and labelled per task, with a link back to the parent project.

* Site tab on Project form — draw polygons, lines, and points directly on
  the map; automatically calculates and stores the total enclosed area
  (m²); colour picker and HTML notes field.

* Site tab on Task form — same drawing canvas as on the project form plus
  a read-only display of the parent project's area for reference.

Models extended
---------------
* project.project — mapbox_geojson (SearchableJson), mapbox_area (Float),
  mapbox_notes (Html), mapbox_color (Integer)

* project.task — mapbox_geojson, mapbox_area, mapbox_notes, mapbox_color
  (own task-level fields) plus mapbox_project_geojson and
  mapbox_project_area (related read-only fields from the parent project)

uninstall_hook  — removes "mapbox_gl" from the standard Project and Task
                  window actions so no broken view buttons remain after
                  uninstallation.
''',
    'depends': [
        'project',
        'web_view_mapbox_gl_draw',
        'web_widget_mapbox_gl',
    ],
    'data': [
        'data/ir_actions_act_window.xml',
        'views/project_project_views.xml',
        'views/project_task_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'project_mapbox_gl/static/src/views/mapbox_gl_draw/*',
            'project_mapbox_gl/static/src/widget/drawing/*',
        ],
    },
    'uninstall_hook': 'uninstall_hook',
}
