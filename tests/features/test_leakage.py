from datetime import date
from pathlib import Path

import pandas as pd

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.config import load_feature_config
from lottery_ml.features.builder import build_candidate_rows
from lottery_ml.features.schema import KEY_COLUMNS, feature_columns

ROOT = Path(__file__).parents[2]


def test_changing_current_and_future_targets_cannot_change_current_features() -> None:
    config = load_feature_config(ROOT / "configs/features/v1.json")
    original = [
        DrawRecord("2017-01-02", date(2017, 1, 2), (1, 2, 3, 4, 5, 6), 1),
        DrawRecord("2017-01-05", date(2017, 1, 5), (7, 8, 9, 10, 11, 12), 2),
        DrawRecord("2017-01-09", date(2017, 1, 9), (13, 14, 15, 16, 17, 18), 3),
        DrawRecord("2017-01-12", date(2017, 1, 12), (19, 20, 21, 22, 23, 24), 4),
    ]
    changed = [
        *original[:2],
        DrawRecord("2017-01-09", date(2017, 1, 9), (21, 22, 23, 24, 25, 26), 7),
        DrawRecord("2017-01-12", date(2017, 1, 12), (27, 28, 29, 30, 31, 32), 8),
    ]

    before = build_candidate_rows(original, config)
    after = build_candidate_rows(changed, config)
    columns = [*KEY_COLUMNS, *feature_columns("full", config)]
    before_current = before.loc[before["draw_date"] <= "2017-01-09", columns]
    after_current = after.loc[after["draw_date"] <= "2017-01-09", columns]

    pd.testing.assert_frame_equal(
        before_current.reset_index(drop=True),
        after_current.reset_index(drop=True),
        check_exact=True,
    )
