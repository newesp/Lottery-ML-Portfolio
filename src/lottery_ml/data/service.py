from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import date, datetime
from pathlib import Path
from typing import Protocol, cast

from lottery_ml.data.contracts import DrawRecord
from lottery_ml.data.fetch import YEAR_URL
from lottery_ml.data.parser import parse_year_page
from lottery_ml.data.storage import PublicationResult, publish_verified_dataset
from lottery_ml.data.validation import Correction, validate_dataset


class DatasetFileError(ValueError):
    """Raised when a versioned data or correction file has an invalid schema."""


class YearFetcher(Protocol):
    def fetch_year(self, year: int) -> bytes: ...


def ingest_history(
    *,
    root: Path,
    years: Sequence[int],
    client: YearFetcher,
    fetched_at: datetime,
    git_commit: str,
) -> PublicationResult:
    ordered_years = sorted(years)
    if not ordered_years:
        raise ValueError("years must not be empty")
    if len(set(ordered_years)) != len(ordered_years):
        raise ValueError("years must not contain duplicates")

    proposed: list[DrawRecord] = []
    source_urls: list[str] = []
    for year in ordered_years:
        html = client.fetch_year(year)
        proposed.extend(parse_year_page(html, expected_year=year))
        source_urls.append(YEAR_URL.format(year=year))
    proposed.sort(key=lambda draw: draw.draw_date)

    previous = _load_canonical(root / "data/processed/power-lottery.json")
    corrections = _load_corrections(root / "configs/data/corrections.json")
    validation = validate_dataset(
        proposed,
        previous=previous,
        corrections=corrections,
    )
    return publish_verified_dataset(
        root=root,
        draws=proposed,
        fetched_at=fetched_at,
        source_urls=tuple(source_urls),
        corrections_applied=validation.corrections_applied,
        git_commit=git_commit,
    )


def _load_canonical(path: Path) -> list[DrawRecord]:
    if not path.exists():
        return []
    payload = _load_json_object(path)
    _require_exact_keys(payload, {"schema_version", "draws"}, path)
    if payload["schema_version"] != "1.0.0":
        raise DatasetFileError(f"unsupported canonical schema in {path}")
    raw_draws = payload["draws"]
    if not isinstance(raw_draws, list):
        raise DatasetFileError(f"draws must be a list in {path}")
    return [_decode_draw(item, path) for item in raw_draws]


def _load_corrections(path: Path) -> list[Correction]:
    if not path.exists():
        raise DatasetFileError(f"correction registry is missing: {path}")
    payload = _load_json_object(path)
    _require_exact_keys(payload, {"schema_version", "corrections"}, path)
    if payload["schema_version"] != "1.0.0":
        raise DatasetFileError(f"unsupported correction schema in {path}")
    raw_corrections = payload["corrections"]
    if not isinstance(raw_corrections, list):
        raise DatasetFileError(f"corrections must be a list in {path}")

    corrections: list[Correction] = []
    for item in raw_corrections:
        raw = _as_string_dict(item, path)
        _require_exact_keys(raw, {"draw_id", "old", "new", "reason", "source"}, path)
        draw_id = _required_string(raw, "draw_id", path)
        reason = _required_string(raw, "reason", path)
        source = _required_string(raw, "source", path)
        old = _as_string_dict(raw["old"], path)
        new = _as_string_dict(raw["new"], path)
        corrections.append(Correction(draw_id, old, new, reason, source))
    return corrections


def _decode_draw(value: object, path: Path) -> DrawRecord:
    raw = _as_string_dict(value, path)
    _require_exact_keys(raw, {"draw_id", "draw_date", "area1", "area2"}, path)
    draw_id = _required_string(raw, "draw_id", path)
    draw_date_text = _required_string(raw, "draw_date", path)
    area1_raw = raw["area1"]
    area2_raw = raw["area2"]
    if not isinstance(area1_raw, list) or not all(
        isinstance(number, int) and not isinstance(number, bool) for number in area1_raw
    ):
        raise DatasetFileError(f"area1 must be an integer list in {path}")
    if not isinstance(area2_raw, int) or isinstance(area2_raw, bool):
        raise DatasetFileError(f"area2 must be an integer in {path}")
    try:
        draw_date = date.fromisoformat(draw_date_text)
        area1 = tuple(cast(list[int], area1_raw))
        return DrawRecord(draw_id, draw_date, area1, area2_raw)
    except ValueError as error:
        raise DatasetFileError(f"invalid draw in {path}: {draw_id}: {error}") from error


def _load_json_object(path: Path) -> dict[str, object]:
    try:
        value: object = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise DatasetFileError(f"cannot read JSON file {path}: {error}") from error
    return _as_string_dict(value, path)


def _as_string_dict(value: object, path: Path) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise DatasetFileError(f"expected a JSON object with string keys in {path}")
    return cast(dict[str, object], value)


def _require_exact_keys(value: dict[str, object], expected: set[str], path: Path) -> None:
    if set(value) != expected:
        raise DatasetFileError(f"unexpected keys in {path}: {sorted(value)}")


def _required_string(value: dict[str, object], key: str, path: Path) -> str:
    result = value[key]
    if not isinstance(result, str) or not result:
        raise DatasetFileError(f"{key} must be a non-empty string in {path}")
    return result
