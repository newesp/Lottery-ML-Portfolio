# Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working subsystem: a tested Python CLI that fetches Taiwan Power Lottery history from NFD, validates it, writes immutable raw snapshots and manifests, and updates a canonical dataset only after all gates pass.

**Architecture:** Keep transport, parsing, validation, and storage independent. The fetch client returns raw bytes and metadata; the parser converts year-page HTML into typed draw records; validation compares a proposed dataset with the last verified canonical dataset; the publisher writes a new snapshot directory atomically and updates the canonical file only for a verified change. The CLI composes those ports and emits machine-readable status.

**Tech Stack:** Python 3.12+, standard-library dataclasses/JSON/hashlib/pathlib, Requests, Beautiful Soup 4, pytest, Ruff, mypy, setuptools.

## Global Constraints

- Source index: `https://www.nfd.com.tw/lottery/lottyear/year.htm`; year pages: `https://www.nfd.com.tw/lottery/power-38/{year}.htm`.
- Do not silently repair source anomalies. Corrections must come from a versioned registry and appear in the manifest.
- Existing historical draw values may not change unless an explicit registered correction matches the old and new values.
- A failed request, parse, or validation must not modify `data/processed/power-lottery.json`.
- Snapshot directories are append-only and use UTC-offset timestamps safe for Windows paths: `YYYYMMDDTHHMMSS+0800`.
- All JSON is UTF-8, stable-key ordered, newline terminated, and validated before publication.
- This phase provides a local CLI only. Scheduled GitHub Actions and GitHub Pages deployment belong to Phase 7.

---

## Task 1: Create the Python Package and Quality Gates

**Files:**

- Create: `pyproject.toml`
- Create: `src/lottery_ml/__init__.py`
- Create: `src/lottery_ml/cli.py`
- Create: `tests/test_cli.py`
- Modify: `.gitignore`

- [ ] **Step 1: Write a failing CLI smoke test**

```python
# tests/test_cli.py
from lottery_ml.cli import main


def test_main_without_command_prints_help(capsys) -> None:
    exit_code = main([])

    captured = capsys.readouterr()
    assert exit_code == 2
    assert "usage: lottery-ml" in captured.err
```

- [ ] **Step 2: Run the test and confirm the package does not exist**

Run: `python -m pytest tests/test_cli.py -q`

Expected: FAIL with `ModuleNotFoundError: No module named 'lottery_ml'`.

- [ ] **Step 3: Add the complete project configuration**

```toml
# pyproject.toml
[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.build_meta"

[project]
name = "lottery-ml-portfolio"
version = "0.1.0"
description = "Reproducible Taiwan Power Lottery ML case study"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
  "beautifulsoup4>=4.12,<5",
  "requests>=2.32,<3",
]

[project.optional-dependencies]
dev = [
  "mypy>=1.11,<2",
  "pytest>=8.3,<9",
  "ruff>=0.9,<1",
  "types-requests>=2.32,<3",
]

[project.scripts]
lottery-ml = "lottery_ml.cli:entrypoint"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
addopts = "-ra"
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.11"
strict = true
packages = ["lottery_ml"]
```

```python
# src/lottery_ml/__init__.py
"""Lottery ML Portfolio data and experiment tooling."""

__version__ = "0.1.0"
```

```python
# src/lottery_ml/cli.py
from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence


def build_parser() -> argparse.ArgumentParser:
    return argparse.ArgumentParser(prog="lottery-ml")


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    parser.parse_args(argv)
    parser.print_usage(sys.stderr)
    return 2


def entrypoint() -> None:
    raise SystemExit(main())
```

Add these generated/local paths to the existing `.gitignore` without removing existing entries:

```gitignore
.venv/
__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.egg-info/
dist/
build/
```

- [ ] **Step 4: Install the package and pass the smoke test**

Run: `python -m pip install -e ".[dev]"`

Run: `python -m pytest tests/test_cli.py -q`

Expected: PASS.

- [ ] **Step 5: Run initial static checks**

Run: `python -m ruff check .`

Run: `python -m mypy src`

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml .gitignore src/lottery_ml tests/test_cli.py
git commit -m "build: add Python package foundation"
```

## Task 2: Define the Canonical Draw and Manifest Contracts

**Files:**

- Create: `src/lottery_ml/data/__init__.py`
- Create: `src/lottery_ml/data/contracts.py`
- Create: `tests/data/test_contracts.py`

- [ ] **Step 1: Write contract tests first**

```python
# tests/data/test_contracts.py
from datetime import date, datetime, timezone

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


