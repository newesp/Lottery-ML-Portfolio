from __future__ import annotations

import re
from pathlib import Path

from lottery_ml.experiments.config import load_feature_config
from lottery_ml.features.schema import feature_columns

ROOT = Path(__file__).parents[1]


def test_feature_column_count_matches_facts_formula() -> None:
    config_path = ROOT / "configs/features/v1.json"
    config = load_feature_config(config_path)

    # Formula from web/app/lib/facts.ts & forward-test-ledger.md §C3-4
    # frequency: 2 + 2 * rolling_windows + ewm_halflives
    # gap: 4, context: 19, cooccurrence: 3 (from schema.py)
    gap_count = 4
    context_count = 19
    cooccurrence_count = 3
    frequency_count = 2 + 2 * len(config.rolling_windows) + len(config.ewm_halflives)
    expected_full_count = frequency_count + gap_count + context_count + cooccurrence_count

    actual_columns = feature_columns("full", config)
    assert len(actual_columns) == expected_full_count
    assert expected_full_count == 46


def test_no_hardcoded_years_or_formatted_numbers_in_web_tsx() -> None:
    web_app_dir = ROOT / "web/app"
    tsx_files = list(web_app_dir.rglob("*.tsx"))
    assert tsx_files, "Expected to find .tsx files in web/app"

    year_pattern = re.compile(r"\b20\d{2}\b")
    comma_num_pattern = re.compile(r"\b\d{1,3}(,\d{3})+\b")

    violations: list[str] = []

    for file_path in tsx_files:
        content = file_path.read_text(encoding="utf-8")
        lines = content.splitlines()
        in_block_comment = False

        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()

            if "/*" in stripped and "*/" in stripped:
                stripped = re.sub(r"/\*.*?\*/", "", stripped)
            elif "/*" in stripped:
                in_block_comment = True
                continue
            elif "*/" in stripped:
                in_block_comment = False
                continue

            if in_block_comment:
                continue

            # Strip single-line comments
            line_clean = re.sub(r"//.*$", "", stripped)

            years = year_pattern.findall(line_clean)
            numbers = comma_num_pattern.findall(line_clean)

            if years or numbers:
                rel_path = file_path.relative_to(ROOT)
                violations.append(
                    f"{rel_path}:{line_num}: found years={years}, "
                    f"numbers={numbers} in line: {line.strip()}"
                )

    assert not violations, "Found hardcoded facts in web .tsx files:\n" + "\n".join(violations)
