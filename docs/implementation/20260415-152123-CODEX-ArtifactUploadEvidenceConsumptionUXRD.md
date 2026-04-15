# Artifact Upload and Evidence Consumption UXRD Implementation Note

## Overview
- Objective: author a full UXRD for generalized single-artifact upload and evidence-driven UI updates in AskEIDS.
- Deliverable: a repo-grounded UXRD in `PRD/` covering upload, processing, source rendering, Ask/search/report updates, accessibility, selectors, and TDD traceability.
- Scope: frontend behavior only, with notional UI-facing API contracts.

## Acceptance Criteria
- UXRD follows the `uxrd-creator` template and reflects the current codebase rather than a greenfield design.
- UXRD covers generalized artifact upload, processing states, source detail behavior, evidence-driven downstream updates, and trust/recovery UX.
- UXRD includes detailed UI-only acceptance criteria, Definition of Done, selectors, Playwright scenarios, and React handoff.
- UXRD explicitly preserves current app patterns where appropriate: top nav, route/query-param model, custom CSS tokens, toast region, modal and drawer treatments, and desktop-only unsupported viewport.

## Definition of Done
- The UXRD exists in `PRD/` with a timestamped filename.
- The document is decision-complete for frontend implementation and QA.
- The document includes AC-to-test traceability and headed/headless Playwright expectations.
- Continuity and implementation tracking docs are updated.

## Test Mapping
- Documentation task only; no automated tests are modified in this step.
- Validation method: repo-grounded review of the generated UXRD for required sections, acceptance criteria coverage, selector inventory, and React handoff completeness.

## Checklist
- [x] Scan current frontend structure, CSS patterns, routing, data fetching, and existing E2E coverage.
- [x] Confirm current API and permission surfaces that shape the UX contract.
- [x] Write the full UXRD to `PRD/` using streaming sections.
- [x] Review the written UXRD for completeness and consistency.

## Patch Notes
- Tightened the UXRD after review feedback to add an explicit supported-artifact matrix and classification rules.
- Clarified source-type inference, locked vs reviewable source families, and structured-import confirmation behavior.
- Made deck/spreadsheet/document/email/transcript preview behavior explicit.
- Locked ingest-status placement, persistence, dismissal rules, and polling cadence/timeout behavior.
- Clarified Ask retry semantics, report regeneration behavior, source open/download behavior, selector stability, and AC traceability for narrative evidence-only uploads.
