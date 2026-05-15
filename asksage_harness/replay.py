"""Prompt replay harness for Ask EIDS cost analysis.

Local mode exists for repeatability and governance. It validates the replay
pipeline, prompt inventory, dataset summary construction, and snapshot
generation without claiming model-quality validation.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from asksage_harness.cur2_loader import load_cur2_parquet


@dataclass(frozen=True)
class PromptBaseline:
    """A named baseline prompt loaded from markdown."""

    title: str
    slug: str
    instruction: str


REPLAY_REQUIREMENTS = [
    "Use only the supplied synthetic cost context.",
    "State assumptions when the summary is insufficient.",
    "Respond in markdown.",
    "Do not invent benchmarks, ROI factors, scenario counts, or cost values that are not present in the supplied summary.",
    "If the instruction asks for estimates not fully supported by the summary, provide a qualitative assessment and explicitly name the missing inputs.",
    "Prefer plain markdown with ASCII punctuation; avoid Mermaid, LaTeX, and decorative Unicode characters.",
    "Preserve the Ask EIDS reasoning role and avoid orchestration implementation detail unless asked.",
]

CUR2_REPLAY_REQUIREMENTS = [
    "Use only the supplied CUR 2.0 cost context.",
    "State assumptions when the summary is insufficient.",
    "Respond in markdown.",
    "Do not invent benchmarks, ROI factors, scenario counts, or cost values that are not present in the supplied summary.",
    "Treat high-spend rows as review candidates, not confirmed waste, unless the supplied context supports that conclusion.",
    "Prefer plain markdown with ASCII punctuation; avoid Mermaid, LaTeX, and decorative Unicode characters.",
    "Preserve the Ask EIDS reasoning role and avoid orchestration implementation detail unless asked.",
]


def slugify(value: str) -> str:
    return (
        value.lower()
        .replace("&", "and")
        .replace("/", " ")
        .replace("-", " ")
        .replace("  ", " ")
        .strip()
        .replace(" ", "_")
    )


def load_prompt_baselines(path: str | Path) -> list[PromptBaseline]:
    """Parse markdown prompt baselines from level-2 headings."""
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    prompts: list[PromptBaseline] = []
    current_title = ""
    current_body: list[str] = []

    def flush() -> None:
        nonlocal current_title, current_body
        if not current_title:
            return
        instruction = "\n".join(line.strip() for line in current_body if line.strip()).strip()
        prompts.append(
            PromptBaseline(
                title=current_title,
                slug=slugify(current_title),
                instruction=instruction,
            )
        )
        current_title = ""
        current_body = []

    for line in lines:
        if line.startswith("## "):
            flush()
            current_title = line[3:].strip()
            continue
        if line.startswith("# "):
            continue
        current_body.append(line)

    flush()
    return prompts


def resolve_dataset_type(path: str | Path, dataset_type: str = "auto") -> str:
    """Resolve dataset type from an explicit value or file extension."""
    if dataset_type != "auto":
        return dataset_type
    path = Path(path)
    if path.is_dir() and any(path.rglob("*.parquet")):
        return "cur2_parquet"
    suffix = path.suffix.lower()
    if suffix == ".parquet":
        return "cur2_parquet"
    return "synthetic_cur"


def load_dataset(path: str | Path, dataset_type: str = "auto") -> list[dict[str, Any]]:
    """Load a supported cost dataset into a normalized row list."""
    resolved_dataset_type = resolve_dataset_type(path, dataset_type)
    if resolved_dataset_type == "cur2_parquet":
        return load_cur2_parquet(path)
    if resolved_dataset_type != "synthetic_cur":
        raise ValueError(f"Unsupported dataset type: {resolved_dataset_type}")

    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [dict(row) for row in data]


def _sum_costs(rows: list[dict[str, Any]], key: str, limit: int = 5) -> list[dict[str, Any]]:
    totals: dict[str, float] = {}
    for row in rows:
        label = str(row.get(key) or "unknown")
        totals[label] = round(totals.get(label, 0.0) + float(row.get("cost") or 0.0), 2)
    return [
        {key: label, "cost": cost}
        for label, cost in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]


def build_cur2_dataset_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Produce a compact summary for real CUR 2.0 parquet inputs."""
    scenario_counts = Counter(row.get("scenario", "cur2_cost_line_item") for row in rows)
    positive_cost_rows = sorted(
        [row for row in rows if float(row.get("cost") or 0.0) > 0.0],
        key=lambda item: float(item.get("cost") or 0.0),
        reverse=True,
    )
    anomaly_examples = [
        {
            "service": row["service"],
            "region": row["region"],
            "scenario": "cur2_high_spend_candidate",
            "technical_debt_event": "not_classified",
            "usage_type": row.get("usage_type", "unknown"),
            "usage_hours": row.get("usage_hours", 0.0),
            "usage_account_id": row.get("usage_account_id", "unknown"),
            "resource_id": row.get("resource_id", "not_available"),
            "line_item_type": row.get("line_item_type", "unknown"),
            "cost": row["cost"],
            "waste_driver": "high spend candidate from CUR 2.0 line item",
            "recommended_action": "Review service, account, usage type, and resource context in CUR 2.0",
            "pmo_summary_line": row["pmo_summary_line"],
        }
        for row in positive_cost_rows[:5]
    ]

    usage_start_dates = [
        str(row["line_item_usage_start_date"])
        for row in rows
        if row.get("line_item_usage_start_date")
    ]
    usage_end_dates = [
        str(row["line_item_usage_end_date"])
        for row in rows
        if row.get("line_item_usage_end_date")
    ]

    return {
        "dataset_type": "cur2_parquet",
        "row_count": len(rows),
        "total_cost": round(sum(float(row.get("cost") or 0.0) for row in rows), 2),
        "usage_period": {
            "start": min(usage_start_dates) if usage_start_dates else None,
            "end": max(usage_end_dates) if usage_end_dates else None,
        },
        "scenario_counts": dict(sorted(scenario_counts.items())),
        "anomaly_count": len(anomaly_examples),
        "anomaly_definition": "Top positive-cost CUR 2.0 line items selected as review candidates.",
        "top_services_by_cost": [
            {"service": item["service"], "cost": item["cost"]}
            for item in _sum_costs(rows, "service")
        ],
        "top_accounts_by_cost": [
            {"usage_account_id": item["usage_account_id"], "cost": item["cost"]}
            for item in _sum_costs(rows, "usage_account_id")
        ],
        "top_regions_by_cost": [
            {"region": item["region"], "cost": item["cost"]}
            for item in _sum_costs(rows, "region")
        ],
        "top_usage_types_by_cost": [
            {"usage_type": item["usage_type"], "cost": item["cost"]}
            for item in _sum_costs(rows, "usage_type")
        ],
        "top_resources_by_cost": [
            {"resource_id": item["resource_id"], "cost": item["cost"]}
            for item in _sum_costs(
                [row for row in rows if row.get("resource_id") != "not_available"],
                "resource_id",
            )
        ],
        "anomaly_examples": anomaly_examples,
    }


