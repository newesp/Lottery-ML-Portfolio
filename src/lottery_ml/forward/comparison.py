"""Immutable registration, settlement and fixed-horizon prospective comparisons."""

from __future__ import annotations

import json
import math
import os
import re
from datetime import date, datetime
from pathlib import Path
from statistics import mean
from tempfile import NamedTemporaryFile

import numpy as np

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.storage import serialize_draws
from lottery_ml.evaluation.bootstrap import paired_mean_difference
from lottery_ml.experiments.artifacts import write_json_artifact
from lottery_ml.experiments.rolling import (
    AREAS,
    METHODS,
    Record,
    RollingProtocol,
    digest,
    years_before,
)
from lottery_ml.forward.ledger import get_environment, get_git_commit, load_ledger_entries
from lottery_ml.forward.predict import scoring_code_hash
from lottery_ml.forward.schedule import TAIPEI, next_draw_date, prediction_deadline


def publish_once(path: Path, record: Record) -> bool:
    """Atomically publish complete JSON without replacing a concurrent writer."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temp = Path(handle.name)
    try:
        write_json_artifact(temp, record)
        try:
            if os.name == "nt":
                # Windows rename fails if another writer already published the target.
                temp.rename(path)
            else:
                os.link(temp, path)
        except FileExistsError:
            return False
        return True
    finally:
        temp.unlink(missing_ok=True)


def load_records(folder: Path) -> list[Record]:
    return [json.loads(p.read_bytes()) for p in sorted(folder.glob("*.json"))]


def record_missed_deadline(folder: Path, version: str, target: date, cutoff: str) -> str:
    publish_once(
        folder / "missed" / version / f"{target}.json",
        {
            "version": version,
            "target": target.isoformat(),
            "cutoff_draw_id": cutoff,
            "deadline": prediction_deadline(target).isoformat(),
            "reason": "skipped_late",
        },
    )
    return "skipped_late"


def register_prediction(root: Path, draws: list[DrawRecord], protocol: RollingProtocol) -> str:
    target = next_draw_date(draws[-1].draw_date)
    folder = root / "artifacts/forward/v2"
    path = folder / "entries" / protocol.version / f"{target}.json"
    if path.exists():
        return "exists"
    if datetime.now(TAIPEI) >= prediction_deadline(target):
        return record_missed_deadline(folder, protocol.version, target, draws[-1].draw_id)
    history = protocol.window(draws, target)
    if not history:
        return "insufficient_history"
    prediction = protocol.predict(history, target, protocol.version)
    entry = {
        **prediction,
        **protocol.identity,
        "kind": "forward",
        "definition": protocol.definition,
        "environment": protocol.environment,
        "git_commit": get_git_commit(root),
        "cutoff_draw_id": draws[-1].draw_id,
    }
    now = datetime.now(TAIPEI)
    if now >= prediction_deadline(target):
        return record_missed_deadline(folder, protocol.version, target, draws[-1].draw_id)
    entry["generated_at"] = now.isoformat()
    return "created" if publish_once(path, entry) else "exists"


def register_plan(
    root: Path,
    name: str,
    area: str,
    metric: str,
    incumbent: str,
    candidate: str,
    first: date,
    count: int,
    margin: float,
    now: datetime,
    incumbent_entry: Path | None = None,
    candidate_entry: Path | None = None,
) -> str:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", name) or count < 2:
        raise ValueError("invalid comparison id or sample count")
    if area not in AREAS or not math.isfinite(margin) or margin < 0:
        raise ValueError("invalid area or improvement threshold")
    identities: dict[str, dict[str, str]] = {}
    references: Record = {}
    environments: Record = {}
    if metric not in ("hits", "brier") or incumbent == candidate:
        raise ValueError("invalid metric or identical methods")
    for choice, reference in ((incumbent, incumbent_entry), (candidate, candidate_entry)):
        version, method = choice.split("/")
        previous_identity = identities.get(version)
        legacy = version == "forward-v1"
        if not legacy and not re.fullmatch(r"rolling-[a-z0-9-]+", version):
            raise ValueError("unknown protocol")
        allowed: tuple[str, ...] = METHODS[:2] if legacy else METHODS
        if metric == "brier":
            allowed = ("raw",) if legacy else ("raw", "adjusted")
        if method not in allowed:
            raise ValueError("invalid comparison method")
        if reference is not None:
            reference = root / reference
            frozen = json.loads(reference.read_bytes())
            if frozen.get("version", frozen.get("protocol_id")) != version:
                raise ValueError("reference version does not match comparison method")
            keys = ["code_sha256", "selection_sha256", "feature_config_sha256"]
            if not legacy:
                keys.append("protocol_sha256")
            if any(not frozen.get(k) for k in keys):
                raise ValueError("archived entry lacks a frozen version fingerprint")
            identities[version] = {k: frozen[k] for k in keys}
            environments[version] = frozen["environment"]
            references[choice] = {
                "entry_sha256": digest(reference.read_bytes()),
                "target": frozen.get("target", frozen.get("assumed_target_date")),
                "git_commit": frozen["git_commit"],
            }
        elif legacy:
            identities[version] = {
                "code_sha256": scoring_code_hash(),
                "selection_sha256": digest(
                    (root / "configs/experiments/selection-v1.json").read_bytes()
                ),
                "feature_config_sha256": digest((root / "configs/features/v1.json").read_bytes()),
            }
            environments[version] = get_environment()
        else:
            protocol = RollingProtocol(root, version)
            identities[version] = protocol.identity
            environments[version] = protocol.environment
        if previous_identity is not None and previous_identity != identities[version]:
            raise ValueError("different predictor revisions must use distinct protocol IDs")
    if now >= prediction_deadline(first):
        raise ValueError("first target must still be open")
    plan = {
        "id": name,
        "area": area,
        "metric": metric,
        "incumbent": incumbent,
        "candidate": candidate,
        "registered_at": now.isoformat(),
        "first": first.isoformat(),
        "required": count,
        "margin": margin,
        "resamples": 10000,
        "seed": 2026,
        "identities": identities,
        "environments": environments,
        "references": references,
    }
    if not publish_once(root / "artifacts/forward/v2/plans" / f"{name}.json", plan):
        raise ValueError("comparison id already registered")
    return name


def v1_record(entry: Record) -> Record:
    areas: Record = {}
    for area, (size, _) in AREAS.items():
        model = entry["predictions"]["model"][area]
        scores = model.get("raw")
        if scores is None and len(model["top_scores"]) == size:
            scores = [p for _, p in sorted(model["top_scores"])]
        areas[area] = {
            "picks": {m: entry["predictions"][m][area]["picks"] for m in METHODS[:2]},
            "scores": {"raw": scores} if scores is not None else {},
        }
    return {
        **entry,
        "target": entry["assumed_target_date"],
        "version": entry["protocol_id"],
        "areas": areas,
    }


def result_for(entry: Record, area: str, method: str, actual: DrawRecord, metric: str) -> float:
    winners = set(actual.area1 if area == "area1" else (actual.area2,))
    outputs = entry["areas"][area]
    if metric == "hits":
        picks = outputs["picks"].get(method, [])
        size, k = AREAS[area]
        if (
            len(picks) != k
            or len(set(picks)) != k
            or any(n not in range(1, size + 1) for n in picks)
        ):
            raise ValueError("invalid_ticket")
        return float(len(winners.intersection(picks)))
    scores = outputs["scores"].get(method)
    if scores is None or len(scores) != AREAS[area][0]:
        raise ValueError("missing_complete_scores")
    if any(not math.isfinite(p) or not 0 <= p <= 1 for p in scores):
        raise ValueError("invalid_score")
    return float(mean((score - (i in winners)) ** 2 for i, score in enumerate(scores, 1)))


def compare(
    plan: Record, entries: dict[tuple[str, str], Record], draws: list[DrawRecord]
) -> Record:
    drift: list[Record] = []
    included: list[Record] = []
    excluded: list[Record] = []
    registered = datetime.fromisoformat(plan["registered_at"])
    for index, actual in enumerate(draws):
        target = actual.draw_date.isoformat()
        if target < plan["first"]:
            continue
        values = []
        registrations = {}
        for role in ("incumbent", "candidate"):
            version, method = plan[role].split("/")
            entry = entries.get((target, version))
            reason = None
            if entry is None:
                reason = "missing_registration"
            elif entry.get("kind", "forward") != "forward" or "generated_at" not in entry:
                reason = "not_forward_evidence"
            elif index == 0 or entry["cutoff_draw_id"] != draws[index - 1].draw_id:
                reason = "target_mismatch"
            elif (
                not registered
                <= datetime.fromisoformat(entry["generated_at"])
                < (prediction_deadline(actual.draw_date))
            ):
                reason = "outside_registration_period"
            else:
                expected = plan["identities"][version]
                if any(entry.get(k) != value for k, value in expected.items()):
                    reason = "version_mismatch"
            if reason:
                excluded.append({"target": target, "role": role, "reason": reason})
                break
            assert entry is not None
            registrations[role] = entry["generated_at"]
            if entry.get("environment") != plan["environments"][version]:
                drift.append(
                    {"target": target, "role": role, "environment": entry.get("environment")}
                )
            try:
                values.append(result_for(entry, plan["area"], method, actual, plan["metric"]))
            except ValueError as error:
                excluded.append({"target": target, "role": role, "reason": str(error)})
                break
        if len(values) == 2:
            delta = values[1] - values[0]
            included.append(
                {
                    "target": target,
                    "draw_id": actual.draw_id,
                    "actual": actual.to_dict(),
                    "registrations": registrations,
                    "incumbent": values[0],
                    "candidate": values[1],
                    "difference": delta if plan["metric"] == "hits" else -delta,
                }
            )
            if len(included) == plan["required"]:
                break
    result: Record = {
        "plan": plan,
        "included": included,
        "excluded": excluded,
        "environment_changes": drift,
        "status": "collecting",
        "interval": None,
    }
    if len(included) == plan["required"]:
        diff = np.array([r["difference"] for r in included], dtype=float)
        interval = paired_mean_difference(
            diff, np.zeros_like(diff), resamples=plan["resamples"], seed=plan["seed"]
        )
        result["interval"] = interval.to_dict()
        result["status"] = "promote" if interval.lower > plan["margin"] else "retain"
        if interval.upper < plan["margin"]:
            result["status"] = "archive"
        result["exclusions_require_review"] = bool(excluded)
    return result


def forward_report(root: Path, draws: list[DrawRecord]) -> Record:
    folder = root / "artifacts/forward/v2"
    legacy = [v1_record(e) for e in load_ledger_entries(folder.parent / "ledger.jsonl")]
    records = [json.loads(p.read_bytes()) for p in sorted((folder / "entries").glob("*/*.json"))]
    indexed = {(e["target"], e["version"]): e for e in [*legacy, *records]}
    if len(indexed) != len(legacy) + len(records):
        raise ValueError("duplicate target registration")
    comparisons = []
    for plan in load_records(folder / "plans"):
        decision_path = folder / "decisions" / f"{plan['id']}.json"
        current = compare(plan, indexed, draws)
        if current["status"] != "collecting" and not decision_path.exists():
            publish_once(decision_path, current)
        if decision_path.exists():
            frozen = json.loads(decision_path.read_bytes())
            frozen["evidence_changed"] = frozen != current
            current = frozen
        comparisons.append(current)
    by_date = {d.draw_date.isoformat(): (i, d) for i, d in enumerate(draws)}
    entries = []
    for e in records:
        previous = e["cutoff_draw_id"]
        resolved = by_date.get(e["target"])
        if not resolved:
            status = "pending" if e["target"] > draws[-1].draw_date.isoformat() else "mismatch"
        elif resolved[0] == 0 or draws[resolved[0] - 1].draw_id != previous:
            status = "mismatch"
        elif datetime.fromisoformat(e["generated_at"]) >= prediction_deadline(
            resolved[1].draw_date
        ):
            status = "late"
        else:
            status = "resolved"
        target_date = date.fromisoformat(e["target"])
        window_start = years_before(target_date, 8)
        history = [d for d in draws if window_start <= d.draw_date < target_date]
        input_changed = (
            digest(serialize_draws(history)) != e["input_sha256"] if "input_sha256" in e else None
        )
        entries.append(
            {
                **e,
                "status": status,
                "input_data_changed": input_changed,
                "actual": resolved[1].to_dict() if status == "resolved" and resolved else None,
            }
        )
    publications = load_records(folder / "publications")
    live: dict[str, str | None] = {a: None for a in AREAS}
    if legacy:
        for area in AREAS:
            live[area] = legacy[-1]["version"] + "/model"
    if publications:
        live.update(publications[-1]["methods"])
    missed = [json.loads(p.read_bytes()) for p in sorted((folder / "missed").glob("*/*.json"))]
    report = {
        "schema_version": 2,
        "kind": "forward",
        "data_through": draws[-1].draw_id,
        "entries": entries,
        "missed": [m for m in missed if (m["target"], m["version"]) not in indexed],
        "comparisons": comparisons,
        "published_methods": live,
        "last_publication": publications[-1] if publications else None,
    }
    write_json_artifact(folder / "summary.json", report)
    return report


def publish_methods(root: Path, draws: list[DrawRecord], methods: dict[str, str]) -> None:
    """Record the deployed choices only when all referenced tickets exist before deadline."""
    target = next_draw_date(draws[-1].draw_date)
    folder = root / "artifacts/forward/v2"
    path = folder / "publications" / f"{target}.json"
    if path.exists() or datetime.now(TAIPEI) >= prediction_deadline(target):
        return
    if set(methods) != set(AREAS):
        raise ValueError("published methods require both areas")
    picks = {}
    for area, choice in methods.items():
        version, method = choice.split("/")
        if version == "forward-v1":
            records = load_ledger_entries(folder.parent / "ledger.jsonl")
            if not records or records[-1]["assumed_target_date"] != target.isoformat():
                return
            entry = v1_record(records[-1])
        else:
            if not re.fullmatch(r"rolling-[a-z0-9-]+", version):
                raise ValueError("invalid published protocol")
            record = folder / "entries" / version / f"{target}.json"
            if not record.exists():
                return
            entry = json.loads(record.read_bytes())
        if entry["cutoff_draw_id"] != draws[-1].draw_id:
            return
        picks[area] = entry["areas"][area]["picks"][method]
    now = datetime.now(TAIPEI)
    if now < prediction_deadline(target):
        publish_once(
            path,
            {
                "target": target.isoformat(),
                "methods": methods,
                "picks": picks,
                "generated_at": now.isoformat(),
            },
        )
