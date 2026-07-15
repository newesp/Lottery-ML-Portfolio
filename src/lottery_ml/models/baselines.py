from __future__ import annotations

import numpy as np
import pandas as pd
from numpy.typing import NDArray

KEY_COLUMNS = ["draw_id", "area", "number"]


def predict_uniform(frame: pd.DataFrame) -> pd.DataFrame:
    return _predict_from_scores(frame, np.ones(len(frame), dtype=float))


def predict_rolling_frequency(frame: pd.DataFrame) -> pd.DataFrame:
    if "lifetime_rate" not in frame:
        raise ValueError("rolling frequency baseline requires lifetime_rate")
    scores = frame["lifetime_rate"].to_numpy(dtype=float) + 1e-9
    return _predict_from_scores(frame, scores)


def predict_shuffled_history(frame: pd.DataFrame, seed: int) -> pd.DataFrame:
    predictions = predict_rolling_frequency(frame)
    rng = np.random.default_rng(seed)
    for draw_id in predictions["draw_id"].astype(str).unique().tolist():
        for area in ("area1", "area2"):
            mask = (predictions["draw_id"] == draw_id) & (predictions["area"] == area)
            positions = np.flatnonzero(mask.to_numpy())
            values = predictions.loc[positions, "probability"].to_numpy(dtype=float, copy=True)
            predictions.loc[positions, "probability"] = rng.permutation(values)
    return predictions


def _predict_from_scores(frame: pd.DataFrame, scores: np.ndarray) -> pd.DataFrame:
    result = frame[KEY_COLUMNS].reset_index(drop=True).copy()
    result["probability"] = 0.0
    score_series = pd.Series(scores, index=result.index)
    for draw_id in result["draw_id"].astype(str).unique().tolist():
        for area, pick_count in (("area1", 6), ("area2", 1)):
            mask = (result["draw_id"] == draw_id) & (result["area"] == area)
            positions = np.flatnonzero(mask.to_numpy())
            probabilities = _normalize_to_pick_count(
                score_series.iloc[positions].to_numpy(dtype=float), pick_count
            )
            result.loc[positions, "probability"] = probabilities
    return result


def _normalize_to_pick_count(
    scores: NDArray[np.float64], pick_count: int
) -> NDArray[np.float64]:
    positive = np.maximum(scores.astype(float), 1e-12)
    probabilities = positive / positive.sum() * pick_count
    active = probabilities < 1
    while np.any(probabilities > 1):
        probabilities = np.minimum(probabilities, 1)
        remaining = pick_count - probabilities[~active].sum()
        if not np.any(active) or remaining <= 0:
            break
        active_scores = positive[active]
        probabilities[active] = active_scores / active_scores.sum() * remaining
        active = probabilities < 1
    probabilities[-1] += pick_count - probabilities.sum()
    return np.asarray(probabilities, dtype=np.float64)
