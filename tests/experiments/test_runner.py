from datetime import date
from pathlib import Path

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.config import ExperimentConfig, load_feature_config
from lottery_ml.experiments.runner import run_development_matrix

ROOT = Path(__file__).parents[2]


def synthetic_draws() -> list[DrawRecord]:
    draws: list[DrawRecord] = []
    for index, year in enumerate(range(2014, 2021)):
        start = index % 30 + 1
        area1 = tuple(sorted({((start + offset - 1) % 38) + 1 for offset in range(6)}))
        draws.append(
            DrawRecord(
                f"{year}-01-01",
                date(year, 1, 1),
                area1,
                index % 8 + 1,
            )
        )
    return draws


def test_reduced_development_matrix_is_complete_and_deterministic() -> None:
    feature_config = load_feature_config(ROOT / "configs/features/v1.json")
    config = ExperimentConfig(
        experiment_id="test-development",
        mode="development",
        feature_config=Path("configs/features/v1.json"),
        cv_validation_years=(2018, 2019),
        holdout_start=date(2020, 1, 1),
        seeds=(42,),
        feature_sets=("frequency",),
        models=("logistic_regression",),
        baselines=("uniform",),
        hyperparameters={
            "logistic_regression": ({"config_id": "lr-test", "C": 1.0},)
        },
    )

    first = run_development_matrix(synthetic_draws(), config, feature_config)
    second = run_development_matrix(synthetic_draws(), config, feature_config)

    assert len(first.runs) == 4
    assert {run.area for run in first.runs} == {"area1", "area2"}
    assert all(len(run.folds) == 2 for run in first.runs)
    assert first.to_dict() == second.to_dict()
