# Nova Extraction FSFS Execution Tracker

| Attribute | Detail |
| :--- | :--- |
| Task | Execute the Dental extraction-first FSFS |
| Status | Complete |
| Owner | Codex |
| Last Updated | 2026-04-15 20:18:31 local |
| Source Spec | `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md` |
| Continuity Ledger | `ContinuityDocs/20260415-200402-CODEX-NovaExtractionDentalFSFSExecution.md` |

## Overview
Implement the Dental-first extraction and aggregation workflow described in the FSFS while preserving existing UI routes and mixed-mode portfolio behavior for non-Dental products.

## Acceptance Criteria Focus
- [x] Dental runtime state now exposes persisted extraction/aggregate metadata and semantic-state projection for extraction-first Dental flows.
- [x] Structured rows remain deterministic truth for the Data tab.
- [x] Upload, Ask, Sources, Reports, and reset flows use extraction-first Dental contracts and UI selectors.
- [x] Replay-backed automation and Playwright proof exist for the required Dental workflows implemented in this turn.
- [x] Headless and headed verification passed for the new Dental extraction-first Playwright suite.

## Definition of Done
- [x] All mapped FE/BE/INT acceptance criteria in this execution slice have automated proof.
- [x] Mixed-mode Dental vs non-Dental rendering remains stable.
- [x] Last-known-good behavior is preserved on extraction/aggregation failure.
- [x] Implementation and ledger docs reflect final status and verification evidence.

## Test Mapping
| Acceptance Area | Planned Proof |
| :--- | :--- |
| Reset / baseline extraction-first Dental | `server/test/read.contract.test.js`, `tests/e2e/nova-baseline-reset.spec.js` |
| Upload extraction, partial, and failure states | `server/test/ingest.pipeline.integration.test.js`, `tests/e2e/nova-upload-email-source-detail.spec.js`, `tests/e2e/nova-failure-last-known-good.spec.js` |
| Aggregate publication and last-known-good fallback | `server/test/runtime-state.repository.integration.test.js`, `tests/e2e/nova-failure-last-known-good.spec.js` |
| Ask/report extraction-first grounding | `server/test/read.contract.test.js`, `tests/e2e/nova-upload-transcript-ask.spec.js`, `tests/e2e/nova-report-regeneration.spec.js` |
| Required selectors and UI messaging | `client/src/test/artifact-upload-ui.test.jsx`, `tests/e2e/nova-structured-data-overview.spec.js` |

## Implementation Checklist
- [x] Verify current gaps against FSFS API/data contracts.
- [x] Add execution-mode flags and Dental extraction-first persistence structures.
- [x] Implement normalized source, extraction record, aggregate snapshot, and prompt-run storage.
- [x] Implement Dental reset flow with replay/live execution contract.
- [x] Implement extraction-first upload and projection flow for Dental.
- [x] Rewire Ask/report/read-model behavior to consume extraction-first Dental state.
- [x] Add/update automated tests and Playwright specs.
- [x] Run modified-file tests plus headed/headless Playwright verification.

## Verification Notes
- `npm test -- --run client/src/test/artifact-upload-ui.test.jsx server/test/read.contract.test.js server/test/runtime-state.repository.integration.test.js server/test/ingest.pipeline.integration.test.js`
- `npx playwright test tests/e2e/nova-baseline-reset.spec.js tests/e2e/nova-upload-email-source-detail.spec.js tests/e2e/nova-upload-transcript-ask.spec.js tests/e2e/nova-structured-data-overview.spec.js tests/e2e/nova-report-regeneration.spec.js tests/e2e/nova-failure-last-known-good.spec.js tests/e2e/nova-lifecycle.spec.js`
- `npx playwright test --headed tests/e2e/nova-baseline-reset.spec.js tests/e2e/nova-upload-email-source-detail.spec.js tests/e2e/nova-upload-transcript-ask.spec.js tests/e2e/nova-structured-data-overview.spec.js tests/e2e/nova-report-regeneration.spec.js tests/e2e/nova-failure-last-known-good.spec.js tests/e2e/nova-lifecycle.spec.js`
- Headed visual evidence captured in `baseline-headed-proof.png`, `source-detail-headed-proof.png`, and `report-regeneration-headed-proof.png`.
