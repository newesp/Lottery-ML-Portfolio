from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from lottery_ml.data.contracts import DrawRecord


class DatasetValidationError(ValueError):
    """Raised when proposed history violates the canonical dataset contract."""


@dataclass(frozen=True, slots=True)
class Correction:
    draw_id: str
    old: Mapping[str, object]
    new: Mapping[str, object]
    reason: str
    source: str


@dataclass(frozen=True, slots=True)
class ValidationResult:
    corrections_applied: tuple[str, ...]


def validate_dataset(
    proposed: list[DrawRecord],
    *,
    previous: list[DrawRecord],
    corrections: list[Correction],
) -> ValidationResult:
    if not proposed:
        raise DatasetValidationError("proposed dataset is empty")
    _validate_identity_and_order(proposed)

    proposed_by_id = {draw.draw_id: draw for draw in proposed}
    used_corrections: set[int] = set()
    applied_ids: list[str] = []

    for old_draw in previous:
        new_draw = proposed_by_id.get(old_draw.draw_id)
        if new_draw is None:
            raise DatasetValidationError(f"removed historical draw: {old_draw.draw_id}")
        if new_draw == old_draw:
            continue

        matches = [
            index
            for index, item in enumerate(corrections)
            if _matches_correction(item, old_draw, new_draw)
        ]
        if len(matches) != 1:
            raise DatasetValidationError(
                f"historical mutation is not registered: {old_draw.draw_id}"
            )
        used_corrections.add(matches[0])
        applied_ids.append(old_draw.draw_id)

    unused = [
        item.draw_id for index, item in enumerate(corrections) if index not in used_corrections
    ]
    if unused:
        raise DatasetValidationError(f"unused correction: {unused[0]}")

    return ValidationResult(corrections_applied=tuple(sorted(applied_ids)))


def _validate_identity_and_order(draws: Sequence[DrawRecord]) -> None:
    seen_ids: set[str] = set()
    for draw in draws:
        if draw.draw_id in seen_ids:
            raise DatasetValidationError(f"duplicate draw ID: {draw.draw_id}")
        seen_ids.add(draw.draw_id)

    dates = [draw.draw_date for draw in draws]
    if any(current <= previous for previous, current in zip(dates, dates[1:], strict=False)):
        raise DatasetValidationError("draw dates must be strictly increasing")


def _matches_correction(
    correction: Correction,
    old_draw: DrawRecord,
    new_draw: DrawRecord,
) -> bool:
    return (
        correction.draw_id == old_draw.draw_id
        and correction.old == old_draw.to_dict()
        and correction.new == new_draw.to_dict()
    )
