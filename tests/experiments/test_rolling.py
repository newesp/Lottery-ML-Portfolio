from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.experiments.rolling import RollingProtocol, project, replay_metrics, years_before
from lottery_ml.forward import comparison
from lottery_ml.forward.comparison import (
    compare,
    forward_report,
    publish_methods,
    publish_once,
    register_prediction,
    v1_record,
)
from lottery_ml.forward.schedule import TAIPEI

ROOT = Path(__file__).resolve().parents[2]


def draw(day: date) -> DrawRecord:
    return DrawRecord(day.isoformat(), day, (1, 2, 3, 4, 5, 6), 1)


def test_calendar_and_window() -> None:
    assert years_before(date(2028, 2, 29), 1) == date(2027, 2, 28)
    protocol = RollingProtocol(ROOT)
    target = date(2028, 10, 2)
    boundary = date(2020, 10, 2)
    history = [
        draw(boundary - timedelta(days=1)),
        draw(boundary),
        draw(target - timedelta(days=4)),
        draw(target),
    ]
    window = protocol.window(history, target)
    assert window == history[1:3]
    changed = [replace(history[0], area2=4), *window, replace(history[-1], area2=3)]
    assert protocol.window(changed, target) == window
    assert protocol.window(history[2:], target) == []


@pytest.mark.parametrize("n,k", [(38, 6), (8, 1)])
def test_fixed_sum_and_order(n: int, k: int) -> None:
    raw = np.linspace(0, 1, n)
    adjusted = np.array(project(raw.tolist(), k))
    assert abs(adjusted.sum() - k) < 1e-9
    assert np.all((adjusted >= 0) & (adjusted <= 1))
    assert np.all(np.diff(adjusted) >= 0)


def test_hand_scored_bins_and_brier() -> None:
    areas = {"area1": {}, "area2": {}}
    for area, size, k in (("area1", 38, 6), ("area2", 8, 1)):
        areas[area] = {"scores": {"raw": [0] * size, "adjusted": [k / size] * size}}
    hits = {area: {"model": 1, "historical_frequency": 0, "mixed": 1} for area in areas}
    row = {
        "actual": draw(date.today()).to_dict(),
        "hits": {"rolling-v2": hits, "forward-v1": hits},
        "predictions": {"rolling-v2": {"areas": areas}},
    }
    metrics = replay_metrics([row])["area2"]
    assert metrics["probabilities"]["raw"]["brier"] == 1 / 8
    assert metrics["probabilities"]["adjusted"]["brier"] == 7 / 64
    assert metrics["probabilities"]["adjusted"]["bins"][1] == {
        "sum": 1,
        "count": 8,
        "wins": 1,
        "draw_count": 1,
    }
    assert metrics["mixed_differences"]["forward-v1/historical_frequency"]["lower"] == 1


def test_atomic_registration_and_no_replacement(tmp_path: Path) -> None:
    path = tmp_path / "entries" / "one.json"
    with ThreadPoolExecutor(max_workers=4) as executor:
        won = list(executor.map(lambda i: publish_once(path, {"i": i}), range(4)))
    assert sum(won) == 1
    assert json.loads(path.read_bytes()) == {"i": won.index(True)}


def test_legacy_partial_scores_stay_missing() -> None:
    line = (ROOT / "artifacts/forward/ledger.jsonl").read_bytes().splitlines()[0]
    record = v1_record(json.loads(line))
    assert record["areas"]["area1"]["scores"] == {}
    assert len(record["areas"]["area2"]["scores"]["raw"]) == 8


