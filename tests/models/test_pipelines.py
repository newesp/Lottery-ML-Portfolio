from lightgbm import LGBMClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from lottery_ml.models.pipelines import build_estimator


def test_logistic_regression_scales_inside_pipeline() -> None:
    estimator = build_estimator("logistic_regression", {"C": 1.0}, seed=42)

    assert isinstance(estimator, Pipeline)
    assert isinstance(estimator.named_steps["scale"], StandardScaler)
    assert isinstance(estimator.named_steps["model"], LogisticRegression)


def test_tree_models_do_not_add_scalers() -> None:
    forest = build_estimator(
        "random_forest",
        {"n_estimators": 20, "max_depth": 4, "min_samples_leaf": 2, "max_features": "sqrt"},
        seed=42,
    )
    lightgbm = build_estimator(
        "lightgbm",
        {"n_estimators": 20, "num_leaves": 7, "learning_rate": 0.1, "min_child_samples": 5},
        seed=42,
    )

    assert isinstance(forest, RandomForestClassifier)
    assert isinstance(lightgbm, LGBMClassifier)
