from __future__ import annotations

from collections.abc import Sequence


def top_k_numbers(
    numbers: Sequence[int], scores: Sequence[float], k: int
) -> tuple[int, ...]:
    """Sort by (score desc, number asc), take k, return sorted ascending."""
    if len(numbers) != len(scores):
        raise ValueError("numbers and scores must have the same length")
    if k <= 0 or k > len(numbers):
        raise ValueError(f"k must be between 1 and {len(numbers)}, got {k}")

    paired = sorted(
        zip(numbers, scores, strict=True),
        key=lambda item: (-item[1], item[0]),
    )
    chosen = [num for num, _ in paired[:k]]
    return tuple(sorted(chosen))
