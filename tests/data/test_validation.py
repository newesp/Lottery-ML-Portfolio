from datetime import date

import pytest

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.validation import Correction, DatasetValidationError, validate_dataset


def draw(day: int, area2: int = 1) -> DrawRecord:
    value = date(2026, 7, day)
    return DrawRecord(value.isoformat(), value, (1, 2, 3, 4, 5, 6), area2)


def correction(old: DrawRecord, new: DrawRecord) -> Correction:
    return Correction(
        draw_id=old.draw_id,
        old=old.to_dict(),
        new=new.to_dict(),
        reason="Source corrected the special number.",
        source="https://example.test/correction",
    )


def test_validate_dataset_accepts_append_only_history() -> None:
    result = validate_dataset([draw(6), draw(9)], previous=[draw(6)], corrections=[])

    assert result.corrections_applied == ()


def test_validate_dataset_rejects_empty_proposal() -> None:
    with pytest.raises(DatasetValidationError, match="proposed dataset is empty"):
        validate_dataset([], previous=[], corrections=[])


def test_validate_dataset_rejects_historical_mutation() -> None:
    with pytest.raises(DatasetValidationError, match="historical mutation.*2026-07-06"):
        validate_dataset([draw(6, area2=2)], previous=[draw(6)], corrections=[])


def test_validate_dataset_accepts_exact_registered_correction() -> None:
    old = draw(6)
    new = draw(6, area2=2)

    result = validate_dataset(
        [new, draw(9)],
        previous=[old],
        corrections=[correction(old, new)],
    )

    assert result.corrections_applied == ("2026-07-06",)


def test_validate_dataset_rejects_removed_history() -> None:
    with pytest.raises(DatasetValidationError, match="removed historical draw.*2026-07-06"):
        validate_dataset([draw(9)], previous=[draw(6), draw(9)], corrections=[])


def test_validate_dataset_rejects_non_increasing_dates() -> None:
    with pytest.raises(DatasetValidationError, match="strictly increasing"):
        validate_dataset([draw(9), draw(6)], previous=[], corrections=[])


def test_validate_dataset_rejects_duplicate_draw_ids() -> None:
    with pytest.raises(DatasetValidationError, match="duplicate draw ID.*2026-07-06"):
        validate_dataset([draw(6), draw(6)], previous=[], corrections=[])


def test_validate_dataset_rejects_unused_correction() -> None:
    old = draw(6)
    new = draw(6, area2=2)

    with pytest.raises(DatasetValidationError, match="unused correction.*2026-07-06"):
        validate_dataset([old], previous=[old], corrections=[correction(old, new)])
