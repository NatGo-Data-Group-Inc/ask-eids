# Project Brief

## Objective
Build a 2-week feasibility prototype for Ask EIDS that validates AI-assisted enclave cost intelligence using synthetic and sandbox-derived AWS Cost and Usage Report (CUR)-shaped data, while defining a governed production path using Amazon Bedrock Prompt Management and Flows.

## Scope
### In Scope
- Synthetic CUR-shaped data generator
- Sandbox-derived cost/utilization overlays
- AskSage / Ask EIDS prompt validation harness
- Capability-specific prompt folders for multiple enclave analyses
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
- Extensible capability registry so CUR and EMR-log analysis can coexist
- Bedrock flow JSON scaffolds
- PMO executive report template
- Feasibility findings markdown bundle

## Success Criteria
- Detect spend anomalies from synthetic CUR data
- Correlate technical debt events to waste drivers
- Generate leadership-readable cost narratives
- Demonstrate clear migration path to Bedrock
