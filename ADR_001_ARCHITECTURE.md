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
