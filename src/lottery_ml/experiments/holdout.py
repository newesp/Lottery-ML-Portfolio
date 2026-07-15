from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Protocol, cast

import numpy as np
import pandas as pd
from numpy.typing import NDArray

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.storage import serialize_draws
from lottery_ml.evaluation.bootstrap import paired_mean_difference
from lottery_ml.evaluation.metrics import AreaName, evaluate_predictions
from lottery_ml.experiments.config import FeatureConfig
from lottery_ml.features.builder import build_candidate_rows
from lottery_ml.features.schema import feature_columns
from lottery_ml.models.baselines import predict_rolling_frequency, predict_uniform
from lottery_ml.models.pipelines import build_estimator


class SelectionError(ValueError):
    """Raised when the frozen selection protocol is invalid or stale."""


class ProbabilityEstimator(Protocol):
    def fit(self, x: pd.DataFrame, y: pd.Series) -> object: ...

    def predict_proba(self, x: pd.DataFrame) -> NDArray[np.float64]: ...


@dataclass(frozen=True, slots=True)
class AreaSelection:
    model: str
    feature_set: str
    config_id: str
    parameters: dict[str, object]
    seeds: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class SelectionProtocol:
    selection_id: str
    development_artifact: Path
    development_artifact_sha256: str
    holdout_start: date
    selection_metric: str
    bootstrap_resamples: int
    bootstrap_seed: int
    areas: dict[AreaName, AreaSelection]


@dataclass(frozen=True, slots=True)
class HoldoutReport:
    schema_version: str
    experiment_id: str
    selection_id: str
    development_artifact_sha256: str
    data_sha256: str
    draw_count: int
    holdout_start: str
    holdout_draw_count: int
    areas: dict[str, object]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def load_selection(path: Path, root: Path) -> SelectionProtocol:
    try:
        payload: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise SelectionError(f"cannot read selection protocol {path}: {error}") from error
    if not isinstance(payload, dict):
        raise SelectionError("selection protocol must be an object")
    raw = cast(dict[str, object], payload)
    required = {
        "schema_version",
        "selection_id",
        "development_artifact",
        "development_artifact_sha256",
        "holdout_start",
        "selection_metric",
        "bootstrap_resamples",
        "bootstrap_seed",
        "areas",
    }
    if set(raw) != required or raw["schema_version"] != "1.0.0":
        raise SelectionError("unsupported selection protocol schema")
    artifact = root / _string(raw, "development_artifact")
    expected_hash = _string(raw, "development_artifact_sha256")
    try:
        actual_hash = hashlib.sha256(artifact.read_bytes()).hexdigest()
    except OSError as error:
        raise SelectionError(f"cannot read development artifact: {artifact}") from error
    if actual_hash != expected_hash:
        raise SelectionError("development artifact hash does not match frozen selection")
    areas_raw = raw["areas"]
    if not isinstance(areas_raw, dict) or set(areas_raw) != {"area1", "area2"}:
        raise SelectionError("selection requires area1 and area2")
    areas: dict[AreaName, AreaSelection] = {}
    area_names: tuple[AreaName, ...] = ("area1", "area2")
    for name in area_names:
        value = areas_raw[name]
        if not isinstance(value, dict):
            raise SelectionError(f"invalid selection for {name}")
        item = cast(dict[str, object], value)
        parameters = item.get("parameters")
        seeds = item.get("seeds")
        if not isinstance(parameters, dict) or not isinstance(seeds, list) or not all(
            isinstance(seed, int) and not isinstance(seed, bool) for seed in seeds
        ):
            raise SelectionError(f"invalid parameters or seeds for {name}")
        areas[name] = AreaSelection(
            model=_string(item, "model"),
            feature_set=_string(item, "feature_set"),
            config_id=_string(item, "config_id"),
            parameters=cast(dict[str, object], parameters),
            seeds=tuple(cast(list[int], seeds)),
        )
    try:
        holdout_start = date.fromisoformat(_string(raw, "holdout_start"))
    except ValueError as error:
        raise SelectionError("invalid holdout_start") from error
    return SelectionProtocol(
        selection_id=_string(raw, "selection_id"),
        development_artifact=artifact,
        development_artifact_sha256=expected_hash,
        holdout_start=holdout_start,
        selection_metric=_string(raw, "selection_metric"),
        bootstrap_resamples=_integer(raw, "bootstrap_resamples"),
        bootstrap_seed=_integer(raw, "bootstrap_seed"),
        areas=areas,
    )


