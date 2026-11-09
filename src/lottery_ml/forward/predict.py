from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.evaluation.metrics import AreaName
from lottery_ml.evaluation.ranking import top_k_numbers
from lottery_ml.experiments.config import FeatureConfig
from lottery_ml.experiments.holdout import SelectionProtocol, fit_seed_ensemble
from lottery_ml.features.builder import build_candidate_rows, build_next_draw_rows
from lottery_ml.features.schema import feature_columns


@dataclass(frozen=True, slots=True)
class AreaPrediction:
    picks: tuple[int, ...]
    scores: tuple[tuple[int, float], ...] = ()


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

    area_names: tuple[AreaName, AreaName] = ("area1", "area2")
    for area_name in area_names:
        chosen = selection.areas[area_name]
        columns = list(feature_columns(chosen.feature_set, feature_config))

        area_train = train_frame.loc[train_frame["area"] == area_name]
        area_next = next_frame.loc[next_frame["area"] == area_name]
        k = 6 if area_name == "area1" else 1

        # Model ensemble prediction
        _, ensemble_proba = fit_seed_ensemble(
            chosen.model,
            chosen.parameters,
            chosen.seeds,
            area_train[columns],
            area_train["target"],
            area_next[columns],
        )

        numbers = [int(n) for n in area_next["number"].tolist()]
        scores = [float(s) for s in ensemble_proba.tolist()]
        model_picks = top_k_numbers(numbers, scores, k)

        score_limit = 10 if area_name == "area1" else 8
        paired = sorted(zip(numbers, scores, strict=True), key=lambda x: (-x[1], x[0]))
        top_scores = tuple((num, round(score, 6)) for num, score in paired[:score_limit])
        model_preds[area_name] = AreaPrediction(picks=model_picks, scores=top_scores)

        # Historical frequency baseline
        hf_scores = [float(s) for s in area_next["lifetime_rate"].tolist()]
        hf_picks = top_k_numbers(numbers, hf_scores, k)
        hf_preds[area_name] = AreaPrediction(picks=hf_picks, scores=())

    return {
        "model": model_preds,
        "historical_frequency": hf_preds,
    }


def serialize_predictions(
    predictions: dict[str, dict[AreaName, AreaPrediction]],
) -> dict[str, dict[str, object]]:
    return {
        "model": {
            "area1": {
                "picks": list(predictions["model"]["area1"].picks),
                "top_scores": [
                    [num, score] for num, score in predictions["model"]["area1"].scores
                ],
            },
            "area2": {
                "picks": list(predictions["model"]["area2"].picks),
                "top_scores": [
                    [num, score] for num, score in predictions["model"]["area2"].scores
                ],
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
