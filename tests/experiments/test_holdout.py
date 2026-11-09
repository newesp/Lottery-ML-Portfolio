import json
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


def test_holdout_v1_1_preserves_model_and_rolling_metrics() -> None:
    v1_path = ROOT / "artifacts/experiments/holdout-v1.json"
    v1_1_path = ROOT / "artifacts/experiments/holdout-v1.1.json"

    assert v1_path.exists(), "holdout-v1.json must exist"
    assert v1_1_path.exists(), "holdout-v1.1.json must exist"

    v1 = json.loads(v1_path.read_text(encoding="utf-8"))
    v1_1 = json.loads(v1_1_path.read_text(encoding="utf-8"))

    assert v1_1["schema_version"] == "1.1.0"
    assert v1_1["experiment_id"] == "holdout-v1.1"
    assert v1_1["supersedes"] == "holdout-v1"
    assert v1_1["data_sha256"] == v1["data_sha256"]
    assert v1_1["draw_count"] == v1["draw_count"]
    assert v1_1["holdout_draw_count"] == v1["holdout_draw_count"]
    assert v1_1["holdout_start"] == v1["holdout_start"]

    for area in ("area1", "area2"):
        area_v1 = v1["areas"][area]
        area_v1_1 = v1_1["areas"][area]

        assert area_v1_1["seed_results"] == area_v1["seed_results"]
        assert area_v1_1["ensemble_metrics"] == area_v1["ensemble_metrics"]
        assert (
            area_v1_1["baselines"]["rolling_frequency"]
            == area_v1["baselines"]["rolling_frequency"]
        )

        # Legacy fixed ticket check
        legacy = area_v1_1["legacy_v1_fixed_ticket_uniform"]
        assert legacy["metrics"] == area_v1["baselines"]["uniform"]
        assert (
            legacy["paired_bootstrap_hits_vs_uniform"]
            == area_v1["paired_bootstrap_hits_vs_uniform"]
        )

        # Analytical expectation values check
        expected_hits = 36 / 38 if area == "area1" else 0.125
        assert area_v1_1["baselines"]["uniform"]["average_hits"] == expected_hits
        assert area_v1_1["baselines"]["uniform"]["lift_over_uniform"] == 1.0
        assert (
            area_v1_1["baselines"]["uniform"]["brier_score"]
            == area_v1["baselines"]["uniform"]["brier_score"]
        )

