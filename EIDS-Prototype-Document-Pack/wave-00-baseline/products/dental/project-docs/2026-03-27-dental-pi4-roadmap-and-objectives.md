---
title: Dental PI 4 Roadmap and Objectives
product: DENTAL / DENCLASS
product_id: dental
wave: wave-00-baseline
date: 2026-03-27
author: Benjiman Jennings
source_type: roadmap
---
# PI 4 Roadmap and Objectives

## Intent

PI 4 for Dental / DenClass is intended to move the product from planning and discovery into a credible stakeholder demo posture for the FHIR-based referral path. The central constraint is that the product cannot honestly claim readiness until the environment and test story are both real.

## PI 4 Objectives

1. **Complete FHIR endpoint mapping**
   - Resolve field mapping decisions for fourteen endpoint groups.
   - Lock ownership for legacy referral history handling.
   - Publish a reusable mapping package for engineering and reporting.

2. **Deliver security assessment**
   - Provide endpoint inventory and authentication assumptions.
   - Close the major questions required for release planning.

3. **Prepare test environment**
   - Gain named-user access in the shared sandbox.
   - Validate the most important referral flows in the path that will be shown to stakeholders.

4. **Deliver stakeholder demo**
   - Present a coherent end-to-end narrative that reflects both what is working and what remains under mitigation.

## Roadmap Assumptions
- Sprint 1 will focus on planning, architecture, and objective baselining.
- Sprint 2 will shift toward active FHIR work and test-path readiness.
- Sprint 3 will absorb any non-critical feature work if the vendor dependency becomes the pacing item.

## Early Warning Indicators
The following conditions should force the product posture to move from healthy to caution:
- vendor dates are verbal only,
- named-user credentials remain undefined,
- integration-test readiness is implied rather than proven,
- reporting artifacts disagree with ADO or meeting decisions.

## Governance Expectations
- Every major decision should exist in at least one durable artifact.
- Weekly summaries should be written for humans, not just for compliance.
- If evidence is missing, the generated report should say so directly.
