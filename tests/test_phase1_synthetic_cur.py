from __future__ import annotations

import csv
import json
from pathlib import Path

import pyarrow.parquet as pq

from data_gen.sandbox_overlay import apply_overlay
from data_gen.synthetic_cur import generate_rows, run, validate_against_sample


def test_seeded_row_matches_sample_expectations() -> None:
    rows = generate_rows(10, seed=42)
    assert rows[0]["service"] == "AmazonEMR"
    assert rows[0]["region"] == "us-gov-west-1"
    assert rows[0]["usage_hours"] == 72
    assert rows[0]["cost"] == 1840.22
    assert rows[0]["scenario"] == "cluster_left_running"
    assert rows[0]["technical_debt_event"] == "missed_shutdown_hook"
    assert all(validate_against_sample(rows[0]).values())


def test_overlay_application_updates_matching_rows() -> None:
    rows = generate_rows(5, seed=42)
    updated = apply_overlay(
        rows,
        [
            {
                "resource_id": rows[1]["resource_id"],
                "cost": "999.99",
                "overlay_note": "sandbox-derived",
            }
        ],
    )
    assert updated[1]["cost"] == "999.99"
    assert updated[1]["overlay_note"] == "sandbox-derived"
    assert updated[1]["data_source"] == "synthetic+overlay"


def test_run_writes_phase1_bundle(tmp_path: Path) -> None:
    result = run(tmp_path, row_count=25, seed=42)

    csv_path = Path(result["csv"])
    parquet_path = Path(result["parquet"])
    json_path = Path(result["json"])
    validation_path = Path(result["validation"])

    assert csv_path.exists()
    assert parquet_path.exists()
    assert json_path.exists()
    assert validation_path.exists()
    assert (tmp_path / "pmo_executive_summary.md").exists()
    assert (tmp_path / "cost_anomaly_report.md").exists()
    assert (tmp_path / "feasibility_findings.md").exists()
    assert (tmp_path / "bedrock_flow_stub.json").exists()

    with csv_path.open(newline="", encoding="utf-8") as handle:
        csv_rows = list(csv.DictReader(handle))
    json_rows = json.loads(json_path.read_text(encoding="utf-8"))
    parquet_rows = pq.read_table(parquet_path).to_pylist()
    validation = json.loads(validation_path.read_text(encoding="utf-8"))

    assert len(csv_rows) == 25
    assert len(json_rows) == 25
    assert len(parquet_rows) == 25
    assert all(validation.values())
