# State constants with numeric prefixes for sorting order in selection lists
# Higher numbers appear later in the list (99_draft appears last)
ROUTE_STATE_DRAFT = '99_draft'
ROUTE_STATE_CONFIRMED = '02_confirmed'
ROUTE_STATE_IN_PROGRESS = '01_in_progress'
ROUTE_STATE_DONE = '03_done'
ROUTE_STATE_CANCELLED = '04_cancelled'

ROUTE_STATES = [
    (ROUTE_STATE_DRAFT, 'Draft'),
    (ROUTE_STATE_IN_PROGRESS, 'In Progress'),
    (ROUTE_STATE_CONFIRMED, 'Confirmed'),
    (ROUTE_STATE_DONE, 'Done'),
    (ROUTE_STATE_CANCELLED, 'Cancelled'),
]

# Route stop states
ROUTE_STOP_STATE_NONE = '00_none'
ROUTE_STOP_STATE_ARRIVED = '01_arrived'
ROUTE_STOP_STATE_CANCELLED_OR_SKIPPED = '03_cancell_or_skipped'
ROUTE_STOP_STATE_DONE = '04_done'

ROUTE_STOP_STATES = [
    (ROUTE_STOP_STATE_NONE, 'None'),
    (ROUTE_STOP_STATE_ARRIVED, 'Arrived'),
    (ROUTE_STOP_STATE_CANCELLED_OR_SKIPPED, 'Cancelled/Skipped'),
    (ROUTE_STOP_STATE_DONE, 'Done'),
]


def format_duration(hours_float):
    """
    Format a float duration (in hours) to a human-readable string.
    Handles values >= 24 hours unlike datetime.time.

    :param hours_float: Duration in hours as a float (e.g., 25.5 = 25h 30m)
    :return: Formatted string (e.g., "25h 30m")
    """
    if not hours_float:
        return ''
    total_minutes = int(hours_float * 60)
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours and minutes:
        return f'{hours}h {minutes}m'
    elif hours:
        return f'{hours}h'
    elif minutes:
        return f'{minutes}m'
    elif hours_float > 0:
        return '< 1m'
    return ''
