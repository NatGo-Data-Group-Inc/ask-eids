from __future__ import annotations

from pathlib import Path

from analysis_capabilities.base import CapabilityRunResult
from emr_triage.analyze_artifacts import (
    analyze,
    artifact_root,
    resolve_bundle,
    resolve_output_dir,
    resolve_scratch_dir,
    write_outputs,
)


class EMRLogsCapabilityHandler:
    capability_id = "emr_logs"
    default_input_dir = Path("input/emr_triage")

    def run(
        self,
        *,
        bundle: Path | None = None,
        input_dir: Path | None = None,
        output_dir: Path | None = None,
        scratch_dir: Path | None = None,
    ) -> CapabilityRunResult:
        resolved_input_dir = input_dir or self.default_input_dir
        resolved_bundle = resolve_bundle(bundle, resolved_input_dir)
        resolved_output_dir = resolve_output_dir(resolved_bundle, output_dir)
        resolved_scratch_dir = resolve_scratch_dir(resolved_bundle, scratch_dir)

        root, temp_dir = artifact_root(resolved_bundle, scratch_dir=resolved_scratch_dir)
        try:
            analysis_result = analyze(root=root, capability_id=self.capability_id)
            outputs = write_outputs(analysis_result, resolved_output_dir)
        finally:
            if temp_dir is not None:
                temp_dir.cleanup()

        return CapabilityRunResult(
            capability_id=self.capability_id,
            bundle=str(resolved_bundle),
            output_dir=str(resolved_output_dir),
            scratch_dir=str(resolved_scratch_dir),
            outputs=outputs,
            prompt_brief_path=outputs["prompt_brief"],
        )
