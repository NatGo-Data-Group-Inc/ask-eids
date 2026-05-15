"""CUR 2.0 parquet streaming aggregation helpers."""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pyarrow.dataset as ds


COST_COLUMNS = (
    "line_item_unblended_cost",
    "line_item_blended_cost",
    "net_unblended_cost",
    "line_item_net_unblended_cost",
)

SUMMARY_COLUMNS = (
    *COST_COLUMNS,
    "line_item_usage_start_date",
    "line_item_usage_end_date",
    "line_item_usage_account_id",
    "line_item_usage_type",
    "line_item_usage_amount",
    "line_item_resource_id",
    "line_item_line_item_type",
    "line_item_operation",
    "line_item_product_code",
    "line_item_legal_entity",
    "product_product_name",
    "product_servicecode",
    "product_region",
    "product_region_code",
    "region",
    "resource_id",
    "usage_account_id",
    "operation",
    "product",
)


def _first_present(row: dict[str, Any], names: tuple[str, ...], default: Any = None) -> Any:
    for name in names:
        value = row.get(name)
        if value not in (None, ""):
            return value
    return default


def _as_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_text(value: Any, default: str = "unknown") -> str:
    if value in (None, ""):
        return default
    return str(value)


def _map_value(value: Any, keys: tuple[str, ...]) -> Any:
    if not value:
        return None
    if isinstance(value, dict):
        for key in keys:
            if key in value and value[key] not in (None, ""):
                return value[key]
        return None
    if isinstance(value, list):
        pairs: dict[str, Any] = {}
        for item in value:
            if isinstance(item, dict):
                key = item.get("key")
                item_value = item.get("value")
                if key is not None:
                    pairs[str(key)] = item_value
            elif isinstance(item, (tuple, list)) and len(item) == 2:
                pairs[str(item[0])] = item[1]
        return _map_value(pairs, keys)
    return None


def _service_name(row: dict[str, Any]) -> str:
    product = row.get("product")
    value = _first_present(
        row,
        (
            "product_product_name",
            "product_servicecode",
            "line_item_product_code",
            "line_item_legal_entity",
        ),
    )
    if value:
        return _as_text(value)

    mapped = _map_value(
        product,
        (
            "product_name",
            "ProductName",
            "servicecode",
            "serviceCode",
            "service_name",
        ),
    )
    if mapped:
        return _as_text(mapped)

    usage_type = _as_text(row.get("line_item_usage_type"), "")
    return usage_type.split("-")[0] if "-" in usage_type else "unknown"


def _region(row: dict[str, Any]) -> str:
    product = row.get("product")
    value = _first_present(row, ("product_region", "product_region_code", "region"))
    if value:
        return _as_text(value)

    mapped = _map_value(product, ("region", "regionCode", "region_code", "location"))
    return _as_text(mapped)


def _selected_cost(row: dict[str, Any]) -> float:
    return _as_float(_first_present(row, COST_COLUMNS))


def _top_cost_items(totals: dict[str, float], key: str, limit: int = 5) -> list[dict[str, Any]]:
    return [
        {key: label, "cost": round(cost, 2)}
        for label, cost in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]


def _source_files(dataset: ds.Dataset) -> list[str]:
    files = getattr(dataset, "files", None)
    if files is None:
        return []
    return [str(file) for file in files]


