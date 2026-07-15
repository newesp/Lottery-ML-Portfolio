from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Literal

from bs4 import BeautifulSoup, Tag

from lottery_ml.data.contracts import DrawRecord

REQUIRED_HEADERS = (
    "年份",
    "日期",
    "球號1",
    "球號2",
    "球號3",
    "球號4",
    "球號5",
    "球號6",
    "特號",
)


class ParseError(ValueError):
    """Raised when an NFD page does not satisfy the expected table contract."""


@dataclass(frozen=True, slots=True)
class SourceCorrection:
    correction_id: str
    draw_id: str
    field: Literal["area2"]
    old: int
    new: int
    reason: str
    sources: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ParsedYear:
    draws: tuple[DrawRecord, ...]
    corrections_applied: tuple[str, ...]


def parse_year_page(html: bytes, expected_year: int) -> list[DrawRecord]:
    return list(parse_year_page_report(html, expected_year=expected_year).draws)


def parse_year_page_report(
    html: bytes,
    *,
    expected_year: int,
    source_corrections: Sequence[SourceCorrection] = (),
) -> ParsedYear:
    soup = BeautifulSoup(html, "html.parser")
    table, header_row, columns = _find_results_table(soup)
    rows = table.select("tr")
    header_index = rows.index(header_row)
    parsed_rows = [
        _parse_row(row, columns, expected_year, source_corrections)
        for row in rows[header_index + 1 :]
        if row.select("th,td")
    ]
    draws = [draw for draw, _ in parsed_rows]
    if not draws:
        raise ParseError("results table contains no complete draw rows")

    draw_ids = [draw.draw_id for draw in draws]
    if len(set(draw_ids)) != len(draw_ids):
        raise ParseError("results table contains duplicate draw dates")
    ordered_draws = tuple(sorted(draws, key=lambda draw: draw.draw_date))
    applied = tuple(sorted(item for _, item in parsed_rows if item is not None))
    return ParsedYear(ordered_draws, applied)


def _find_results_table(soup: BeautifulSoup) -> tuple[Tag, Tag, dict[str, int]]:
    for table in soup.select("table"):
        for row in table.select("tr"):
            headers = [_normalize(cell.get_text(" ", strip=True)) for cell in row.select("th,td")]
            columns = {header: index for index, header in enumerate(headers)}
            if all(header in columns for header in REQUIRED_HEADERS):
                return table, row, columns
    raise ParseError("results table not found")


def _parse_row(
    row: Tag,
    columns: dict[str, int],
    expected_year: int,
    source_corrections: Sequence[SourceCorrection],
) -> tuple[DrawRecord, str | None]:
    cells = row.select("th,td")
    required_index = max(columns[header] for header in REQUIRED_HEADERS)
    if len(cells) <= required_index:
        raise ParseError("results table contains an incomplete draw row")

    year_text = _cell(cells, columns, "年份")
    try:
        source_year = int(year_text)
    except ValueError as error:
        raise ParseError(f"invalid year in draw row: {year_text}") from error
    if source_year != expected_year:
        raise ParseError(f"unexpected year in draw row: {source_year}")

    date_text = _cell(cells, columns, "日期")
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})", date_text)
    if match is None:
        raise ParseError(f"unsupported draw date: {date_text}")
    month, day = (int(part) for part in match.groups())

    try:
        draw_date = date(expected_year, month, day)
        area1 = tuple(sorted(int(_cell(cells, columns, f"球號{number}")) for number in range(1, 7)))
        raw_area2 = int(_cell(cells, columns, "特號"))
        area2, correction_id = _apply_area2_correction(
            draw_date.isoformat(),
            raw_area2,
            source_corrections,
        )
        return DrawRecord(draw_date.isoformat(), draw_date, area1, area2), correction_id
    except ValueError as error:
        raise ParseError(f"invalid values in draw row for {date_text}: {error}") from error


def _apply_area2_correction(
    draw_id: str,
    raw_area2: int,
    source_corrections: Sequence[SourceCorrection],
) -> tuple[int, str | None]:
    matches = [
        correction
        for correction in source_corrections
        if correction.draw_id == draw_id
        and correction.field == "area2"
        and correction.old == raw_area2
    ]
    if len(matches) > 1:
        raise ParseError(f"multiple source corrections match: {draw_id}")
    if not matches:
        return raw_area2, None
    correction = matches[0]
    return correction.new, correction.correction_id


def _cell(cells: list[Tag], columns: dict[str, int], header: str) -> str:
    return _normalize(cells[columns[header]].get_text(" ", strip=True))


def _normalize(value: str) -> str:
    return "".join(value.split())
