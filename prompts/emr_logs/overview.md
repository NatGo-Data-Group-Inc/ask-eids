# EMR Log Analysis

This capability is reserved for EMR cluster, step, and application log analysis within the enclave.

It now includes an offline artifact-analysis workflow for master-node triage bundles. The analyzer can inspect an extracted artifact tree or a `.tar.gz` bundle, score likely root causes, and emit:

- `emr_log_summary.json`
- `emr_log_findings.md`
- `emr_prompt_brief.txt`

This is designed for the two-step enclave workflow: prepare and validate the tooling here, then move the project into the enclave and run the analyzer against the real artifact bundle there.
