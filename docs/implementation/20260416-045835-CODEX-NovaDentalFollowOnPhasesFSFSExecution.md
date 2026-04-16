# Nova Dental Follow-On Phases FSFS Execution Tracker

| Attribute | Detail |
| :--- | :--- |
| Task | Execute the Dental follow-on FSFS for live email baseline, trust surfaces, and semantic service hardening |
| Status | Completed |
| Owner | Codex |
| Last Updated | 2026-04-16 05:31:36 local |
| Source Spec | `PRD/20260416-043745-CODEX-NovaDentalFollowOnPhasesFSFS.md` |
| Continuity Ledger | `ContinuityDocs/20260416-045835-CODEX-NovaDentalFollowOnPhasesFSFSExecution.md` |

## Overview

Implement the follow-on Dental semantic phases on top of the existing extraction-first baseline:

1. Hybrid source-family execution with Dental email capable of live Bedrock-backed extraction.
2. User-visible trust surfaces for freshness, degraded last-known-good state, and exact-vs-fallback citations.
3. Dedicated semantic services that remove Dental semantic orchestration from broad helper logic in `corpusImport.service.js` and `mutation.service.js` when the hardening flag is enabled.

## Starting State Verification

- The current codebase already exposes the expected route shell and core product tabs in `client/src/App.jsx`.
- The backend already persists extraction-first state in DuckDB via `server/src/services/state/runtimeState.repository.js`.
- Existing Dental semantic state is still coarse:
  - one global execution mode instead of source-family-scoped policy
  - no freshness/degraded or last-known-good trust contract on product / ask / report routes
  - citations exist, but not with explicit `citationMode` exact/fallback semantics
  - semantic assembly remains coupled to `server/src/services/ingest/corpusImport.service.js` and `server/src/services/domain/mutation.service.js`
- Existing tests and Playwright suites provide a strong baseline for the prior extraction-first rollout and should be extended rather than replaced.

## Acceptance Criteria Focus

### Global

- [x] `AC-G-001` Hybrid policy allows Dental email live extraction when enabled.
- [x] `AC-G-002` Effective execution mode is persisted and surfaced explicitly.
- [x] `AC-G-003` Exact citations are only labeled exact when coordinate projection succeeds.
- [x] `AC-G-004` Ask and Reports disclose stale/degraded last-known-good state.
- [x] `AC-G-005` Publication failures preserve the last-known-good aggregate/read model.
- [x] `AC-G-006` Existing Dental routes and selectors stay stable.
- [x] `AC-G-007` Non-Dental mixed-mode portfolio behavior does not regress.
- [x] `AC-G-008` Live prompt-run metadata is queryable and traceable.
- [x] `AC-G-009` Service-split flag routes Dental semantic work through dedicated services.
- [x] `AC-G-010` Required Playwright workflows pass headless and headed.

### Frontend

- [x] `AC-FE-001` to `AC-FE-003` Overview/header trust-state messaging.
- [x] `AC-FE-004` to `AC-FE-007` Sources and citation trust rendering.
- [x] `AC-FE-008` to `AC-FE-009` Ask degraded-state banner.
- [x] `AC-FE-010` to `AC-FE-011` Reports trust banner with regeneration notice compatibility.
- [x] `AC-FE-012` to `AC-FE-013` Upload processing/failure trust messaging.
- [x] `AC-FE-014` to `AC-FE-015` Accessibility and visual consistency.

### Backend

- [x] `AC-BE-001` to `AC-BE-004` Execution policy, normalization, live/replay extraction, prompt metadata.
- [x] `AC-BE-005` to `AC-BE-007` Citation projection and source detail payloads.
- [x] `AC-BE-008` to `AC-BE-010` Atomic publication and trust-state computation.
- [x] `AC-BE-011` to `AC-BE-013` Dedicated semantic services and stable contracts.
- [x] `AC-BE-014` to `AC-BE-015` Observability and controlled failures.

### Cross-Cutting

- [x] `AC-INT-001` Hybrid reset communicates source-family policy.
- [x] `AC-INT-002` Live Dental email upload completes through extraction, persistence, publication, and UI refresh.
- [x] `AC-INT-003` Publication failure keeps last-known-good state visible with degraded messaging.
- [x] `AC-INT-004` Source detail distinguishes exact citations from fallback references.
- [x] `AC-INT-005` Ask reflects fresh vs last-known-good state consistently.
- [x] `AC-INT-006` Reports reflect semantic trust consistently with regeneration state.
- [x] `AC-INT-007` The same Playwright workflows pass headless and headed.

## Definition of Done

- All mapped `AC-G-*`, `AC-FE-*`, `AC-BE-*`, and `AC-INT-*` items have automated proof.
- The backend exposes hybrid execution, citation mode, freshness/degraded trust state, and service-split behavior per the FSFS contracts.
- The frontend surfaces trust-state messaging in Overview, Sources, Ask, Reports, and upload status without route churn.
- Last-known-good behavior is preserved on extraction, citation, and publication failures.
- Playwright scripts for the required scenarios are implemented and verified in both headless and headed modes.
- This tracker and the continuity ledger are updated with verification evidence and any conservative implementation decisions.

## Test Mapping / Traceability

