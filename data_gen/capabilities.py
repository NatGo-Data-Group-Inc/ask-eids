from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


PROMPTS_ROOT = Path(__file__).resolve().parents[1] / "prompts"


@dataclass(frozen=True)
class CapabilitySpec:
    capability_id: str
    title: str
    description: str
    input_type: str
    prompt_files: tuple[str, ...]
    output_artifacts: tuple[str, ...]
    bedrock_flow_name: str

    @classmethod
    def from_dict(cls, payload: dict) -> "CapabilitySpec":
        return cls(
            capability_id=payload["capability_id"],
            title=payload["title"],
            description=payload["description"],
            input_type=payload["input_type"],
            prompt_files=tuple(payload.get("prompt_files", [])),
            output_artifacts=tuple(payload.get("output_artifacts", [])),
            bedrock_flow_name=payload["bedrock_flow_name"],
        )

    @property
    def prompt_dir(self) -> Path:
        return PROMPTS_ROOT / self.capability_id

    def to_dict(self) -> dict:
        return {
            "capability_id": self.capability_id,
            "title": self.title,
            "description": self.description,
            "input_type": self.input_type,
            "prompt_files": list(self.prompt_files),
            "output_artifacts": list(self.output_artifacts),
            "bedrock_flow_name": self.bedrock_flow_name,
            "prompt_dir": str(self.prompt_dir),
        }


def _manifest_path(capability_id: str) -> Path:
    return PROMPTS_ROOT / capability_id / "capability.json"


def load_capability(capability_id: str) -> CapabilitySpec:
    manifest_path = _manifest_path(capability_id)
    if not manifest_path.exists():
        raise ValueError(
            f"Unknown capability '{capability_id}'. Available capabilities: "
            f"{', '.join(spec.capability_id for spec in list_capabilities())}"
        )
    return CapabilitySpec.from_dict(json.loads(manifest_path.read_text(encoding="utf-8")))


def list_capabilities() -> list[CapabilitySpec]:
    specs: list[CapabilitySpec] = []
    if not PROMPTS_ROOT.exists():
        return specs

    for manifest_path in sorted(PROMPTS_ROOT.glob("*/capability.json")):
        specs.append(CapabilitySpec.from_dict(json.loads(manifest_path.read_text(encoding="utf-8"))))
    return specs