def test_formal_comparison_counts_first_104_and_freezes(tmp_path: Path) -> None:
    start = date(2025, 10, 1)
    draws = [draw(start + timedelta(days=4 * i)) for i in range(110)]
    folder = tmp_path / "artifacts/forward/v2"
    plan = {
        "id": "restore-a",
        "area": "area2",
        "metric": "hits",
        "incumbent": "rolling-b/model",
        "candidate": "rolling-a/model",
        "first": draws[1].draw_id,
        "required": 104,
        "margin": 0,
        "registered_at": datetime.combine(start, datetime.min.time(), TAIPEI).isoformat(),
        "resamples": 100,
        "seed": 2026,
        "identities": {v: {"code_sha256": v} for v in ("rolling-a", "rolling-b")},
        "environments": {v: {} for v in ("rolling-a", "rolling-b")},
    }
    publish_once(folder / "plans/restore-a.json", plan)
    entries = {}
    for i, target in enumerate(draws[1:], 1):
        for version, pick in (("rolling-a", 1), ("rolling-b", 2)):
            if i == 1 and version == "rolling-a":
                continue
            entry = {
                "target": target.draw_id,
                "version": version,
                "cutoff_draw_id": draws[i - 1].draw_id,
                "code_sha256": version,
                "environment": {},
                "generated_at": target.draw_id + "T12:00:00+08:00",
                "areas": {"area2": {"picks": {"model": [pick]}}},
            }
            if i == 2:
                entry["generated_at"] = target.draw_id + "T20:00:00+08:00"
            if i == 3:
                entry["cutoff_draw_id"] = "wrong"
            if i == 4:
                entry["code_sha256"] = "different"
            entries[(target.draw_id, version)] = entry
            publish_once(folder / "entries" / version / (target.draw_id + ".json"), entry)
    before = compare(plan, entries, draws[:108])
    assert len(before["included"]) == 103 and before["status"] == "collecting"
    summary = forward_report(tmp_path, draws[:109])
    decision = summary["comparisons"][0]
    assert len(decision["included"]) == 104
    assert decision["included"][0]["target"] == draws[5].draw_id
    assert (draws[108].draw_date - draws[5].draw_date).days > 365
    assert decision["status"] == "promote" and decision["interval"]["estimate"] == 1
    assert {r["reason"] for r in decision["excluded"]} == {
        "missing_registration",
        "outside_registration_period",
        "target_mismatch",
        "version_mismatch",
    }
    assert summary["last_publication"] is None
    assert forward_report(tmp_path, draws)["comparisons"][0] == decision
    corrected = draws.copy()
    corrected[6] = replace(draws[6], area2=2)
    revised = forward_report(tmp_path, corrected)["comparisons"][0]
    assert revised["evidence_changed"] and revised["interval"] == decision["interval"]


def test_replay_and_registration_match_without_target_or_future(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from lottery_ml.experiments.rolling import verify_entry

    protocol = RollingProtocol(ROOT)
    first = date(2018, 1, 1)
    target = date(2026, 1, 5)
    history = [draw(first), draw(date(2018, 1, 5))]
    for i in range(12):
        day = date(2025, 11, 24) + timedelta(days=3 * i)
        history.append(
            DrawRecord(day.isoformat(), day, tuple((i + n) % 38 + 1 for n in range(6)), i % 8 + 1)
        )
    history.append(draw(date(2026, 1, 1)))
    clock = datetime(2026, 1, 2, 12, tzinfo=TAIPEI)

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock

    monkeypatch.setattr(comparison, "datetime", Clock)
    assert register_prediction(tmp_path, history, protocol) == "created"
    assert register_prediction(tmp_path, history, protocol) == "exists"
    entry_path = tmp_path / "artifacts/forward/v2/entries/rolling-v2/2026-01-05.json"
    entry = json.loads(entry_path.read_bytes())
    known = [*history, draw(target), draw(target + timedelta(days=3))]
    verify_entry(ROOT, known, entry)
    known[0] = replace(known[0], area2=8)
    known[-2] = replace(known[-2], area2=7)
    verify_entry(ROOT, known, entry)
    assert forward_report(tmp_path, history)["entries"][0]["status"] == "pending"
    assert forward_report(tmp_path, known)["entries"][0]["status"] == "resolved"
    assert forward_report(tmp_path, known)["last_publication"] is None
    methods = {"area1": "rolling-v2/mixed", "area2": "rolling-v2/model"}
    publish_methods(tmp_path, history, methods)
    assert forward_report(tmp_path, known)["published_methods"] == methods
    clock = datetime(2026, 1, 8, 20, tzinfo=TAIPEI)
    assert register_prediction(tmp_path, known[:-1], protocol) == "skipped_late"
    assert register_prediction(tmp_path, known[:-1], protocol) == "skipped_late"
    missed = forward_report(tmp_path, known)["missed"]
    assert [(m["target"], m["reason"]) for m in missed] == [("2026-01-08", "skipped_late")]


def test_missing_probabilities_and_replay_are_excluded() -> None:
    first = date(2026, 1, 1)
    draws = [draw(first), draw(first + timedelta(days=4))]
    plan = {
        "id": "brier",
        "incumbent": "forward-v1/raw",
        "candidate": "rolling-v2/adjusted",
        "area": "area1",
        "metric": "brier",
        "first": draws[-1].draw_id,
        "registered_at": "2026-01-01T12:00:00+08:00",
        "required": 104,
        "identities": {"forward-v1": {}},
        "environments": {"forward-v1": {}},
    }
    entry = {
        "version": "forward-v1",
        "cutoff_draw_id": draws[0].draw_id,
        "generated_at": "2026-01-02T10:00:00+08:00",
        "environment": {},
        "areas": {"area1": {"scores": {}}},
    }
    entries = {(draws[-1].draw_id, "forward-v1"): entry}
    assert compare(plan, entries, draws)["excluded"][0]["reason"] == "missing_complete_scores"
    entry["kind"] = "replay"
    assert compare(plan, entries, draws)["excluded"][0]["reason"] == "not_forward_evidence"
