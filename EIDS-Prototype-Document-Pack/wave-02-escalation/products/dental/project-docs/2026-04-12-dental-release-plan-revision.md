---
title: Dental Release Plan Revision
product: DENTAL / DENCLASS
product_id: dental
wave: wave-02-escalation
date: 2026-04-12
author: Jaden Cole
source_type: release_plan
---
# Dental Release Plan Revision — April 12

## Why the release plan changed
Between April 8 and April 12, the team moved from a vague dependency concern to an explicit critical-path disruption. The vendor sandbox issue is no longer a background watch item. It now governs what can be credibly promised in PI 4.

## Revised planning logic
### Critical-path work that remains in current scope
- FHIR endpoint mapping completion
- Minimum viable integration-test path
- Security assessment completion
- Stakeholder narrative and reporting alignment

### Work deferred or re-scoped
- Non-critical feature stories originally slated for Sprint 2
- Polished demo scripting that assumes full environment readiness
- Some stakeholder-facing refinements that do not reduce actual readiness risk

## Mitigation lanes
### Lane A — Vendor path recovers by 4/15
- retain stakeholder demo target,
- keep FHIR priority,
- use revised milestone plan to sequence test work.

### Lane B — Vendor path does not recover
- use mock services to preserve narrative continuity,
- narrow the demo to validated scope,
- continue reporting the product as at risk until the evidence posture materially improves.

## Reporting implication
Generated reports and Ask answers should stop describing the product as a generic schedule issue and start describing it as a governed mitigation problem with defined actions and decision points.
