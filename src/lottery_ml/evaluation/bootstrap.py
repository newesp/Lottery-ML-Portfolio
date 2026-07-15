from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True, slots=True)
class BootstrapInterval:
    estimate: float
    lower: float
    upper: float
    confidence_level: float
    resamples: int
    seed: int

    def to_dict(self) -> dict[str, float | int]:
        return asdict(self)


def paired_mean_difference(
    candidate: NDArray[np.float64],
    reference: NDArray[np.float64],
    *,
    resamples: int = 10_000,
    seed: int = 2026,
) -> BootstrapInterval:
    candidate = np.asarray(candidate, dtype=float)
    reference = np.asarray(reference, dtype=float)
    if candidate.ndim != 1 or reference.ndim != 1 or len(candidate) != len(reference):
        raise ValueError("paired bootstrap inputs must be equal-length vectors")
    if not len(candidate) or resamples <= 0:
        raise ValueError("paired bootstrap requires observations and positive resamples")
    if not np.isfinite(candidate).all() or not np.isfinite(reference).all():
        raise ValueError("paired bootstrap values must be finite")
    differences = candidate - reference
    rng = np.random.default_rng(seed)
    sampled = np.empty(resamples, dtype=float)
    chunk = 1000
    for start in range(0, resamples, chunk):
        size = min(chunk, resamples - start)
        indices = rng.integers(0, len(differences), size=(size, len(differences)))
        sampled[start : start + size] = differences[indices].mean(axis=1)
    lower, upper = np.quantile(sampled, [0.025, 0.975])
    return BootstrapInterval(
        estimate=float(differences.mean()),
        lower=float(lower),
        upper=float(upper),
        confidence_level=0.95,
        resamples=resamples,
        seed=seed,
    )
