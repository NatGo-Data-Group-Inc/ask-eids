# Ask EIDS Feasibility — Codex Handoff Pack

This handoff pack converts the strategy work from this chat into **implementation-ready artifacts for Codex execution**.

---

# 1) PROJECT_BRIEF.md
```md
# Project Brief

## Objective
Build a 2-week feasibility prototype for **Ask EIDS** that validates AI-assisted enclave cost intelligence using **synthetic and sandbox-derived AWS Cost and Usage Report (CUR)-shaped data**, while defining a governed production path using Amazon Bedrock Prompt Management and Flows.

## Scope
### In Scope
- Synthetic CUR-shaped data generator
- Sandbox-derived cost/utilization overlays
- AskSage / Ask EIDS prompt validation harness
- Technical debt to cost correlation scenarios
- PMO-ready markdown reporting outputs
- Amazon Bedrock flow scaffolding
- GovCloud-compatible architecture assumptions

### Out of Scope
- Direct production CUR access
- Real billing payer account integration
- Live PMO dashboards
- Production deployment into MIP
- Real PHI/CUI datasets

## Constraints
- Must run in air-gapped / enclave-friendly workflow
- Synthetic and anonymized sandbox data only
- Python-first implementation
- Output formats: parquet + markdown + JSON
- Future Bedrock compatibility required

## Deliverables
- Synthetic CUR parquet generator
- Scenario library for cost anomalies
- Ask EIDS prompt pack
- Bedrock flow JSON scaffolds
- PMO executive report template
- Feasibility findings markdown bundle

## Success Criteria
- Detect spend anomalies from synthetic CUR data
- Correlate technical debt events to waste drivers
- Generate leadership-readable cost narratives
- Demonstrate clear migration path to Bedrock
```

---

# 2) TASKS.md
```md
# Tasks

## Phase 1 — Data Foundation
- [ ] Build CUR-shaped synthetic row generator
- [ ] Add GovCloud service mix (EC2, S3, EMR, Redshift, Glue, Lambda, Bedrock)
- [ ] Write parquet + CSV outputs
- [ ] Create sandbox overlay ingestion adapter

## Phase 2 — Scenario Library
- [ ] EMR cluster left running scenario
- [ ] Redshift scan spike scenario
- [ ] Trino dead coordinator retry loop
- [ ] SQL proxy restart loop waste model
- [ ] Orphan EBS / EC2 cost leakage
- [ ] FTE manual recovery labor cost estimator

## Phase 3 — Ask EIDS Harness
- [ ] Prompt replay harness
- [ ] Golden prompt baseline loader
- [ ] Markdown narrative emitter
- [ ] Output comparison snapshots

## Phase 4 — Bedrock Production Path
- [ ] Prompt Management asset scaffolds
- [ ] Flow JSON node stubs
- [ ] Lambda transform placeholders
- [ ] Step Functions integration hook points

## Phase 5 — Reporting
- [ ] PMO one-page executive summary
- [ ] Cost anomaly markdown report
- [ ] Technical debt heatmap data export
- [ ] Feasibility sprint findings summary
```

---

# 3) ADR_001_ARCHITECTURE.md
```md
# ADR 001 — Ask EIDS Feasibility Architecture

## Context
The prototype must validate AI usefulness before direct CUR access is approved while preserving a low-rework path to AWS-native production workflows.

## Decision
- AskSage / Ask EIDS = analyst-facing reasoning and prompt discovery layer
- Amazon Bedrock = governed workflow orchestration and prompt lifecycle layer
- S3-compatible storage = canonical synthetic dataset staging
- Parquet = canonical cost dataset format
- Markdown = leadership and PMO narrative output
- JSON = Bedrock Flow and Lambda handoff format

## Consequences
### Positive
- Immediate feasibility progress
- No dependency on billing permissions
- Safe synthetic-data-first governance posture
- Clean production migration path

### Negative
- Cannot validate true payer-account edge cases yet
- Synthetic data quality drives trust

### Deferred
- Direct CUR ingestion
- CUR Athena/Trino external tables
- Scheduled production reporting
```

---

# 4) PROMPT_BASELINES.md
```md
# Prompt Baselines

## Cost Anomaly Detection
Identify the top 5 spend anomalies by service, region, and usage type. Explain likely technical or operational causes.

## Technical Debt Correlation
Correlate repeated operational failures (retry loops, dead coordinators, stale transfers, proxy restarts) to synthetic cost waste.

## FTE Replacement ROI
Estimate analyst hours saved by Ask EIDS-assisted anomaly detection and narrative generation.

## PMO Executive Summary
Convert findings into a 1-page leadership-ready markdown summary with risk, cost impact, and recommended next actions.

## Bedrock Transition Recommendation
Recommend which prompts should be promoted into Bedrock Prompt Management and Flow nodes.
```

---

# 5) SAMPLE_IO.md
```md
# Sample Inputs and Outputs

## Input Example
Synthetic CUR row:
{
  "service": "AmazonEMR",
  "region": "us-gov-west-1",
  "usage_hours": 72,
  "cost": 1840.22,
  "scenario": "cluster_left_running",
  "technical_debt_event": "missed_shutdown_hook"
}

## Expected Output
- anomaly_score: high
- waste_driver: missed shutdown automation
- recommended_action: Bedrock flow scheduled cluster teardown check
- pmo_summary_line: EMR waste due to automation gap caused 72 excess compute hours
```

---

# 6) REPO_LAYOUT.md
```md
ask-eids-feasibility/
├── data_gen/
│   ├── synthetic_cur.py
│   └── sandbox_overlay.py
├── scenarios/
├── prompts/
├── asksage_harness/
├── bedrock_flow/
├── reports/
├── docs/
└── tests/
```

---

# Minimal Codex Kickoff Prompt
```text
Implement from PROJECT_BRIEF.md and TASKS.md.
Start with Phase 1 synthetic CUR parquet generator.
Honor ADR architecture split: Ask EIDS = reasoning layer, Bedrock = orchestration layer.
Validate outputs against SAMPLE_IO.md.
Emit markdown reports for PMO review.
```

---

# Recommended First Codex Task
**Start with:** `data_gen/synthetic_cur.py`

That file unlocks every downstream workstream:
- Ask EIDS prompt tests
- anomaly scenarios
- Bedrock flow scaffolds
- PMO reporting
- ROI estimation

This is the correct first implementation wedge.

