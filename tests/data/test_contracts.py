from datetime import UTC, date, datetime

import pytest

from lottery_ml.data.contracts import DrawRecord, SnapshotManifest


def test_draw_record_serializes_with_stable_fields() -> None:
    draw = DrawRecord(
        draw_id="2026-07-13",
        draw_date=date(2026, 7, 13),
        area1=(1, 5, 12, 19, 23, 38),
        area2=7,
    )

    assert draw.to_dict() == {
        "draw_id": "2026-07-13",
        "draw_date": "2026-07-13",
        "area1": [1, 5, 12, 19, 23, 38],
        "area2": 7,
    }


@pytest.mark.parametrize(
    ("area1", "area2"),
    [
        ((1, 1, 2, 3, 4, 5), 1),
        ((0, 1, 2, 3, 4, 5), 1),
        ((1, 2, 3, 4, 5, 39), 1),
        ((1, 2, 3, 4, 5, 6), 0),
        ((1, 2, 3, 4, 5, 6), 9),
    ],
)
def test_draw_record_rejects_invalid_number_ranges(
    area1: tuple[int, ...], area2: int
) -> None:
    with pytest.raises(ValueError):
        DrawRecord("bad", date(2026, 7, 13), area1, area2)


def test_manifest_serializes_verified_status() -> None:
    manifest = _manifest("verified")

    assert manifest.to_dict()["validation_status"] == "verified"


def test_manifest_rejects_non_verified_status() -> None:
    with pytest.raises(ValueError, match="validation_status must be verified"):
        _manifest("failed")


def _manifest(validation_status: str) -> SnapshotManifest:
    return SnapshotManifest(
        schema_version="1.0.0",
        fetched_at=datetime(2026, 7, 13, 13, 15, tzinfo=UTC),
        source_urls=("https://example.test/2026.htm",),
        sha256="a" * 64,
        draw_count=1,
        date_min=date(2026, 7, 13),
        date_max=date(2026, 7, 13),
        validation_status=validation_status,  # type: ignore[arg-type]
        corrections_applied=(),
        git_commit="unknown",
    )
