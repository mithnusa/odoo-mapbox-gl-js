def migrate(cr, version):
    cr.execute("""
        UPDATE route_planner_line
        SET state = '01_arrived'
        WHERE state = '01_in_progress'
    """)