def build_dataset_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Produce a compact summary suitable for prompt replay."""
    if rows and rows[0].get("data_source") == "cur2_parquet_summary":
        return dict(rows[0]["summary"])
    if rows and rows[0].get("data_source") == "cur2_parquet":
        return build_cur2_dataset_summary(rows)

    scenario_counts = Counter(row["scenario"] for row in rows)
    service_costs: dict[str, float] = {}
    anomaly_rows = [row for row in rows if row["anomaly_score"] in {"high", "medium"}]

    for row in rows:
        service_costs[row["service"]] = round(
            service_costs.get(row["service"], 0.0) + float(row["cost"]), 2
        )

    top_services = [
        {"service": service, "cost": cost}
        for service, cost in sorted(
            service_costs.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:5]
    ]
    anomaly_examples = [
        {
            "service": row["service"],
            "region": row["region"],
            "scenario": row["scenario"],
            "technical_debt_event": row["technical_debt_event"],
            "usage_hours": row["usage_hours"],
            "cost": row["cost"],
            "waste_driver": row["waste_driver"],
            "recommended_action": row["recommended_action"],
            "pmo_summary_line": row["pmo_summary_line"],
        }
        for row in anomaly_rows[:5]
    ]

    return {
        "dataset_type": "synthetic_cur",
        "row_count": len(rows),
        "scenario_counts": dict(sorted(scenario_counts.items())),
        "anomaly_count": len(anomaly_rows),
        "top_services_by_cost": top_services,
        "anomaly_examples": anomaly_examples,
    }


def build_prompt_packet_data(
    baseline: PromptBaseline,
    summary: dict[str, Any],
    dataset_path: str | Path,
) -> dict[str, Any]:
    """Build the structured replay payload prior to rendering."""
    dataset_type = summary.get("dataset_type", "synthetic_cur")
    requirements = CUR2_REPLAY_REQUIREMENTS if dataset_type == "cur2_parquet" else REPLAY_REQUIREMENTS
    summary_key = "cur2_dataset_summary" if dataset_type == "cur2_parquet" else "synthetic_dataset_summary"
    return {
        "task": baseline.title,
        "instruction": baseline.instruction,
        "dataset_path": str(dataset_path),
        "dataset_type": dataset_type,
        summary_key: summary,
        "requirements": requirements,
    }


def build_prompt_packet(
    baseline: PromptBaseline,
    summary: dict[str, Any],
    dataset_path: str | Path,
    packet_format: str = "json",
) -> str:
    """Build the replay payload that gets sent to a model."""
    packet = build_prompt_packet_data(baseline, summary, dataset_path)
    summary_key = (
        "cur2_dataset_summary"
        if packet.get("dataset_type") == "cur2_parquet"
        else "synthetic_dataset_summary"
    )
    if packet_format == "json":
        return json.dumps(packet, indent=2)
    if packet_format != "markdown":
        raise ValueError(f"Unsupported packet format: {packet_format}")

    scenario_lines = [
        f"- {scenario}: {count}"
        for scenario, count in packet[summary_key]["scenario_counts"].items()
    ]
    top_service_lines = [
        f"- {item['service']}: ${float(item['cost']):,.2f}"
        for item in packet[summary_key]["top_services_by_cost"]
    ]
    anomaly_lines = [
        (
            f"- {item['service']} | {item['region']} | {item['scenario']} | "
            f"{item['waste_driver']} | recommended: {item['recommended_action']}"
        )
        for item in packet[summary_key]["anomaly_examples"]
    ]
    dataset_label = "CUR 2.0 Dataset" if packet.get("dataset_type") == "cur2_parquet" else "Dataset"
    summary_heading = (
        "CUR 2.0 Dataset Summary JSON"
        if packet.get("dataset_type") == "cur2_parquet"
        else "Synthetic Dataset Summary JSON"
    )

    markdown_lines = [
        f"# Task: {packet['task']}",
        "",
        "## Instruction",
        packet["instruction"],
        "",
        f"## {dataset_label}",
        f"- dataset_path: {packet['dataset_path']}",
        f"- dataset_type: {packet['dataset_type']}",
        f"- row_count: {packet[summary_key]['row_count']}",
        f"- anomaly_count: {packet[summary_key]['anomaly_count']}",
        "",
        "## Scenario Counts",
        *scenario_lines,
        "",
        "## Top Services By Cost",
        *top_service_lines,
        "",
        "## Representative Anomaly Examples",
        *(anomaly_lines or ["- None"]),
        "",
        "## Requirements",
        *(f"- {item}" for item in packet["requirements"]),
        "",
        f"## {summary_heading}",
        "```json",
        json.dumps(packet[summary_key], indent=2),
        "```",
    ]
    return "\n".join(markdown_lines)


def build_payload_metadata(message: str, preview_chars: int = 600) -> dict[str, Any]:
    """Capture lightweight payload diagnostics for debugging."""
    preview = message[:preview_chars]
    return {
        "char_count": len(message),
        "byte_count_utf8": len(message.encode("utf-8")),
        "line_count": len(message.splitlines()),
        "preview": preview,
        "preview_truncated": len(preview) < len(message),
    }


def resolve_packet_format(mode: str, packet_format: str) -> str:
    """Resolve packet format defaults without hiding explicit user choice."""
    if packet_format == "auto":
        return "markdown" if mode == "asksage" else "json"
    if packet_format not in {"json", "markdown"}:
        raise ValueError(f"Unsupported packet format: {packet_format}")
    return packet_format


def parse_replay_payload(message: str) -> dict[str, Any]:
    """Parse a replay payload from either JSON or markdown packet format."""
    stripped = message.lstrip()
    if stripped.startswith("{"):
        return json.loads(message)

    title_match = re.search(r"^# Task:\s*(.+)$", message, flags=re.MULTILINE)
    instruction_match = re.search(
        r"^## Instruction\s*\n(?P<body>.*?)(?:\n## |\Z)",
        message,
        flags=re.MULTILINE | re.DOTALL,
    )
    dataset_match = re.search(r"^- dataset_path:\s*(.+)$", message, flags=re.MULTILINE)
    dataset_type_match = re.search(r"^- dataset_type:\s*(.+)$", message, flags=re.MULTILINE)
    summary_match = re.search(
        r"^## (?:Synthetic Dataset Summary JSON|CUR 2\.0 Dataset Summary JSON)\s*\n```json\s*\n(?P<body>.*?)\n```",
        message,
        flags=re.MULTILINE | re.DOTALL,
    )

    if not title_match or not summary_match:
        raise ValueError("Replay payload format is not recognized")

    requirements = re.findall(r"^## Requirements\s*$([\s\S]*?)(?:^## |\Z)", message, flags=re.MULTILINE)
    requirement_lines: list[str] = []
    if requirements:
        requirement_lines = [
            line[2:].strip()
            for line in requirements[0].splitlines()
            if line.strip().startswith("- ")
        ]

    summary = json.loads(summary_match.group("body"))
    dataset_type = (
        dataset_type_match.group(1).strip()
        if dataset_type_match
        else summary.get("dataset_type", "synthetic_cur")
    )

    return {
        "task": title_match.group(1).strip(),
        "instruction": instruction_match.group("body").strip() if instruction_match else "",
        "dataset_path": dataset_match.group(1).strip() if dataset_match else "",
        "dataset_type": dataset_type,
        "synthetic_dataset_summary": summary,
        "cur2_dataset_summary": summary if dataset_type == "cur2_parquet" else None,
        "requirements": requirement_lines,
    }


class LocalReplayClient:
    """Deterministic fallback for governance baselines, not model validation."""

    def query(self, message: str, model: str) -> dict[str, str]:
        payload = parse_replay_payload(message)
        task = payload["task"]
        summary = payload.get("synthetic_dataset_summary") or payload.get("cur2_dataset_summary")
        top_service = summary["top_services_by_cost"][0]
        anomaly_lines = [
            (
                f"- {item['service']} in {item['region']}: {item['waste_driver']} "
                f"at ${float(item['cost']):,.2f}"
            )
            for item in summary["anomaly_examples"][:3]
        ]

        if task == "Cost Anomaly Detection":
            content = "\n".join(
                [
                    "# Cost Anomaly Detection",
                    "",
                    f"- Rows analyzed: {summary['row_count']}",
                    f"- High or medium anomalies: {summary['anomaly_count']}",
                    f"- Highest cost service: {top_service['service']} at ${float(top_service['cost']):,.2f}",
                    "",
                    "## Representative anomalies",
                    *anomaly_lines,
                ]
            )
        elif task == "Technical Debt Correlation":
            events = Counter(
                item["technical_debt_event"] for item in summary["anomaly_examples"]
            )
            content = "\n".join(
                [
                    "# Technical Debt Correlation",
                    "",
                    "## Top debt signals",
                    *(
                        f"- {event}: {count} anomaly examples"
                        for event, count in events.items()
                    ),
                    "",
                    "## Interpretation",
                    "Repeated operational gaps align with measurable synthetic waste drivers in the dataset summary.",
                ]
            )
        elif task == "FTE Replacement ROI":
            hours_saved = max(4, summary["anomaly_count"] * 2)
            content = "\n".join(
                [
                    "# FTE Replacement ROI",
                    "",
                    f"- Estimated analyst hours saved per review cycle: {hours_saved}",
                    f"- Basis: {summary['anomaly_count']} anomalies summarized from {summary['row_count']} rows",
                    "- Recommendation: use Ask EIDS to triage anomalies and draft first-pass narratives.",
                ]
            )
        elif task == "PMO Executive Summary":
            content = "\n".join(
                [
                    "# PMO Executive Summary",
                    "",
                    f"- Synthetic rows reviewed: {summary['row_count']}",
                    f"- Anomalies requiring attention: {summary['anomaly_count']}",
                    f"- Highest cost concentration: {top_service['service']} at ${float(top_service['cost']):,.2f}",
                    "- Recommended next action: prioritize the dominant waste driver and validate prompt promotion criteria.",
                ]
            )
        else:
            content = "\n".join(
                [
                    "# Bedrock Transition Recommendation",
                    "",
                    "- Promote cost anomaly detection and PMO summary prompts first.",
                    "- Keep technical debt correlation in the reasoning layer until more scenarios are available.",
                    "- Preserve markdown and JSON handoff outputs for Bedrock orchestration.",
                ]
            )

        return {"message": content}


def extract_response_text(response: Any) -> str:
    """Extract text from common AskSage-style response shapes."""
    if response is None:
        return ""
    if isinstance(response, str):
        return response
    if isinstance(response, dict):
        for key in ("message", "response", "content", "answer", "text"):
            value = response.get(key)
            if isinstance(value, str):
                return value
            if value:
                nested = extract_response_text(value)
                if nested:
                    return nested
        for key in ("choices", "messages", "parts", "delta"):
            value = response.get(key)
            if value:
                nested = extract_response_text(value)
                if nested:
                    return nested
        return json.dumps(response, indent=2)
    if isinstance(response, list):
        parts = [extract_response_text(item) for item in response]
        return "\n".join(part for part in parts if part)
    return str(response)


def create_client(mode: str, email: str | None = None, api_key: str | None = None) -> Any:
    """Create either a deterministic local client or the real AskSage client."""
    if mode == "local":
        return LocalReplayClient()

    try:
        from asksageclient import AskSageClient
    except ImportError as exc:
        raise RuntimeError(
            "asksageclient is not installed; use --mode local or install it in the enclave environment"
        ) from exc

    client_kwargs = {
        "email": email or os.getenv("ASKSAGE_EMAIL"),
        "api_key": api_key or os.getenv("ASKSAGE_API_KEY"),
        "user_base_url": os.getenv("ASKSAGE_USER_BASE_URL", "https://api.genai.army.mil/user/"),
        "server_base_url": os.getenv("ASKSAGE_SERVER_BASE_URL", "https://api.genai.army.mil/server/"),
    }
    ca_bundle = os.getenv("ASKSAGE_CA_BUNDLE")
    if ca_bundle:
        client_kwargs["path_to_CA_Bundle"] = ca_bundle

    missing = [key for key in ("email", "api_key") if not client_kwargs[key]]
    if missing:
        raise RuntimeError(f"Missing AskSage credentials: {', '.join(missing)}")

    return AskSageClient(**client_kwargs)


def emit_snapshot_markdown(record: dict[str, Any]) -> str:
    """Render one replay result as markdown."""
    return "\n".join(
        [
            f"# {record['title']}",
            "",
            "## Prompt",
            record["instruction"],
            "",
            "## Response",
            record["response_markdown"].strip(),
            "",
            "## Metadata",
            f"- prompt_slug: {record['slug']}",
            f"- model: {record['model']}",
            f"- mode: {record['mode']}",
            f"- generated_at: {record['generated_at']}",
        ]
    )


def load_manifest(path: str | Path) -> dict[str, Any]:
    """Load a harness manifest JSON file."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def compare_snapshot_dirs(
    baseline_dir: str | Path,
    candidate_dir: str | Path,
    output_dir: str | Path,
) -> dict[str, Any]:
    """Compare two snapshot directories and emit markdown and JSON summaries."""
    baseline_path = Path(baseline_dir)
    candidate_path = Path(candidate_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    baseline_manifest = load_manifest(baseline_path / "manifest.json")
    candidate_manifest = load_manifest(candidate_path / "manifest.json")

    baseline_by_slug = {
        item["slug"]: item for item in baseline_manifest["snapshots"]
    }
    candidate_by_slug = {
        item["slug"]: item for item in candidate_manifest["snapshots"]
    }
    all_slugs = sorted(set(baseline_by_slug) | set(candidate_by_slug))

    comparisons: list[dict[str, Any]] = []
    markdown_lines = [
        "# Harness Comparison",
        "",
        "## Run Metadata",
        f"- baseline_dir: {baseline_path}",
        f"- candidate_dir: {candidate_path}",
        f"- baseline_mode: {baseline_manifest.get('mode', 'unknown')}",
        f"- candidate_mode: {candidate_manifest.get('mode', 'unknown')}",
        f"- baseline_type: {baseline_manifest.get('baseline_type', 'unknown')}",
        f"- candidate_type: {candidate_manifest.get('baseline_type', 'unknown')}",
        "",
        "## Prompt Comparisons",
    ]

    for slug in all_slugs:
        baseline_item = baseline_by_slug.get(slug)
        candidate_item = candidate_by_slug.get(slug)
        baseline_json = (
            json.loads(Path(baseline_item["json"]).read_text(encoding="utf-8"))
            if baseline_item
            else None
        )
        candidate_json = (
            json.loads(Path(candidate_item["json"]).read_text(encoding="utf-8"))
            if candidate_item
            else None
        )

        baseline_text = baseline_json["response_markdown"] if baseline_json else ""
        candidate_text = candidate_json["response_markdown"] if candidate_json else ""
        changed = baseline_text != candidate_text
        diff_lines = list(
            difflib.unified_diff(
                baseline_text.splitlines(),
                candidate_text.splitlines(),
                fromfile=f"{slug}:baseline",
                tofile=f"{slug}:candidate",
                lineterm="",
            )
        )

        comparisons.append(
            {
                "slug": slug,
                "title": candidate_json["title"] if candidate_json else baseline_json["title"],
                "baseline_present": baseline_json is not None,
                "candidate_present": candidate_json is not None,
                "changed": changed,
                "baseline_chars": len(baseline_text),
                "candidate_chars": len(candidate_text),
                "diff_line_count": len(diff_lines),
                "diff": diff_lines,
            }
        )

        status = "changed" if changed else "unchanged"
        markdown_lines.extend(
            [
                f"### {slug}",
                f"- status: {status}",
                f"- baseline_present: {baseline_json is not None}",
                f"- candidate_present: {candidate_json is not None}",
                f"- baseline_chars: {len(baseline_text)}",
                f"- candidate_chars: {len(candidate_text)}",
                f"- diff_line_count: {len(diff_lines)}",
            ]
        )
        if diff_lines:
            markdown_lines.extend(
                [
                    "",
                    "```diff",
                    *diff_lines[:80],
                    "```",
                ]
            )
        markdown_lines.append("")

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "baseline_dir": str(baseline_path),
        "candidate_dir": str(candidate_path),
        "baseline_mode": baseline_manifest.get("mode"),
        "candidate_mode": candidate_manifest.get("mode"),
        "baseline_type": baseline_manifest.get("baseline_type"),
        "candidate_type": candidate_manifest.get("baseline_type"),
        "prompt_count": len(all_slugs),
        "changed_prompt_count": len([item for item in comparisons if item["changed"]]),
        "comparisons": comparisons,
    }

    (output_path / "comparison.md").write_text("\n".join(markdown_lines), encoding="utf-8")
    (output_path / "comparison.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def run_replay(
    prompts_path: str | Path,
    dataset_path: str | Path,
    output_dir: str | Path,
    dataset_type: str = "auto",
    mode: str = "local",
    model: str = "gpt-4o",
    packet_format: str = "auto",
    payload_preview_chars: int = 600,
    print_payload_stats: bool = False,
    email: str | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Replay all baseline prompts against a dataset summary and write snapshots."""
    prompts = load_prompt_baselines(prompts_path)
    resolved_dataset_type = resolve_dataset_type(dataset_path, dataset_type)
    rows = load_dataset(dataset_path, dataset_type=resolved_dataset_type)
    summary = build_dataset_summary(rows)
    client = create_client(mode=mode, email=email, api_key=api_key)
    resolved_packet_format = resolve_packet_format(mode=mode, packet_format=packet_format)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    results: list[dict[str, Any]] = []

    for baseline in prompts:
        payload = build_prompt_packet(
            baseline,
            summary,
            dataset_path,
            packet_format=resolved_packet_format,
        )
        payload_metadata = build_payload_metadata(payload, preview_chars=payload_preview_chars)
        if print_payload_stats:
            print(
                json.dumps(
                    {
                        "slug": baseline.slug,
                        "packet_format": resolved_packet_format,
                        **payload_metadata,
                    },
                    indent=2,
                )
            )
        response = client.query(message=payload, model=model)
        response_text = extract_response_text(response)
        record = {
            "title": baseline.title,
            "slug": baseline.slug,
            "instruction": baseline.instruction,
            "mode": mode,
            "model": model,
            "generated_at": timestamp,
            "dataset_path": str(dataset_path),
            "packet_format": resolved_packet_format,
            "prompt_message": payload,
            "prompt_packet": (
                build_prompt_packet_data(baseline, summary, dataset_path)
                if resolved_packet_format == "json"
                else None
            ),
            "payload_metadata": payload_metadata,
            "response_markdown": response_text,
        }
        results.append(record)

        markdown_path = output_path / f"{baseline.slug}.md"
        json_path = output_path / f"{baseline.slug}.json"
        markdown_path.write_text(emit_snapshot_markdown(record), encoding="utf-8")
        json_path.write_text(json.dumps(record, indent=2), encoding="utf-8")

    manifest = {
        "generated_at": timestamp,
        "mode": mode,
        "baseline_type": (
            "governance_repeatability"
            if mode == "local"
            else "operational_reasoning"
        ),
        "mode_description": (
            "Deterministic local replay for governance, repeatability, and auditable snapshots."
            if mode == "local"
            else "Real AskSage execution for reasoning and output validation."
        ),
        "model": model,
        "packet_format": resolved_packet_format,
        "dataset_type": resolved_dataset_type,
        "dataset_path": str(dataset_path),
        "prompt_count": len(prompts),
        "summary": summary,
        "snapshots": [
            {
                "title": result["title"],
                "slug": result["slug"],
                "markdown": str(output_path / f"{result['slug']}.md"),
                "json": str(output_path / f"{result['slug']}.json"),
            }
            for result in results
        ],
    }
    manifest_path = output_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        nargs="?",
        default="replay",
        choices=("replay", "compare"),
        help="Run prompt replay or compare two snapshot directories.",
    )
    parser.add_argument(
        "--prompts",
        type=Path,
        default=Path("prompts/cost_cur/analyst_prompts.md"),
        help="Markdown file containing level-2 prompt baselines.",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path("output/phase1/synthetic_cur.json"),
        help="Dataset path. Supports synthetic JSON and CUR 2.0 parquet.",
    )
    parser.add_argument(
        "--dataset-type",
        choices=("auto", "synthetic_cur", "cur2_parquet"),
        default="auto",
        help="Dataset type. auto treats .parquet as CUR 2.0 and other inputs as synthetic JSON.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output/asksage_harness"),
        help="Directory for replay snapshots.",
    )
    parser.add_argument(
        "--mode",
        choices=("local", "asksage"),
        default="local",
        help="Use deterministic local replay or the real AskSage client.",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o",
        help="Model name to pass to the replay client.",
    )
    parser.add_argument(
        "--packet-format",
        choices=("auto", "json", "markdown"),
        default="auto",
        help="Render replay payloads as JSON or markdown/plain text. auto uses markdown for asksage and json for local.",
    )
    parser.add_argument(
        "--payload-preview-chars",
        type=int,
        default=600,
        help="Number of payload characters to persist in preview metadata.",
    )
    parser.add_argument(
        "--print-payload-stats",
        action="store_true",
        help="Print payload size and preview metadata for each prompt during replay.",
    )
    parser.add_argument("--email", default=None, help="Optional AskSage email override.")
    parser.add_argument("--api-key", default=None, help="Optional AskSage API key override.")
    parser.add_argument(
        "--baseline-dir",
        type=Path,
        default=None,
        help="Snapshot directory used as the baseline for compare mode.",
    )
    parser.add_argument(
        "--candidate-dir",
        type=Path,
        default=None,
        help="Snapshot directory used as the candidate for compare mode.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "compare":
        if not args.baseline_dir or not args.candidate_dir:
            raise SystemExit("compare mode requires --baseline-dir and --candidate-dir")
        summary = compare_snapshot_dirs(
            baseline_dir=args.baseline_dir,
            candidate_dir=args.candidate_dir,
            output_dir=args.output_dir,
        )
        print(json.dumps(summary, indent=2))
        return

    manifest = run_replay(
        prompts_path=args.prompts,
        dataset_path=args.dataset,
        output_dir=args.output_dir,
        dataset_type=args.dataset_type,
        mode=args.mode,
        model=args.model,
        packet_format=args.packet_format,
        payload_preview_chars=args.payload_preview_chars,
        print_payload_stats=args.print_payload_stats,
        email=args.email,
        api_key=args.api_key,
    )
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
