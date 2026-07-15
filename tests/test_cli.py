import json
from pathlib import Path

from lottery_ml import cli
from lottery_ml.data.fetch import FetchError
from lottery_ml.data.storage import PublicationResult


def test_main_without_command_prints_help(capsys) -> None:
    exit_code = cli.main([])

    captured = capsys.readouterr()
    assert exit_code == 2
    assert "usage: lottery-ml" in captured.err


def test_ingest_command_prints_publication_json(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    captured_call: dict[str, object] = {}

    def fake_ingest_history(**kwargs):
        captured_call.update(kwargs)
        return PublicationResult(
            status="published",
            sha256="a" * 64,
            snapshot_path=tmp_path / "snapshot.json",
            manifest_path=tmp_path / "manifest.json",
        )

    monkeypatch.setattr(cli, "ingest_history", fake_ingest_history)

    exit_code = cli.main(
        [
            "ingest",
            "--from-year",
            "2023",
            "--through-year",
            "2026",
            "--root",
            str(tmp_path),
        ]
    )

    output = json.loads(capsys.readouterr().out)
    assert exit_code == 0
    assert captured_call["years"] == [2023, 2024, 2025, 2026]
    assert captured_call["root"] == tmp_path
    assert output["status"] == "published"
    assert output["sha256"] == "a" * 64


def test_ingest_command_returns_clean_error(
    tmp_path: Path, monkeypatch, capsys
) -> None:
    def fail_ingest_history(**kwargs):
        raise FetchError("failed to fetch NFD year 2026: slow")

    monkeypatch.setattr(cli, "ingest_history", fail_ingest_history)

    exit_code = cli.main(["ingest", "--root", str(tmp_path)])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert "failed to fetch NFD year 2026" in captured.err
    assert "<html" not in captured.err


def test_ingest_command_rejects_reversed_year_range(capsys) -> None:
    exit_code = cli.main(
        ["ingest", "--from-year", "2026", "--through-year", "2025"]
    )

    assert exit_code == 2
    assert "from-year must not exceed through-year" in capsys.readouterr().err
