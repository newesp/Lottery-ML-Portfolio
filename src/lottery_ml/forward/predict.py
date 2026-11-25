from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date
from inspect import getsource
from pathlib import Path

import pandas as pd

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.evaluation.metrics import AreaName
from lottery_ml.evaluation.ranking import top_k_numbers
from lottery_ml.experiments.config import FeatureConfig
from lottery_ml.experiments.holdout import SelectionProtocol, fit_seed_ensemble
from lottery_ml.features.builder import build_candidate_rows, build_next_draw_rows
from lottery_ml.features.schema import feature_columns


def scoring_code_hash() -> str:
    source = Path(__file__).resolve().parents[1]
    code = hashlib.sha256()
    for name in (
        "features/builder.py",
        "features/schema.py",
        "models/pipelines.py",
        "evaluation/ranking.py",
    ):
        code.update((source / name).read_text(encoding="utf8").encode())
    for fn in (score_candidates, fit_seed_ensemble, predict_next):
        code.update(getsource(fn).encode())
    return code.hexdigest()


@dataclass(frozen=True, slots=True)
class AreaPrediction:
    picks: tuple[int, ...]
    scores: tuple[tuple[int, float], ...] = ()
    raw: tuple[float, ...] = ()


def predict_next(
    draws: list[DrawRecord],
    selection: SelectionProtocol,
    feature_config: FeatureConfig,
    target_date: date,
) -> dict[str, dict[AreaName, AreaPrediction]]:
    """Predict top numbers for the upcoming target draw.

    Returns predictions for 'model' and 'historical_frequency'.
    """
    train_frame = build_candidate_rows(draws, feature_config)
    next_frame = build_next_draw_rows(draws, target_date, target_date.isoformat(), feature_config)

    model_preds: dict[AreaName, AreaPrediction] = {}
    hf_preds: dict[AreaName, AreaPrediction] = {}
    for area_name, (numbers, scores, hf_scores) in score_candidates(
        train_frame, next_frame, selection, feature_config
    ).items():
        k = 6 if area_name == "area1" else 1
        model_picks = top_k_numbers(numbers, scores, k)

        score_limit = 10 if area_name == "area1" else 8
        paired = sorted(zip(numbers, scores, strict=True), key=lambda x: (-x[1], x[0]))
        top_scores = tuple((num, round(score, 6)) for num, score in paired[:score_limit])
        model_preds[area_name] = AreaPrediction(
            picks=model_picks, scores=top_scores, raw=tuple(scores)
        )

        # Historical frequency baseline
        hf_picks = top_k_numbers(numbers, hf_scores, k)
        hf_preds[area_name] = AreaPrediction(picks=hf_picks, scores=())

    return {
        "model": model_preds,
        "historical_frequency": hf_preds,
    }


def score_candidates(
    train_frame: pd.DataFrame,
    next_frame: pd.DataFrame,
    selection: SelectionProtocol,
    feature_config: FeatureConfig,
) -> dict[AreaName, tuple[list[int], list[float], list[float]]]:
    result: dict[AreaName, tuple[list[int], list[float], list[float]]] = {}
    area_names: tuple[AreaName, AreaName] = ("area1", "area2")
    for area_name in area_names:
        chosen = selection.areas[area_name]
        columns = list(feature_columns(chosen.feature_set, feature_config))

        area_train = train_frame.loc[train_frame["area"] == area_name]
        area_next = next_frame.loc[next_frame["area"] == area_name]

        # Model ensemble prediction
        _, ensemble_proba = fit_seed_ensemble(
            chosen.model,
            chosen.parameters,
            chosen.seeds,
            area_train[columns],
            area_train["target"],
            area_next[columns],
            deterministic_prediction=True,
        )

        numbers = [int(n) for n in area_next["number"].tolist()]
        scores = [float(s) for s in ensemble_proba.tolist()]
        frequencies = [float(s) for s in area_next["lifetime_rate"].tolist()]
        result[area_name] = numbers, scores, frequencies
    return result


def serialize_predictions(
    predictions: dict[str, dict[AreaName, AreaPrediction]],
) -> dict[str, dict[str, object]]:
    return {
        "model": {
            "area1": {
                "picks": list(predictions["model"]["area1"].picks),
                "raw": list(predictions["model"]["area1"].raw),
                "top_scores": [[num, score] for num, score in predictions["model"]["area1"].scores],
            },
            "area2": {
                "picks": list(predictions["model"]["area2"].picks),
                "raw": list(predictions["model"]["area2"].raw),
                "top_scores": [[num, score] for num, score in predictions["model"]["area2"].scores],
            },
        },
        "historical_frequency": {
            "area1": {
                "picks": list(predictions["historical_frequency"]["area1"].picks),
            },
            "area2": {
                "picks": list(predictions["historical_frequency"]["area2"].picks),
            },
        },
    }
