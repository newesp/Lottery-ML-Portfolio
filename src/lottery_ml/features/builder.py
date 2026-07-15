from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass
from datetime import date
from statistics import mean, pstdev
from typing import Literal

import pandas as pd

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.config import FeatureConfig
from lottery_ml.features.schema import KEY_COLUMNS, TARGET_COLUMN, feature_columns

AreaName = Literal["area1", "area2"]


@dataclass(slots=True)
class _AreaState:
    max_number: int
    pick_count: int
    counts: list[int]
    occurrences: list[list[int]]
    recent: deque[set[int]]
    ewm_values: dict[int, list[float]]
    ewm_norms: dict[int, float]
    cooccurrence: list[list[int]]

    @classmethod
    def create(cls, max_number: int, pick_count: int, config: FeatureConfig) -> _AreaState:
        return cls(
            max_number=max_number,
            pick_count=pick_count,
            counts=[0] * (max_number + 1),
            occurrences=[[] for _ in range(max_number + 1)],
            recent=deque(maxlen=max(config.rolling_windows)),
            ewm_values={
                halflife: [0.0] * (max_number + 1) for halflife in config.ewm_halflives
            },
            ewm_norms={halflife: 0.0 for halflife in config.ewm_halflives},
            cooccurrence=[
                [0] * (max_number + 1) for _ in range(max_number + 1)
            ],
        )


def build_candidate_rows(draws: list[DrawRecord], config: FeatureConfig) -> pd.DataFrame:
    if 20 not in config.rolling_windows:
        raise ValueError("feature config must include rolling window 20")
    _validate_draw_order(draws)
    states = {
        "area1": _AreaState.create(38, 6, config),
        "area2": _AreaState.create(8, 1, config),
    }
    rows: list[dict[str, object]] = []
    all_features = feature_columns("full", config)

    for draw_index, draw in enumerate(draws):
        selections: dict[AreaName, set[int]] = {
            "area1": set(draw.area1),
            "area2": {draw.area2},
        }
        for area in ("area1", "area2"):
            state = states[area]
            selected = selections[area]
            for number in range(1, state.max_number + 1):
                row: dict[str, object] = {
                    "draw_id": draw.draw_id,
                    "draw_date": draw.draw_date.isoformat(),
                    "area": area,
                    "number": number,
                    "target": int(number in selected),
                }
                row.update(_features(state, number, draw_index, draw.draw_date, config))
                rows.append(row)
            _update_state(state, selected, draw_index, config)

    return pd.DataFrame(rows, columns=[*KEY_COLUMNS, TARGET_COLUMN, *all_features])


def _features(
    state: _AreaState,
    number: int,
    draw_index: int,
    draw_date: date,
    config: FeatureConfig,
) -> dict[str, float | int]:
    history_count = len(state.recent)
    result: dict[str, float | int] = {
        "lifetime_count": state.counts[number],
        "lifetime_rate": state.counts[number] / draw_index if draw_index else 0.0,
    }
    rolling_rates: dict[int, float] = {}
    history = list(state.recent)
    for window in config.rolling_windows:
        relevant = history[-window:]
        count = sum(number in draw for draw in relevant)
        rate = count / len(relevant) if relevant else 0.0
        result[f"rolling_count_{window}"] = count
        result[f"rolling_rate_{window}"] = rate
        rolling_rates[window] = rate
    for halflife in config.ewm_halflives:
        norm = state.ewm_norms[halflife]
        value = state.ewm_values[halflife][number]
        result[f"ewm_rate_{halflife}"] = value / norm if norm else 0.0

    occurrences = state.occurrences[number]
    gap = draw_index - occurrences[-1] if occurrences else draw_index + 1
    gaps = [
        current - previous
        for previous, current in zip(occurrences, occurrences[1:], strict=False)
    ]
    avg_gap = mean(gaps) if gaps else float(gap)
    result.update(
        {
            "gap": gap,
            "log_gap": math.log1p(gap),
            "avg_gap": avg_gap,
            "gap_ratio": gap / avg_gap if avg_gap else 0.0,
        }
    )

    previous = sorted(history[-1]) if history else []
    previous_values = [float(value) for value in previous]
    uniform_rate = state.pick_count / state.max_number
    relative_rate = rolling_rates[20] / uniform_rate if history_count else 0.0
    candidate_angle = 2 * math.pi * number / state.max_number
    weekday_angle = 2 * math.pi * draw_date.weekday() / 7
    month_angle = 2 * math.pi * (draw_date.month - 1) / 12
    result.update(
        {
            "candidate_norm": number / state.max_number,
            "candidate_sin": math.sin(candidate_angle),
            "candidate_cos": math.cos(candidate_angle),
            "draw_index_scaled": draw_index / (draw_index + 100) if draw_index else 0.0,
            "weekday_sin": math.sin(weekday_angle),
            "weekday_cos": math.cos(weekday_angle),
            "month_sin": math.sin(month_angle),
            "month_cos": math.cos(month_angle),
            "previous_draw_sum": sum(previous_values),
            "previous_draw_mean": mean(previous_values) if previous_values else 0.0,
            "previous_draw_std": pstdev(previous_values) if len(previous_values) > 1 else 0.0,
            "previous_draw_range": (
                max(previous_values) - min(previous_values) if previous_values else 0.0
            ),
            "previous_draw_odd_count": sum(value % 2 for value in previous),
            "seen_last_draw": int(bool(history) and number in history[-1]),
            "seen_last_2_draws": int(any(number in draw for draw in history[-2:])),
            "seen_last_3_draws": int(any(number in draw for draw in history[-3:])),
            "rolling_20_vs_uniform": relative_rate,
            "is_hot_20": int(history_count >= 3 and relative_rate > 1.2),
            "is_cold_20": int(history_count >= 3 and relative_rate < 0.8),
        }
    )

    cooccurrence_values = [state.cooccurrence[number][other] for other in previous]
    result.update(
        {
            "cooccurrence_prev_sum": sum(cooccurrence_values),
            "cooccurrence_prev_max": max(cooccurrence_values, default=0),
            "cooccurrence_prev_mean": (
                mean(cooccurrence_values) if cooccurrence_values else 0.0
            ),
        }
    )
    return result


def _update_state(
    state: _AreaState,
    selected: set[int],
    draw_index: int,
    config: FeatureConfig,
) -> None:
    for halflife in config.ewm_halflives:
        decay = 0.5 ** (1 / halflife)
        values = state.ewm_values[halflife]
        for number in range(1, state.max_number + 1):
            values[number] *= decay
        for number in selected:
            values[number] += 1.0
        state.ewm_norms[halflife] = state.ewm_norms[halflife] * decay + 1.0

    for number in selected:
        state.counts[number] += 1
        state.occurrences[number].append(draw_index)
    for left in selected:
        for right in selected:
            if left != right:
                state.cooccurrence[left][right] += 1
    state.recent.append(set(selected))


def _validate_draw_order(draws: list[DrawRecord]) -> None:
    dates = [draw.draw_date for draw in draws]
    if any(
        current <= previous
        for previous, current in zip(dates, dates[1:], strict=False)
    ):
        raise ValueError("draws must be strictly increasing by date")
