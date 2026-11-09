from __future__ import annotations

from datetime import date
from pathlib import Path

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.config import load_feature_config
from lottery_ml.experiments.holdout import load_selection
from lottery_ml.forward.predict import predict_next, serialize_predictions


def _make_dummy_draws(n: int = 20) -> list[DrawRecord]:
    draws: list[DrawRecord] = []
    # Generate sequential draws
    import datetime

    start = datetime.date(2024, 1, 1)
    for i in range(n):
        d = start + datetime.timedelta(days=i * 3)
        w = [(i + j) % 38 + 1 for j in range(6)]
        s = (i % 8) + 1
        draws.append(
            DrawRecord(
                draw_id=f"D{i:04d}",
                draw_date=d,
                area1=tuple(sorted(w)),
                area2=s,
            )
        )
    return draws


def test_predict_next_deterministic() -> None:
    root = Path(__file__).resolve().parents[2]
    selection = load_selection(root / "configs" / "experiments" / "selection-v1.json", root)
    feature_config = load_feature_config(root / "configs" / "features" / "v1.json")

    draws = _make_dummy_draws(20)
    target_date = date(2025, 1, 1)

    res1 = predict_next(draws, selection, feature_config, target_date)
    res2 = predict_next(draws, selection, feature_config, target_date)

    serialized1 = serialize_predictions(res1)
    serialized2 = serialize_predictions(res2)

    assert serialized1 == serialized2
    assert len(serialized1["model"]["area1"]["picks"]) == 6
    assert len(serialized1["model"]["area2"]["picks"]) == 1
    assert len(serialized1["model"]["area1"]["top_scores"]) == 10
    assert len(serialized1["model"]["area2"]["top_scores"]) == 8
    assert len(serialized1["historical_frequency"]["area1"]["picks"]) == 6
    assert len(serialized1["historical_frequency"]["area2"]["picks"]) == 1
