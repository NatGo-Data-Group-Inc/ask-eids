# EIDS Prototype Document Pack

This zip contains a fully synthetic, time-phased document corpus for demonstrating the **EIDS Product Knowledge Hub**.

## What is in the pack

- **3 prototype products**
  - Dental / DenClass — the hero product that evolves from baseline to escalation to recovery
  - Optima Care Coordination — the healthy comparison product
  - ESSENCE Transition Support — the continuity-failure / caution product

- **4 ingestion waves**
  - `wave-00-baseline`
  - `wave-01-operational`
  - `wave-02-escalation`
  - `wave-03-recovery`

- **Mixed source types**
  - project docs
  - weekly updates
  - structured CSV exports
  - ADO exports
  - email messages (`.eml`)
  - transcripts
  - slide decks (`.pptx`)
  - PDF summaries
  - spreadsheet attachment (`.xlsx`)

- **Bedrock-friendly sidecar metadata**
  - Every ingestable source file has a sibling `*.metadata.json` file with product, wave, source-type, date, and demo-purpose attributes.

## Recommended demo motion

1. Ingest `wave-00-baseline` only.
2. Show portfolio landing and basic Ask / Reports behavior.
3. Ingest `wave-01-operational`.
4. Show timeline growth, new decisions, better Ask answers, and updated risk posture.
5. Ingest `wave-02-escalation`.
6. Show the product at its lowest confidence / most at-risk point.
7. Ingest `wave-03-recovery`.
8. Show improved knowledge health, stronger evidence, and a more complete leadership-ready story.

## File counts

- Ingestable artifacts: 56
- Sidecar metadata files: 56
- Operator guide files: 5

## Important note

All names, products, emails, meetings, schedules, and artifacts in this pack are synthetic. They are designed to look operationally realistic while remaining safe for prototype and demo use.
