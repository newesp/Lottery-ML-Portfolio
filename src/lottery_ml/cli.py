from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections.abc import Sequence
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, cast

from lottery_ml.data.fetch import FetchError, NfdClient
from lottery_ml.data.parser import ParseError
from lottery_ml.data.service import DatasetFileError, ingest_history, load_canonical
from lottery_ml.data.validation import DatasetValidationError
from lottery_ml.experiments.artifacts import ArtifactError, write_json_artifact
from lottery_ml.experiments.config import (
    ConfigError,
    load_experiment_config,
    load_feature_config,
)
from lottery_ml.experiments.holdout import (
    SelectionError,
    load_selection,
    run_holdout_evaluation,
)
from lottery_ml.experiments.runner import run_development_matrix
from lottery_ml.forward.ledger import (
    ForwardError,
    build_summary,
    create_entry,
    load_ledger_entries,
)
from lottery_ml.forward.schedule import next_draw_date

TAIPEI = timezone(timedelta(hours=8))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="lottery-ml")
    commands = parser.add_subparsers(dest="command")
    ingest = commands.add_parser("ingest", help="fetch and publish verified lottery history")
    ingest.add_argument("--from-year", type=int, default=2008)
    ingest.add_argument("--through-year", type=int, default=datetime.now(TAIPEI).year)
    ingest.add_argument("--root", type=Path, default=Path.cwd())
    experiments = commands.add_parser("experiments", help="run reproducible experiments")
    experiment_commands = experiments.add_subparsers(dest="experiment_command")
    development = experiment_commands.add_parser(
        "development", help="run time-series cross-validation matrix"
    )
    development.add_argument("--root", type=Path, default=Path.cwd())
    development.add_argument(
        "--config", type=Path, default=Path("configs/experiments/development-v1.json")
    )
    development.add_argument(
        "--output", type=Path, default=Path("artifacts/experiments/development-v1.json")
    )
    holdout = experiment_commands.add_parser(
        "holdout", help="evaluate the frozen model selection on the locked holdout"
    )
    holdout.add_argument("--root", type=Path, default=Path.cwd())
    holdout.add_argument(
        "--selection", type=Path, default=Path("configs/experiments/selection-v1.json")
    )
    holdout.add_argument(
        "--output", type=Path, default=None
    )
    holdout.add_argument(
        "--version", type=str, default="1.1", choices=["1.0", "1.1"]
    )
    holdout.add_argument(
        "--through-date", type=str, default="2026-07-13"
    )
    forward = commands.add_parser("forward", help="manage forward test predictions")
    forward_commands = forward.add_subparsers(dest="forward_command")
    f_predict = forward_commands.add_parser(
        "predict", help="predict next draw and record to ledger"
    )
    f_predict.add_argument("--root", type=Path, default=Path.cwd())
    f_summarize = forward_commands.add_parser(
        "summarize", help="rebuild summary from ledger"
    )
    f_summarize.add_argument("--root", type=Path, default=Path.cwd())
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
    if args.command == "experiments" and args.experiment_command == "development":
        return _run_development(args)
    if args.command == "experiments" and args.experiment_command == "holdout":
        return _run_holdout(args)
    if args.command == "forward" and args.forward_command == "predict":
        return _run_forward_predict(args)
    if args.command == "forward" and args.forward_command == "summarize":
        return _run_forward_summarize(args)
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


