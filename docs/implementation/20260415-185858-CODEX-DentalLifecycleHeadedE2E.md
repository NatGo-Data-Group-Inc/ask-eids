# Dental Lifecycle Headed E2E Implementation

| Attribute | Detail |
| :--- | :--- |
| Task | Detailed headed Playwright lifecycle workflow for Dental / DENCLASS |
| Implementation Doc | `docs/implementation/20260415-185858-CODEX-DentalLifecycleHeadedE2E.md` |
| Status | Verified |
| Owner | Codex |
| Last Updated | 2026-04-15 20:12:00 local |

## Overview
This document tracks the proof-driven implementation of a detailed lifecycle workflow that exercises Dental / DENCLASS through the approved document pack and verifies user-visible UI changes as evidence is onboarded. The workflow should be suitable for headed Playwright execution and robust enough to act as an operational demo/runbook test.

## Acceptance Criteria
- Add a detailed Playwright lifecycle workflow covering Dental / DENCLASS document onboarding in manifest/order-aligned phases.
- Validate the application from the earliest supported starting point available in the current app, then through wave-based onboarding progressions.
- Assert visible updates in the portfolio, product overview, timeline, sources, data tab, Ask panel, and reports where each phase materially changes expected behavior.
- Keep the workflow runnable in headed mode and aligned with the current repo harness.
- Update this document and the continuity ledger with proof results.

## Definition of Done
- Required lifecycle expectations are mapped to concrete assertions.
- The new lifecycle workflow exists in the Playwright suite or companion script used by that suite.
- The workflow passes in at least the targeted verification run used for this task.
- Any helper additions or test reliability improvements needed for the lifecycle flow are implemented.
- Traceability and proof notes are updated here.

## Test Mapping Strategy
- Prefer one high-signal Playwright workflow spec supported by small helper additions over many fragmented specs.
- Validate phase transitions at the lowest useful UI level: overview/sources/data/timeline/Ask/report generation.
- Use the operator guide and manifest as the expectation source for lifecycle milestones.

## Implementation Checklist
- [x] Inspect manifest/operator guide and extract Dental-only lifecycle checkpoints.
- [x] Inspect current Playwright helpers and choose the target file structure.
- [x] Add failing lifecycle workflow test/script.
- [x] Implement helper support and stable assertions as needed.
- [x] Run targeted verification for the new workflow.
- [x] Update this doc and the continuity ledger with outcomes.

## AC Traceability

| Acceptance Item | Test File | Test / Proof | Status |
| :--- | :--- | :--- | :--- |
| Lifecycle order matches approved Dental pack progression | `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` | `uploads Dental lifecycle artifacts in approved order and validates wave transitions` | Passing |
| Portfolio/product UI evolves with uploaded evidence | `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` | Baseline entry plus wave 01 and wave 03 status assertions (`At Risk` then `Caution`) | Passing |
| Sources/timeline/data/Ask/report surfaces are validated at meaningful checkpoints | `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` | Source surfacing after each upload, Ask assertions after waves 01 and 03, blocker row after wave 02, report generation after wave 02, leadership deck visible after wave 03 | Passing |
| Workflow runs in headed Playwright mode | `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` | `npx playwright test tests/e2e/lifecycle/dental-pack-lifecycle.spec.js --headed --reporter=line` | Passing |

## Verification Log
- 2026-04-15 20:11 local: `npx playwright test tests/e2e/lifecycle/dental-pack-lifecycle.spec.js --headed --reporter=line`
- Result: Passed (`1 passed (26.1s)`).

## Outcome Notes
- Added a dedicated lifecycle spec at `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` that starts from a baseline-only reset and uploads Dental wave 01, wave 02, and wave 03 artifacts one by one.
- Added `tests/e2e/lifecycle/dental-pack-lifecycle.helpers.js` to read the manifest, build stand-ins for missing GitHub-unavailable binaries, respect source-type selection, clamp future upload dates to the current test day, and wait for uploaded source rows by returned `sourceId`.
- Extended the upload type matrix in `shared/artifactTypes.js` so the Gold-pack document subtypes can be selected legitimately by the UI during lifecycle ingestion.
- Extended reset/import behavior in the server so the test harness can reset to `wave-00-baseline` rather than always starting from the full corpus.
