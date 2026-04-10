from __future__ import annotations

import json
from pathlib import Path

from asksage_harness.replay import (
    build_dataset_summary,
    compare_snapshot_dirs,
    load_prompt_baselines,
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
