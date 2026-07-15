from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Literal

import numpy as np
import pandas as pd

KEY_COLUMNS = ["draw_id", "area", "number"]
AreaName = Literal["area1", "area2"]


class PredictionKeyError(ValueError):
    """Raised when targets and predictions do not have one-to-one key coverage."""


@dataclass(frozen=True, slots=True)
class MetricSummary:
    area: AreaName
    draw_count: int
    average_hits: float
    precision_at_k: float
    recall_at_k: float
    lift_over_uniform: float
    brier_score: float
    log_loss: float

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def evaluate_predictions(
    targets: pd.DataFrame,
    predictions: pd.DataFrame,
    *,
    area: AreaName,
) -> MetricSummary:
    expected_target_columns = {*KEY_COLUMNS, "target"}
    expected_prediction_columns = {*KEY_COLUMNS, "probability"}
    if not expected_target_columns <= set(targets):
        raise PredictionKeyError("targets are missing required columns")
    if not expected_prediction_columns <= set(predictions):
        raise PredictionKeyError("predictions are missing required columns")
    if targets.duplicated(KEY_COLUMNS).any() or predictions.duplicated(KEY_COLUMNS).any():
        raise PredictionKeyError("duplicate prediction keys")

    merged = targets[[*KEY_COLUMNS, "target"]].merge(
        predictions[[*KEY_COLUMNS, "probability"]],
        on=KEY_COLUMNS,
        how="outer",
        validate="one_to_one",
        indicator=True,
    )
    if len(merged) != len(targets) or not (merged["_merge"] == "both").all():
        raise PredictionKeyError("targets and predictions require one-to-one key coverage")
    if set(merged["area"]) != {area}:
        raise PredictionKeyError(f"metrics received rows outside area {area}")

    probabilities = merged["probability"].to_numpy(dtype=float)
    labels = merged["target"].to_numpy(dtype=float)
    if not np.isfinite(probabilities).all() or np.any((probabilities < 0) | (probabilities > 1)):
        raise ValueError("probabilities must be finite values between zero and one")
    if not set(np.unique(labels)) <= {0.0, 1.0}:
        raise ValueError("targets must be binary")

    pick_count = 6 if area == "area1" else 1
    maximum = 38 if area == "area1" else 8
    ranked = merged.sort_values(
        ["draw_id", "probability", "number"],
        ascending=[True, False, True],
        kind="stable",
    )
    top = ranked.groupby("draw_id", sort=False).head(pick_count)
    hits = top.groupby("draw_id", sort=False)["target"].sum()
    average_hits = float(hits.mean())
    expected_uniform_hits = pick_count * pick_count / maximum
    clipped = np.clip(probabilities, 1e-15, 1 - 1e-15)
    log_loss = float(
        -np.mean(labels * np.log(clipped) + (1 - labels) * np.log(1 - clipped))
    )
    return MetricSummary(
        area=area,
        draw_count=int(merged["draw_id"].nunique()),
        average_hits=average_hits,
        precision_at_k=average_hits / pick_count,
        recall_at_k=average_hits / pick_count,
        lift_over_uniform=average_hits / expected_uniform_hits,
        brier_score=float(np.mean((probabilities - labels) ** 2)),
        log_loss=log_loss if math.isfinite(log_loss) else float("inf"),
    )
