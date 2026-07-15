import pandas as pd
import pytest

from lottery_ml.evaluation.metrics import PredictionKeyError, evaluate_predictions


def area1_targets() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "draw_id": ["2026-01-01"] * 38,
            "area": ["area1"] * 38,
            "number": list(range(1, 39)),
            "target": [1] * 6 + [0] * 32,
        }
    )


def test_metrics_join_predictions_by_key_not_row_order() -> None:
    targets = area1_targets()
    predictions = targets[["draw_id", "area", "number"]].copy()
    predictions["probability"] = [0.9] * 6 + [0.1] * 32
    shuffled = predictions.sample(frac=1, random_state=42).reset_index(drop=True)

    summary = evaluate_predictions(targets, shuffled, area="area1")

    assert summary.average_hits == 6
    assert summary.precision_at_k == 1
    assert summary.recall_at_k == 1
    assert summary.lift_over_uniform == pytest.approx(6 / (36 / 38))
    assert summary.brier_score == pytest.approx((6 * 0.01 + 32 * 0.01) / 38)


def test_area2_reports_top1_accuracy_and_uniform_lift() -> None:
    targets = pd.DataFrame(
        {
            "draw_id": ["2026-01-01"] * 8,
            "area": ["area2"] * 8,
            "number": list(range(1, 9)),
            "target": [0, 0, 1, 0, 0, 0, 0, 0],
        }
    )
    predictions = targets[["draw_id", "area", "number"]].copy()
    predictions["probability"] = [0.05, 0.05, 0.65, 0.05, 0.05, 0.05, 0.05, 0.05]

    summary = evaluate_predictions(targets, predictions, area="area2")

    assert summary.average_hits == 1
    assert summary.lift_over_uniform == 8


def test_metrics_reject_missing_prediction_keys() -> None:
    targets = area1_targets()
    predictions = targets[["draw_id", "area", "number"]].iloc[:-1].copy()
    predictions["probability"] = 0.1

    with pytest.raises(PredictionKeyError, match="one-to-one key coverage"):
        evaluate_predictions(targets, predictions, area="area1")
