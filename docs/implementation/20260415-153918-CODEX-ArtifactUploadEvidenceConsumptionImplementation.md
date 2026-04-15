# Artifact Upload and Evidence Consumption Implementation

| Attribute | Detail |
| :--- | :--- |
| Document | `PRD/20260415-152123-CODEX-ArtifactUploadEvidenceConsumptionUXRD.md` |
| Implementation Doc | `docs/implementation/20260415-153918-CODEX-ArtifactUploadEvidenceConsumptionImplementation.md` |
| Status | Complete |
| Owner | Codex |
| Last Updated | 2026-04-15 16:07:00 local |

## Overview
This document tracks execution of the Artifact Upload and Evidence Consumption UXRD using the required proof-driven workflow: Spec -> Tests -> Code -> Proof. It is the working source of truth for implementation progress, test traceability, and definition-of-done verification.

## Acceptance Criteria
- Implement AC-001 through AC-028 from the UXRD exactly as written.
- Preserve existing unsupported viewport behavior below 1024px.
- Reuse existing app layout and component patterns while introducing the upload, ingest-status, sources, Ask, search, data-impact, and report-regeneration experiences.

## Definition of Done
- All AC-001 through AC-028 are implemented and verified.
- Integration coverage exists for the UX behaviors specified as integration-level checks in the UXRD.
- Playwright coverage exists for all E2E workflows in the UXRD and passes in both headless and headed modes.
- Accessibility, focus management, async announcements, and scoped error handling are verified.
- This implementation document and the continuity ledger are updated to reflect the final state.

## Test Mapping Strategy
- Write or update integration tests for modal validation, focus handling, ingest status, source drawer behavior, Ask loading/retry, impact messaging, aria-live announcements, and viewport guardrails.
- Write or update Playwright specs for the ten required UXRD scenarios.
- Keep this document updated with failing -> passing status as work proceeds.

## Implementation Checklist
- [x] Inspect current frontend, server, fixtures, and test architecture.
- [x] Add failing integration tests for required UX behaviors.
- [x] Add failing Playwright specs for the required scenarios.
- [x] Implement upload modal, validation, and retry behavior.
- [x] Implement ingest-status surface and evidence-updated messaging.
- [x] Implement sources filters, rows, drawer previews, and warnings.
- [x] Implement Ask loading, error, retry, and citation behavior.
- [x] Implement search, report-regeneration notice, and data-impact flows.
- [x] Verify read-only and unsupported viewport states.
- [x] Run modified-file lint/tests plus full required Playwright runs in headless and headed modes.
- [x] Update this document with final proof and DoD completion.

## AC Traceability

| AC ID | Test File | Test Name | Status |
| :--- | :--- | :--- | :--- |
| AC-001 | `client/src/test/artifact-upload-ui.test.jsx`, `tests/e2e/upload-transcript.spec.js` | `shows upload artifact entry for editors and hides it for read-only users` / `artifact upload happy path` | Passing |
| AC-002 | `client/src/test/artifact-upload-ui.test.jsx`, `tests/e2e/read-only-permissions.spec.js` | `shows upload artifact entry for editors and hides it for read-only users` / `read only user does not see edit or upload controls` | Passing |
| AC-003 | `client/src/test/artifact-upload-ui.test.jsx`, `tests/e2e/upload-transcript.spec.js` | modal upload integration / `artifact upload happy path` | Passing |
| AC-004 | `tests/e2e/ask-upload-validation.spec.js` | `artifact upload validation failures` | Passing |
| AC-005 | `tests/e2e/ask-upload-validation.spec.js` | `artifact upload validation failures` | Passing |
| AC-006 | `tests/e2e/ask-upload-validation.spec.js` | `artifact upload validation failures` plus client modal validation | Passing |
| AC-007 | `tests/e2e/upload-transcript.spec.js` | `artifact upload happy path` | Passing |
| AC-008 | `client/src/test/artifact-upload-ui.test.jsx`, `tests/e2e/artifact-upload-failure-retry.spec.js` | retryable upload error coverage | Passing |
| AC-009 | `tests/e2e/upload-transcript.spec.js` | `artifact upload happy path` | Passing |
| AC-010 | `tests/e2e/upload-transcript.spec.js` | `artifact upload happy path` | Passing |
| AC-011 | `tests/e2e/artifact-upload-partial.spec.js` | `partial artifact processing surfaces warnings` | Passing |
| AC-012 | `tests/e2e/upload-transcript.spec.js` | `artifact upload happy path` | Passing |
| AC-013 | `tests/e2e/upload-transcript.spec.js` | `artifact upload happy path` | Passing |
| AC-014 | `tests/e2e/artifact-upload-source-detail.spec.js` | `source detail drawer renders type-aware metadata and restores focus` | Passing |
| AC-015 | `tests/e2e/artifact-upload-source-detail.spec.js` | `source detail drawer renders type-aware metadata and restores focus` | Passing |
| AC-016 | `tests/e2e/artifact-upload-source-detail.spec.js` | `source detail drawer renders type-aware metadata and restores focus` | Passing |
| AC-017 | `tests/e2e/artifact-upload-partial.spec.js` | `partial artifact processing surfaces warnings` | Passing |
| AC-018 | `tests/e2e/doc-pack-upload-ask.spec.js` | `uploaded artifact appears in search and ask` | Passing |
| AC-019 | `tests/e2e/doc-pack-upload-ask.spec.js` | `uploaded artifact appears in search and ask` | Passing |
| AC-020 | `tests/e2e/kb-failure.spec.js` | `ask failure renders scoped error without crashing the page` | Passing |
| AC-021 | `tests/e2e/doc-pack-upload-ask.spec.js` | `uploaded artifact appears in search and ask` | Passing |
| AC-022 | `tests/e2e/artifact-upload-evidence-only-impact.spec.js` | `narrative upload does not mutate structured tables` | Passing |
| AC-023 | `tests/e2e/artifact-upload-structured-data-impact.spec.js` | `structured import updates data tab` | Passing |
| AC-024 | `tests/e2e/artifact-upload-report-regenerate.spec.js` | `existing report requires explicit regeneration after new evidence` | Passing |
| AC-025 | `tests/e2e/artifact-upload-structured-data-impact.spec.js` | `structured import updates data tab` | Passing |
| AC-026 | `tests/e2e/artifact-upload-source-detail.spec.js`, `tests/e2e/read-accessibility.spec.js` | overlay focus restoration and roving keyboard order | Passing |
| AC-027 | `tests/e2e/artifact-upload-partial.spec.js`, `client/src/test/artifact-upload-ui.test.jsx` | async upload announcements and retry state integration | Passing |
| AC-028 | `tests/e2e/unsupported-viewport.spec.js` | `unsupported viewport remains authoritative` | Passing |

## Verification Log
- `npm test` -> 17/17 files passed, 47/47 tests passed.
- `npm run test:e2e` -> 28/28 Playwright tests passed in headless mode.
- `npm run test:e2e:headed` -> 28/28 Playwright tests passed in headed mode.
- The implementation includes the generalized upload modal, ingest status panel, evidence update banner, expanded sources, Ask loading/retry states, search/report/data propagation, and read-only / unsupported viewport handling.
- The DoD checklist is satisfied: AC-001 through AC-028 are covered, full Playwright proof exists, and no failing automated checks remain.
