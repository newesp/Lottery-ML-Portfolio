import pandas as pd
import pytest

from lottery_ml.evaluation.metrics import (
    PredictionKeyError,
    evaluate_predictions,
    evaluate_uniform_baseline,
    expected_uniform_hits,
)
from lottery_ml.models.baselines import predict_uniform


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


def test_evaluate_uniform_baseline_matches_analytical_expectation() -> None:
    # Area 1
    targets1 = area1_targets()
    summary1 = evaluate_uniform_baseline(targets1, area="area1")
    legacy1 = evaluate_predictions(targets1, predict_uniform(targets1), area="area1")

    assert expected_uniform_hits("area1") == pytest.approx(36 / 38)
    assert summary1.average_hits == pytest.approx(36 / 38)
    assert summary1.precision_at_k == pytest.approx(6 / 38)
    assert summary1.recall_at_k == pytest.approx(6 / 38)
    assert summary1.lift_over_uniform == 1.0
    assert summary1.brier_score == pytest.approx(legacy1.brier_score)
    assert summary1.log_loss == pytest.approx(legacy1.log_loss)

    # Area 2
    targets2 = pd.DataFrame(
        {
            "draw_id": ["2026-01-01"] * 8,
            "area": ["area2"] * 8,
            "number": list(range(1, 9)),
            "target": [0, 0, 1, 0, 0, 0, 0, 0],
        }
    )
    summary2 = evaluate_uniform_baseline(targets2, area="area2")
    legacy2 = evaluate_predictions(targets2, predict_uniform(targets2), area="area2")

    assert expected_uniform_hits("area2") == 0.125
    assert summary2.average_hits == 0.125
    assert summary2.precision_at_k == 0.125
    assert summary2.recall_at_k == 0.125
    assert summary2.lift_over_uniform == 1.0
    assert summary2.brier_score == pytest.approx(legacy2.brier_score)
    assert summary2.log_loss == pytest.approx(legacy2.log_loss)

