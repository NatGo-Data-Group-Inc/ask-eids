"""Run a capability-specific artifact analyzer and submit the generated prompt brief to AskSage."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from analysis_capabilities import get_capability_handler
from asksage_harness.replay import create_client, extract_response_text


class LocalCapabilitySubmissionClient:
    """Deterministic local client for validating the capability submission flow."""

    def query(self, message: str, model: str) -> dict[str, str]:
        preview = "\n".join(message.splitlines()[:12]).strip()
        return {
            "message": "\n".join(
                [
                    "# Local Capability Submission",
                    "",
                    f"- model: {model}",
                    "- mode: local",
                    "- result: capability submission wrapper executed successfully.",
                    "",
                    "## Prompt Preview",
                    preview,
                ]
            )
        }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--capability",
        default="emr_logs",
        help="Capability id to submit through the shared wrapper.",
    )
    parser.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help="Artifact root directory or archive bundle. If omitted, the capability handler uses its default input directory.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=None,
        help="Optional input directory override used when --bundle is omitted.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for analysis and AskSage outputs.",
    )
    parser.add_argument(
        "--scratch-dir",
        type=Path,
        default=None,
        help="Directory used for archive extraction.",
    )
    parser.add_argument(
        "--model",
        default="gpt-4.1",
        help="AskSage model to use for the final capability prompt.",
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
        help="Optional system instructions prepended before the generated prompt brief.",
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
        return LocalCapabilitySubmissionClient()
    return create_client(mode=mode, email=email, api_key=api_key)


def run_submission(
    *,
    capability_id: str = "emr_logs",
    bundle: Path | None = None,
    input_dir: Path | None = None,
    output_dir: Path | None = None,
    scratch_dir: Path | None = None,
    mode: str = "asksage",
    model: str = "gpt-4.1",
    email: str | None = None,
    api_key: str | None = None,
    system_prompt: str = "",
) -> dict[str, Any]:
    handler = get_capability_handler(capability_id)
    capability_run = handler.run(
        bundle=bundle,
        input_dir=input_dir,
        output_dir=output_dir,
        scratch_dir=scratch_dir,
    )

    prompt_brief_path = Path(capability_run.prompt_brief_path)
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
        "capability_id": capability_run.capability_id,
        "bundle": capability_run.bundle,
        "output_dir": capability_run.output_dir,
        "scratch_dir": capability_run.scratch_dir,
        "prompt_brief": str(prompt_brief_path),
        "system_prompt": system_prompt,
        "message": message,
        "raw_response": response,
        "response_markdown": response_text,
    }

    output_dir_path = Path(capability_run.output_dir)
    response_json_path = output_dir_path / "asksage_response.json"
    response_md_path = output_dir_path / "asksage_response.md"
    response_json_path.write_text(json.dumps(response_record, indent=2), encoding="utf-8")
    response_md_path.write_text(response_text, encoding="utf-8")

    return {
        "capability": capability_run.capability_id,
        "bundle": capability_run.bundle,
        "output_dir": capability_run.output_dir,
        "scratch_dir": capability_run.scratch_dir,
        **capability_run.outputs,
        "asksage_response_json": str(response_json_path),
        "asksage_response_markdown": str(response_md_path),
    }


def main() -> None:
    args = build_parser().parse_args()
    result = run_submission(
        capability_id=args.capability,
        bundle=args.bundle,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        scratch_dir=args.scratch_dir,
        mode=args.mode,
        model=args.model,
        email=args.email,
        api_key=args.api_key,
        system_prompt=args.system_prompt,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
