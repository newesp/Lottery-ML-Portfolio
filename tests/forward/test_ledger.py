from __future__ import annotations

import datetime
from pathlib import Path

import pytest

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.config import load_feature_config
from lottery_ml.experiments.holdout import load_selection
from lottery_ml.forward.ledger import (
    ForwardError,
    append_entry,
    build_summary,
    create_entry,
)
from lottery_ml.forward.schedule import TAIPEI


def _make_dummy_draws(n: int = 20) -> list[DrawRecord]:
    draws: list[DrawRecord] = []
    start = datetime.date(2024, 1, 1)
    for i in range(n):
        d = start + datetime.timedelta(days=i * 3)
        w = [(i + j) % 38 + 1 for j in range(6)]
        s = (i % 8) + 1
        draws.append(
            DrawRecord(
                draw_id=f"D{i:04d}",
                draw_date=d,
                area1=tuple(sorted(w)),
                area2=s,
            )
        )
    return draws


def _make_sample_entry(cutoff_id: str, cutoff_date: str, target_date: str) -> dict[str, object]:
    return {
        "schema_version": "1.0.0",
        "protocol_id": "forward-v1",
        "selection_id": "selection-v1",
        "selection_sha256": "dummy_selection_sha",
        "feature_config_sha256": "dummy_config_sha",
        "cutoff_draw_id": cutoff_id,
        "cutoff_date": cutoff_date,
        "input_draw_count": 10,
        "input_data_sha256": "dummy_data_sha",
        "assumed_target_date": target_date,
        "generated_at": "2026-01-01T20:00:00+08:00",
        "git_commit": "abcdef123",
        "environment": {"python": "3.12"},
        "predictions": {
            "model": {
                "area1": {"picks": [1, 2, 3, 4, 5, 6], "top_scores": [[1, 0.5]]},
                "area2": {"picks": [7], "top_scores": [[7, 0.9]]},
            },
            "historical_frequency": {
                "area1": {"picks": [10, 11, 12, 13, 14, 15]},
                "area2": {"picks": [8]},
            },
        },
    }


def test_append_entry_lifecycle(tmp_path: Path) -> None:
    ledger_path = tmp_path / "ledger.jsonl"
    entry1 = _make_sample_entry("2026-01-01", "2026-01-01", "2026-01-05")

    # 1. Created
    status = append_entry(ledger_path, entry1)
    assert status == "created"
    assert ledger_path.exists()
    content1 = ledger_path.read_bytes()

    # 2. Exists (idempotent, bytes unmodified)
    status2 = append_entry(ledger_path, entry1)
    assert status2 == "exists"
    assert ledger_path.read_bytes() == content1

    # 3. Reject older or equal cutoff
    entry_old = _make_sample_entry("2025-12-31", "2025-12-31", "2026-01-01")
    with pytest.raises(ForwardError, match="not strictly later"):
        append_entry(ledger_path, entry_old)

    # 4. Corrupt line rejected
    with ledger_path.open("a", encoding="utf-8") as f:
        f.write("not valid json\n")
    entry2 = _make_sample_entry("2026-01-08", "2026-01-08", "2026-01-12")
    with pytest.raises(ForwardError, match="Corrupt ledger line"):
        append_entry(ledger_path, entry2)


def test_create_entry_skipped_late(tmp_path: Path) -> None:
    root = Path(__file__).resolve().parents[2]
    selection_path = root / "configs" / "experiments" / "selection-v1.json"
    feature_config_path = root / "configs" / "features" / "v1.json"
    selection = load_selection(selection_path, root)
    feature_config = load_feature_config(feature_config_path)

    draws = _make_dummy_draws(5)
    # cutoff draw is draws[-1].draw_date
    # Next draw date is after cutoff
    ledger_path = tmp_path / "ledger.jsonl"
    summary_path = tmp_path / "summary.json"

    # Set 'now' way in the future past the deadline
    late_time = datetime.datetime(2099, 1, 1, 21, 0, tzinfo=TAIPEI)
    result = create_entry(
        root=tmp_path,
        draws=draws,
        selection=selection,
        feature_config=feature_config,
        selection_path=selection_path,
        feature_config_path=feature_config_path,
        now=late_time,
        ledger_path=ledger_path,
        summary_path=summary_path,
    )
    assert result["status"] == "skipped_late"
    assert not ledger_path.exists()
    assert summary_path.exists()  # summary rebuilt even when skipped


