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
