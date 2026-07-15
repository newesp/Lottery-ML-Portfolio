from datetime import date
from pathlib import Path

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.config import load_feature_config
from lottery_ml.experiments.holdout import AreaSelection, SelectionProtocol, run_holdout_evaluation

ROOT = Path(__file__).parents[2]


def test_holdout_uses_only_dates_after_frozen_boundary() -> None:
    draws = []
    for index, year in enumerate(range(2016, 2026)):
        draws.append(
            DrawRecord(
                f"{year}-01-01",
                date(year, 1, 1),
                tuple(range(index % 10 + 1, index % 10 + 7)),
                index % 8 + 1,
            )
        )
    selected = AreaSelection(
        "random_forest",
        "frequency",
        "rf-test",
        {
            "config_id": "rf-test",
            "n_estimators": 5,
            "max_depth": 3,
            "min_samples_leaf": 1,
            "max_features": "sqrt",
        },
        (42,),
    )
    protocol = SelectionProtocol(
        "test-selection",
        Path("development.json"),
        "a" * 64,
        date(2024, 1, 1),
        "mean_cv_average_hits",
        100,
        2026,
        {"area1": selected, "area2": selected},
    )

    feature_config = load_feature_config(ROOT / "configs/features/v1.json")
    report = run_holdout_evaluation(draws, protocol, feature_config)

    assert report.holdout_draw_count == 2
    assert set(report.areas) == {"area1", "area2"}
    assert report.to_dict()["holdout_start"] == "2024-01-01"
