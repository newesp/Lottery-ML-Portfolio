from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

TAIPEI = timezone(timedelta(hours=8))
DRAW_WEEKDAYS = (0, 3)  # Monday, Thursday
LATE_GUARD_LOCAL_TIME = time(20, 0)


def next_draw_date(after: date) -> date:
    """Return the next Monday or Thursday strictly after the given date."""
    current = after + timedelta(days=1)
    while current.weekday() not in DRAW_WEEKDAYS:
        current += timedelta(days=1)
    return current


def prediction_deadline(target: date) -> datetime:
    """Return 20:00 Asia/Taipei on the target draw date."""
    return datetime.combine(target, LATE_GUARD_LOCAL_TIME, tzinfo=TAIPEI)
