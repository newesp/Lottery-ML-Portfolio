from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.storage import serialize_draws
from lottery_ml.evaluation.metrics import expected_uniform_hits
from lottery_ml.experiments.artifacts import write_json_artifact
from lottery_ml.experiments.config import FeatureConfig
from lottery_ml.experiments.holdout import SelectionProtocol
from lottery_ml.forward.predict import predict_next, serialize_predictions
from lottery_ml.forward.schedule import (
    TAIPEI,
    next_draw_date,
    prediction_deadline,
)


class ForwardError(ValueError):
    """Raised when ledger integrity is violated or prediction cannot proceed."""


def get_environment() -> dict[str, str]:
    import lightgbm
    import numpy as np
    import pandas as pd
    import sklearn

    return {
        "python": sys.version.split()[0],
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "scikit-learn": sklearn.__version__,
        "lightgbm": lightgbm.__version__,
    }


def get_git_commit(root: Path) -> str:
    env_sha = os.environ.get("GITHUB_SHA")
    if env_sha:
        return env_sha.strip()
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except Exception:
        pass
    return "unknown"


REQUIRED_ENTRY_KEYS = {
    "schema_version",
    "protocol_id",
    "selection_id",
    "selection_sha256",
    "feature_config_sha256",
    "cutoff_draw_id",
    "cutoff_date",
    "input_draw_count",
    "input_data_sha256",
    "assumed_target_date",
    "generated_at",
    "git_commit",
    "environment",
    "predictions",
}


