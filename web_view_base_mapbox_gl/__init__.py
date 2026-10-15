from . import models


def _uninstall_view_mapbox_gl(env):
    env.cr.execute(
        "UPDATE ir_act_window "
        "SET view_mode=replace(view_mode, ',mapbox_gl', '')"
        "WHERE view_mode LIKE '%,mapbox_gl%';"
    )
    env.cr.execute(
        "UPDATE ir_act_window "
        "SET view_mode=replace(view_mode, 'mapbox_gl,', '')"
        "WHERE view_mode LIKE '%mapbox_gl,%';"
    )
    env.cr.execute("DELETE FROM ir_act_window WHERE view_mode = 'mapbox_gl';")
