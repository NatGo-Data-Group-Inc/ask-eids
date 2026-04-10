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
- `python -m asksage_harness.replay compare --baseline-dir ... --candidate-dir ...` compares two snapshot runs and writes `comparison.md` plus `comparison.json`

## Mode Semantics

- `--mode local` is a governance and repeatability baseline
- Local mode confirms dataset loading, prompt parsing, summary construction, and snapshot generation
- Local mode does not validate real AskSage reasoning quality or connectivity
- `--mode asksage` is the operational reasoning baseline and should be used for real model evaluation
