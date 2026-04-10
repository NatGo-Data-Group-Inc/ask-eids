# Bedrock Transition Recommendation

## Prompt
Recommend which prompts should be promoted into Bedrock Prompt Management and Flow nodes.

## Response
# Bedrock Transition Recommendation

## Executive Summary

Based on the supplied synthetic cost and anomaly dataset, I recommend promoting the following prompt patterns into Bedrock Prompt Management and Flow nodes:

- **Scheduled Cluster Teardown Check** for AmazonEMR "cluster_left_running" anomalies
- **Orphaned Resource Sweep** for AmazonEC2 "orphan_ebs_leakage" anomalies

These recommendations are driven by the high cost impact and repeatability of the detected waste patterns, as well as their alignment with actionable automation opportunities.

---

## Reasoning

### 1. **Dataset Analysis**

- **Total Rows:** 250
- **Anomalies:** 28 (11.2% of dataset)
- **Top Cost Drivers:**  
  - AmazonEMR ($54,650.43)
  - AmazonRedshift ($12,679.57)
  - AmazonEC2 ($4,472.76)
- **Anomaly Scenarios:**
  - `cluster_left_running` (12 occurrences, EMR)
  - `orphan_ebs_leakage` (8 occurrences, EC2)
  - `redshift_scan_spike` (8 occurrences, Redshift)
- **Baseline Operations:** 222 (no anomaly)

### 2. **Anomaly Patterns and Recommendations**

#### A. **AmazonEMR: cluster_left_running**
- **Pattern:** Clusters left running due to missed shutdown automation.
- **Cost Impact:** High (individual events $1,700–$2,400, aggregate likely >$20,000).
- **Recommended Prompt:**  
  - **Bedrock flow scheduled cluster teardown check**
- **Rationale:**  
  - Repeated, high-cost waste.
  - Automation gap is clearly identified.
  - Action is well-defined and can be standardized as a Bedrock Flow node.

#### B. **AmazonEC2: orphan_ebs_leakage**
- **Pattern:** Orphaned EBS volumes accruing cost after instance retirement.
- **Cost Impact:** Moderate per event, but recurring.
- **Recommended Prompt:**  
  - **Bedrock flow orphaned resource sweep**
- **Rationale:**  
  - Repeated, preventable waste.
  - Action is clear (resource sweep/cleanup).
  - Suitable for Bedrock Flow node for periodic or event-driven execution.

#### C. **AmazonRedshift: redshift_scan_spike**
- **Pattern:** Not detailed in examples, but scenario count matches other anomalies.
- **Assumption:** If similar actionable automation (e.g., query optimization, scan monitoring) is identified, a Bedrock Flow node could be justified.
- **Current Recommendation:**  
  - **Defer** until more actionable, repeatable prompt patterns are observed.

---

## Assumptions

- The anomaly examples provided are representative of the broader anomaly set.
- "Bedrock flow" recommendations refer to actionable, automatable checks or remediations suitable for Bedrock Prompt Management.
- No orchestration or implementation detail is included, per instruction.

---

## Recommendation Table

| Scenario                | Service      | Pattern/Prompt to Promote                        | Rationale                                 |
|-------------------------|-------------|--------------------------------------------------|-------------------------------------------|
| cluster_left_running    | AmazonEMR   | Bedrock flow scheduled cluster teardown check    | High cost, repeatable, actionable         |
| orphan_ebs_leakage      | AmazonEC2   | Bedrock flow orphaned resource sweep             | Recurring, preventable, actionable        |
| redshift_scan_spike     | AmazonRedshift | *Defer*                                         | Insufficient actionable pattern detail    |

---

## Next Steps

- **Promote** the two identified prompt patterns into Bedrock Prompt Management and Flow nodes.
- **Monitor** for actionable patterns in Redshift scan spikes and other emerging scenarios.
- **Review** anomaly detection coverage periodically to ensure new waste patterns are captured and addressed.

---

**Ask EIDS Reasoning Role:**  
This recommendation is based on the frequency, cost impact, and clarity of actionable automation for each anomaly scenario, ensuring that Bedrock Prompt Management focuses on the highest-value, most repeatable interventions. No orchestration or implementation detail is included, as per requirements.

## Metadata
- prompt_slug: bedrock_transition_recommendation
- model: gpt-4.1
- mode: asksage
- generated_at: 2026-04-10T13:27:53Z