def summarize_cur2_parquet(path: str | Path, batch_size: int = 100_000) -> dict[str, Any]:
    """Summarize CUR 2.0 parquet without materializing all rows."""
    dataset = ds.dataset(path, format="parquet")
    schema_names = set(dataset.schema.names)
    columns = [column for column in SUMMARY_COLUMNS if column in schema_names]
    scanner = dataset.scanner(columns=columns, batch_size=batch_size)
    source_files = _source_files(dataset)

    row_count = 0
    selected_total_cost = 0.0
    cost_column_totals: dict[str, float] = defaultdict(float)
    service_totals: dict[str, float] = defaultdict(float)
    account_totals: dict[str, float] = defaultdict(float)
    region_totals: dict[str, float] = defaultdict(float)
    usage_type_totals: dict[str, float] = defaultdict(float)
    resource_totals: dict[str, float] = defaultdict(float)
    line_item_type_totals: dict[str, float] = defaultdict(float)
    scenario_counts: Counter[str] = Counter()
    usage_start_values: list[str] = []
    usage_end_values: list[str] = []
    top_candidates: list[dict[str, Any]] = []

    for batch in scanner.to_batches():
        data = batch.to_pydict()
        batch_rows = batch.num_rows
        row_count += batch_rows

        for index in range(batch_rows):
            row = {column: values[index] for column, values in data.items()}
            cost = _selected_cost(row)
            service = _service_name(row)
            region = _region(row)
            usage_type = _as_text(row.get("line_item_usage_type"))
            usage_amount = _as_float(row.get("line_item_usage_amount"))
            usage_account_id = _as_text(
                _first_present(row, ("line_item_usage_account_id", "usage_account_id"))
            )
            resource_id = _as_text(
                _first_present(row, ("line_item_resource_id", "resource_id"), default="not_available")
            )
            line_item_type = _as_text(row.get("line_item_line_item_type"))

            selected_total_cost += cost
            scenario_counts["cur2_cost_line_item"] += 1
            service_totals[service] += cost
            account_totals[usage_account_id] += cost
            region_totals[region] += cost
            usage_type_totals[usage_type] += cost
            line_item_type_totals[line_item_type] += cost
            if resource_id != "not_available":
                resource_totals[resource_id] += cost

            for cost_column in COST_COLUMNS:
                if cost_column in row:
                    cost_column_totals[cost_column] += _as_float(row.get(cost_column))

            if row.get("line_item_usage_start_date") not in (None, ""):
                usage_start_values.append(str(row["line_item_usage_start_date"]))
            if row.get("line_item_usage_end_date") not in (None, ""):
                usage_end_values.append(str(row["line_item_usage_end_date"]))

            candidate = {
                "service": service,
                "region": region,
                "scenario": "cur2_high_spend_candidate",
                "technical_debt_event": "not_classified",
                "usage_type": usage_type,
                "usage_hours": usage_amount,
                "usage_account_id": usage_account_id,
                "resource_id": resource_id,
                "line_item_type": line_item_type,
                "cost": round(cost, 2),
                "waste_driver": "high spend candidate from CUR 2.0 line item",
                "recommended_action": "Review service, account, usage type, and resource context in CUR 2.0",
                "pmo_summary_line": (
                    f"{service} cost line item in {region} for {usage_type} totaled ${cost:,.2f}"
                ),
            }
            top_candidates.append(candidate)
            top_candidates = sorted(
                top_candidates,
                key=lambda item: float(item["cost"]),
                reverse=True,
            )[:5]

    return {
        "dataset_type": "cur2_parquet",
        "source_path": str(path),
        "source_file_count": len(source_files),
        "source_files": source_files[:50],
        "source_files_truncated": len(source_files) > 50,
        "row_count": row_count,
        "total_cost": round(selected_total_cost, 2),
        "cost_column_totals": {
            column: round(total, 2)
            for column, total in sorted(cost_column_totals.items())
        },
        "usage_period": {
            "start": min(usage_start_values) if usage_start_values else None,
            "end": max(usage_end_values) if usage_end_values else None,
        },
        "scenario_counts": dict(sorted(scenario_counts.items())),
        "anomaly_count": len(top_candidates),
        "anomaly_definition": "Top positive-cost CUR 2.0 line items selected as review candidates.",
        "top_services_by_cost": _top_cost_items(service_totals, "service"),
        "top_accounts_by_cost": _top_cost_items(account_totals, "usage_account_id"),
        "top_regions_by_cost": _top_cost_items(region_totals, "region"),
        "top_usage_types_by_cost": _top_cost_items(usage_type_totals, "usage_type"),
        "top_resources_by_cost": _top_cost_items(resource_totals, "resource_id"),
        "line_item_types_by_cost": _top_cost_items(line_item_type_totals, "line_item_type", limit=20),
        "anomaly_examples": top_candidates,
    }


def load_cur2_parquet(path: str | Path) -> list[dict[str, Any]]:
    """Return a summary sentinel for compatibility with the generic loader API."""
    return [{"data_source": "cur2_parquet_summary", "summary": summarize_cur2_parquet(path)}]
