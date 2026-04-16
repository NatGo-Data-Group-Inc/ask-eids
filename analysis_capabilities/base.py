from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol


@dataclass(frozen=True)
class CapabilityRunResult:
    capability_id: str
    bundle: str
    output_dir: str
    scratch_dir: str
    outputs: dict[str, str]
    prompt_brief_path: str


class CapabilityHandler(Protocol):
    capability_id: str
    default_input_dir: Path

    def run(
        self,
        *,
        bundle: Path | None = None,
        input_dir: Path | None = None,
        output_dir: Path | None = None,
        scratch_dir: Path | None = None,
    ) -> CapabilityRunResult: ...
