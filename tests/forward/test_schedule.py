from __future__ import annotations

from datetime import date, datetime

from lottery_ml.forward.schedule import (
    TAIPEI,
    next_draw_date,
    prediction_deadline,
)


def test_next_draw_date() -> None:
    # Monday 2026-11-02 -> Thursday 2026-11-05
    assert next_draw_date(date(2026, 11, 2)) == date(2026, 11, 5)

    # Thursday 2026-11-05 -> Monday 2026-11-09
    assert next_draw_date(date(2026, 11, 5)) == date(2026, 11, 9)

    # Tuesday 2026-11-03 -> Thursday 2026-11-05
    assert next_draw_date(date(2026, 11, 3)) == date(2026, 11, 5)

    # Saturday 2026-11-07 -> Monday 2026-11-09
    assert next_draw_date(date(2026, 11, 7)) == date(2026, 11, 9)

    # Sunday 2026-11-08 -> Monday 2026-11-09
    assert next_draw_date(date(2026, 11, 8)) == date(2026, 11, 9)


def test_prediction_deadline() -> None:
    target = date(2026, 11, 5)
    deadline = prediction_deadline(target)
    assert deadline == datetime(2026, 11, 5, 20, 0, tzinfo=TAIPEI)
