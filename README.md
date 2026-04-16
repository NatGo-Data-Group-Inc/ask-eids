# Ask EIDS Feasibility Prototype

This repository contains the Phase 1 feasibility implementation for Ask EIDS: a synthetic AWS Cost and Usage Report (CUR)-shaped data foundation designed for enclave-friendly cost analysis and future Amazon Bedrock orchestration.

The project now supports multiple Ask EIDS analysis capabilities under `prompts/<capability_id>/`, so the current CUR cost workflow can live beside future prompt packs such as EMR log analysis.

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
- [asksage_harness/replay.py](/home/tjansto/github/natgo/ask-eids/asksage_harness/replay.py) replays baseline prompts against synthetic cost data and captures snapshots
- [prompts/README.md](/home/tjansto/github/natgo/ask-eids/prompts/README.md) describes the capability prompt-pack layout
- [prompts/cost_cur/](/home/tjansto/github/natgo/ask-eids/prompts/cost_cur) contains the current CUR cost-analysis capability
- [prompts/emr_logs/](/home/tjansto/github/natgo/ask-eids/prompts/emr_logs) contains the EMR log-analysis scaffold
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
.venv/bin/python -m data_gen.synthetic_cur --capability cost_cur --rows 250 --seed 42 --output-dir output/phase1
```

Generated outputs include:

- `output/phase1/synthetic_cur.parquet`
- `output/phase1/synthetic_cur.csv`
- `output/phase1/synthetic_cur.json`
- `output/phase1/sample_validation.json`
- `output/phase1/capability_manifest.json`
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
  --capability cost_cur \
  --overlay path/to/overlay.json \
  --output-dir output/phase1
```

## Capability Prompt Packs

Each Ask EIDS capability now has its own folder under `prompts/` with a `capability.json` manifest and prompt markdown files.

- `cost_cur` is the implemented Phase 1 capability and is compatible with `data_gen.synthetic_cur`
- `emr_logs` is a scaffold showing how additional enclave analyses can be added without changing the CUR prompt pack

If you point `data_gen.synthetic_cur` at a capability whose `input_type` is not `synthetic_cur`, it will fail fast so incompatible data generators are not mixed with the wrong prompt pack.

## EMR Artifact Triage Workflow

The `emr_logs` capability now includes an offline analyzer for master-node triage bundles:

```bash
python -m emr_triage.analyze_artifacts
```

If `--bundle` is omitted, the analyzer automatically selects the newest `.tgz`, `.tar.gz`, or `.tar` file under `input/emr_triage/`.
If `--output-dir` and `--scratch-dir` are omitted, the analyzer writes beside the bundle under:

- `input/emr_triage/_analysis/<bundle-name>/`
- `input/emr_triage/_scratch/`

The bundle may be either:

- an extracted artifact directory
- a `.tar`, `.tar.gz`, or `.tgz` archive

Outputs:

- `emr_log_summary.json`: structured findings and evidence
- `emr_log_findings.md`: analyst-readable A-F diagnosis report
- `emr_prompt_brief.txt`: prompt-ready brief to paste or attach to Ask EIDS / AskSage in the enclave

This supports the expected two-step process:

1. Build and validate tooling here.
2. Move the repo into the enclave and run the analyzer against the actual EMR artifact bundle there.

If you want to target a specific bundle name instead of the latest one:

```bash
python -m emr_triage.analyze_artifacts \
  --bundle input/emr_triage/emr_master_triage_20260416_090345.tgz \
  --output-dir input/emr_triage/_analysis/manual_run \
  --scratch-dir input/emr_triage/_scratch
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
- Capability prompt-pack registry under `prompts/<capability_id>/`
- Sample I/O validation
- PMO markdown reporting
- Bedrock orchestration stub
- AskSage prompt replay harness
- Markdown and JSON output snapshots

Next work should focus on Phase 2 scenario expansion and richer AskSage evaluation criteria.
