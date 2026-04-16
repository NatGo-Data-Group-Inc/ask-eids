# Ask EIDS Reasoning Layer

This directory is reserved for analyst-facing reasoning assets:

- Prompt replay harnesses
- Golden output snapshots
- Narrative generation helpers

Per ADR 001, no orchestration logic belongs here. Bedrock-owned flow and lifecycle artifacts remain under `bedrock_flow/`.

## Current Implementation

- `python -m asksage_harness.replay --mode local` replays the baseline prompt pack against `output/phase1/synthetic_cur.json`
- The harness writes markdown and JSON snapshots plus `manifest.json` under `output/asksage_harness/`
- `--mode asksage` uses the real `asksageclient` when enclave credentials and connectivity are available
- `--packet-format auto|json|markdown` switches between the original JSON payload and a plain-text markdown payload that more closely matches the interactive client style
- `--packet-format auto` is the default and resolves to `json` for `--mode local` and `markdown` for `--mode asksage`
- `--print-payload-stats` emits payload size and preview metadata for each prompt to help isolate AskSage failure modes
- `python -m asksage_harness.replay compare --baseline-dir ... --candidate-dir ...` compares two snapshot runs and writes `comparison.md` plus `comparison.json`
- `python -m asksage_harness.emr_triage_submit` runs EMR artifact analysis and then submits the generated prompt brief to AskSage in one step

## Mode Semantics

- `--mode local` is a governance and repeatability baseline
- Local mode confirms dataset loading, prompt parsing, summary construction, and snapshot generation
- Local mode does not validate real AskSage reasoning quality or connectivity
- `--mode asksage` is the operational reasoning baseline and should be used for real model evaluation
- AskSage mode now defaults to markdown payloads because JSON packet mode previously triggered internal AskSage errors in enclave testing
- JSON packet mode remains available as an explicit debug option

## EMR One-Step Flow

Use this when the enclave has a staged EMR triage bundle under `input/emr_triage/` and AskSage connectivity is available:

```bash
python -m asksage_harness.emr_triage_submit
```

Outputs are written beside the bundle analysis directory and include:

- `emr_log_summary.json`
- `emr_log_findings.md`
- `emr_prompt_brief.txt`
- `asksage_response.json`
- `asksage_response.md`

Use `--mode local` to validate the wrapper without real AskSage access.
