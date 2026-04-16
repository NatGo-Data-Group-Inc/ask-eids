# Prompt Baselines

## Error Triage
Identify the earliest probable root cause in the CloudWatch log set and separate it from downstream retries or wrapper failures.

## Timeline Reconstruction
Reconstruct the failure sequence from the log timestamps and indicate which event likely triggered the cascade.

## Service Correlation
Connect related error signals across application, platform, and dependency logs without treating repeated copies of the same failure as separate root causes.

## Leadership Summary
Produce a concise enclave-ready summary of operational impact, likely root cause, and the highest-value next diagnostic actions.