def test_manifest_requires_verified_status() -> None:
    manifest = SnapshotManifest(
        schema_version="1.0.0",
        fetched_at=datetime(2026, 7, 13, 13, 15, tzinfo=timezone.utc),
        source_urls=("https://example.test/2026.htm",),
        sha256="a" * 64,
        draw_count=1,
        date_min=date(2026, 7, 13),
        date_max=date(2026, 7, 13),
        validation_status="verified",
        corrections_applied=(),
        git_commit="unknown",
    )

    assert manifest.to_dict()["validation_status"] == "verified"
```

- [ ] **Step 2: Run tests and confirm missing contracts**

Run: `python -m pytest tests/data/test_contracts.py -q`

Expected: FAIL importing `lottery_ml.data.contracts`.

- [ ] **Step 3: Implement complete immutable contracts**

```python
# src/lottery_ml/data/__init__.py
"""Data ingestion, validation, and publication contracts."""
```

```python
# src/lottery_ml/data/contracts.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal


@dataclass(frozen=True, slots=True)
class DrawRecord:
    draw_id: str
    draw_date: date
    area1: tuple[int, ...]
    area2: int

    def __post_init__(self) -> None:
        if len(self.area1) != 6 or len(set(self.area1)) != 6:
            raise ValueError("area1 must contain six distinct numbers")
        if any(number < 1 or number > 38 for number in self.area1):
            raise ValueError("area1 numbers must be between 1 and 38")
        if self.area2 < 1 or self.area2 > 8:
            raise ValueError("area2 must be between 1 and 8")

    def to_dict(self) -> dict[str, object]:
        return {
            "draw_id": self.draw_id,
            "draw_date": self.draw_date.isoformat(),
            "area1": list(self.area1),
            "area2": self.area2,
        }


@dataclass(frozen=True, slots=True)
class SnapshotManifest:
    schema_version: str
    fetched_at: datetime
    source_urls: tuple[str, ...]
    sha256: str
    draw_count: int
    date_min: date
    date_max: date
    validation_status: Literal["verified"]
    corrections_applied: tuple[str, ...]
    git_commit: str

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "fetched_at": self.fetched_at.isoformat(),
            "source_urls": list(self.source_urls),
            "sha256": self.sha256,
            "draw_count": self.draw_count,
            "date_min": self.date_min.isoformat(),
            "date_max": self.date_max.isoformat(),
            "validation_status": self.validation_status,
            "corrections_applied": list(self.corrections_applied),
            "git_commit": self.git_commit,
        }
```

- [ ] **Step 4: Run tests and static checks**

Run: `python -m pytest tests/data/test_contracts.py -q`

Run: `python -m ruff check src tests`

Run: `python -m mypy src`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lottery_ml/data tests/data/test_contracts.py
git commit -m "feat: define lottery data contracts"
```

## Task 3: Parse NFD Year Pages with Versioned Fixtures

**Files:**

- Create: `src/lottery_ml/data/parser.py`
- Create: `tests/fixtures/nfd/power-38-2023.html`
- Create: `tests/fixtures/nfd/power-38-2026.html`
- Create: `tests/data/test_parser.py`

- [ ] **Step 1: Save minimal UTF-8 fixture excerpts**

Use copied, attribution-preserving table excerpts from the real 2023 and 2026 NFD pages. Each fixture must contain its original column headers plus at least two complete draw rows. Do not invent HTML structure; record retrieval date in an HTML comment.

- [ ] **Step 2: Write parser behavior tests**

```python
# tests/data/test_parser.py
from pathlib import Path

import pytest

from lottery_ml.data.parser import ParseError, parse_year_page

FIXTURES = Path(__file__).parents[1] / "fixtures" / "nfd"


@pytest.mark.parametrize("year", [2023, 2026])
def test_parse_year_page_reads_complete_draws(year: int) -> None:
    html = (FIXTURES / f"power-38-{year}.html").read_bytes()

    draws = parse_year_page(html, expected_year=year)

    assert len(draws) >= 2
    assert all(draw.draw_date.year == year for draw in draws)
    assert all(tuple(sorted(draw.area1)) == draw.area1 for draw in draws)


def test_parse_year_page_rejects_missing_results_table() -> None:
    with pytest.raises(ParseError, match="results table"):
        parse_year_page(b"<html><body>changed</body></html>", expected_year=2026)
```

- [ ] **Step 3: Run tests and confirm missing parser**

