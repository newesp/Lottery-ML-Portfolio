from __future__ import annotations

from lottery_ml.experiments.config import FeatureConfig

KEY_COLUMNS = ("draw_id", "draw_date", "area", "number")
TARGET_COLUMN = "target"

GAP_COLUMNS = ("gap", "log_gap", "avg_gap", "gap_ratio")
CONTEXT_COLUMNS = (
    "candidate_norm",
    "candidate_sin",
    "candidate_cos",
    "draw_index_scaled",
    "weekday_sin",
    "weekday_cos",
    "month_sin",
    "month_cos",
    "previous_draw_sum",
    "previous_draw_mean",
    "previous_draw_std",
    "previous_draw_range",
    "previous_draw_odd_count",
    "seen_last_draw",
    "seen_last_2_draws",
    "seen_last_3_draws",
    "rolling_20_vs_uniform",
    "is_hot_20",
    "is_cold_20",
)
COOCCURRENCE_COLUMNS = (
    "cooccurrence_prev_sum",
    "cooccurrence_prev_max",
    "cooccurrence_prev_mean",
)


def frequency_columns(config: FeatureConfig) -> tuple[str, ...]:
    rolling = tuple(
        name
        for window in config.rolling_windows
        for name in (f"rolling_count_{window}", f"rolling_rate_{window}")
    )
    ewm = tuple(f"ewm_rate_{halflife}" for halflife in config.ewm_halflives)
    return ("lifetime_count", "lifetime_rate", *rolling, *ewm)


def feature_columns(feature_set: str, config: FeatureConfig) -> tuple[str, ...]:
    group_columns = {
        "frequency": frequency_columns(config),
        "gap": GAP_COLUMNS,
        "context": CONTEXT_COLUMNS,
        "cooccurrence": COOCCURRENCE_COLUMNS,
    }
    try:
        groups = config.feature_sets[feature_set]
    except KeyError as error:
        raise ValueError(f"unknown feature set: {feature_set}") from error

    columns: list[str] = []
    for group in groups:
        if group not in group_columns:
            raise ValueError(f"unknown feature group: {group}")
        columns.extend(group_columns[group])
    if len(columns) != len(set(columns)):
        raise ValueError(f"duplicate feature columns in set: {feature_set}")
    return tuple(columns)
