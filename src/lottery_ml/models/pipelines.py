from __future__ import annotations

from lightgbm import LGBMClassifier
from sklearn.base import BaseEstimator
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def build_estimator(model_name: str, params: dict[str, object], seed: int) -> BaseEstimator:
    model_params = {key: value for key, value in params.items() if key != "config_id"}
    if model_name == "logistic_regression":
        model = LogisticRegression(
            C=_float_param(model_params, "C"),
            class_weight=None,
            max_iter=500,
            random_state=seed,
        )
        return Pipeline([("scale", StandardScaler()), ("model", model)])
    if model_name == "random_forest":
        return RandomForestClassifier(
            n_estimators=_int_param(model_params, "n_estimators"),
            max_depth=_optional_int_param(model_params, "max_depth"),
            min_samples_leaf=_int_param(model_params, "min_samples_leaf"),
            max_features=_string_param(model_params, "max_features"),
            class_weight=None,
            random_state=seed,
            n_jobs=-1,
        )
    if model_name == "lightgbm":
        return LGBMClassifier(
            n_estimators=_int_param(model_params, "n_estimators"),
            num_leaves=_int_param(model_params, "num_leaves"),
            learning_rate=_float_param(model_params, "learning_rate"),
            min_child_samples=_int_param(model_params, "min_child_samples"),
            class_weight=None,
            random_state=seed,
            n_jobs=-1,
            verbosity=-1,
        )
    raise ValueError(f"unknown model: {model_name}")


def _int_param(params: dict[str, object], key: str) -> int:
    value = params.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return value


def _optional_int_param(params: dict[str, object], key: str) -> int | None:
    value = params.get(key)
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer or null")
    return value


def _float_param(params: dict[str, object], key: str) -> float:
    value = params.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{key} must be numeric")
    return float(value)


def _string_param(params: dict[str, object], key: str) -> str:
    value = params.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{key} must be a non-empty string")
    return value
