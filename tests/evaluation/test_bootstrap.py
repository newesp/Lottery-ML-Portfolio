import numpy as np

from lottery_ml.evaluation.bootstrap import paired_mean_difference


def test_paired_bootstrap_is_deterministic_and_identical_is_zero() -> None:
    values = np.array([0.0, 1.0, 2.0, 1.0])

    first = paired_mean_difference(values, values, resamples=1000, seed=2026)
    second = paired_mean_difference(values, values, resamples=1000, seed=2026)

    assert first == second
    assert first.estimate == 0.0
    assert first.lower == 0.0
    assert first.upper == 0.0
