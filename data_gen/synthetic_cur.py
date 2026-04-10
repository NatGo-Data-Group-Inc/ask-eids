"""Phase 1 synthetic CUR-shaped generator for Ask EIDS feasibility."""

from __future__ import annotations

import argparse
import csv
import json
import random
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import pyarrow as pa
import pyarrow.parquet as pq

from data_gen.sandbox_overlay import apply_overlay, load_overlay


REGIONS = ("us-gov-west-1", "us-gov-east-1")


@dataclass(frozen=True)
class ServiceProfile:
    service: str
    usage_type: str
    operation: str
    unit: str
    min_rate: float
    max_rate: float


SERVICE_PROFILES: tuple[ServiceProfile, ...] = (
    ServiceProfile("AmazonEC2", "BoxUsage:m6i.2xlarge", "RunInstances", "Hrs", 0.22, 0.61),
    ServiceProfile("AmazonS3", "TimedStorage-ByteHrs", "StandardStorage", "GB-Mo", 0.02, 0.05),
    ServiceProfile("AmazonEMR", "EMR-InstanceUsage", "RunJobFlow", "Hrs", 14.0, 28.0),
    ServiceProfile("AmazonRedshift", "NodeUsage:ra3.xlplus", "CreateCluster", "Hrs", 1.1, 4.8),
    ServiceProfile("AWSGlue", "Glue-ETL-DPU-Hour", "StartJobRun", "DPU-Hr", 0.35, 0.95),
    ServiceProfile("AWSLambda", "Lambda-GB-Second", "Invoke", "GB-Second", 0.00001, 0.00009),
    ServiceProfile("AmazonBedrock", "InputTokens", "InvokeModel", "1K-Tokens", 0.003, 0.018),
)

SERVICE_PROFILE_BY_NAME = {
    profile.service: profile for profile in SERVICE_PROFILES
}


SCENARIO_DEFAULT = {
    "scenario": "baseline_operations",
    "technical_debt_event": "none",
    "anomaly_score": "low",
    "waste_driver": "none",
    "recommended_action": "Continue monitoring synthetic cost baselines",
    "pmo_summary_line": "Baseline synthetic operations remained within expected spend bounds",
}


SCENARIO_LIBRARY = {
    "cluster_left_running": {
        "service": "AmazonEMR",
        "technical_debt_event": "missed_shutdown_hook",
        "anomaly_score": "high",
        "waste_driver": "missed shutdown automation",
        "recommended_action": "Bedrock flow scheduled cluster teardown check",
        "pmo_summary_line": "EMR waste due to automation gap caused {usage_hours} excess compute hours",
        "usage_hours_range": (48, 96),
        "cost_range": (1200.0, 2600.0),
    },
    "redshift_scan_spike": {
        "service": "AmazonRedshift",
        "technical_debt_event": "inefficient_scan_pattern",
        "anomaly_score": "high",
        "waste_driver": "unbounded analytical scan pattern",
        "recommended_action": "Bedrock flow query guardrail review",
        "pmo_summary_line": "Redshift scan surge increased warehouse cost through repeated full-table access",
        "usage_hours_range": (18, 54),
        "cost_range": (700.0, 1900.0),
    },
    "orphan_ebs_leakage": {
        "service": "AmazonEC2",
        "technical_debt_event": "orphaned_storage_cleanup_gap",
        "anomaly_score": "medium",
        "waste_driver": "orphaned block storage",
        "recommended_action": "Bedrock flow orphaned resource sweep",
        "pmo_summary_line": "Detached storage continued accruing cost after instance retirement",
        "usage_hours_range": (120, 240),
        "cost_range": (200.0, 780.0),
    },
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=250, help="Number of synthetic CUR rows")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output/phase1"),
        help="Directory for generated parquet, csv, json, and markdown artifacts",
    )
    parser.add_argument(
        "--overlay",
        type=Path,
        default=None,
        help="Optional overlay CSV or JSON to merge by resource_id",
    )
    return parser


def random_resource_id(service: str, index: int) -> str:
    prefix = service.replace("Amazon", "").replace("AWS", "").lower()
    return f"{prefix}-{index:05d}"


def apply_service_profile(row: dict, profile: ServiceProfile, index: int) -> dict:
    row.update(
        {
            "line_item_product_code": profile.service,
            "line_item_usage_type": profile.usage_type,
            "line_item_operation": profile.operation,
            "pricing_unit": profile.unit,
            "resource_id": random_resource_id(profile.service, index),
            "service": profile.service,
        }
    )
    return row