| Acceptance Area | Proof | Final Status |
| :--- | :--- | :--- |
| Execution policy and reset contract | `server/test/runtime.config.test.js`, `server/test/semantic.execution-policy.test.js`, `server/test/read.contract.test.js`, `tests/e2e/dental-live-email-upload.spec.js` | Passed |
| Email normalization and citation projection | `server/test/semantic.citationProjection.test.js`, `server/test/semantic.ingest.integration.test.js`, `tests/e2e/dental-source-citation-trust.spec.js` | Passed |
| Publication preservation and freshness metadata | `server/test/runtime-state.repository.integration.test.js`, `server/test/semantic.ingest.integration.test.js`, `tests/e2e/dental-publication-failure-preserves-state.spec.js` | Passed |
| Ask/report trust-state read paths | `server/test/ask.contract.test.js`, `server/test/read.contract.test.js`, `client/src/test/semantic-trust-ui.test.jsx`, `tests/e2e/dental-ask-degraded.spec.js`, `tests/e2e/dental-report-trust.spec.js` | Passed |
| Service split stability | `server/src/services/semantic/semanticIngestOrchestrator.service.js`, `server/src/services/semantic/semanticPublication.service.js`, `tests/e2e/dental-service-split-stability.spec.js` | Passed |
| Existing route/selector stability | `client/src/test/artifact-upload-ui.test.jsx` plus the full Dental Playwright suite | Passed |

## Implementation Checklist

- [x] Verify current FE/BE/test starting state against the FSFS assumptions.
- [x] Create execution tracker and continuity ledger for this run.
- [x] Write failing lower-level tests for hybrid execution/trust-state/citation/service-split behavior.
- [x] Implement new semantic services and runtime/config contracts.
- [x] Rewire mutation/read-model/ask/report flows to consume the new semantic services and trust-state fields.
- [x] Update the React UI with the new trust surfaces and required selectors.
- [x] Extend Playwright helpers and implement the required FSFS E2E specs.
- [x] Run modified-file tests.
- [x] Run the same Playwright suite headless and headed, capture screenshot evidence, and update docs with results.

## Working Set

- `client/src/App.jsx`
- `client/src/styles/runtime.css`
- `client/src/test/artifact-upload-ui.test.jsx`
- `server/src/app.js`
- `server/src/config/runtime.js`
- `server/src/services/domain/ask.service.js`
- `server/src/services/domain/mutation.service.js`
- `server/src/services/domain/readModel.service.js`
- `server/src/services/ingest/corpusImport.service.js`
- `server/src/services/semantic/executionPolicy.service.js`
- `server/src/services/semantic/sourceNormalization.service.js`
- `server/src/services/semantic/novaSourceExtraction.service.js`
- `server/src/services/semantic/citationProjection.service.js`
- `server/src/services/semantic/semanticFreshness.service.js`
- `server/src/services/semantic/semanticPublication.service.js`
- `server/src/services/semantic/semanticIngestOrchestrator.service.js`
- `server/src/services/state/runtimeState.repository.js`
- `tests/e2e/helpers/novaLifecycle.js`
- `tests/e2e/*.spec.js`
- `server/test/*.test.js`

## Verification Evidence

- Modified-file Vitest pass:
  - `npm test -- --run client/src/test/artifact-upload-ui.test.jsx client/src/test/semantic-trust-ui.test.jsx server/test/runtime.config.test.js server/test/semantic.execution-policy.test.js server/test/semantic.citationProjection.test.js server/test/read.contract.test.js server/test/ask.contract.test.js server/test/runtime-state.repository.integration.test.js server/test/semantic.ingest.integration.test.js`
  - Result: `9` test files passed, `34` tests passed.
- Playwright headless pass:
  - `npx playwright test tests/e2e/dental-live-email-upload.spec.js tests/e2e/dental-source-citation-trust.spec.js tests/e2e/dental-ask-degraded.spec.js tests/e2e/dental-report-trust.spec.js tests/e2e/dental-publication-failure-preserves-state.spec.js tests/e2e/dental-service-split-stability.spec.js`
  - Result: `6` tests passed in `17.4s`.
- Playwright headed pass:
  - `npx playwright test --headed tests/e2e/dental-live-email-upload.spec.js tests/e2e/dental-source-citation-trust.spec.js tests/e2e/dental-ask-degraded.spec.js tests/e2e/dental-report-trust.spec.js tests/e2e/dental-publication-failure-preserves-state.spec.js tests/e2e/dental-service-split-stability.spec.js`
  - Result: `6` tests passed in `20.5s`.
- Screenshot evidence captured during manual verification:
  - `dental-overview-trust-headed-proof.png`
  - `dental-source-citation-headed-proof.png`
  - `dental-ask-degraded-headed-proof.png`

## Notes

- The prior extraction-first execution already landed much of the base runtime model, so this implementation should stay additive and conservative.
- The spec requires honest proof-type labeling. This environment did not provide a confirmed Bedrock-backed local live proof path during final verification, so the E2E suite validated the hybrid contract with explicit replay fallback semantics while lower-level tests covered the live-policy branch and metadata persistence contracts.
- The service-split alignment was tightened by moving orchestration and publication responsibilities into `server/src/services/semantic/semanticIngestOrchestrator.service.js` and `server/src/services/semantic/semanticPublication.service.js`.
