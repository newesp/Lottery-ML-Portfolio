from lottery_ml.cli import main


def test_main_without_command_prints_help(capsys) -> None:
    exit_code = main([])

    captured = capsys.readouterr()
    assert exit_code == 2
    assert "usage: lottery-ml" in captured.err