Run: `python -m pytest tests/data/test_parser.py -q`

Expected: FAIL importing `lottery_ml.data.parser`.

- [ ] **Step 4: Implement the parser against observed fixture structure**

Create:

```python
# src/lottery_ml/data/parser.py
from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup, Tag

from lottery_ml.data.contracts import DrawRecord


class ParseError(ValueError):
    """Raised when an NFD page no longer satisfies the expected table contract."""


def parse_year_page(html: bytes, expected_year: int) -> list[DrawRecord]:
    soup = BeautifulSoup(html, "html.parser")
    table = _find_results_table(soup)
    draws = [_parse_row(row, expected_year) for row in table.select("tr") if _is_draw_row(row)]
    if not draws:
        raise ParseError("results table contains no complete draw rows")
    by_id = {draw.draw_id: draw for draw in draws}
    if len(by_id) != len(draws):
        raise ParseError("results table contains duplicate draw dates")
    return sorted(draws, key=lambda draw: draw.draw_date)


def _find_results_table(soup: BeautifulSoup) -> Tag:
    for table in soup.select("table"):
        text = table.get_text(" ", strip=True)
        if "威力彩" in text and ("第一區" in text or "第1區" in text):
            return table
    raise ParseError("results table not found")


def _is_draw_row(row: Tag) -> bool:
    values = _integer_cells(row)
    return len(values) >= 9 and bool(_date_text(row))


def _parse_row(row: Tag, expected_year: int) -> DrawRecord:
    raw_date = _date_text(row)
    draw_date = _parse_roc_or_iso_date(raw_date)
    if draw_date.year != expected_year:
        raise ParseError(f"unexpected year in draw row: {raw_date}")
    values = _integer_cells(row)
    area1 = tuple(sorted(values[-7:-1]))
    area2 = values[-1]
    return DrawRecord(draw_date.isoformat(), draw_date, area1, area2)


def _date_text(row: Tag) -> str:
    for cell in row.select("td"):
        text = cell.get_text(" ", strip=True)
        if re.search(r"\d{2,4}[-/.]\d{1,2}[-/.]\d{1,2}", text):
            return text
    return ""


def _integer_cells(row: Tag) -> list[int]:
    values: list[int] = []
    for cell in row.select("td"):
        text = cell.get_text(" ", strip=True)
        if re.fullmatch(r"\d{1,3}", text):
            values.append(int(text))
    return values


def _parse_roc_or_iso_date(value: str) -> date:
    match = re.search(r"(\d{2,4})[-/.](\d{1,2})[-/.](\d{1,2})", value)
    if match is None:
        raise ParseError(f"unsupported draw date: {value}")
    year, month, day = (int(part) for part in match.groups())
    if year < 1911:
        year += 1911
    return date(year, month, day)
```

If fixture inspection shows different cell ordering, change `_parse_row` to explicit header-index mapping and update tests with exact expected records. Do not weaken the table or row detection to make a fixture pass.

- [ ] **Step 5: Add exact-value assertions from both real fixtures**

For the first and last row in each fixture, assert the exact ISO date, six Area 1 values, and Area 2 value. This locks down column mapping and prevents a plausible-but-wrong parse.

- [ ] **Step 6: Run tests and static checks**

Run: `python -m pytest tests/data/test_parser.py -q`

Run: `python -m ruff check src tests`

Run: `python -m mypy src`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lottery_ml/data/parser.py tests/fixtures/nfd tests/data/test_parser.py
git commit -m "feat: parse NFD power lottery history"
```

## Task 4: Add Fetch Transport and Retry Boundaries

**Files:**

- Create: `src/lottery_ml/data/fetch.py`
- Create: `tests/data/test_fetch.py`

- [ ] **Step 1: Write transport tests with a fake session**

```python
# tests/data/test_fetch.py
import pytest
import requests

from lottery_ml.data.fetch import FetchError, NfdClient


class FakeResponse:
    content = b"history"

    def raise_for_status(self) -> None:
        return None


class FakeSession:
    def get(self, url: str, *, timeout: tuple[float, float], headers: dict[str, str]) -> FakeResponse:
        assert url.endswith("/power-38/2026.htm")
        assert timeout == (5.0, 20.0)
        assert "Lottery-ML-Portfolio" in headers["User-Agent"]
        return FakeResponse()


def test_fetch_year_returns_source_bytes() -> None:
    client = NfdClient(session=FakeSession())  # type: ignore[arg-type]
    assert client.fetch_year(2026) == b"history"


