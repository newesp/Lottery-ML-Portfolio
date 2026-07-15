from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Literal, cast


class ConfigError(ValueError):
    """Raised when an experiment configuration violates its schema."""


@dataclass(frozen=True, slots=True)
class FeatureConfig:
    version: str
    rolling_windows: tuple[int, ...]
    ewm_halflives: tuple[int, ...]
    feature_sets: dict[str, tuple[str, ...]]


@dataclass(frozen=True, slots=True)
class ExperimentConfig:
    experiment_id: str
    mode: Literal["development", "holdout"]
    feature_config: Path
    cv_validation_years: tuple[int, ...]
    holdout_start: date
    seeds: tuple[int, ...]
    feature_sets: tuple[str, ...]
    models: tuple[str, ...]
    baselines: tuple[str, ...]
    hyperparameters: dict[str, tuple[dict[str, object], ...]]


def load_feature_config(path: Path) -> FeatureConfig:
    payload = _load_object(path)
    _exact_keys(
        payload,
        {"schema_version", "version", "rolling_windows", "ewm_halflives", "feature_sets"},
        path,
    )
    _schema_version(payload, path)
    version = _string(payload, "version", path)
    windows = _positive_int_tuple(payload["rolling_windows"], "rolling_windows", path)
    halflives = _positive_int_tuple(payload["ewm_halflives"], "ewm_halflives", path)
    raw_sets = _string_dict(payload["feature_sets"], path)
    sets = {name: _string_tuple(groups, name, path) for name, groups in raw_sets.items()}
    expected_sets = ("frequency", "frequency_gap", "temporal_context", "full")
    if tuple(sets) != expected_sets:
        raise ConfigError(f"feature_sets must be ordered as {expected_sets} in {path}")
    return FeatureConfig(version, windows, halflives, sets)


def load_experiment_config(path: Path) -> ExperimentConfig:
    payload = _load_object(path)
    _exact_keys(
        payload,
        {
            "schema_version",
            "experiment_id",
            "mode",
            "feature_config",
            "cv_validation_years",
            "holdout_start",
            "seeds",
            "feature_sets",
            "models",
            "baselines",
            "hyperparameters",
        },
        path,
    )
    _schema_version(payload, path)
    mode = _string(payload, "mode", path)
    if mode not in {"development", "holdout"}:
        raise ConfigError(f"unsupported experiment mode in {path}: {mode}")
    years = _positive_int_tuple(payload["cv_validation_years"], "cv_validation_years", path)
    try:
        holdout_start = date.fromisoformat(_string(payload, "holdout_start", path))
    except ValueError as error:
        raise ConfigError(f"invalid holdout_start in {path}") from error
    if holdout_start.year <= max(years):
        raise ConfigError(f"holdout_start must follow all CV years in {path}")
    raw_hyperparameters = _string_dict(payload["hyperparameters"], path)
    hyperparameters = {
        model: _parameter_tuple(values, model, path)
        for model, values in raw_hyperparameters.items()
    }
    return ExperimentConfig(
        experiment_id=_string(payload, "experiment_id", path),
        mode=cast(Literal["development", "holdout"], mode),
        feature_config=Path(_string(payload, "feature_config", path)),
        cv_validation_years=years,
        holdout_start=holdout_start,
        seeds=_positive_int_tuple(payload["seeds"], "seeds", path),
        feature_sets=_string_tuple(payload["feature_sets"], "feature_sets", path),
        models=_string_tuple(payload["models"], "models", path),
        baselines=_string_tuple(payload["baselines"], "baselines", path),
        hyperparameters=hyperparameters,
    )


def _load_object(path: Path) -> dict[str, object]:
    try:
        value: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ConfigError(f"cannot read config {path}: {error}") from error
    return _string_dict(value, path)


def _string_dict(value: object, path: Path) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ConfigError(f"expected object with string keys in {path}")
    return cast(dict[str, object], value)


def _exact_keys(value: dict[str, object], expected: set[str], path: Path) -> None:
    if set(value) != expected:
        raise ConfigError(f"unexpected keys in {path}: {sorted(value)}")


def _schema_version(value: dict[str, object], path: Path) -> None:
    if value["schema_version"] != "1.0.0":
        raise ConfigError(f"unsupported schema_version in {path}")


def _string(value: dict[str, object], key: str, path: Path) -> str:
    result = value[key]
    if not isinstance(result, str) or not result:
        raise ConfigError(f"{key} must be a non-empty string in {path}")
    return result


def _positive_int_tuple(value: object, key: str, path: Path) -> tuple[int, ...]:
    if not isinstance(value, list) or not value or not all(
        isinstance(item, int) and not isinstance(item, bool) and item > 0 for item in value
    ):
        raise ConfigError(f"{key} must be a non-empty positive integer list in {path}")
    return tuple(cast(list[int], value))


def _string_tuple(value: object, key: str, path: Path) -> tuple[str, ...]:
    if not isinstance(value, list) or not value or not all(
        isinstance(item, str) and item for item in value
    ):
        raise ConfigError(f"{key} must be a non-empty string list in {path}")
    return tuple(cast(list[str], value))


def _parameter_tuple(value: object, key: str, path: Path) -> tuple[dict[str, object], ...]:
    if not isinstance(value, list) or not value:
        raise ConfigError(f"hyperparameters.{key} must be a non-empty list in {path}")
    result = tuple(_string_dict(item, path) for item in value)
    if any(not isinstance(item.get("config_id"), str) for item in result):
        raise ConfigError(f"hyperparameters.{key} requires config_id in {path}")
    return result
