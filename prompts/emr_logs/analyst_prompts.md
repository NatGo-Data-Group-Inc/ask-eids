# Prompt Baselines

## Job Failure Triage
Identify the most likely root cause for failed or long-running EMR steps from controller, YARN, and Spark signals.

## Resource Saturation Analysis
Highlight indicators of under-provisioning, executor churn, or skew that would explain runtime degradation.

## Cost-to-Operations Correlation
Connect repeated retries, idle clusters, and failed workloads to cost and mission impact.

## Leadership Summary
Produce a concise enclave-ready summary of operational risk, user impact, and the highest-value remediation actions.

## Master-Node Triage
Analyze attached master-node artifacts and decide whether the primary fault is a NameNode issue, HA failover/config problem, service startup problem, network/connectivity problem, storage/resource exhaustion problem, or a combination. Prioritize the earliest root cause over downstream noise. Favor direct HA state and configuration evidence over Spark or application symptom files, and explicitly say when HA config appears present but runtime state is still degraded.
