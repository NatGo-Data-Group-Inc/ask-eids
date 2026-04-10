# Ask EIDS Feasibility Prototype

This repository contains the Phase 1 feasibility implementation for Ask EIDS: a synthetic AWS Cost and Usage Report (CUR)-shaped data foundation designed for enclave-friendly cost analysis and future Amazon Bedrock orchestration.

## Scope

- Generate synthetic CUR-shaped cost records with a GovCloud-oriented service mix
- Export canonical data artifacts as parquet, CSV, and JSON
- Validate seeded anomaly output against [SAMPLE_IO.md](/home/tjansto/github/natgo/ask-eids/SAMPLE_IO.md)
- Emit PMO-readable markdown summaries
- Preserve the ADR split:
  - Ask EIDS = reasoning layer
  - Bedrock = orchestration layer

## Repository Layout

- [data_gen/synthetic_cur.py](/home/tjansto/github/natgo/ask-eids/data_gen/synthetic_cur.py) generates synthetic CUR data and reports
- [data_gen/sandbox_overlay.py](/home/tjansto/github/natgo/ask-eids/data_gen/sandbox_overlay.py) merges optional sandbox overlays by `resource_id`
- [prompts/PROMPT_BASELINES.md](/home/tjansto/github/natgo/ask-eids/prompts/PROMPT_BASELINES.md) contains initial reasoning prompts
- [asksage_harness/replay.py](/home/tjansto/github/natgo/ask-eids/asksage_harness/replay.py) replays baseline prompts against synthetic cost data and captures snapshots
- [bedrock_flow/README.md](/home/tjansto/github/natgo/ask-eids/bedrock_flow/README.md) describes orchestration ownership
- [tests/test_phase1_synthetic_cur.py](/home/tjansto/github/natgo/ask-eids/tests/test_phase1_synthetic_cur.py) covers generation, validation, overlay merge, and artifact emission

## Setup

Create a local virtual environment and install dependencies:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt pytest
```

## Generate Phase 1 Artifacts

```bash
.venv/bin/python -m data_gen.synthetic_cur --rows 250 --seed 42 --output-dir output/phase1
```

Generated outputs include:

- `output/phase1/synthetic_cur.parquet`
- `output/phase1/synthetic_cur.csv`
- `output/phase1/synthetic_cur.json`
- `output/phase1/sample_validation.json`
- `output/phase1/pmo_executive_summary.md`
- `output/phase1/cost_anomaly_report.md`
- `output/phase1/feasibility_findings.md`
- `output/phase1/bedrock_flow_stub.json`

## Optional Overlay Input

Overlay files may be passed as CSV or JSON and are merged by `resource_id`:

```bash
.venv/bin/python -m data_gen.synthetic_cur \
  --rows 250 \
  --seed 42 \
  --overlay path/to/overlay.json \
  --output-dir output/phase1
```

## Run Tests

```bash
.venv/bin/pytest -q
```

## Run The AskSage Harness

Replay the baseline prompt pack in deterministic local mode:

```bash
.venv/bin/python -m asksage_harness.replay --mode local
```

Use local mode when you want a governance baseline:

- fixed synthetic dataset input
- fixed prompt inventory
- deterministic replay behavior
- auditable markdown, JSON, and manifest outputs

Local mode validates harness repeatability. It does not validate real AskSage reasoning quality.

When enclave credentials and `asksageclient` are available, run against AskSage:

```bash
ASKSAGE_EMAIL=you@example.mil \
ASKSAGE_API_KEY=... \
.venv/bin/python -m asksage_harness.replay --mode asksage --model gpt-4o
```

Use `--mode asksage` when you want the operational reasoning baseline: actual model outputs, prompt quality evaluation, and enclave connectivity validation.

Compare two harness runs without using raw shell `diff`:

```bash
.venv/bin/python -m asksage_harness.replay compare \
  --baseline-dir output/asksage_harness_local \
  --candidate-dir output/asksage_harness \
  --output-dir output/asksage_compare
```

## Current Status

Phase 1 and the initial Phase 3 harness are implemented:

- Synthetic CUR generator
- GovCloud service mix
- Parquet/CSV/JSON outputs
- Overlay adapter
- Sample I/O validation
- PMO markdown reporting
- Bedrock orchestration stub
- AskSage prompt replay harness
- Markdown and JSON output snapshots

Next work should focus on Phase 2 scenario expansion and richer AskSage evaluation criteria.
