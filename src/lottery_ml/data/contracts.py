from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal


@dataclass(frozen=True, slots=True)
class DrawRecord:
    draw_id: str
    draw_date: date
    area1: tuple[int, ...]
    area2: int

    def __post_init__(self) -> None:
        if len(self.area1) != 6 or len(set(self.area1)) != 6:
            raise ValueError("area1 must contain six distinct numbers")
        if any(number < 1 or number > 38 for number in self.area1):
            raise ValueError("area1 numbers must be between 1 and 38")
        if self.area2 < 1 or self.area2 > 8:
            raise ValueError("area2 must be between 1 and 8")

    def to_dict(self) -> dict[str, object]:
        return {
            "draw_id": self.draw_id,
            "draw_date": self.draw_date.isoformat(),
            "area1": list(self.area1),
            "area2": self.area2,
        }


@dataclass(frozen=True, slots=True)
class SnapshotManifest:
    schema_version: str
    fetched_at: datetime
    source_urls: tuple[str, ...]
    sha256: str
    draw_count: int
    date_min: date
    date_max: date
    validation_status: Literal["verified"]
    corrections_applied: tuple[str, ...]
    git_commit: str

    def __post_init__(self) -> None:
        if self.validation_status != "verified":
            raise ValueError("validation_status must be verified")

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "fetched_at": self.fetched_at.isoformat(),
            "source_urls": list(self.source_urls),
            "sha256": self.sha256,
            "draw_count": self.draw_count,
            "date_min": self.date_min.isoformat(),
            "date_max": self.date_max.isoformat(),
            "validation_status": self.validation_status,
            "corrections_applied": list(self.corrections_applied),
            "git_commit": self.git_commit,
        }
