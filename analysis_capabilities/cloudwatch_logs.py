from __future__ import annotations

import json
from pathlib import Path

from analysis_capabilities.base import CapabilityRunResult
from data_gen.capabilities import load_capability


class CloudWatchLogsCapabilityHandler:
    capability_id = "cloudwatch_logs"
    default_input_dir = Path("input/cloudwatch_logs")

    def run(
        self,
        *,
        bundle: Path | None = None,
        input_dir: Path | None = None,
        output_dir: Path | None = None,
        scratch_dir: Path | None = None,
    ) -> CapabilityRunResult:
        capability = load_capability(self.capability_id)
        resolved_input_dir = input_dir or self.default_input_dir
        resolved_bundle = bundle or resolved_input_dir
        resolved_output_dir = output_dir or (resolved_input_dir / "_analysis" / "cloudwatch_logs")
        resolved_output_dir.mkdir(parents=True, exist_ok=True)

        prompt_brief_path = resolved_output_dir / "cloudwatch_prompt_brief.txt"
        summary_path = resolved_output_dir / "cloudwatch_log_summary.json"
        findings_path = resolved_output_dir / "cloudwatch_log_findings.md"

        summary = {
            "capability_id": self.capability_id,
            "status": "skeleton",
            "message": (
                "CloudWatch log analysis has not been implemented yet. "
                "Add a dataset-specific extractor and prompt brief builder for the CloudWatch log shape you want to analyze."
            ),
            "input_dir": str(resolved_input_dir),
            "bundle": str(resolved_bundle),
            "expected_next_step": "Implement a CloudWatch-specific analyzer under analysis_capabilities/cloudwatch_logs.py.",
        }
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        findings_path.write_text(
            "\n".join(
                [
                    "# CloudWatch Log Analysis",
                    "",
                    "This capability is currently a scaffold.",
                    "",
                    "## Current Status",
                    "- No CloudWatch-specific parser or extractor is implemented yet.",
                    f"- Capability manifest loaded: {capability.capability_id}",
                    f"- Expected input directory: {resolved_input_dir}",
                    "",
                    "## Required Next Step",
                    "- Implement dataset-specific extraction for the CloudWatch log format you want to triage.",
                ]
            ),
            encoding="utf-8",
        )
        prompt_brief_path.write_text(
            "\n".join(
                [
                    "You are acting as a CloudWatch log triage analyst inside an approved enclave workflow.",
                    "This capability is a scaffold and does not yet extract dataset-specific facts.",
                    "Do not infer production conclusions from this placeholder output.",
                    "",
                    "Required next step: implement a CloudWatch-specific analyzer before using this capability for operational triage.",
                ]
            ),
            encoding="utf-8",
        )

        return CapabilityRunResult(
            capability_id=self.capability_id,
            bundle=str(resolved_bundle),
            output_dir=str(resolved_output_dir),
            scratch_dir=str(scratch_dir or (resolved_input_dir / "_scratch")),
            outputs={
                "json": str(summary_path),
                "report": str(findings_path),
                "prompt_brief": str(prompt_brief_path),
            },
            prompt_brief_path=str(prompt_brief_path),
        )
