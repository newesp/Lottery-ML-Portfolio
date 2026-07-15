import json
from pathlib import Path

import pytest

from lottery_ml.experiments.artifacts import ArtifactError, write_json_artifact


def test_write_json_artifact_is_stable_and_newline_terminated(tmp_path: Path) -> None:
    path = tmp_path / "artifact.json"

    write_json_artifact(path, {"schema_version": "1.0.0", "value": 1.25})

    assert path.read_bytes().endswith(b"\n")
    assert json.loads(path.read_bytes())["value"] == 1.25


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_write_json_artifact_rejects_non_finite_values(
    tmp_path: Path, value: float
) -> None:
    with pytest.raises(ArtifactError, match="finite"):
        write_json_artifact(
            tmp_path / "bad.json",
            {"schema_version": "1.0.0", "value": value},
        )
