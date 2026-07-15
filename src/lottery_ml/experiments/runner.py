from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from importlib.metadata import PackageNotFoundError, version
from statistics import mean, pstdev
from typing import Literal, Protocol, cast

import numpy as np
import pandas as pd
from numpy.typing import NDArray

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.storage import serialize_draws
from lottery_ml.evaluation.metrics import AreaName, MetricSummary, evaluate_predictions
from lottery_ml.evaluation.splits import ExpandingYearFold, split_candidate_rows
from lottery_ml.experiments.config import ExperimentConfig, FeatureConfig
from lottery_ml.features.builder import build_candidate_rows
from lottery_ml.features.schema import feature_columns
from lottery_ml.models.baselines import (
    predict_rolling_frequency,
    predict_shuffled_history,
    predict_uniform,
)
from lottery_ml.models.pipelines import build_estimator

RunKind = Literal["model", "baseline"]
METRIC_NAMES = (
    "average_hits",
    "precision_at_k",
    "recall_at_k",
    "lift_over_uniform",
    "brier_score",
    "log_loss",
)


class ProbabilityEstimator(Protocol):
    def fit(self, x: pd.DataFrame, y: pd.Series) -> object: ...

    def predict_proba(self, x: pd.DataFrame) -> NDArray[np.float64]: ...


@dataclass(frozen=True, slots=True)
class FoldEvaluation:
    train_end_year: int
    validation_year: int
    draw_count: int
    metrics: dict[str, float]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ExperimentRun:
    run_id: str
    kind: RunKind
    area: AreaName
    model: str
    feature_set: str | None
    config_id: str
    parameters: dict[str, object]
    seed: int
    folds: tuple[FoldEvaluation, ...]
    mean_metrics: dict[str, float]
    std_metrics: dict[str, float]

    def to_dict(self) -> dict[str, object]:
        return {
            "run_id": self.run_id,
            "kind": self.kind,
            "area": self.area,
            "model": self.model,
            "feature_set": self.feature_set,
            "config_id": self.config_id,
            "parameters": self.parameters,
            "seed": self.seed,
            "folds": [fold.to_dict() for fold in self.folds],
            "mean_metrics": self.mean_metrics,
            "std_metrics": self.std_metrics,
        }


@dataclass(frozen=True, slots=True)
class DevelopmentReport:
    schema_version: str
    experiment_id: str
    data_sha256: str
    draw_count: int
    feature_version: str
    cv_validation_years: tuple[int, ...]
    holdout_start: str
    selected_hyperparameters: dict[str, dict[str, dict[str, object]]]
    package_versions: dict[str, str]
    runs: tuple[ExperimentRun, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "experiment_id": self.experiment_id,
            "data_sha256": self.data_sha256,
            "draw_count": self.draw_count,
            "feature_version": self.feature_version,
            "cv_validation_years": list(self.cv_validation_years),
            "holdout_start": self.holdout_start,
            "selected_hyperparameters": self.selected_hyperparameters,
            "package_versions": self.package_versions,
            "runs": [run.to_dict() for run in self.runs],
        }


def run_development_matrix(
    draws: list[DrawRecord],
    config: ExperimentConfig,
    feature_config: FeatureConfig,
) -> DevelopmentReport:
    if config.mode != "development":
        raise ValueError("development matrix requires a development config")
    frame = build_candidate_rows(draws, feature_config)
    folds = tuple(
        ExpandingYearFold(validation_year=year, train_end_year=year - 1)
        for year in config.cv_validation_years
    )
    seed = config.seeds[0]
    selected: dict[str, dict[str, dict[str, object]]] = {"area1": {}, "area2": {}}
    runs: list[ExperimentRun] = []

    areas: tuple[AreaName, ...] = ("area1", "area2")
    for area_name in areas:
        for model_name in config.models:
            candidates = config.hyperparameters.get(model_name)
            if not candidates:
                raise ValueError(f"missing hyperparameters for model: {model_name}")
            scored: list[tuple[float, float, str, dict[str, object]]] = []
            for parameters in candidates:
                evaluations = _evaluate_model(
                    frame,
                    folds,
                    area_name,
                    model_name,
                    "full",
                    parameters,
                    seed,
                    feature_config,
                )
                hits = [fold.metrics["average_hits"] for fold in evaluations]
                scored.append((-mean(hits), pstdev(hits), str(parameters["config_id"]), parameters))
            parameters = min(scored)[3]
            selected[area_name][model_name] = dict(parameters)
            for feature_set in config.feature_sets:
                evaluations = _evaluate_model(
                    frame,
                    folds,
                    area_name,
                    model_name,
                    feature_set,
                    parameters,
                    seed,
                    feature_config,
                )
                runs.append(
                    _make_run(
                        kind="model",
                        area=area_name,
                        model=model_name,
                        feature_set=feature_set,
                        config_id=str(parameters["config_id"]),
                        parameters=dict(parameters),
                        seed=seed,
                        folds=evaluations,
                    )
                )

        for baseline in config.baselines:
            evaluations = _evaluate_baseline(frame, folds, area_name, baseline, seed)
            runs.append(
                _make_run(
                    kind="baseline",
                    area=area_name,
                    model=baseline,
                    feature_set=None,
                    config_id=baseline,
                    parameters={},
                    seed=seed,
                    folds=evaluations,
                )
            )

    return DevelopmentReport(
        schema_version="1.0.0",
        experiment_id=config.experiment_id,
        data_sha256=hashlib.sha256(serialize_draws(draws)).hexdigest(),
        draw_count=len(draws),
        feature_version=feature_config.version,
        cv_validation_years=config.cv_validation_years,
        holdout_start=config.holdout_start.isoformat(),
        selected_hyperparameters=selected,
        package_versions=_package_versions(),
        runs=tuple(runs),
    )