def load_ledger_entries(ledger_path: Path) -> list[dict[str, Any]]:
    if not ledger_path.exists():
        return []
    try:
        content = ledger_path.read_text(encoding="utf-8")
    except OSError as error:
        raise ForwardError(f"Cannot read ledger {ledger_path}: {error}") from error

    entries: list[dict[str, Any]] = []
    for line_idx, line in enumerate(content.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError as error:
            msg = f"Corrupt ledger line {line_idx} in {ledger_path}: {error}"
            raise ForwardError(msg) from error
        if not isinstance(entry, dict):
            raise ForwardError(f"Ledger line {line_idx} must be a JSON object")
        missing = REQUIRED_ENTRY_KEYS - set(entry.keys())
        if missing:
            raise ForwardError(f"Ledger line {line_idx} is missing keys: {missing}")
        entries.append(entry)
    return entries


def append_entry(ledger_path: Path, entry: dict[str, Any]) -> str:
    """Validate and append an entry to ledger.jsonl.

    Returns:
        "created" if appended, or "exists" if cutoff_draw_id already in ledger.
    Raises:
        ForwardError if ledger is corrupt or chronological order is violated.
    """
    existing_bytes = b""
    if ledger_path.exists():
        existing_bytes = ledger_path.read_bytes()
        entries = load_ledger_entries(ledger_path)
        cutoff_id = str(entry["cutoff_draw_id"])
        cutoff_date = str(entry["cutoff_date"])

        for prev in entries:
            prev_id = str(prev["cutoff_draw_id"])
            if prev_id == cutoff_id:
                return "exists"
            prev_date = str(prev["cutoff_date"])
            if prev_date >= cutoff_date or prev_id >= cutoff_id:
                raise ForwardError(
                    f"New cutoff {cutoff_id} ({cutoff_date}) is not strictly later than "
                    f"existing cutoff {prev_id} ({prev_date})"
                )

    new_line = json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n"
    new_bytes = existing_bytes + new_line.encode("utf-8")

    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = ledger_path.with_suffix(".tmp")
    try:
        temp_path.write_bytes(new_bytes)
        written = temp_path.read_bytes()
        if not written.startswith(existing_bytes):
            raise ForwardError("Ledger prefix verification failed during atomic append")
        temp_path.replace(ledger_path)
    except OSError as error:
        temp_path.unlink(missing_ok=True)
        raise ForwardError(f"Failed to atomically write ledger {ledger_path}: {error}") from error

    return "created"


def build_summary(
    entries: list[dict[str, Any]],
    draws: list[DrawRecord],
    selection_id: str = "selection-v1",
) -> dict[str, Any]:
    """Derive summary.json deterministically from ledger entries and canonical draws."""
    sorted_entries = sorted(
        entries,
        key=lambda e: (str(e["cutoff_date"]), str(e["cutoff_draw_id"])),
    )
    draws_by_id = {d.draw_id: d for d in draws}

    summary_entries: list[dict[str, Any]] = []
    latest_pending: dict[str, Any] | None = None

    for entry in sorted_entries:
        cutoff_date = date.fromisoformat(str(entry["cutoff_date"]))
        assumed_target_date = str(entry["assumed_target_date"])

        # Target is the first draw in canonical with draw_date > cutoff_date
        target_draw = next((d for d in draws if d.draw_date > cutoff_date), None)

        # Check if canonical input data up to cutoff has changed
        draws_at_cutoff = [d for d in draws if d.draw_date <= cutoff_date]
        current_cutoff_sha = hashlib.sha256(serialize_draws(draws_at_cutoff)).hexdigest()
        input_data_changed = current_cutoff_sha != entry.get("input_data_sha256")

        model_picks_a1 = list(entry["predictions"]["model"]["area1"]["picks"])
        model_picks_a2 = list(entry["predictions"]["model"]["area2"]["picks"])
        hf_picks_a1 = list(entry["predictions"]["historical_frequency"]["area1"]["picks"])
        hf_picks_a2 = list(entry["predictions"]["historical_frequency"]["area2"]["picks"])

        picks_payload = {
            "model": {"area1": model_picks_a1, "area2": model_picks_a2},
            "historical_frequency": {"area1": hf_picks_a1, "area2": hf_picks_a2},
        }

        if target_draw is None:
            status = "pending"
            target_draw_id: str | None = None
            target_date_matched = True
            actual: dict[str, Any] | None = None
            hits: dict[str, Any] | None = None
            cutoff_draw = draws_by_id.get(str(entry["cutoff_draw_id"]))
            cutoff_actual = (
                {
                    "area1": list(cutoff_draw.area1),
                    "area2": cutoff_draw.area2,
                }
                if cutoff_draw
                else None
            )
            latest_pending = {
                "cutoff_draw_id": str(entry["cutoff_draw_id"]),
                "cutoff_actual": cutoff_actual,
                "assumed_target_date": assumed_target_date,
                "predictions": entry["predictions"],
            }
        else:
            status = "resolved"
            target_draw_id = target_draw.draw_id
            target_date_matched = target_draw.draw_date.isoformat() == assumed_target_date
            actual = {
                "area1": list(target_draw.area1),
                "area2": target_draw.area2,
            }
            m_a1_hits = len(set(model_picks_a1) & set(target_draw.area1))
            m_a2_hits = 1 if target_draw.area2 in model_picks_a2 else 0
            hf_a1_hits = len(set(hf_picks_a1) & set(target_draw.area1))
            hf_a2_hits = 1 if target_draw.area2 in hf_picks_a2 else 0
            hits = {
                "model": {"area1": m_a1_hits, "area2": m_a2_hits},
                "historical_frequency": {"area1": hf_a1_hits, "area2": hf_a2_hits},
            }

        summary_entries.append(
            {
                "cutoff_draw_id": str(entry["cutoff_draw_id"]),
                "assumed_target_date": assumed_target_date,
                "status": status,
                "target_draw_id": target_draw_id,
                "target_date_matched": target_date_matched,
                "input_data_changed": input_data_changed,
                "actual": actual,
                "picks": picks_payload,
                "hits": hits,
            }
        )

    resolved = [e for e in summary_entries if e["status"] == "resolved"]
    resolved_count = len(resolved)

    if resolved_count == 0:
        mean_hits = {
            "model": {"area1": 0.0, "area2": 0.0},
            "historical_frequency": {"area1": 0.0, "area2": 0.0},
        }
        unpredicted_draws_since_start = 0
    else:
        m_a1_mean = round(sum(e["hits"]["model"]["area1"] for e in resolved) / resolved_count, 6)
        m_a2_mean = round(sum(e["hits"]["model"]["area2"] for e in resolved) / resolved_count, 6)
        hf_a1_mean = round(
            sum(e["hits"]["historical_frequency"]["area1"] for e in resolved) / resolved_count, 6
        )
        hf_a2_mean = round(
            sum(e["hits"]["historical_frequency"]["area2"] for e in resolved) / resolved_count, 6
        )
        mean_hits = {
            "model": {"area1": m_a1_mean, "area2": m_a2_mean},
            "historical_frequency": {"area1": hf_a1_mean, "area2": hf_a2_mean},
        }
        first_target_date = min(draws_by_id[e["target_draw_id"]].draw_date for e in resolved)
        occurred_ids = {d.draw_id for d in draws if d.draw_date >= first_target_date}
        resolved_target_ids = {e["target_draw_id"] for e in resolved}
        unpredicted_draws_since_start = len(occurred_ids - resolved_target_ids)

    return {
        "schema_version": "1.0.0",
        "protocol_id": "forward-v1",
        "selection_id": selection_id,
        "expected_hits_uniform": {
            "area1": round(expected_uniform_hits("area1"), 6),
            "area2": round(expected_uniform_hits("area2"), 6),
        },
        "latest_pending": latest_pending,
        "entries": summary_entries,
        "aggregate": {
            "resolved_count": resolved_count,
            "mean_hits": mean_hits,
            "unpredicted_draws_since_start": unpredicted_draws_since_start,
        },
    }


def create_entry(
    *,
    root: Path,
    draws: list[DrawRecord],
    selection: SelectionProtocol,
    feature_config: FeatureConfig,
    selection_path: Path,
    feature_config_path: Path,
    now: datetime | None = None,
    ledger_path: Path | None = None,
    summary_path: Path | None = None,
) -> dict[str, Any]:
    """Execute prediction workflow for the next draw and rebuild summary."""
    if not draws:
        raise ForwardError("Cannot run forward prediction on empty draws")

    ledger_file = ledger_path or (root / "artifacts" / "forward" / "ledger.jsonl")
    summary_file = summary_path or (root / "artifacts" / "forward" / "summary.json")

    now = now or datetime.now(TAIPEI)
    if now.tzinfo is None:
        now = now.replace(tzinfo=TAIPEI)

    cutoff = draws[-1]
    existing_entries = load_ledger_entries(ledger_file) if ledger_file.exists() else []
    already_in_ledger = any(e["cutoff_draw_id"] == cutoff.draw_id for e in existing_entries)

    target_date = next_draw_date(cutoff.draw_date)
    deadline = prediction_deadline(target_date)

    if already_in_ledger:
        status = "exists"
    elif now >= deadline:
        status = "skipped_late"
    else:
        predictions = predict_next(draws, selection, feature_config, target_date)
        serialized_preds = serialize_predictions(predictions)
        selection_sha = hashlib.sha256(selection_path.read_bytes()).hexdigest()
        feature_config_sha = hashlib.sha256(feature_config_path.read_bytes()).hexdigest()
        data_sha = hashlib.sha256(serialize_draws(draws)).hexdigest()

        entry: dict[str, Any] = {
            "schema_version": "1.0.0",
            "protocol_id": "forward-v1",
            "selection_id": selection.selection_id,
            "selection_sha256": selection_sha,
            "feature_config_sha256": feature_config_sha,
            "cutoff_draw_id": cutoff.draw_id,
            "cutoff_date": cutoff.draw_date.isoformat(),
            "input_draw_count": len(draws),
            "input_data_sha256": data_sha,
            "assumed_target_date": target_date.isoformat(),
            "generated_at": now.isoformat(),
            "git_commit": get_git_commit(root),
            "environment": get_environment(),
            "predictions": serialized_preds,
        }
        status = append_entry(ledger_file, entry)

    # Always rebuild summary
    updated_entries = load_ledger_entries(ledger_file) if ledger_file.exists() else []
    summary = build_summary(updated_entries, draws, selection.selection_id)
    write_json_artifact(summary_file, summary)

    return {
        "status": status,
        "ledger_path": str(ledger_file),
        "summary_path": str(summary_file),
        "cutoff_draw_id": cutoff.draw_id,
        "assumed_target_date": target_date.isoformat(),
    }
