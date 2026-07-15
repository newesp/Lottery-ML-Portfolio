import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from lottery_ml.data.fetch import YEAR_URL
from lottery_ml.data.parser import ParseError
from lottery_ml.data.service import ingest_history

FIXTURES = Path(__file__).parents[1] / "fixtures" / "nfd"
TAIPEI = timezone(timedelta(hours=8))


class FixtureClient:
    def __init__(self, pages: dict[int, bytes]) -> None:
        self.pages = pages
        self.requested_years: list[int] = []

    def fetch_year(self, year: int) -> bytes:
        self.requested_years.append(year)
        return self.pages[year]


def fixture_pages() -> dict[int, bytes]:
    return {
        year: (FIXTURES / f"power-38-{year}.html").read_bytes()
        for year in (2023, 2026)
    }


def initialize_root(root: Path) -> None:
    config = root / "configs/data/corrections.json"
    config.parent.mkdir(parents=True)
    config.write_text(
        json.dumps({"schema_version": "1.0.0", "corrections": []}),
        encoding="utf-8",
    )


def test_ingest_history_publishes_merged_verified_dataset(tmp_path: Path) -> None:
    initialize_root(tmp_path)
    client = FixtureClient(fixture_pages())

    result = ingest_history(
        root=tmp_path,
        years=[2026, 2023],
        client=client,
        fetched_at=datetime(2026, 7, 15, 21, 15, tzinfo=TAIPEI),
        git_commit="abc123",
    )

    assert result.status == "published"
    assert client.requested_years == [2023, 2026]
    canonical = json.loads((tmp_path / "data/processed/power-lottery.json").read_bytes())
    assert len(canonical["draws"]) == 8
    assert canonical["draws"][0]["draw_id"] == "2023-01-02"
    assert canonical["draws"][-1]["draw_id"] == "2026-07-13"
    manifest = json.loads(result.manifest_path.read_bytes())
    assert manifest["source_urls"] == [
        YEAR_URL.format(year=2023),
        YEAR_URL.format(year=2026),
    ]


def test_ingest_history_returns_unchanged_for_identical_data(tmp_path: Path) -> None:
    initialize_root(tmp_path)
    first = FixtureClient(fixture_pages())
    second = FixtureClient(fixture_pages())
    base_time = datetime(2026, 7, 15, 21, 15, tzinfo=TAIPEI)
    ingest_history(
        root=tmp_path,
        years=[2023, 2026],
        client=first,
        fetched_at=base_time,
        git_commit="abc123",
    )

    result = ingest_history(
        root=tmp_path,
        years=[2023, 2026],
        client=second,
        fetched_at=base_time + timedelta(days=1),
        git_commit="def456",
    )

    assert result.status == "unchanged"


def test_ingest_history_parse_failure_preserves_all_existing_files(tmp_path: Path) -> None:
    initialize_root(tmp_path)
    base_time = datetime(2026, 7, 15, 21, 15, tzinfo=TAIPEI)
    ingest_history(
        root=tmp_path,
        years=[2023, 2026],
        client=FixtureClient(fixture_pages()),
        fetched_at=base_time,
        git_commit="abc123",
    )
    before = _tree_state(tmp_path)
    bad_pages = fixture_pages()
    bad_pages[2026] = b"<html><body>changed</body></html>"

    with pytest.raises(ParseError, match="results table"):
        ingest_history(
            root=tmp_path,
            years=[2023, 2026],
            client=FixtureClient(bad_pages),
            fetched_at=base_time + timedelta(days=1),
            git_commit="def456",
        )

    assert _tree_state(tmp_path) == before


def _tree_state(root: Path) -> dict[str, bytes | None]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes() if path.is_file() else None
        for path in root.rglob("*")
    }
