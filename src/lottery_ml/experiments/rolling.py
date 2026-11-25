"""Rolling-window prediction shared by replay and pre-draw registration."""

from __future__ import annotations

import hashlib
import json
import re
from calendar import monthrange
from datetime import date
from inspect import getsource
from pathlib import Path
from statistics import mean
from typing import Any

import numpy as np
import pandas as pd

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.storage import serialize_draws
from lottery_ml.evaluation.bootstrap import paired_mean_difference
from lottery_ml.evaluation.ranking import top_k_numbers
from lottery_ml.experiments.artifacts import write_json_artifact
from lottery_ml.experiments.config import load_feature_config
from lottery_ml.experiments.holdout import load_selection
from lottery_ml.features.builder import build_candidate_rows, build_next_draw_rows
from lottery_ml.forward.ledger import get_environment
from lottery_ml.forward.predict import score_candidates, scoring_code_hash

Record = dict[str, Any]
AREAS = {"area1": (38, 6), "area2": (8, 1)}
METHODS = ("model", "historical_frequency", "mixed")
VERSIONS = ("forward-v1", "rolling-v2")


def years_before(day: date, years: int) -> date:
    year = day.year - years
    return day.replace(year=year, day=min(day.day, monthrange(year, day.month)[1]))


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def project(scores: list[float], total: int) -> list[float]:
    values = np.asarray(scores, dtype=float)
    if not np.isfinite(values).all():
        raise ValueError("candidate scores must be finite")
    # Euclidean projection onto [0,1]^n with a fixed sum.
    low, high = float(values.min()) - 1, float(values.max())
    for _ in range(55):
        shift = (low + high) / 2
        if np.clip(values - shift, 0, 1).sum() > total:
            low = shift
        else:
            high = shift
    return [float(p) for p in np.clip(values - (low + high) / 2, 0, 1)]


class RollingProtocol:
    def __init__(self, root: Path, version: str = "rolling-v2") -> None:
        if not re.fullmatch(r"rolling-[a-z0-9-]+", version):
            raise ValueError("invalid rolling protocol id")
        self.version = version
        config_file = root / "configs/experiments" / (version + ".json")
        cfg = json.loads(config_file.read_bytes())
        if (
            cfg["protocol_id"],
            cfg["training_years"],
            cfg["report_years"],
            cfg["rank_weights"],
            cfg["projection"],
        ) != (version, 8, 1, [0.5, 0.5], "capped-simplex"):
            raise ValueError("unsupported rolling protocol")
        selection_file, feature_file = root / cfg["selection"], root / cfg["features"]
        self.selection = load_selection(selection_file, root)
        self.features = load_feature_config(feature_file)
        self.environment = get_environment()
        code = hashlib.sha256(scoring_code_hash().encode())
        for fn in (project, years_before, self.window, self.predict):
            code.update(getsource(fn).encode())
        self.definition = {
            "protocol": cfg,
            "selection": json.loads(selection_file.read_bytes()),
            "features": json.loads(feature_file.read_bytes()),
        }
        self.identity = {
            "protocol_sha256": digest(config_file.read_bytes()),
            "feature_config_sha256": digest(feature_file.read_bytes()),
            "selection_sha256": digest(selection_file.read_bytes()),
            "code_sha256": code.hexdigest(),
        }

    def window(self, history: list[DrawRecord], target: date) -> list[DrawRecord]:
        start = years_before(target, 8)
        if not history or history[0].draw_date > start:
            return []
        return [draw for draw in history if start <= draw.draw_date < target]

    def predict(
        self,
        history: list[DrawRecord],
        target: date,
        version: str,
        frames: tuple[pd.DataFrame, pd.DataFrame] | None = None,
    ) -> Record:
        if (
            not history
            or history[-1].draw_date >= target
            or version not in ("forward-v1", self.version)
        ):
            raise ValueError("invalid prediction history or version")
        if frames is None:
            frames = (
                build_candidate_rows(history, self.features),
                build_next_draw_rows(history, target, target.isoformat(), self.features),
            )
        areas: Record = {}
        for area, (numbers, raw, frequency) in score_candidates(
            *frames, self.selection, self.features
        ).items():
            k = AREAS[area][1]
            picks = {
                "model": top_k_numbers(numbers, raw, k),
                "historical_frequency": top_k_numbers(numbers, frequency, k),
            }
            scores = {"raw": raw}
            if version == self.version:
                ranks = pd.Series(raw).rank(ascending=False) + pd.Series(frequency).rank(
                    ascending=False
                )
                picks["mixed"] = top_k_numbers(numbers, (-ranks).tolist(), k)
                scores["adjusted"] = project(raw, k)
            areas[area] = {"picks": picks, "scores": scores}
        return {
            "version": version,
            "target": target.isoformat(),
            "train_first": history[0].draw_date.isoformat(),
            "train_last": history[-1].draw_date.isoformat(),
            "train_count": len(history),
            "input_sha256": digest(serialize_draws(history)),
            "areas": areas,
        }


def hit_counts(prediction: Record, actual: DrawRecord) -> Record:
    results: Record = {}
    for area, winners in (("area1", actual.area1), ("area2", (actual.area2,))):
        picks = prediction["areas"][area]["picks"]
        results[area] = {
            key: len(set(values).intersection(winners)) for key, values in picks.items()
        }
    return results


