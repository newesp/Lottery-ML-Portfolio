from datetime import date

import pandas as pd

from lottery_ml.evaluation.splits import development_folds, split_candidate_rows


def candidate_frame() -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for year in range(2017, 2025):
        draw_id = f"{year}-01-01"
        for area, maximum in (("area1", 38), ("area2", 8)):
            for number in range(1, maximum + 1):
                rows.append(
                    {
                        "draw_id": draw_id,
                        "draw_date": date(year, 1, 1).isoformat(),
                        "area": area,
                        "number": number,
                        "target": 0,
                    }
                )
    return pd.DataFrame(rows)


def test_development_folds_match_locked_protocol() -> None:
    folds = development_folds()

    assert [(fold.train_end_year, fold.validation_year) for fold in folds] == [
        (2017, 2018),
        (2018, 2019),
        (2019, 2020),
        (2020, 2021),
        (2021, 2022),
        (2022, 2023),
    ]


def test_split_preserves_complete_draw_groups_and_excludes_holdout() -> None:
    train, validation = split_candidate_rows(candidate_frame(), development_folds()[-1])

    assert train["draw_date"].max() < validation["draw_date"].min()
    assert set(train["draw_id"]).isdisjoint(validation["draw_id"])
    assert set(validation["draw_date"].str[:4]) == {"2023"}
    assert not any(train["draw_date"].str.startswith("2024"))
    assert set(validation.groupby(["draw_id", "area"]).size()) == {38, 8}
