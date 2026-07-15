from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from lottery_ml.data.contracts import DrawRecord, SnapshotManifest


@dataclass(frozen=True, slots=True)
class PublicationResult:
    status: Literal["published", "unchanged"]
    sha256: str
    snapshot_path: Path | None
    manifest_path: Path | None


def serialize_draws(draws: Sequence[DrawRecord]) -> bytes:
    payload = {
        "schema_version": "1.0.0",
        "draws": [draw.to_dict() for draw in draws],
    }
    return _serialize_json(payload)


def publish_verified_dataset(
    *,
    root: Path,
    draws: Sequence[DrawRecord],
    fetched_at: datetime,
    source_urls: tuple[str, ...],
    corrections_applied: tuple[str, ...],
    git_commit: str,
) -> PublicationResult:
    if not draws:
        raise ValueError("cannot publish an empty dataset")
    if fetched_at.utcoffset() is None:
        raise ValueError("fetched_at must include a UTC offset")

    dataset_bytes = serialize_draws(draws)
    digest = hashlib.sha256(dataset_bytes).hexdigest()
    canonical_path = root / "data/processed/power-lottery.json"
    if canonical_path.exists() and canonical_path.read_bytes() == dataset_bytes:
        return PublicationResult("unchanged", digest, None, None)

    stamp = fetched_at.strftime("%Y%m%dT%H%M%S%z")
    snapshot_dir = root / "data/raw/snapshots" / stamp
    snapshot_path = snapshot_dir / "power-lottery.json"
    manifest_path = root / "data/manifests" / f"{stamp}.json"
    if snapshot_dir.exists():
        raise FileExistsError(f"snapshot path already exists: {snapshot_dir}")
    if manifest_path.exists():
        raise FileExistsError(f"manifest path already exists: {manifest_path}")

    manifest = SnapshotManifest(
        schema_version="1.0.0",
        fetched_at=fetched_at,
        source_urls=source_urls,
        sha256=digest,
        draw_count=len(draws),
        date_min=min(draw.draw_date for draw in draws),
        date_max=max(draw.draw_date for draw in draws),
        validation_status="verified",
        corrections_applied=corrections_applied,
        git_commit=git_commit,
    )
    manifest_bytes = _serialize_json(manifest.to_dict())

    snapshot_dir.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    canonical_path.parent.mkdir(parents=True, exist_ok=True)
    transaction_parent = root / "data/.transactions"
    transaction_parent.mkdir(parents=True, exist_ok=True)
    transaction = Path(tempfile.mkdtemp(prefix=f"publish-{stamp}-", dir=transaction_parent))
    staged_snapshot_dir = transaction / "snapshot"
    staged_snapshot_dir.mkdir()
    staged_snapshot = staged_snapshot_dir / "power-lottery.json"
    staged_manifest = transaction / "manifest.json"
    staged_canonical = transaction / "canonical.json"

    created_snapshot = False
    created_manifest = False
    canonical_published = False
    try:
        staged_snapshot.write_bytes(dataset_bytes)
        staged_manifest.write_bytes(manifest_bytes)
        staged_canonical.write_bytes(dataset_bytes)
        if staged_snapshot.read_bytes() != dataset_bytes:
            raise OSError("staged snapshot verification failed")
        if staged_manifest.read_bytes() != manifest_bytes:
            raise OSError("staged manifest verification failed")
        if staged_canonical.read_bytes() != dataset_bytes:
            raise OSError("staged canonical verification failed")

        staged_snapshot_dir.replace(snapshot_dir)
        created_snapshot = True
        staged_manifest.replace(manifest_path)
        created_manifest = True
        staged_canonical.replace(canonical_path)
        canonical_published = True
    except Exception:
        if not canonical_published:
            if created_manifest:
                manifest_path.unlink(missing_ok=True)
            if created_snapshot:
                shutil.rmtree(snapshot_dir, ignore_errors=True)
        raise
    finally:
        shutil.rmtree(transaction, ignore_errors=True)

    return PublicationResult("published", digest, snapshot_path, manifest_path)


def _serialize_json(payload: object) -> bytes:
    text = json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2)
    return f"{text}\n".encode()
