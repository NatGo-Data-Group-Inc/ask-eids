# Cost Anomaly Report

## Sample Validation
- anomaly_score: pass
- waste_driver: pass
- recommended_action: pass
- pmo_summary_line: pass

## Scenario Counts
- baseline_operations: 222
- cluster_left_running: 12
- orphan_ebs_leakage: 8
- redshift_scan_spike: 8

## Top Services By Synthetic Cost
- AmazonEMR: $54,650.43
- AmazonRedshift: $12,679.57
- AmazonEC2: $4,472.76
- AWSGlue: $601.98
- AmazonS3: $49.03

## Representative Findings
- AmazonEMR in us-gov-west-1: EMR waste due to automation gap caused 72 excess compute hours | action: Bedrock flow scheduled cluster teardown check
- AmazonEMR in us-gov-west-1: EMR waste due to automation gap caused 90 excess compute hours | action: Bedrock flow scheduled cluster teardown check
- AmazonEMR in us-gov-east-1: EMR waste due to automation gap caused 84 excess compute hours | action: Bedrock flow scheduled cluster teardown check
- AmazonEC2 in us-gov-west-1: Detached storage continued accruing cost after instance retirement | action: Bedrock flow orphaned resource sweep
- AmazonEC2 in us-gov-west-1: Detached storage continued accruing cost after instance retirement | action: Bedrock flow orphaned resource sweep