def _evaluate_model(
    frame: pd.DataFrame,
    folds: tuple[ExpandingYearFold, ...],
    area: AreaName,
    model_name: str,
    feature_set: str,
    parameters: dict[str, object],
    seed: int,
    feature_config: FeatureConfig,
) -> tuple[FoldEvaluation, ...]:
    columns = list(feature_columns(feature_set, feature_config))
    results: list[FoldEvaluation] = []
    for fold in folds:
        train, validation = split_candidate_rows(frame, fold)
        train = train.loc[train["area"] == area]
        validation = validation.loc[validation["area"] == area]
        estimator = cast(ProbabilityEstimator, build_estimator(model_name, parameters, seed))
        estimator.fit(train[columns], train["target"])
        probabilities = estimator.predict_proba(validation[columns])[:, 1]
        predictions = validation[["draw_id", "area", "number"]].copy()
        predictions["probability"] = probabilities
        summary = evaluate_predictions(validation, predictions, area=area)
        results.append(_fold_evaluation(fold, summary))
    return tuple(results)


def _evaluate_baseline(
    frame: pd.DataFrame,
    folds: tuple[ExpandingYearFold, ...],
    area: AreaName,
    baseline: str,
    seed: int,
) -> tuple[FoldEvaluation, ...]:
    results: list[FoldEvaluation] = []
    for fold in folds:
        _, validation = split_candidate_rows(frame, fold)
        if baseline == "uniform":
            predictions = predict_uniform(validation)
        elif baseline == "rolling_frequency":
            predictions = predict_rolling_frequency(validation)
        elif baseline == "shuffled_history":
            predictions = predict_shuffled_history(validation, seed)
        else:
            raise ValueError(f"unknown baseline: {baseline}")
        area_validation = validation.loc[validation["area"] == area]
        area_predictions = predictions.loc[predictions["area"] == area]
        summary = evaluate_predictions(area_validation, area_predictions, area=area)
        results.append(_fold_evaluation(fold, summary))
    return tuple(results)


def _fold_evaluation(fold: ExpandingYearFold, summary: MetricSummary) -> FoldEvaluation:
    metrics = {
        "average_hits": summary.average_hits,
        "precision_at_k": summary.precision_at_k,
        "recall_at_k": summary.recall_at_k,
        "lift_over_uniform": summary.lift_over_uniform,
        "brier_score": summary.brier_score,
        "log_loss": summary.log_loss,
    }
    return FoldEvaluation(fold.train_end_year, fold.validation_year, summary.draw_count, metrics)


def _make_run(
    *,
    kind: RunKind,
    area: AreaName,
    model: str,
    feature_set: str | None,
    config_id: str,
    parameters: dict[str, object],
    seed: int,
    folds: tuple[FoldEvaluation, ...],
) -> ExperimentRun:
    means = {name: mean(fold.metrics[name] for fold in folds) for name in METRIC_NAMES}
    deviations = {name: pstdev(fold.metrics[name] for fold in folds) for name in METRIC_NAMES}
    identity = f"{kind}|{area}|{model}|{feature_set}|{config_id}|{seed}"
    run_id = hashlib.sha256(identity.encode()).hexdigest()[:16]
    return ExperimentRun(
        run_id,
        kind,
        area,
        model,
        feature_set,
        config_id,
        parameters,
        seed,
        folds,
        means,
        deviations,
    )


def _package_versions() -> dict[str, str]:
    result: dict[str, str] = {}
    for package in ("lightgbm", "numpy", "pandas", "scikit-learn"):
        try:
            result[package] = version(package)
        except PackageNotFoundError:
            result[package] = "not-installed"
    return result