class FailingSession:
    def get(self, url: str, *, timeout: tuple[float, float], headers: dict[str, str]) -> FakeResponse:
        raise requests.Timeout("slow")


def test_fetch_year_wraps_request_failure() -> None:
    client = NfdClient(session=FailingSession())  # type: ignore[arg-type]
    with pytest.raises(FetchError, match="2026"):
        client.fetch_year(2026)
```

- [ ] **Step 2: Run tests and confirm missing client**

Run: `python -m pytest tests/data/test_fetch.py -q`

Expected: FAIL importing `lottery_ml.data.fetch`.

- [ ] **Step 3: Implement the fetch client**

```python
# src/lottery_ml/data/fetch.py
from __future__ import annotations

from typing import Protocol

import requests

YEAR_URL = "https://www.nfd.com.tw/lottery/power-38/{year}.htm"
USER_AGENT = "Lottery-ML-Portfolio/0.1 (+https://github.com/newesp/Lottery-ML-Portfolio)"


class ResponseLike(Protocol):
    content: bytes

    def raise_for_status(self) -> None: ...


class SessionLike(Protocol):
    def get(
        self,
        url: str,
        *,
        timeout: tuple[float, float],
        headers: dict[str, str],
    ) -> ResponseLike: ...


class FetchError(RuntimeError):
    """Raised when source transport fails."""


