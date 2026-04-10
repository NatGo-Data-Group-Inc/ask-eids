# Enclave Debug Handoff

## Purpose

This document preserves the current investigation state for continuing Ask EIDS / AskSage debugging on a separate system that has connectivity into the enclave environment.

Use this file as the primary handoff artifact for Codex or another engineer.

## Suggested Codex Prompt

Use this exact prompt on the connected system:

```text
Read ENCLAVE_DEBUG_HANDOFF.md and continue the investigation.

Focus on the AskSage replay harness failure mode. The key issue is that the interactive client works for small prompts, but the replay harness fails in AskSage mode. Determine whether the problem is payload format, payload size, specific fields in the packet, or asksageclient query behavior. Prefer minimally invasive debugging changes. If appropriate, implement a way to inspect or switch packet formats, such as JSON vs markdown/plain text, while preserving the current harness architecture.
```

## Project Intent

- Repository: Ask EIDS feasibility prototype
- Goal: validate AI-assisted analysis over synthetic AWS cost data in an enclave-compatible workflow
- Reasoning layer: AskSage / Ask EIDS
- Orchestration/governance layer: Amazon Bedrock

This is not a Bedrock runtime project yet. Bedrock is scaffolded for later productionization. AskSage is the active reasoning path being tested.

## Current Architecture

- `data_gen/`
  Generates synthetic CUR-shaped AWS cost data and markdown reports
- `output/phase1/`
  Canonical synthetic dataset bundle and reports
- `asksage_harness/replay.py`
  Prompt replay harness
- `prompts/PROMPT_BASELINES.md`
  Baseline reasoning prompt pack
- `python/client/asksage_client.py`
  Interactive AskSage client

Key architecture split:

- AskSage = interactive reasoning, prompt discovery, prompt validation
- Bedrock = future orchestration, prompt governance, lifecycle, and workflow execution

## What Is Already Implemented

### Phase 1 Synthetic Data Foundation

Implemented and verified:

- synthetic CUR-shaped row generation
- GovCloud-oriented service mix
- scenario injection
- parquet, CSV, and JSON outputs
- sample validation
- PMO markdown reporting
- Bedrock flow stub

Primary files:

- `data_gen/synthetic_cur.py`
- `data_gen/sandbox_overlay.py`
- `output/phase1/synthetic_cur.json`
- `output/phase1/cost_anomaly_report.md`
- `output/phase1/pmo_executive_summary.md`

### AskSage Harness

Implemented and verified:

- local replay mode
- AskSage replay mode
- compare mode
- markdown and JSON snapshots
- manifest generation

Primary file:

- `asksage_harness/replay.py`

## Meaning Of Harness Modes

- `--mode local`
  Governance and repeatability baseline only
- `--mode asksage`
  Real AskSage reasoning path
- `compare`
  Diffs local baseline vs AskSage output

Local mode is not model validation. It only validates dataset loading, prompt loading, summary construction, and snapshot writing.

## Current Dataset Facts

From the current synthetic dataset bundle:

- row count: 250
- anomaly count: 28
- scenario counts:
  - `baseline_operations`: 222
  - `cluster_left_running`: 12
  - `orphan_ebs_leakage`: 8
  - `redshift_scan_spike`: 8
- top services by synthetic cost:
  - `AmazonEMR`: 54650.43
  - `AmazonRedshift`: 12679.57
  - `AmazonEC2`: 4472.76
  - `AWSGlue`: 601.98
  - `AmazonS3`: 49.03

These values appear in:

- `output/phase1/cost_anomaly_report.md`
- `output/phase1/pmo_executive_summary.md`
- harness manifests under `output/asksage_harness*/manifest.json`

## Important Code Changes Already Made

### Row Consistency Fix

Synthetic anomaly rows were previously inconsistent when scenario injection changed the service but did not update all service-specific CUR fields.

This was fixed so that scenario rows now keep these fields aligned:

- `line_item_product_code`
- `line_item_usage_type`
- `line_item_operation`
- `pricing_unit`
- `resource_id`

Relevant file:

- `data_gen/synthetic_cur.py`

### Python 3.10 Compatibility Fix

The enclave runtime uses Python 3.10. `datetime.UTC` caused failures because it is Python 3.11+.

This was already fixed by switching to `timezone.utc` in:

- `asksage_harness/replay.py`
- `python/client/asksage_client.py`
- `data_gen/synthetic_cur.py`

## What Has Been Verified

### Local System

Verified locally:

- tests passed after harness implementation
- local mode runs successfully
- compare mode runs successfully

### Enclave

Verified in enclave:

- the interactive AskSage client works for small prompts
- local harness mode works once the synthetic JSON artifact is present
- AskSage harness mode runs and returns responses from the service path
- compare mode works once both local and AskSage runs exist

## Confirmed Failure History

### Failure 1: Missing Dataset In Enclave

Observed:

- `output/phase1/synthetic_cur.json` was missing in the enclave copy

Result:

- local mode failed until the synthetic data bundle was copied over

This is resolved.

### Failure 2: `gpt-4o` Model Unavailable

Observed on April 10, 2026:

- AskSage harness run with `--model gpt-4o` returned:
  - `Sorry, this model is no longer available. Please use a more recent version`

Artifacts:

- `output/asksage_harness/*.md`
- `output/asksage_compare/comparison.json`

Interpretation:

