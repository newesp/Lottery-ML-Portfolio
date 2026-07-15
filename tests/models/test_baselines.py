import pandas as pd

from lottery_ml.models.baselines import (
    predict_rolling_frequency,
    predict_shuffled_history,
    predict_uniform,
)


def frame() -> pd.DataFrame:
    rows = []
    for area, maximum in (("area1", 38), ("area2", 8)):
        for number in range(1, maximum + 1):
            rows.append(
                {
                    "draw_id": "2026-01-01",
                    "area": area,
                    "number": number,
                    "lifetime_rate": number / maximum,
                }
            )
    return pd.DataFrame(rows)


def test_uniform_probabilities_sum_to_pick_count_per_draw() -> None:
    predictions = predict_uniform(frame())
    sums = predictions.groupby(["draw_id", "area"])["probability"].sum()

    assert sums["2026-01-01", "area1"] == 6
    assert sums["2026-01-01", "area2"] == 1


def test_shuffled_history_preserves_each_draw_probability_multiset() -> None:
    rolling = predict_rolling_frequency(frame())
    shuffled = predict_shuffled_history(frame(), seed=42)

    for area in ("area1", "area2"):
        expected = sorted(rolling.loc[rolling["area"] == area, "probability"])
        actual = sorted(shuffled.loc[shuffled["area"] == area, "probability"])
        assert actual == expected