def run_holdout_evaluation(
    draws: list[DrawRecord],
    selection: SelectionProtocol,
    feature_config: FeatureConfig,
) -> HoldoutReport:
    frame = build_candidate_rows(draws, feature_config)
    dates = pd.to_datetime(frame["draw_date"], errors="raise").dt.date
    train = frame.loc[dates < selection.holdout_start]
    holdout = frame.loc[dates >= selection.holdout_start]
    if train.empty or holdout.empty or train["draw_date"].max() >= holdout["draw_date"].min():
        raise SelectionError("holdout chronology is invalid or empty")
    area_results: dict[str, object] = {}
    for area, chosen in selection.areas.items():
        area_train = train.loc[train["area"] == area]
        area_holdout = holdout.loc[holdout["area"] == area]
        columns = list(feature_columns(chosen.feature_set, feature_config))
        seed_metrics: list[dict[str, object]] = []
        predictions_by_seed: list[pd.DataFrame] = []
        for seed in chosen.seeds:
            estimator = cast(
                ProbabilityEstimator,
                build_estimator(chosen.model, chosen.parameters, seed),
            )
            estimator.fit(area_train[columns], area_train["target"])
            predictions = area_holdout[["draw_id", "area", "number"]].copy()
            predictions["probability"] = estimator.predict_proba(area_holdout[columns])[:, 1]
            predictions_by_seed.append(predictions)
            metric = evaluate_predictions(area_holdout, predictions, area=area)
            seed_metrics.append({"seed": seed, "metrics": metric.to_dict()})
        ensemble = predictions_by_seed[0].copy()
        ensemble["probability"] = np.mean(
            [item["probability"].to_numpy(dtype=float) for item in predictions_by_seed], axis=0
        )
        ensemble_metric = evaluate_predictions(area_holdout, ensemble, area=area)
        uniform_all = predict_uniform(holdout)
        rolling_all = predict_rolling_frequency(holdout)
        uniform = uniform_all.loc[uniform_all["area"] == area]
        rolling = rolling_all.loc[rolling_all["area"] == area]
        uniform_metric = evaluate_predictions(area_holdout, uniform, area=area)
        rolling_metric = evaluate_predictions(area_holdout, rolling, area=area)
        interval = paired_mean_difference(
            _draw_hits(area_holdout, ensemble, area),
            _draw_hits(area_holdout, uniform, area),
            resamples=selection.bootstrap_resamples,
            seed=selection.bootstrap_seed,
        )
        area_results[area] = {
            "selection": {
                "model": chosen.model,
                "feature_set": chosen.feature_set,
                "config_id": chosen.config_id,
                "parameters": chosen.parameters,
            },
            "seed_results": seed_metrics,
            "ensemble_metrics": ensemble_metric.to_dict(),
            "baselines": {
                "uniform": uniform_metric.to_dict(),
                "rolling_frequency": rolling_metric.to_dict(),
            },
            "paired_bootstrap_hits_vs_uniform": interval.to_dict(),
        }
    return HoldoutReport(
        schema_version="1.0.0",
        experiment_id="holdout-v1",
        selection_id=selection.selection_id,
        development_artifact_sha256=selection.development_artifact_sha256,
        data_sha256=hashlib.sha256(serialize_draws(draws)).hexdigest(),
        draw_count=len(draws),
        holdout_start=selection.holdout_start.isoformat(),
        holdout_draw_count=int(holdout["draw_id"].nunique()),
        areas=area_results,
    )


def _draw_hits(
    targets: pd.DataFrame, predictions: pd.DataFrame, area: AreaName
) -> NDArray[np.float64]:
    pick_count = 6 if area == "area1" else 1
    merged = targets[["draw_id", "area", "number", "target"]].merge(
        predictions[["draw_id", "area", "number", "probability"]],
        on=["draw_id", "area", "number"],
        validate="one_to_one",
    )
    top = merged.sort_values(
        ["draw_id", "probability", "number"],
        ascending=[True, False, True],
        kind="stable",
    ).groupby("draw_id", sort=True).head(pick_count)
    return top.groupby("draw_id", sort=True)["target"].sum().to_numpy(dtype=float)


def _string(raw: dict[str, object], key: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value:
        raise SelectionError(f"{key} must be a non-empty string")
    return value


def _integer(raw: dict[str, object], key: str) -> int:
    value = raw.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise SelectionError(f"{key} must be a positive integer")
    return value
