import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.storage import publish_verified_dataset, serialize_draws

TAIPEI = timezone(timedelta(hours=8))


def draw(day: int, area2: int = 1) -> DrawRecord:
    value = date(2026, 7, day)
    return DrawRecord(value.isoformat(), value, (1, 2, 3, 4, 5, 6), area2)


def fetched_at(day: int = 13) -> datetime:
    return datetime(2026, 7, day, 21, 15, tzinfo=TAIPEI)


def publish(root: Path, draws: list[DrawRecord], *, day: int = 13):
    return publish_verified_dataset(
        root=root,
        draws=draws,
        fetched_at=fetched_at(day),
        source_urls=("https://example.test/2026.htm",),
        corrections_applied=(),
        git_commit="abc123",
    )


def test_serialize_draws_is_stable_utf8_json() -> None:
    payload = serialize_draws([draw(6), draw(9)])

    assert payload.endswith(b"\n")
    assert json.loads(payload) == {
        "draws": [draw(6).to_dict(), draw(9).to_dict()],
        "schema_version": "1.0.0",
    }


def test_publish_creates_snapshot_manifest_and_canonical_dataset(tmp_path: Path) -> None:
    result = publish(tmp_path, [draw(6), draw(9)])

    expected_snapshot = (
        tmp_path
        / "data/raw/snapshots/20260713T211500+0800/power-lottery.json"
    )
    expected_manifest = tmp_path / "data/manifests/20260713T211500+0800.json"
    canonical = tmp_path / "data/processed/power-lottery.json"
    assert result.status == "published"
    assert result.snapshot_path == expected_snapshot
    assert result.manifest_path == expected_manifest
    assert expected_snapshot.read_bytes() == canonical.read_bytes()
    assert result.sha256 == hashlib.sha256(canonical.read_bytes()).hexdigest()

    manifest = json.loads(expected_manifest.read_bytes())
    assert manifest["validation_status"] == "verified"
    assert manifest["sha256"] == result.sha256
    assert manifest["draw_count"] == 2
    assert manifest["date_min"] == "2026-07-06"
    assert manifest["date_max"] == "2026-07-09"


def test_publish_unchanged_creates_no_new_snapshot(tmp_path: Path) -> None:
    first = publish(tmp_path, [draw(6)], day=13)
    second = publish(tmp_path, [draw(6)], day=14)

    assert first.status == "published"
    assert second.status == "unchanged"
    assert second.snapshot_path is None
    assert second.manifest_path is None
    assert not (tmp_path / "data/raw/snapshots/20260714T211500+0800").exists()


def test_publish_rejects_existing_snapshot_path(tmp_path: Path) -> None:
    publish(tmp_path, [draw(6)], day=13)
    collision = tmp_path / "data/raw/snapshots/20260714T211500+0800"
    collision.mkdir(parents=True)

    with pytest.raises(FileExistsError, match="snapshot path"):
        publish(tmp_path, [draw(6), draw(9)], day=14)


def test_publish_failure_keeps_old_canonical_and_rolls_back(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    publish(tmp_path, [draw(6)], day=13)
    canonical = tmp_path / "data/processed/power-lottery.json"
    old_bytes = canonical.read_bytes()
    original_replace = Path.replace

    def fail_canonical_replace(path: Path, target: Path) -> Path:
        if Path(target) == canonical:
            raise OSError("injected canonical failure")
        return original_replace(path, target)

    monkeypatch.setattr(Path, "replace", fail_canonical_replace)

    with pytest.raises(OSError, match="injected canonical failure"):
        publish(tmp_path, [draw(6), draw(9)], day=14)

    assert canonical.read_bytes() == old_bytes
    assert not (tmp_path / "data/raw/snapshots/20260714T211500+0800").exists()
    assert not (tmp_path / "data/manifests/20260714T211500+0800.json").exists()
