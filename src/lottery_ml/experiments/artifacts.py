from __future__ import annotations

import json
import math
import tempfile
from pathlib import Path


class ArtifactError(ValueError):
    """Raised when an experiment artifact cannot be serialized safely."""


def write_json_artifact(path: Path, payload: object) -> None:
    """Write deterministic, finite JSON with an atomic same-directory replace."""
    _require_finite(payload, path="$")
    encoded = (
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
            allow_nan=False,
        )
        + "\n"
    ).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", prefix=f".{path.name}.", dir=path.parent, delete=False
        ) as handle:
            handle.write(encoded)
            handle.flush()
            temporary = Path(handle.name)
        temporary.replace(path)
    except OSError as error:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        raise ArtifactError(f"cannot write artifact {path}: {error}") from error


def _require_finite(value: object, *, path: str) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ArtifactError(f"artifact values must be finite: {path}")
    if isinstance(value, dict):
        for key, item in value.items():
            _require_finite(item, path=f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _require_finite(item, path=f"{path}[{index}]")
