from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True, slots=True)
class ExpandingYearFold:
    train_end_year: int
    validation_year: int


def development_folds() -> tuple[ExpandingYearFold, ...]:
    return tuple(
        ExpandingYearFold(validation_year - 1, validation_year)
        for validation_year in range(2018, 2024)
    )


def split_candidate_rows(
    frame: pd.DataFrame,
    fold: ExpandingYearFold,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    _validate_complete_draw_groups(frame)
    years = pd.to_datetime(frame["draw_date"], errors="raise").dt.year
    train = frame.loc[years <= fold.train_end_year].copy()
    validation = frame.loc[years == fold.validation_year].copy()
    if train.empty or validation.empty:
        raise ValueError(f"fold has an empty partition: {fold}")
    if set(train["draw_id"]) & set(validation["draw_id"]):
        raise ValueError(f"fold contains overlapping draw IDs: {fold}")
    if train["draw_date"].max() >= validation["draw_date"].min():
        raise ValueError(f"fold chronology is invalid: {fold}")
    return train, validation


def _validate_complete_draw_groups(frame: pd.DataFrame) -> None:
    expected = {"area1": 38, "area2": 8}
    for draw_id in frame["draw_id"].astype(str).unique().tolist():
        for area, expected_size in expected.items():
            size = int(((frame["draw_id"] == draw_id) & (frame["area"] == area)).sum())
            if size != expected_size:
                raise ValueError(f"incomplete candidate group: {draw_id}/{area}: {size}")
