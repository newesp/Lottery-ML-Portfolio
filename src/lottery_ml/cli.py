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
