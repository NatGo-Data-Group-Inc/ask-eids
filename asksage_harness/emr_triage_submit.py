"""Compatibility wrapper for the shared capability submission flow."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from asksage_harness.capability_submit import (
    create_submission_client,
    run_submission as run_capability_submission,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help="Artifact root directory or archive bundle. If omitted, the newest archive in input/emr_triage is used.",
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


def run_submission(
    *,
    bundle: Path | None = None,
    input_dir: Path | None = None,
    output_dir: Path | None = None,
    scratch_dir: Path | None = None,
    mode: str = "asksage",
    model: str = "gpt-4.1",
    email: str | None = None,
    api_key: str | None = None,
    system_prompt: str = "",
) -> dict[str, object]:
    return run_capability_submission(
        capability_id="emr_logs",
        bundle=bundle,
        input_dir=input_dir,
        output_dir=output_dir,
        scratch_dir=scratch_dir,
        mode=mode,
        model=model,
        email=email,
        api_key=api_key,
        system_prompt=system_prompt,
    )


def main() -> None:
    args = build_parser().parse_args()
    result = run_submission(
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
