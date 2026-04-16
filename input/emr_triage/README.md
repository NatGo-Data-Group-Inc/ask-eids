# EMR Artifact Drop Location

Place enclave artifact bundles for EMR master-node triage here.

Recommended filename:

- `artifacts.tar.gz`
- Any `.tgz`, `.tar.gz`, or `.tar` bundle name also works

Example usage:

```bash
python -m emr_triage.analyze_artifacts
```

If `--bundle` is omitted, the analyzer automatically uses the newest archive in this folder.

Default output locations:

- `input/emr_triage/_analysis/<bundle-name>/`
- `input/emr_triage/_scratch/`

Notes:

- Files placed under `input/` are ignored by git.
- This folder is for local or enclave-stage inputs only.
