from pathlib import Path

import pytest

from lottery_ml.data.parser import ParseError, parse_year_page

FIXTURES = Path(__file__).parents[1] / "fixtures" / "nfd"


@pytest.mark.parametrize(
    ("year", "first_expected", "last_expected"),
    [
        (
            2023,
            {
                "draw_id": "2023-01-02",
                "draw_date": "2023-01-02",
                "area1": [3, 4, 5, 27, 28, 35],
                "area2": 8,
            },
            {
                "draw_id": "2023-12-28",
                "draw_date": "2023-12-28",
                "area1": [7, 8, 18, 20, 23, 31],
                "area2": 8,
            },
        ),
        (
            2026,
            {
                "draw_id": "2026-01-01",
                "draw_date": "2026-01-01",
                "area1": [7, 14, 22, 23, 31, 35],
                "area2": 1,
            },
            {
                "draw_id": "2026-07-13",
                "draw_date": "2026-07-13",
                "area1": [11, 24, 29, 32, 35, 38],
                "area2": 6,
            },
        ),
    ],
)
def test_parse_year_page_maps_real_nfd_columns(
    year: int,
    first_expected: dict[str, object],
    last_expected: dict[str, object],
) -> None:
    html = (FIXTURES / f"power-38-{year}.html").read_bytes()

    draws = parse_year_page(html, expected_year=year)

    assert len(draws) == 4
    assert draws[0].to_dict() == first_expected
    assert draws[-1].to_dict() == last_expected


def test_parse_year_page_rejects_missing_results_table() -> None:
    with pytest.raises(ParseError, match="results table"):
        parse_year_page(b"<html><body>changed</body></html>", expected_year=2026)
