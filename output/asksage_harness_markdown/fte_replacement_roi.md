# FTE Replacement ROI

## Prompt
Estimate analyst hours saved by Ask EIDS-assisted anomaly detection and narrative generation.

## Response
# FTE Replacement ROI Estimate: Ask EIDS-Assisted Anomaly Detection & Narrative Generation

## Assumptions

- **Analyst Workflow**: Manual anomaly detection and narrative generation typically involves: data review, anomaly identification, root cause analysis, and summary/narrative writing.
- **Manual Effort per Anomaly**: Industry benchmarks suggest 1–2 hours per anomaly for full-cycle analysis and reporting (conservative estimate: 1.5 hours/anomaly).
- **Ask EIDS Automation**: Ask EIDS automates anomaly detection and narrative generation, reducing analyst time to near-zero for these steps (assume 90%+ time savings).
- **Dataset Scope**: 250 rows, 28 anomalies detected, with representative scenarios and cost context provided.

## Analyst Hours Saved Calculation

### 1. Manual Analyst Effort (Baseline)

- **Total anomalies**: 28
- **Manual hours per anomaly**: 1.5 hours
- **Total manual hours**:  
  $$ 28 \text{ anomalies} \times 1.5 \text{ hours/anomaly} = 42 \text{ hours} $$

### 2. Ask EIDS-Assisted Effort

- **Automated detection & narrative**: Assume 0.1 hours/anomaly (review/validation only)
- **Total EIDS-assisted hours**:  
  $$ 28 \text{ anomalies} \times 0.1 \text{ hours/anomaly} = 2.8 \text{ hours} $$

### 3. Analyst Hours Saved

- **Hours saved**:  
  $$ 42 \text{ hours (manual)} - 2.8 \text{ hours (EIDS-assisted)} = 39.2 \text{ hours saved} $$

## ROI Summary Table

| Metric                      | Value         |
|-----------------------------|--------------|
| Total anomalies detected    | 28           |
| Manual analyst hours        | 42           |
| Ask EIDS-assisted hours     | 2.8          |
| Analyst hours saved         | 39.2         |
| % Time Reduction            | 93%          |

## Narrative Example

Ask EIDS automatically identified and generated narratives for anomalies such as:
- **AmazonEMR cluster left running**: Detected missed shutdown automation, recommended scheduled teardown.
- **AmazonEC2 orphan EBS leakage**: Identified orphaned block storage, recommended resource sweep.

## FTE Impact

- **Monthly/Annual Scaling**: If this pattern holds for larger datasets or recurring monthly reviews, the FTE savings scale proportionally.
- **FTE Conversion**:  
  $$ \text{FTE hours/year} = 2080 $$
  $$ \text{Equivalent FTE saved} = \frac{39.2}{2080} \approx 0.019 \text{ FTE per dataset} $$

## Conclusion

**Ask EIDS-assisted anomaly detection and narrative generation saves approximately 39 analyst hours per 250-row dataset (28 anomalies), representing a 93% reduction in manual effort. This enables significant FTE reallocation and operational efficiency for cost anomaly management.**

---

*If you need cost savings, FTE conversion for larger volumes, or more granular breakdowns, let me know!*

## Metadata
- prompt_slug: fte_replacement_roi
- model: gpt-4.1
- mode: asksage
- generated_at: 2026-04-10T13:27:53Z