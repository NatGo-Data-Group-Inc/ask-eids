# Ask EIDS Capability Prompt Packs

Each subfolder under `prompts/` represents one Ask EIDS analysis capability.

Required files per capability:

- `capability.json`: machine-readable manifest used by generators and orchestration stubs
- Prompt markdown files referenced by `prompt_files`

Current capabilities:

- `cost_cur`: synthetic CUR cost and anomaly analysis
- `emr_logs`: EMR operational log analysis scaffold
