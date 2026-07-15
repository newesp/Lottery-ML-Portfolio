from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import cast

from lottery_ml.data.fetch import FetchError, NfdClient
from lottery_ml.data.parser import ParseError
from lottery_ml.data.service import DatasetFileError, ingest_history
from lottery_ml.data.validation import DatasetValidationError

TAIPEI = timezone(timedelta(hours=8))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lottery-ml")
    commands = parser.add_subparsers(dest="command")
    ingest = commands.add_parser("ingest", help="fetch and publish verified lottery history")
    ingest.add_argument("--from-year", type=int, default=2008)
    ingest.add_argument("--through-year", type=int, default=datetime.now(TAIPEI).year)
    ingest.add_argument("--root", type=Path, default=Path.cwd())
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    if argv is not None and not argv:
        parser.print_usage(sys.stderr)
        return 2
    try:
        args = parser.parse_args(argv)
    except SystemExit as error:
        return cast(int, error.code)
    if args.command != "ingest":
        parser.print_usage(sys.stderr)
        return 2

    from_year = cast(int, args.from_year)
    through_year = cast(int, args.through_year)
    root = cast(Path, args.root)
    if from_year > through_year:
        print("lottery-ml: error: from-year must not exceed through-year", file=sys.stderr)
        return 2

    try:
        result = ingest_history(
            root=root,
            years=list(range(from_year, through_year + 1)),
            client=NfdClient(),
            fetched_at=datetime.now(TAIPEI),
            git_commit=_git_commit(root),
        )
    except (
        DatasetFileError,
        DatasetValidationError,
        FetchError,
        ParseError,
        OSError,
        ValueError,
    ) as error:
        print(str(error), file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "status": result.status,
                "sha256": result.sha256,
                "snapshot_path": str(result.snapshot_path) if result.snapshot_path else None,
                "manifest_path": str(result.manifest_path) if result.manifest_path else None,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


def _git_commit(root: Path) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "HEAD"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return "unknown"
    return result.stdout.strip() if result.returncode == 0 else "unknown"


def entrypoint() -> None:
    raise SystemExit(main())