class NfdClient:
    def __init__(self, session: SessionLike | None = None) -> None:
        self._session = session or requests.Session()

    def fetch_year(self, year: int) -> bytes:
        url = YEAR_URL.format(year=year)
        try:
            response = self._session.get(
                url,
                timeout=(5.0, 20.0),
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
        except requests.RequestException as error:
            raise FetchError(f"failed to fetch NFD year {year}: {error}") from error
        if not response.content:
            raise FetchError(f"NFD year {year} returned an empty response")
        return response.content
```

- [ ] **Step 4: Run tests and checks**

Run: `python -m pytest tests/data/test_fetch.py -q`

Run: `python -m ruff check src tests`

Run: `python -m mypy src`

Expected: all PASS. If `requests.Session` does not satisfy the protocol under strict mypy, introduce a thin concrete adapter; do not add ignores to production code.

- [ ] **Step 5: Commit**

```bash
git add src/lottery_ml/data/fetch.py tests/data/test_fetch.py
git commit -m "feat: add bounded NFD fetch client"
```

## Task 5: Validate Dataset History and Registered Corrections

**Files:**

- Create: `configs/data/corrections.json`
- Create: `src/lottery_ml/data/validation.py`
- Create: `tests/data/test_validation.py`

- [ ] **Step 1: Add an empty, versioned correction registry**

```json
{
  "schema_version": "1.0.0",
  "corrections": []
}
```

- [ ] **Step 2: Write validation tests**

```python
# tests/data/test_validation.py
from datetime import date

import pytest

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.validation import DatasetValidationError, validate_dataset


def draw(day: int, area2: int = 1) -> DrawRecord:
    value = date(2026, 7, day)
    return DrawRecord(value.isoformat(), value, (1, 2, 3, 4, 5, 6), area2)


def test_validate_dataset_accepts_append_only_history() -> None:
    result = validate_dataset([draw(6), draw(9)], previous=[draw(6)], corrections=[])
    assert result.corrections_applied == ()


def test_validate_dataset_rejects_historical_mutation() -> None:
    with pytest.raises(DatasetValidationError, match="historical mutation"):
        validate_dataset([draw(6, area2=2)], previous=[draw(6)], corrections=[])


def test_validate_dataset_rejects_non_increasing_dates() -> None:
    with pytest.raises(DatasetValidationError, match="strictly increasing"):
        validate_dataset([draw(9), draw(6)], previous=[], corrections=[])
```

- [ ] **Step 3: Run tests and confirm missing validator**

Run: `python -m pytest tests/data/test_validation.py -q`

Expected: FAIL importing `lottery_ml.data.validation`.

- [ ] **Step 4: Implement validation and an explicit correction type**

Implement `Correction` with `draw_id`, `old`, `new`, `reason`, and `source` fields; `ValidationResult` with `corrections_applied`; and a `validate_dataset` function taking `proposed: list[DrawRecord]`, keyword-only `previous: list[DrawRecord]`, and keyword-only `corrections: list[Correction]`, returning `ValidationResult`.

The complete behavior must:

1. reject an empty proposed dataset;
2. reject duplicate IDs and dates that are not strictly increasing;
3. rely on `DrawRecord` for number-range and uniqueness validation;
4. compare every prior draw by `draw_id`;
5. reject removed prior draw IDs;
6. reject changed prior values unless exactly one registry entry matches both serialized `old` and `new` records;
7. return the IDs of applied corrections in deterministic order;
8. reject unused correction entries so stale exceptions cannot silently accumulate.

- [ ] **Step 5: Extend tests for removal, duplicate IDs, exact correction match, and unused correction rejection**

Use full `DrawRecord.to_dict()` values in correction test inputs. Assert the specific draw ID is present in every error message.

- [ ] **Step 6: Run tests and checks**

Run: `python -m pytest tests/data/test_validation.py -q`

Run: `python -m ruff check src tests`

Run: `python -m mypy src`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add configs/data/corrections.json src/lottery_ml/data/validation.py tests/data/test_validation.py
git commit -m "feat: guard canonical lottery history"
```

## Task 6: Publish Immutable Snapshots Atomically

**Files:**

- Create: `src/lottery_ml/data/storage.py`
- Create: `tests/data/test_storage.py`

- [ ] **Step 1: Write storage tests using `tmp_path`**

Cover these cases:

- stable canonical JSON serialization and SHA-256;
- a verified new dataset creates `data/raw/snapshots/<timestamp>/power-lottery.json` and `data/manifests/<timestamp>.json`;
- snapshot and manifest paths are rejected if already present;
- unchanged content returns status `unchanged` and creates nothing;
- canonical replacement uses a temporary sibling followed by `Path.replace`;
- an injected write failure leaves the old canonical bytes untouched.

The public test interface is:

```python
result = publish_verified_dataset(
    root=tmp_path,
    draws=draws,
    fetched_at=fetched_at,
    source_urls=("https://example.test/2026.htm",),
    corrections_applied=(),
    git_commit="abc123",
)
assert result.status == "published"
```

- [ ] **Step 2: Run tests and confirm missing storage module**

Run: `python -m pytest tests/data/test_storage.py -q`

Expected: FAIL importing `lottery_ml.data.storage`.

- [ ] **Step 3: Implement deterministic serialization and publication**

Implement a frozen, slotted `PublicationResult` with `status: Literal["published", "unchanged"]`, `sha256: str`, `snapshot_path: Path | None`, and `manifest_path: Path | None`.

Implement `serialize_draws(draws: Sequence[DrawRecord]) -> bytes` with this complete body:

```python
def serialize_draws(draws: Sequence[DrawRecord]) -> bytes:
    payload = {
        "schema_version": "1.0.0",
        "draws": [draw.to_dict() for draw in draws],
    }
    return (json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode()
```

Expose `publish_verified_dataset` with keyword-only arguments `root: Path`, `draws: Sequence[DrawRecord]`, `fetched_at: datetime`, `source_urls: tuple[str, ...]`, `corrections_applied: tuple[str, ...]`, and `git_commit: str`, returning `PublicationResult`.

Publication order must be: serialize and hash in memory; detect unchanged canonical bytes; create a temporary staging directory under `data/raw`; write and re-read all staged files; atomically rename the snapshot directory; atomically publish the manifest; atomically replace the canonical file last. On any pre-canonical error, remove only the temporary staging path created by the current call.

- [ ] **Step 4: Run storage tests and checks**

Run: `python -m pytest tests/data/test_storage.py -q`

Run: `python -m ruff check src tests`

Run: `python -m mypy src`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lottery_ml/data/storage.py tests/data/test_storage.py
git commit -m "feat: publish immutable verified snapshots"
```

## Task 7: Compose the End-to-End Ingestion Service

**Files:**

- Create: `src/lottery_ml/data/service.py`
- Create: `tests/data/test_service.py`
- Modify: `src/lottery_ml/cli.py`
- Modify: `tests/test_cli.py`

- [ ] **Step 1: Write an integration test with fixture-backed fetches**

Create a fake client whose `fetch_year(year)` returns the matching fixture bytes. Test:

```python
result = ingest_history(
    root=tmp_path,
    years=[2023, 2026],
    client=fake_client,
    fetched_at=fixed_taipei_datetime,
    git_commit="abc123",
)
assert result.status == "published"
```

Assert chronological merged draws, source URL ordering, canonical creation, matching hashes, and manifest `validation_status == "verified"`. A second identical run must be `unchanged`. A malformed second-year fixture must raise and leave all prior bytes and directory entries unchanged.

- [ ] **Step 2: Run the integration test and confirm missing service**

Run: `python -m pytest tests/data/test_service.py -q`

Expected: FAIL importing `lottery_ml.data.service`.

- [ ] **Step 3: Implement the ingestion orchestration**

Expose `ingest_history` with keyword-only arguments `root: Path`, `years: Sequence[int]`, `client: NfdClient`, `fetched_at: datetime`, and `git_commit: str`, returning `PublicationResult`.

It must load the correction registry and prior canonical dataset, fetch and parse all requested years before any write, merge and sort records, validate against prior history, then call `publish_verified_dataset`. Reject duplicate records across pages. Add JSON decoding helpers for prior canonical and correction files with strict required-key checks.

- [ ] **Step 4: Add the real CLI command**

Update `build_parser()` with:

```text
lottery-ml ingest --from-year 2008 --through-year 2026 --root .
```

Default `--through-year` to the current Asia/Taipei year and `--root` to the current directory. Print one JSON object to stdout containing `status`, `sha256`, `snapshot_path`, and `manifest_path`. On a known fetch/parse/validation/storage error, print one concise message to stderr and return exit code 1; never print HTML response bodies.

- [ ] **Step 5: Extend CLI tests**

Monkeypatch the service boundary. Assert argument conversion, JSON stdout, exit code 0 for `published`/`unchanged`, exit code 1 and clean stderr for a known error, and exit code 2 for invalid arguments.

- [ ] **Step 6: Run all Python checks**

Run: `python -m pytest -q`

Run: `python -m ruff check .`

Run: `python -m mypy src`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lottery_ml/data/service.py src/lottery_ml/cli.py tests/data/test_service.py tests/test_cli.py
git commit -m "feat: add verified history ingestion command"
```

## Task 8: Document and Verify the Phase 1 Operator Flow

**Files:**

- Create: `docs/data-pipeline.md`
- Modify: `README.md`
- Create: `data/raw/snapshots/.gitkeep`
- Create: `data/manifests/.gitkeep`
- Create: `data/processed/.gitkeep`

- [ ] **Step 1: Document the complete local workflow**

`docs/data-pipeline.md` must explain in Traditional Chinese with English technical terms:

- NFD source URLs and ownership attribution;
- fetch → parse → validate → snapshot → canonical flow;
- why raw snapshots are immutable;
- every validation gate and what failure preserves;
- correction-registry review procedure;
- CLI examples for initial backfill and current-year refresh;
- manifest fields and reproducibility meaning;
- that scheduling and GitHub Pages deployment arrive in Phase 7.

- [ ] **Step 2: Add README quick start**

Add Python 3.12 setup, editable installation, test/lint/type commands, and:

```powershell
lottery-ml ingest --from-year 2008 --through-year 2026 --root .
```

Clearly label the project as an educational ML case study, not a lottery prediction claim.

- [ ] **Step 3: Run a fixture-backed integration verification**

Run: `python -m pytest tests/data/test_service.py -q`

Expected: PASS and no network access.

- [ ] **Step 4: Run the full quality gate from a clean process**

Run: `python -m pytest -q`

Run: `python -m ruff check .`

Run: `python -m mypy src`

Expected: all PASS with no skipped ingestion tests.

- [ ] **Step 5: Perform one opt-in live smoke test**

Run only when network use is approved:

```powershell
lottery-ml ingest --from-year 2026 --through-year 2026 --root .
```

Expected: exit 0, status `published` or `unchanged`, a manifest with `validation_status: verified`, and no unregistered historical changes. Inspect the first and latest draw against the NFD page. Do not commit generated data until provenance and licensing expectations are reviewed.

- [ ] **Step 6: Commit documentation and empty data layout**

```bash
git add README.md docs/data-pipeline.md data
git commit -m "docs: explain verified data ingestion"
```

## Phase 1 Completion Gate

Before claiming Phase 1 complete:

- [ ] `python -m pytest -q` passes.
- [ ] `python -m ruff check .` passes.
- [ ] `python -m mypy src` passes.
- [ ] A malformed page cannot alter the canonical dataset.
- [ ] A historical mutation requires an exact registered correction.
- [ ] Repeating identical ingestion produces `unchanged` and no new snapshot.
- [ ] Snapshot data hash matches the manifest and canonical bytes.
- [ ] No GitHub Actions schedule, Pages deployment, ML feature code, or web runtime has been prematurely added in this phase.