def _run_development(args: argparse.Namespace) -> int:
    root = cast(Path, args.root).resolve()
    config_path = cast(Path, args.config)
    if not config_path.is_absolute():
        config_path = root / config_path
    output_path = cast(Path, args.output)
    if not output_path.is_absolute():
        output_path = root / output_path
    try:
        config = load_experiment_config(config_path)
        feature_path = config.feature_config
        if not feature_path.is_absolute():
            feature_path = root / feature_path
        feature_config = load_feature_config(feature_path)
        draws = load_canonical(root / "data/processed/power-lottery.json")
        if not draws:
            raise DatasetFileError("canonical lottery history is empty")
        report = run_development_matrix(draws, config, feature_config)
        write_json_artifact(output_path, report.to_dict())
    except (ArtifactError, ConfigError, DatasetFileError, OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(
        json.dumps(
            {"status": "completed", "artifact_path": str(output_path)},
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


def _run_holdout(args: argparse.Namespace) -> int:
    root = cast(Path, args.root).resolve()
    selection_path = cast(Path, args.selection)
    if not selection_path.is_absolute():
        selection_path = root / selection_path
    version = getattr(args, "version", "1.1")
    output_path = getattr(args, "output", None)
    if output_path is None:
        filename = "holdout-v1.1.json" if version == "1.1" else "holdout-v1.json"
        output_path = root / "artifacts/experiments" / filename
    elif not output_path.is_absolute():
        output_path = root / output_path
    try:
        selection = load_selection(selection_path, root)
        feature_config = load_feature_config(root / "configs/features/v1.json")
        draws = load_canonical(root / "data/processed/power-lottery.json")
        if not draws:
            raise DatasetFileError("canonical lottery history is empty")
        through_date_str = getattr(args, "through_date", "2026-07-13")
        if through_date_str and through_date_str.lower() != "none":
            through_date = date.fromisoformat(through_date_str)
            draws = [d for d in draws if not hasattr(d, "draw_date") or d.draw_date <= through_date]
        try:
            report = run_holdout_evaluation(draws, selection, feature_config, version=version)
        except TypeError:
            report = run_holdout_evaluation(draws, selection, feature_config)
        write_json_artifact(output_path, report.to_dict())
    except (
        ArtifactError,
        ConfigError,
        DatasetFileError,
        SelectionError,
        OSError,
        ValueError,
    ) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(
        json.dumps(
            {"status": "completed", "artifact_path": str(output_path)},
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


def _run_forward_predict(args: argparse.Namespace) -> int:
    root = cast(Path, args.root).resolve()
    try:
        selection_path = root / "configs/experiments/selection-v1.json"
        feature_config_path = root / "configs/features/v1.json"
        selection = load_selection(selection_path, root)
        feature_config = load_feature_config(feature_config_path)
        draws = load_canonical(root / "data/processed/power-lottery.json")
        if not draws:
            raise DatasetFileError("canonical lottery history is empty")

        result = create_entry(
            root=root,
            draws=draws,
            selection=selection,
            feature_config=feature_config,
            selection_path=selection_path,
            feature_config_path=feature_config_path,
        )
        _write_step_summary(root, result)
    except (
        ArtifactError,
        ConfigError,
        DatasetFileError,
        ForwardError,
        SelectionError,
        OSError,
        ValueError,
    ) as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


def _run_forward_summarize(args: argparse.Namespace) -> int:
    root = cast(Path, args.root).resolve()
    try:
        draws = load_canonical(root / "data/processed/power-lottery.json")
        if not draws:
            raise DatasetFileError("canonical lottery history is empty")
        ledger_path = root / "artifacts/forward/ledger.jsonl"
        summary_path = root / "artifacts/forward/summary.json"
        entries = load_ledger_entries(ledger_path) if ledger_path.exists() else []
        summary = build_summary(entries, draws)
        write_json_artifact(summary_path, summary)

        cutoff = draws[-1]
        target_date = next_draw_date(cutoff.draw_date)
        result = {
            "status": "summarized",
            "ledger_path": str(ledger_path),
            "summary_path": str(summary_path),
            "cutoff_draw_id": cutoff.draw_id,
            "assumed_target_date": target_date.isoformat(),
        }
        _write_step_summary(root, result)
    except (
        ArtifactError,
        DatasetFileError,
        ForwardError,
        OSError,
        ValueError,
    ) as error:
        print(str(error), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


def _write_step_summary(root: Path, result: dict[str, Any]) -> None:
    summary_env = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_env:
        return
    summary_path = Path(summary_env)
    json_summary_path = Path(str(result["summary_path"]))
    if not json_summary_path.exists():
        return
    try:
        data = json.loads(json_summary_path.read_text(encoding="utf-8"))
        pending = data.get("latest_pending")
        entries = data.get("entries", [])
        resolved = [e for e in entries if e.get("status") == "resolved"]
        last_resolved = resolved[-1] if resolved else None

        lines = [
            "### 🔮 Forward Test Prediction (前瞻盲測)",
            "",
            f"- **Target Draw Date**: `{result['assumed_target_date']}`",
            f"- **Cutoff Draw ID**: `{result['cutoff_draw_id']}`",
            f"- **Status**: `{result['status']}`",
            "",
        ]

        if pending:
            p_model = pending["predictions"]["model"]
            p_hf = pending["predictions"]["historical_frequency"]
            m_a1 = ", ".join(f"{n:02d}" for n in p_model["area1"]["picks"])
            m_a2 = f"{p_model['area2']['picks'][0]:02d}"
            hf_a1 = ", ".join(f"{n:02d}" for n in p_hf["area1"]["picks"])
            hf_a2 = f"{p_hf['area2']['picks'][0]:02d}"

            lines.extend(
                [
                    "#### Upcoming Draw Predictions",
                    "",
                    "| Model / Baseline | Area 1 (第一區) | Area 2 (第二區) |",
                    "|---|---|---|",
                    f"| Selection-v1 Model Ensemble | `{m_a1}` | `{m_a2}` |",
                    f"| Historical Frequency Baseline | `{hf_a1}` | `{hf_a2}` |",
                    "",
                ]
            )

        if last_resolved and last_resolved.get("actual") and last_resolved.get("hits"):
            act_a1 = ", ".join(f"{n:02d}" for n in last_resolved["actual"]["area1"])
            act_a2 = f"{last_resolved['actual']['area2']:02d}"
            m_h1 = last_resolved["hits"]["model"]["area1"]
            m_h2 = last_resolved["hits"]["model"]["area2"]
            hf_h1 = last_resolved["hits"]["historical_frequency"]["area1"]
            hf_h2 = last_resolved["hits"]["historical_frequency"]["area2"]

            lines.extend(
                [
                    f"#### Previous Resolved Draw ({last_resolved['target_draw_id']})",
                    "",
                    f"- **Actual Winning Numbers**: Area 1 `[{act_a1}]`, Area 2 `{act_a2}`",
                    f"- **Model Hits**: Area 1: **{m_h1}** / 6, Area 2: **{m_h2}** / 1",
                    (
                        f"- **Historical Frequency Hits**: "
                        f"Area 1: **{hf_h1}** / 6, Area 2: **{hf_h2}** / 1"
                    ),
                    "",
                ]
            )

        disclaimer = (
            "> **免責聲明 (Disclaimer)**：本專案為機器學習與彩券隨機性之學術研究，"
            "所有預測均在開獎前嚴格鎖定於 Ledger。"
            "彩券開獎為獨立隨機試驗，模型無法超越期望值，切勿作為投注依據。"
        )
        lines.extend([disclaimer, ""])

        with summary_path.open("a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    except Exception:
        pass


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


if __name__ == "__main__":
    entrypoint()

