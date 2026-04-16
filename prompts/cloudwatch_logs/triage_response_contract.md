# CloudWatch Triage Response Contract

Use this response structure for CloudWatch log triage:

A. Executive diagnosis
B. Evidence supporting that diagnosis, citing specific files and log entries
C. Immediate corrective actions in exact recommended order
D. Commands or queries to run next to confirm the diagnosis
E. Whether more artifacts are needed, and if so exactly which ones
F. Confidence level with a short reason

Analysis rules:

- Identify the earliest likely root cause first.
- Separate root cause, downstream symptoms, and repeated-noise log lines.
- Prefer timestamp-ordered control-plane or service-startup evidence over repeated application retries.
- Do not give generic AWS advice unless the logs support it.
