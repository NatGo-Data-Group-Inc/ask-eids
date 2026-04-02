"""Sandbox overlay ingestion and row enrichment helpers."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Iterable


def load_overlay(path: str | Path) -> list[dict]:
    """Load overlay records from JSON or CSV files."""
    overlay_path = Path(path)
    suffix = overlay_path.suffix.lower()

    if suffix == ".json":
        data = json.loads(overlay_path.read_text())
        if isinstance(data, list):
            return [dict(item) for item in data]
        raise ValueError("Overlay JSON must contain a list of records")

    if suffix == ".csv":
        with overlay_path.open(newline="", encoding="utf-8") as handle:
            return [dict(row) for row in csv.DictReader(handle)]

    raise ValueError(f"Unsupported overlay format: {suffix}")


def apply_overlay(rows: Iterable[dict], overlay_records: Iterable[dict]) -> list[dict]:
    """
    Merge overlay records keyed by resource_id. Overlay values replace base values
    while preserving the synthetic source markers.
    """
    indexed_overlay = {
        record["resource_id"]: record
        for record in overlay_records
        if record.get("resource_id")
    }

    merged_rows: list[dict] = []
    for row in rows:
        overlay = indexed_overlay.get(row.get("resource_id"), {})
        merged = dict(row)
        merged.update(overlay)
        if overlay:
            merged["data_source"] = "synthetic+overlay"
        merged_rows.append(merged)
    return merged_rows