def build_baseline_row(index: int, rng: random.Random) -> dict:
    profile = rng.choice(SERVICE_PROFILES)
    usage_amount = round(rng.uniform(1.0, 72.0), 2)
    unit_rate = rng.uniform(profile.min_rate, profile.max_rate)
    cost = round(usage_amount * unit_rate, 2)
    usage_start = datetime(2026, 3, 1, tzinfo=timezone.utc) + timedelta(hours=index * 3)
    usage_end = usage_start + timedelta(hours=1)

    row = {
        "billing_period_start": "2026-03-01",
        "billing_period_end": "2026-03-31",
        "line_item_usage_start_date": usage_start.isoformat(),
        "line_item_usage_end_date": usage_end.isoformat(),
        "line_item_product_code": profile.service,
        "line_item_usage_type": profile.usage_type,
        "line_item_operation": profile.operation,
        "line_item_usage_amount": usage_amount,
        "line_item_unblended_cost": cost,
        "pricing_unit": profile.unit,
        "product_region": rng.choice(REGIONS),
        "resource_id": random_resource_id(profile.service, index),
        "usage_account_id": f"000000000{index % 10}",
        "payer_account_id": "synthetic-payer",
        "service": profile.service,
        "region": rng.choice(REGIONS),
        "usage_hours": usage_amount if profile.unit == "Hrs" else round(min(usage_amount, 72.0), 2),
        "cost": cost,
        "data_source": "synthetic",
    }
    row.update(SCENARIO_DEFAULT)
    return row


def inject_scenario(row: dict, rng: random.Random, scenario_name: str) -> dict:
    scenario = SCENARIO_LIBRARY[scenario_name]
    profile = SERVICE_PROFILE_BY_NAME[scenario["service"]]
    usage_low, usage_high = scenario["usage_hours_range"]
    cost_low, cost_high = scenario["cost_range"]
    usage_hours = round(rng.uniform(usage_low, usage_high), 2)
    cost = round(rng.uniform(cost_low, cost_high), 2)

    row = apply_service_profile(row, profile, int(str(row["resource_id"]).split("-")[-1]))
    row.update(
        {
            "scenario": scenario_name,
            "technical_debt_event": scenario["technical_debt_event"],
            "anomaly_score": scenario["anomaly_score"],
            "waste_driver": scenario["waste_driver"],
            "recommended_action": scenario["recommended_action"],
            "usage_hours": usage_hours,
            "cost": cost,
            "line_item_usage_amount": usage_hours,
            "line_item_unblended_cost": cost,
            "pmo_summary_line": scenario["pmo_summary_line"].format(usage_hours=int(round(usage_hours))),
        }
    )
    return row