def replay(root: Path, draws: list[DrawRecord], as_of: date, limit: int | None = None) -> Record:
    protocol = RollingProtocol(root)
    history = [d for d in draws if d.draw_date <= as_of]
    start = years_before(as_of, 1)
    targets = [i for i, d in enumerate(history) if start <= d.draw_date]
    if limit is not None and limit <= 0:
        raise ValueError("limit must be positive")
    selected = targets[-limit:] if limit else targets
    frame = None
    rows: list[Record] = []
    skipped = []
    cache = root / ".rolling-cache"
    for i in selected:
        actual = history[i]
        previous = history[:i]
        window = protocol.window(previous, actual.draw_date)
        if not window:
            skipped.append(actual.draw_id)
            continue
        predictions: Record = {}
        for version, training in zip(VERSIONS, (previous, window), strict=True):
            key = digest(
                json.dumps(
                    [
                        protocol.identity,
                        protocol.environment,
                        version,
                        actual.draw_date.isoformat(),
                        digest(serialize_draws(training)),
                    ],
                    sort_keys=True,
                ).encode()
            )
            path = cache / (key + ".json")
            if path.exists():
                prediction = json.loads(path.read_bytes())
            else:
                frames = None
                if version == "forward-v1":
                    # The builder emits each row before observing that draw's outcome.
                    if frame is None:
                        frame = build_candidate_rows(history, protocol.features)
                    frames = (frame.iloc[: i * 46], frame.iloc[i * 46 : (i + 1) * 46])
                prediction = protocol.predict(training, actual.draw_date, version, frames)
                write_json_artifact(path, prediction)
            predictions[version] = prediction
        rows.append(
            {
                "actual": actual.to_dict(),
                "predictions": predictions,
                "hits": {v: hit_counts(p, actual) for v, p in predictions.items()},
            }
        )
    return {
        "schema_version": 2,
        "kind": "replay",
        "as_of": as_of.isoformat(),
        "start": start.isoformat(),
        "data_through": history[-1].draw_date.isoformat() if history else None,
        "snapshot_sha256": digest(serialize_draws(history)),
        **protocol.identity,
        "environment": protocol.environment,
        "eligible": len(targets),
        "not_requested": len(targets) - len(selected),
        "insufficient_history": skipped,
        "rows": rows,
        "metrics": replay_metrics(rows),
    }


def replay_metrics(rows: list[Record]) -> Record:
    metrics: Record = {}
    if not rows:
        return metrics
    for area, (size, k) in AREAS.items():
        hits = {
            f"{v}/{method}": [r["hits"][v][area][method] for r in rows]
            for v in VERSIONS
            for method in rows[0]["hits"][v][area]
        }
        mixed = np.asarray(hits["rolling-v2/mixed"], dtype=float)
        intervals = {
            key: paired_mean_difference(
                mixed, np.asarray(values, dtype=float), resamples=10000, seed=2026
            ).to_dict()
            for key, values in hits.items()
            if key != "rolling-v2/mixed"
        }
        probabilities: Record = {}
        for kind in ("raw", "adjusted", "uniform"):
            losses: list[float] = []
            bins = [{"count": 0, "wins": 0, "sum": 0.0, "draw_count": 0} for _ in range(10)]
            for row in rows:
                scores = (
                    [k / size] * size
                    if kind == "uniform"
                    else row["predictions"]["rolling-v2"]["areas"][area]["scores"][kind]
                )
                actual = row["actual"][area]
                winners = set(actual if isinstance(actual, (tuple, list)) else [actual])
                occupied = set()
                for number, p in enumerate(scores, 1):
                    y = int(number in winners)
                    losses.append((p - y) ** 2)
                    index = min(int(p * 10), 9)
                    bucket = bins[index]
                    bucket["count"] += 1
                    bucket["sum"] += p
                    bucket["wins"] += y
                    occupied.add(index)
                for index in occupied:
                    bins[index]["draw_count"] += 1
            probabilities[kind] = {"brier": mean(losses), "bins": bins}
        metrics[area] = {
            "hits": {key: mean(values) for key, values in hits.items()},
            "uniform_hits": k * k / size,
            "mixed_differences": intervals,
            "probabilities": probabilities,
        }
    return metrics


def verify_entry(root: Path, draws: list[DrawRecord], record: Record) -> None:
    protocol = RollingProtocol(root, record["version"])
    target = date.fromisoformat(record["target"])
    history = protocol.window(draws, target)
    if any(record.get(k) != v for k, v in protocol.identity.items()):
        raise ValueError("restore the archived predictor and configuration first")
    if record["environment"] != protocol.environment:
        raise ValueError("restore the archived runtime versions first")
    if digest(serialize_draws(history)) != record["input_sha256"]:
        raise ValueError("restore the recorded data snapshot first")
    restored = protocol.predict(history, target, protocol.version)
    if json.dumps(restored["areas"], sort_keys=True) != json.dumps(record["areas"], sort_keys=True):
        raise ValueError("restored picks or scores differ from archived entry")
