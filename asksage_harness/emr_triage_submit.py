"""Run EMR artifact triage and submit the generated prompt brief to AskSage."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from asksage_harness.replay import create_client, extract_response_text
from emr_triage.analyze_artifacts import (
    analyze,
    artifact_root,
    resolve_bundle,
    resolve_output_dir,
    resolve_scratch_dir,
    write_outputs,
)


class LocalEMRTriageClient:
    """Deterministic local client for validating the one-step EMR workflow."""

    def query(self, message: str, model: str) -> dict[str, str]:
        preview = "\n".join(message.splitlines()[:12]).strip()
        return {
            "message": "\n".join(
                [
                    "# Local EMR Triage Submission",
                    "",
                    f"- model: {model}",
                    "- mode: local",
                    "- result: AskSage submission wrapper executed successfully.",
                    "",
                    "## Prompt Preview",
                    preview,
                ]
            )
        }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help="Artifact root directory or .tar/.tar.gz/.tgz bundle. If omitted, the newest archive in input/emr_triage is used.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("input/emr_triage"),
        help="Directory searched for the latest bundle when --bundle is omitted.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for analysis and AskSage outputs. If omitted, a bundle-local _analysis/<bundle-name>/ folder is used.",
    )
    parser.add_argument(
        "--scratch-dir",
        type=Path,
        default=None,
        help="Directory used for archive extraction. If omitted, a bundle-local _scratch/ folder is used.",
    )
    parser.add_argument(
        "--capability",
        default="emr_logs",
        help="Capability folder under prompts/ used for the analyzer.",
    )
    parser.add_argument(
        "--model",
        default="gpt-4.1",
        help="AskSage model to use for the final triage prompt.",
    )
    parser.add_argument(
        "--mode",
        choices=("asksage", "local"),
        default="asksage",
        help="Use the real AskSage client or the deterministic local client for offline validation.",
    )
    parser.add_argument("--email", default=None, help="Optional AskSage email override.")
    parser.add_argument("--api-key", default=None, help="Optional AskSage API key override.")
    parser.add_argument(
        "--system-prompt",
        default="",
        help="Optional system instructions prepended before the generated EMR prompt brief.",
    )
    return parser


def build_asksage_message(prompt_brief: str, system_prompt: str = "") -> str:
    parts: list[str] = []
    if system_prompt.strip():
        parts.extend(["SYSTEM INSTRUCTIONS:", system_prompt.strip(), ""])
    parts.append(prompt_brief.strip())
    return "\n".join(parts).strip()


def create_submission_client(mode: str, email: str | None = None, api_key: str | None = None) -> Any:
    if mode == "local":
        return LocalEMRTriageClient()
    return create_client(mode=mode, email=email, api_key=api_key)


def run_submission(
    *,
    bundle: Path | None = None,
    input_dir: Path = Path("input/emr_triage"),
    output_dir: Path | None = None,
    scratch_dir: Path | None = None,
    capability_id: str = "emr_logs",
    mode: str = "asksage",
    model: str = "gpt-4.1",
    email: str | None = None,
    api_key: str | None = None,
    system_prompt: str = "",
) -> dict[str, Any]:
    resolved_bundle = resolve_bundle(bundle, input_dir)
    resolved_output_dir = resolve_output_dir(resolved_bundle, output_dir)
    resolved_scratch_dir = resolve_scratch_dir(resolved_bundle, scratch_dir)

    root, temp_dir = artifact_root(resolved_bundle, scratch_dir=resolved_scratch_dir)
    try:
        analysis_result = analyze(root=root, capability_id=capability_id)
        analysis_outputs = write_outputs(analysis_result, resolved_output_dir)
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()

    prompt_brief_path = Path(analysis_outputs["prompt_brief"])
    prompt_brief = prompt_brief_path.read_text(encoding="utf-8")
    message = build_asksage_message(prompt_brief, system_prompt=system_prompt)

    client = create_submission_client(mode=mode, email=email, api_key=api_key)
    response = client.query(message=message, model=model)
    response_text = extract_response_text(response)

    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    response_record = {
        "generated_at": timestamp,
        "mode": mode,
        "model": model,
        "bundle": str(resolved_bundle),
        "output_dir": str(resolved_output_dir),
        "scratch_dir": str(resolved_scratch_dir),
        "capability_id": capability_id,
        "prompt_brief": str(prompt_brief_path),
        "system_prompt": system_prompt,
        "message": message,
        "raw_response": response,
        "response_markdown": response_text,
    }

    response_json_path = resolved_output_dir / "asksage_response.json"
    response_md_path = resolved_output_dir / "asksage_response.md"
    response_json_path.write_text(json.dumps(response_record, indent=2), encoding="utf-8")
    response_md_path.write_text(response_text, encoding="utf-8")

    return {
        "bundle": str(resolved_bundle),
        "output_dir": str(resolved_output_dir),
        "scratch_dir": str(resolved_scratch_dir),
        **analysis_outputs,
        "asksage_response_json": str(response_json_path),
        "asksage_response_markdown": str(response_md_path),
    }


def main() -> None:
    args = build_parser().parse_args()
    result = run_submission(
        bundle=args.bundle,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        scratch_dir=args.scratch_dir,
        capability_id=args.capability,
        mode=args.mode,
        model=args.model,
        email=args.email,
        api_key=args.api_key,
        system_prompt=args.system_prompt,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