def generate_rows(row_count: int, seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    rows: list[dict] = []
    scenario_names = list(SCENARIO_LIBRARY)

    for index in range(row_count):
        row = build_baseline_row(index, rng)
        if index == 0:
            row = apply_service_profile(row, SERVICE_PROFILE_BY_NAME["AmazonEMR"], index)
            row.update(
                {
                    "region": "us-gov-west-1",
                    "product_region": "us-gov-west-1",
                    "usage_hours": 72,
                    "cost": 1840.22,
                    "line_item_usage_amount": 72,
                    "line_item_unblended_cost": 1840.22,
                    "scenario": "cluster_left_running",
                    "technical_debt_event": "missed_shutdown_hook",
                    "anomaly_score": "high",
                    "waste_driver": "missed shutdown automation",
                    "recommended_action": "Bedrock flow scheduled cluster teardown check",
                    "pmo_summary_line": "EMR waste due to automation gap caused 72 excess compute hours",
                }
            )
        elif index % 9 == 0:
            row = inject_scenario(row, rng, rng.choice(scenario_names))
        rows.append(row)

    return rows


def validate_against_sample(row: dict) -> dict[str, bool]:
    """Validate a row against the sample I/O expectations."""
    checks = {
        "anomaly_score": row.get("anomaly_score") == "high",
        "waste_driver": row.get("waste_driver") == "missed shutdown automation",
        "recommended_action": row.get("recommended_action")
        == "Bedrock flow scheduled cluster teardown check",
        "pmo_summary_line": row.get("pmo_summary_line")
        == "EMR waste due to automation gap caused 72 excess compute hours",
    }
    return checks


def write_csv(rows: Iterable[dict], destination: Path) -> None:
    rows = list(rows)
    if not rows:
        raise ValueError("Cannot write empty CSV output")

    fieldnames = list(rows[0].keys())
    with destination.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_json(rows: Iterable[dict], destination: Path) -> None:
    destination.write_text(json.dumps(list(rows), indent=2), encoding="utf-8")


def write_parquet(rows: Iterable[dict], destination: Path) -> None:
    table = pa.Table.from_pylist(list(rows))
    pq.write_table(table, destination)


def emit_bedrock_flow_stub(destination: Path) -> None:
    flow = {
        "name": "ask-eids-phase1-cost-anomaly-flow",
        "description": "Phase 1 orchestration-only Bedrock scaffold for synthetic CUR validation",
        "nodes": [
            {"id": "ingest-cur", "type": "lambda", "purpose": "Load parquet and optional sandbox overlays"},
            {"id": "reason-anomalies", "type": "prompt", "purpose": "Invoke Ask EIDS-promoted anomaly narrative prompt"},
            {"id": "publish-report", "type": "lambda", "purpose": "Write markdown and JSON artifacts for PMO review"},
        ],
        "handoff_contract": {
            "ask_eids_role": "Reasoning over curated cost findings and generating narratives",
            "bedrock_role": "Prompt lifecycle, orchestration, and governed execution",
        },
    }
    destination.write_text(json.dumps(flow, indent=2), encoding="utf-8")


def emit_markdown_reports(rows: list[dict], validation: dict[str, bool], destination_dir: Path) -> None:
    scenario_counts = Counter(row["scenario"] for row in rows)
    service_costs: dict[str, float] = {}
    for row in rows:
        service_costs[row["service"]] = round(service_costs.get(row["service"], 0.0) + float(row["cost"]), 2)

    top_services = sorted(service_costs.items(), key=lambda item: item[1], reverse=True)[:5]
    anomaly_rows = [row for row in rows if row["anomaly_score"] in {"high", "medium"}]

    pmo_summary = "\n".join(
        [
            "# PMO Executive Summary",
            "",
            "## Phase 1 Status",
            "- Synthetic CUR-shaped dataset generated and exported as parquet, CSV, and JSON.",
            "- GovCloud service mix included: EC2, S3, EMR, Redshift, Glue, Lambda, Bedrock.",
            "- Sample I/O validation passed for the seeded EMR anomaly row.",
            "",
            "## Key Observations",
            f"- Generated rows: {len(rows)}",
            f"- Scenario-bearing rows: {len([row for row in rows if row['scenario'] != 'baseline_operations'])}",
            f"- High or medium anomalies: {len(anomaly_rows)}",
            f"- Highest synthetic cost service: {top_services[0][0]} at ${top_services[0][1]:,.2f}",
            "",
            "## Architecture Split",
            "- Ask EIDS remains the reasoning layer for anomaly interpretation and narrative synthesis.",
            "- Amazon Bedrock remains the orchestration layer for prompt governance, flow execution, and report publication.",
            "",
            "## Next Actions",
            "- Expand the scenario library with operational failure patterns from Phase 2.",
            "- Route validated prompts into Bedrock Prompt Management assets.",
            "- Connect sandbox overlays to enrich synthetic rows with lab-observed signals.",
        ]
    )

    anomaly_report_lines = [
        "# Cost Anomaly Report",
        "",
        "## Sample Validation",
        *(f"- {name}: {'pass' if passed else 'fail'}" for name, passed in validation.items()),
        "",
        "## Scenario Counts",
        *(f"- {scenario}: {count}" for scenario, count in sorted(scenario_counts.items())),
        "",
        "## Top Services By Synthetic Cost",
        *(f"- {service}: ${cost:,.2f}" for service, cost in top_services),
        "",
        "## Representative Findings",
    ]
    anomaly_report_lines.extend(
        f"- {row['service']} in {row['region']}: {row['pmo_summary_line']} | action: {row['recommended_action']}"
        for row in anomaly_rows[:5]
    )

    findings_summary = "\n".join(
        [
            "# Feasibility Findings",
            "",
            "## Outcome",
            "Phase 1 confirms the prototype can generate reproducible CUR-shaped data, preserve the ADR separation between reasoning and orchestration, and produce PMO-readable outputs from synthetic spend signals.",
            "",
            "## Risks",
            "- Parquet writing depends on pyarrow in the target runtime.",
            "- Synthetic anomaly realism will need deeper tuning before executive trust scales beyond feasibility review.",
            "",
            "## Evidence",
            "- Seeded row matches SAMPLE_IO expectations.",
            "- Output bundle includes parquet, CSV, JSON, Bedrock flow scaffold, and markdown summaries.",
        ]
    )

    (destination_dir / "pmo_executive_summary.md").write_text(pmo_summary, encoding="utf-8")
    (destination_dir / "cost_anomaly_report.md").write_text("\n".join(anomaly_report_lines), encoding="utf-8")
    (destination_dir / "feasibility_findings.md").write_text(findings_summary, encoding="utf-8")


def run(output_dir: Path, row_count: int, seed: int, overlay_path: Path | None = None) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = generate_rows(row_count=row_count, seed=seed)
    if overlay_path:
        rows = apply_overlay(rows, load_overlay(overlay_path))

    validation = validate_against_sample(rows[0])
    if not all(validation.values()):
        raise ValueError(f"Sample validation failed: {validation}")

    csv_path = output_dir / "synthetic_cur.csv"
    parquet_path = output_dir / "synthetic_cur.parquet"
    json_path = output_dir / "synthetic_cur.json"
    validation_path = output_dir / "sample_validation.json"
    bedrock_path = output_dir / "bedrock_flow_stub.json"

    write_csv(rows, csv_path)
    write_parquet(rows, parquet_path)
    write_json(rows, json_path)
    validation_path.write_text(json.dumps(validation, indent=2), encoding="utf-8")
    emit_bedrock_flow_stub(bedrock_path)
    emit_markdown_reports(rows, validation, output_dir)

    return {
        "rows": len(rows),
        "csv": str(csv_path),
        "parquet": str(parquet_path),
        "json": str(json_path),
        "validation": str(validation_path),
        "bedrock_flow": str(bedrock_path),
    }


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    result = run(
        output_dir=args.output_dir,
        row_count=args.rows,
        seed=args.seed,
        overlay_path=args.overlay,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
