from __future__ import annotations

import pytest

from lottery_ml.evaluation.ranking import top_k_numbers


def test_top_k_tie_break_prefers_smaller_number() -> None:
    numbers = [1, 2, 3, 4]
    # Numbers 2, 3, 4 all tie at 0.8. For k=2, tie break takes smaller numbers (2 and 3).
    scores_tie = [0.5, 0.8, 0.8, 0.8]
    picks = top_k_numbers(numbers, scores_tie, k=2)
    assert picks == (2, 3)


def test_top_k_returns_sorted_ascending() -> None:
    numbers = [10, 5, 20, 1]
    scores = [0.1, 0.9, 0.8, 0.7]
    # Picks for k=3 are 5 (0.9), 20 (0.8), 1 (0.7).
    # Returned tuple must be sorted ascending: (1, 5, 20)
    picks = top_k_numbers(numbers, scores, k=3)
    assert picks == (1, 5, 20)


def test_top_k_validation_errors() -> None:
    with pytest.raises(ValueError, match="same length"):
        top_k_numbers([1, 2], [0.5], k=1)

    with pytest.raises(ValueError, match="k must be between"):
        top_k_numbers([1, 2], [0.5, 0.6], k=0)

    with pytest.raises(ValueError, match="k must be between"):
        top_k_numbers([1, 2], [0.5, 0.6], k=3)
