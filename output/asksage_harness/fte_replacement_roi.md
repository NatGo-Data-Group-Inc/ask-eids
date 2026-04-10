# FTE Replacement ROI

## Prompt
Estimate analyst hours saved by Ask EIDS-assisted anomaly detection and narrative generation.

## Response
# FTE Replacement ROI Estimate: Ask EIDS-Assisted Anomaly Detection & Narrative Generation

## Summary

This estimate assesses analyst hours saved by Ask EIDS in anomaly detection and narrative generation, using only the provided synthetic dataset and scenario context.

---

## 1. Dataset and Scenario Overview

- **Total records analyzed:** 250
- **Anomalies detected:** 28
- **Scenarios:**
  - Baseline operations: 222
  - Cluster left running: 12
  - Orphan EBS leakage: 8
  - Redshift scan spike: 8

- **Top services by cost:** AmazonEMR, AmazonRedshift, AmazonEC2, AWSGlue, AmazonS3

---

## 2. Ask EIDS Role

Ask EIDS automates:
- **Anomaly detection:** Identifies cost and usage outliers (e.g., clusters left running, orphaned storage).
- **Narrative generation:** Produces PMO-ready summaries and recommended actions for each anomaly.

---

## 3. Analyst Hours Saved: Estimation Approach

### What is Known

- **28 anomalies** were detected and described with narratives and recommendations.
- Each anomaly includes a clear, actionable summary (see "pmo_summary_line" in examples).

### What is Missing

- **No baseline analyst time per anomaly** is provided (e.g., hours to detect, investigate, and document each anomaly manually).
- **No explicit FTE cost or productivity benchmarks** are supplied.

### Stated Assumptions

- **Assumption 1:** Each anomaly would require manual review, investigation, and documentation if not automated.
- **Assumption 2:** Narrative generation for each anomaly is a non-trivial, repeatable analyst task.

---

## 4. Qualitative Assessment

Given the above, the **analyst hours saved** by Ask EIDS can be described as follows:

- **For each of the 28 anomalies, Ask EIDS eliminates the need for manual detection and narrative writing.**
- **The total hours saved is directly proportional to the number of anomalies and the average time an analyst would spend per anomaly.**
- **Without a supplied benchmark for manual effort per anomaly, a quantitative ROI (in hours or FTEs) cannot be calculated from the provided data.**

---

## 5. Example Output (Qualitative)

| Metric                        | Value / Comment                                      |
|-------------------------------|-----------------------------------------------------|
| Total records analyzed        | 250                                                 |
| Anomalies detected            | 28                                                  |
| Analyst hours saved           | Not quantifiable from supplied data                 |
| FTE replacement ROI           | Qualitatively high for repetitive anomaly analysis  |
| Key missing input             | Analyst hours per anomaly (manual process)          |

---

## 6. Conclusion

**Ask EIDS automates the detection and narrative generation for 28 anomalies in this dataset, directly replacing the manual analyst effort for these tasks.**  
**The precise number of analyst hours or FTEs saved cannot be calculated without additional data on manual processing time per anomaly.**  
**Qualitatively, the ROI is significant for organizations with recurring anomaly review and reporting needs, as Ask EIDS eliminates repetitive, labor-intensive tasks.**

---

**To provide a quantitative ROI, please supply:**
- Average analyst hours required per anomaly (detection, investigation, documentation)
- Analyst hourly rate or FTE cost

*This assessment is based solely on the supplied synthetic dataset and scenario context.*

## Metadata
- prompt_slug: fte_replacement_roi
- model: gpt-4.1
- mode: asksage
- generated_at: 2026-04-10T13:37:18Z