def test_summary_resolution_and_hits() -> None:
    draws = [
        DrawRecord(
            draw_id="2026-01-01",
            draw_date=datetime.date(2026, 1, 1),
            area1=(1, 2, 3, 4, 5, 6),
            area2=1,
        ),
        DrawRecord(
            draw_id="2026-01-05",
            draw_date=datetime.date(2026, 1, 5),
            area1=(1, 2, 7, 8, 9, 10),
            area2=2,
        ),
    ]
    entry = _make_sample_entry("2026-01-01", "2026-01-01", "2026-01-05")
    # Entry predicts:
    # model: area1 [1, 2, 3, 4, 5, 6], area2 [7]
    # hf: area1 [10, 11, 12, 13, 14, 15], area2 [8]

    # Target draw is 2026-01-05: area1 (1, 2, 7, 8, 9, 10), area2 2
    # Model area1 hits: {1, 2} -> 2 hits
    # Model area2 hits: 7 not in [2] -> 0 hits
    # HF area1 hits: {10} -> 1 hit
    # HF area2 hits: 8 not in [2] -> 0 hits

    summary = build_summary([entry], draws)
    assert summary["aggregate"]["resolved_count"] == 1
    assert summary["latest_pending"] is None
    entry_summary = summary["entries"][0]
    assert entry_summary["status"] == "resolved"
    assert entry_summary["target_draw_id"] == "2026-01-05"
    assert entry_summary["target_date_matched"] is True
    assert entry_summary["hits"]["model"]["area1"] == 2
    assert entry_summary["hits"]["model"]["area2"] == 0
    assert entry_summary["hits"]["historical_frequency"]["area1"] == 1
    assert entry_summary["hits"]["historical_frequency"]["area2"] == 0
    assert summary["aggregate"]["mean_hits"]["model"]["area1"] == 2.0


def test_summary_flags_and_unpredicted_draws() -> None:
    draws = [
        DrawRecord(
            draw_id="2026-01-01",
            draw_date=datetime.date(2026, 1, 1),
            area1=(1, 2, 3, 4, 5, 6),
            area2=1,
        ),
        # Target draw occurs on 2026-01-06 instead of assumed 2026-01-05!
        DrawRecord(
            draw_id="2026-01-06",
            draw_date=datetime.date(2026, 1, 6),
            area1=(1, 2, 3, 4, 5, 6),
            area2=1,
        ),
        # Missed draw: 2026-01-08 was drawn but never targeted!
        DrawRecord(
            draw_id="2026-01-08",
            draw_date=datetime.date(2026, 1, 8),
            area1=(1, 2, 3, 4, 5, 6),
            area2=1,
        ),
    ]

    entry = _make_sample_entry("2026-01-01", "2026-01-01", "2026-01-05")
    # input_data_sha256 in entry is "dummy_data_sha", but actual sha of draw 1 is different
    # so input_data_changed must be True!
    summary = build_summary([entry], draws)
    entry_summary = summary["entries"][0]
    assert entry_summary["target_date_matched"] is False  # 2026-01-06 != 2026-01-05
    assert entry_summary["input_data_changed"] is True
    # 2026-01-06 was resolved. 2026-01-08 occurred after 2026-01-06 but was not predicted:
    assert summary["aggregate"]["unpredicted_draws_since_start"] == 1


def test_summary_byte_stable_and_no_wall_clock() -> None:
    draws = _make_dummy_draws(5)
    entry = _make_sample_entry("D0004", draws[-1].draw_date.isoformat(), "2026-11-05")

    s1 = build_summary([entry], draws)
    s2 = build_summary([entry], draws)
    assert s1 == s2

    def check_no_wall_clock(obj: object, path: str = "") -> None:
        forbidden = {"generated_at", "git_commit", "environment"}
        if isinstance(obj, dict):
            for k, v in obj.items():
                assert k not in forbidden, f"Found forbidden field '{k}' at {path}"
                check_no_wall_clock(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                check_no_wall_clock(v, f"{path}[{i}]")

    check_no_wall_clock(s1)