- the harness and service path were live
- the model selection was not executable in that environment

### Failure 3: `gpt-4.1` Internal Error

Observed on April 10, 2026:

- AskSage harness rerun with `--model gpt-4.1`
- all five prompts returned:
  - `Internal error`

Artifacts:

- `output/asksage_harness/manifest.json`
- `output/asksage_harness/cost_anomaly_detection.md`
- `output/asksage_harness/technical_debt_correlation.md`
- `output/asksage_harness/pmo_executive_summary.md`
- `output/asksage_compare/comparison.json`
- `output/asksage_compare/comparison.md`

Interpretation:

- model naming was no longer the only issue
- the AskSage execution path is reachable
- the problem is likely payload-related or query-path-related

## Most Important Observation

The interactive AskSage client works for small prompts, while the replay harness fails in AskSage mode.

That strongly suggests the issue is not:

- basic network connectivity
- basic authentication
- basic AskSage availability
- basic Python client import/setup

It suggests the issue is more likely one of:

- payload format
- payload size
- specific field content inside the harness packet
- difference between plain-text prompting and JSON-shaped prompting
- `asksageclient.query()` behavior for larger/structured inputs

## Current Hypothesis

The harness currently builds a JSON string packet and sends that as the `message` body. The interactive client sends more natural prompt text.

The likely investigation focus is the difference between:

- harness packet structure in `asksage_harness/replay.py`
- interactive prompt construction in `python/client/asksage_client.py`

In other words:

- interactive plain-text prompts succeed
- harness JSON prompt packets may be causing the internal error

## Exact Investigation Goal

Determine why the AskSage replay harness fails when the interactive client succeeds.

Prioritize these possibilities:

1. JSON packet format is the problem
2. packet size is too large
3. one or more fields in the packet trigger failure
4. the AskSage API path used by `asksageclient.query()` handles structured JSON poorly
5. the prompt content needs to be converted from JSON packet form to markdown/plain text

## Files To Inspect First

- `asksage_harness/replay.py`
- `python/client/asksage_client.py`
- `prompts/PROMPT_BASELINES.md`
- `output/phase1/synthetic_cur.json`
- `output/asksage_harness/manifest.json`
- `output/asksage_compare/comparison.json`

## Current Behavior Of The Harness

The replay harness does the following:

1. loads prompt baselines from `prompts/PROMPT_BASELINES.md`
2. loads the synthetic dataset from `output/phase1/synthetic_cur.json`
3. computes a compact dataset summary
4. builds a prompt packet via `build_prompt_packet(...)`
5. sends that packet with `client.query(message=..., model=...)`
6. writes markdown and JSON snapshots

The likely critical function is:

- `build_prompt_packet(...)` in `asksage_harness/replay.py`

## Useful Commands

### Local Governance Baseline

```bash
python -m asksage_harness.replay \
  --mode local \
  --output-dir output/asksage_harness_local
```

### AskSage Run

```bash
python -m asksage_harness.replay \
  --mode asksage \
  --model gpt-4.1 \
  --output-dir output/asksage_harness
```

### Compare Local Vs AskSage

```bash
python -m asksage_harness.replay compare \
  --baseline-dir output/asksage_harness_local \
  --candidate-dir output/asksage_harness \
  --output-dir output/asksage_compare
```

## Useful Manual Diagnostic Prompt

Because the interactive client works, one useful manual diagnostic is to paste a simplified version of the harness payload into the interactive client and see where it starts failing.

Example:

```text
Task: Cost Anomaly Detection

Dataset summary:
- Rows analyzed: 250
- High or medium anomalies: 28
- Top cost service: AmazonEMR at $54,650.43
- Scenario counts:
  - baseline_operations: 222
  - cluster_left_running: 12
  - orphan_ebs_leakage: 8
  - redshift_scan_spike: 8

Instruction:
Identify the top 5 spend anomalies by service, region, and usage type. Explain likely technical or operational causes.

Respond in markdown.
```

If this works while the JSON packet fails, the likely fix is to support a plain-text or markdown packet mode in the harness.

## Recommended Next Engineering Step

Do not redesign the whole harness.

Instead, implement the smallest useful debugging improvement, likely one or more of:

- emit the exact payload being sent
- add a payload-size printout
- add an alternate packet mode:
  - `json`
  - `markdown`
- add a minimal AskSage smoke-test path for one prompt
- compare the raw message body used by the harness against the interactive client style

The likely best fix is to support a markdown/plain-text packet format while keeping the existing JSON packet format available for debugging.

## What Can Be Presented Right Now

These statements are accurate and defensible:

- The synthetic AWS cost dataset and governance baseline are operational.
- The enclave-compatible replay harness is operational.
- The AskSage service path is reachable from the enclave workflow.
- The current blocker is not packaging or transport; it is AskSage execution behavior for the harness payload.
- The next step is payload-shape investigation, not more synthetic data work.

## Current Worktree Expectations

The connected system copy should include at minimum:

- `asksage_harness/`
- `prompts/`
- `output/phase1/synthetic_cur.json`
- current output artifacts under `output/asksage_harness*` and `output/asksage_compare/` if available

## Final Instruction

When continuing this work, start by reading the repo and identifying the exact difference between the replay harness message body and the interactive client message body. Then either:

- implement a minimally invasive debugging aid, or
- implement an alternate prompt-packet mode that more closely matches the successful interactive prompt style.
