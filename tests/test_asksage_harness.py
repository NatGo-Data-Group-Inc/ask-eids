from __future__ import annotations

import json
from pathlib import Path

from asksage_harness.replay import (
    build_payload_metadata,
    build_prompt_packet,
    build_dataset_summary,
    compare_snapshot_dirs,
    load_prompt_baselines,
    parse_replay_payload,
    resolve_packet_format,
    run_replay,
)
from data_gen.synthetic_cur import generate_rows


def test_load_prompt_baselines_parses_all_sections() -> None:
    prompts = load_prompt_baselines("prompts/PROMPT_BASELINES.md")

    assert [prompt.title for prompt in prompts] == [
        "Cost Anomaly Detection",
        "Technical Debt Correlation",
        "FTE Replacement ROI",
        "PMO Executive Summary",
        "Bedrock Transition Recommendation",
    ]
    assert prompts[0].slug == "cost_anomaly_detection"


def test_build_dataset_summary_reports_expected_fields() -> None:
    summary = build_dataset_summary(generate_rows(25, seed=42))

    assert summary["row_count"] == 25
    assert summary["anomaly_count"] == 3
    assert "baseline_operations" in summary["scenario_counts"]
    assert summary["top_services_by_cost"][0]["service"] == "AmazonEMR"
    assert summary["anomaly_examples"][0]["scenario"] == "cluster_left_running"


def test_markdown_prompt_packet_round_trips_summary() -> None:
    prompt = load_prompt_baselines("prompts/PROMPT_BASELINES.md")[0]
    summary = build_dataset_summary(generate_rows(25, seed=42))

    payload = build_prompt_packet(
        prompt,
        summary,
        "output/phase1/synthetic_cur.json",
        packet_format="markdown",
    )
    parsed = parse_replay_payload(payload)

    assert payload.startswith("# Task: Cost Anomaly Detection")
    assert parsed["task"] == prompt.title
    assert parsed["synthetic_dataset_summary"] == summary


def test_build_payload_metadata_reports_size_and_truncation() -> None:
    metadata = build_payload_metadata("abcdef", preview_chars=3)

    assert metadata["char_count"] == 6
    assert metadata["byte_count_utf8"] == 6
    assert metadata["line_count"] == 1
    assert metadata["preview"] == "abc"
    assert metadata["preview_truncated"] is True


def test_resolve_packet_format_defaults_by_mode() -> None:
    assert resolve_packet_format(mode="local", packet_format="auto") == "json"
    assert resolve_packet_format(mode="asksage", packet_format="auto") == "markdown"
    assert resolve_packet_format(mode="asksage", packet_format="json") == "json"


def test_run_replay_writes_snapshot_bundle(tmp_path: Path) -> None:
    dataset_path = tmp_path / "synthetic_cur.json"
    dataset_path.write_text(json.dumps(generate_rows(25, seed=42), indent=2), encoding="utf-8")

    manifest = run_replay(
        prompts_path="prompts/PROMPT_BASELINES.md",
        dataset_path=dataset_path,
        output_dir=tmp_path / "replay",
        mode="local",
        model="gpt-4o",
    )

    manifest_path = tmp_path / "replay" / "manifest.json"
    assert manifest_path.exists()
    assert manifest["prompt_count"] == 5
    assert len(manifest["snapshots"]) == 5
    first_markdown = tmp_path / "replay" / "cost_anomaly_detection.md"
    first_json = tmp_path / "replay" / "cost_anomaly_detection.json"
    assert first_markdown.exists()
    assert first_json.exists()
    assert "# Cost Anomaly Detection" in first_markdown.read_text(encoding="utf-8")


def test_run_replay_supports_markdown_packet_format(tmp_path: Path) -> None:
    dataset_path = tmp_path / "synthetic_cur.json"
    dataset_path.write_text(json.dumps(generate_rows(25, seed=42), indent=2), encoding="utf-8")

    manifest = run_replay(
        prompts_path="prompts/PROMPT_BASELINES.md",
        dataset_path=dataset_path,
        output_dir=tmp_path / "replay_markdown",
        mode="local",
        model="gpt-4o",
        packet_format="markdown",
        payload_preview_chars=120,
    )

    first_json = json.loads(
        (tmp_path / "replay_markdown" / "cost_anomaly_detection.json").read_text(encoding="utf-8")
    )
    assert manifest["packet_format"] == "markdown"
    assert first_json["packet_format"] == "markdown"
    assert first_json["prompt_packet"] is None
    assert first_json["prompt_message"].startswith("# Task: Cost Anomaly Detection")
    assert first_json["payload_metadata"]["char_count"] >= first_json["payload_metadata"]["line_count"]


def test_run_replay_auto_packet_format_uses_mode_default(tmp_path: Path) -> None:
    dataset_path = tmp_path / "synthetic_cur.json"
    dataset_path.write_text(json.dumps(generate_rows(25, seed=42), indent=2), encoding="utf-8")

    manifest = run_replay(
        prompts_path="prompts/PROMPT_BASELINES.md",
        dataset_path=dataset_path,
        output_dir=tmp_path / "replay_auto",
        mode="local",
        model="gpt-4o",
    )

    first_json = json.loads(
        (tmp_path / "replay_auto" / "cost_anomaly_detection.json").read_text(encoding="utf-8")
    )
    assert manifest["packet_format"] == "json"
    assert first_json["packet_format"] == "json"
    assert first_json["prompt_packet"] is not None


def test_compare_snapshot_dirs_writes_comparison_bundle(tmp_path: Path) -> None:
    dataset_path = tmp_path / "synthetic_cur.json"
    dataset_path.write_text(json.dumps(generate_rows(25, seed=42), indent=2), encoding="utf-8")

    run_replay(
        prompts_path="prompts/PROMPT_BASELINES.md",
        dataset_path=dataset_path,
        output_dir=tmp_path / "baseline",
        mode="local",
        model="gpt-4o",
    )
    run_replay(
        prompts_path="prompts/PROMPT_BASELINES.md",
        dataset_path=dataset_path,
        output_dir=tmp_path / "candidate",
        mode="local",
        model="gpt-4.1",
    )

    candidate_json = tmp_path / "candidate" / "cost_anomaly_detection.json"
    payload = json.loads(candidate_json.read_text(encoding="utf-8"))
    payload["response_markdown"] += "\n- Extra candidate detail."
    candidate_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    summary = compare_snapshot_dirs(
        baseline_dir=tmp_path / "baseline",
        candidate_dir=tmp_path / "candidate",
        output_dir=tmp_path / "compare",
    )

    assert (tmp_path / "compare" / "comparison.md").exists()
    assert (tmp_path / "compare" / "comparison.json").exists()
    assert summary["prompt_count"] == 5
    assert summary["changed_prompt_count"] >= 1
