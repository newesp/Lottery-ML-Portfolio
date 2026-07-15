from __future__ import annotations

import re
from datetime import date

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


def parse_year_page(html: bytes, expected_year: int) -> list[DrawRecord]:
    soup = BeautifulSoup(html, "html.parser")
    table, header_row, columns = _find_results_table(soup)
    rows = table.select("tr")
    header_index = rows.index(header_row)
    draws = [
        _parse_row(row, columns, expected_year)
        for row in rows[header_index + 1 :]
        if row.select("th,td")
    ]
    if not draws:
        raise ParseError("results table contains no complete draw rows")

    draw_ids = [draw.draw_id for draw in draws]
    if len(set(draw_ids)) != len(draw_ids):
        raise ParseError("results table contains duplicate draw dates")
    return sorted(draws, key=lambda draw: draw.draw_date)


def _find_results_table(soup: BeautifulSoup) -> tuple[Tag, Tag, dict[str, int]]:
    for table in soup.select("table"):
        for row in table.select("tr"):
            headers = [_normalize(cell.get_text(" ", strip=True)) for cell in row.select("th,td")]
            columns = {header: index for index, header in enumerate(headers)}
            if all(header in columns for header in REQUIRED_HEADERS):
                return table, row, columns
    raise ParseError("results table not found")


def _parse_row(row: Tag, columns: dict[str, int], expected_year: int) -> DrawRecord:
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
        area2 = int(_cell(cells, columns, "特號"))
        return DrawRecord(draw_date.isoformat(), draw_date, area1, area2)
    except ValueError as error:
        raise ParseError(f"invalid values in draw row for {date_text}: {error}") from error


def _cell(cells: list[Tag], columns: dict[str, int], header: str) -> str:
    return _normalize(cells[columns[header]].get_text(" ", strip=True))


def _normalize(value: str) -> str:
    return "".join(value.split())
