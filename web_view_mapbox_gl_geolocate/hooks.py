def _uninstall_mapbox_gl_geolocate(env):
    env.cr.execute(
        "UPDATE ir_act_window "
        "SET view_mode=replace(view_mode, ',mapbox_gl_geolocate', '')"
        "WHERE view_mode LIKE '%,mapbox_gl_geolocate%';"
    )
    env.cr.execute(
        "UPDATE ir_act_window "
        "SET view_mode=replace(view_mode, 'mapbox_gl_geolocate,', '')"
        "WHERE view_mode LIKE '%mapbox_gl_geolocate,%';"
    )
    env.cr.execute(
        "DELETE FROM ir_act_window WHERE view_mode = 'mapbox_gl_geolocate'"
    )
