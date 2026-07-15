from datetime import date
from pathlib import Path

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.config import load_feature_config
from lottery_ml.features.builder import build_candidate_rows
from lottery_ml.features.schema import feature_columns

ROOT = Path(__file__).parents[2]


def draws() -> list[DrawRecord]:
    return [
        DrawRecord("2017-01-02", date(2017, 1, 2), (1, 2, 3, 4, 5, 6), 1),
        DrawRecord("2017-01-05", date(2017, 1, 5), (1, 7, 8, 9, 10, 11), 2),
        DrawRecord("2017-01-09", date(2017, 1, 9), (2, 7, 12, 13, 14, 15), 1),
    ]


def test_build_candidate_rows_emits_complete_draw_groups() -> None:
    config = load_feature_config(ROOT / "configs/features/v1.json")

    frame = build_candidate_rows(draws(), config)

    assert len(frame) == 3 * (38 + 8)
    grouped = frame.groupby(["draw_id", "area"], sort=False)
    assert grouped.size().to_dict()["2017-01-02", "area1"] == 38
    assert grouped.size().to_dict()["2017-01-02", "area2"] == 8
    assert grouped["target"].sum().to_dict()["2017-01-02", "area1"] == 6
    assert grouped["target"].sum().to_dict()["2017-01-02", "area2"] == 1


def test_features_use_only_history_before_current_draw() -> None:
    config = load_feature_config(ROOT / "configs/features/v1.json")
    frame = build_candidate_rows(draws(), config)

    first = frame.query("draw_id == '2017-01-02' and area == 'area1' and number == 1").iloc[0]
    second = frame.query("draw_id == '2017-01-05' and area == 'area1' and number == 1").iloc[0]

    assert first["target"] == 1
    assert first["lifetime_count"] == 0
    assert first["rolling_count_3"] == 0
    assert second["lifetime_count"] == 1
    assert second["lifetime_rate"] == 1
    assert second["rolling_count_3"] == 1
    assert second["gap"] == 1
    assert second["seen_last_draw"] == 1


def test_feature_sets_are_ordered_and_progressive() -> None:
    config = load_feature_config(ROOT / "configs/features/v1.json")

    frequency = feature_columns("frequency", config)
    frequency_gap = feature_columns("frequency_gap", config)
    temporal = feature_columns("temporal_context", config)
    full = feature_columns("full", config)

    assert len(frequency) == 20
    assert set(frequency) < set(frequency_gap)
    assert set(frequency) < set(temporal)
    assert set(frequency_gap) | set(temporal) < set(full)
    assert len(full) == len(set(full)) == 46
