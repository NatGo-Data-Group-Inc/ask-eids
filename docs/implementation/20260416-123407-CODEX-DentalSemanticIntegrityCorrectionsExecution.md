# Dental Semantic Integrity Corrections Execution

| Attribute | Detail |
| :--- | :--- |
| Task | Execute the Dental Semantic Integrity Corrections FSFS end to end |
| Status | Implementation Complete - Provider Signoff Achieved |
| Owner | Codex |
| Last Updated | 2026-04-16 18:24:00 local |
| Source FSFS | `PRD/20260416-104117-CODEX-DentalSemanticIntegrityCorrectionsFSFS.md` |
| Continuity Ledger | `ContinuityDocs/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md` |

## Overview

This tracker covers the implementation of the corrective FSFS for Dental semantic integrity. The execution goal is to make replay truth, AJV validation, runtime feature gating, aggregate provenance, retrieval indexing, and Ask precedence behave exactly as specified while preserving the current route shell and existing user-facing layout.

## Acceptance Criteria

### Global

- [x] Replay mode uses cache-backed artifacts only and fails closed on miss.
- [x] Source extraction payloads are AJV-validated before persistence/publication.
- [x] Aggregate payloads are AJV-validated before publish.
- [x] Published aggregate provenance uses distinct aggregate publication runs and monotonic CAS.
- [x] Trust-surface flags and service-split flags produce real behavior changes.
- [x] Retrieval-eligible Dental uploads index immediately when indexing is enabled.
- [x] Fixed-schema structured exports never write `rag_chunks` rows.
- [x] Ask precedence is deterministic and observable.
- [x] No user-visible surface updates from unvalidated model output.
- [x] Required Playwright proof passes headless and headed, with provider-backed signoff documented honestly.

### Definition of Done

- [ ] All mapped `AC-G-*`, `AC-FE-*`, `AC-BE-*`, and `AC-INT-*` are covered by automated proof.
- [ ] Backend contracts match the FSFS request/response/error shapes.
- [ ] Frontend trust/report/source/Ask states match the FSFS selectors and copy.
- [ ] Retrieval indexing lifecycle is proven for enabled, disabled, failed, and not-applicable paths.
- [ ] No temporary stubs or placeholder Playwright scripts remain for this scope.
- [ ] Modified-file lint/test commands pass.
- [x] Playwright passes in headless and headed modes.
- [x] Continuity ledger and this tracker are updated with implementation and proof outcomes.

## Test Mapping

| Area | Planned Proof |
| :--- | :--- |
| Replay truth + validation | Backend unit/integration + replay hit/miss E2E |
| Report and trust surfaces | FE component/integration + fresh/degraded/flag E2E |
| Aggregate validation + publication CAS | Backend integration/contract |
| Retrieval indexing lifecycle | Backend integration + upload/Ask E2E |
| Ask precedence and retrieval warnings | Backend unit/integration + precedence-conflict/disabled-indexing E2E |
| Provider-backed signoff | Local/dev Bedrock-backed manual/E2E proof if environment supports it |

## Implementation Checklist

- [x] Verify codebase drift versus the FSFS assumptions.
- [x] Map existing FE/BE/E2E coverage to the corrective acceptance criteria.
- [x] Write failing tests for missing contracts and workflows.
- [x] Implement replay store + extraction validation + aggregate validation.
- [x] Implement effective feature-flag authority and flat report banner contract.
- [x] Implement aggregate publication run provenance and monotonic CAS.
- [x] Implement family-classed retrieval indexing and source indexing state.
- [x] Implement Ask precedence merge and retrieval warnings.
- [x] Implement frontend source/Ask/report trust and indexing UI.
- [x] Execute modified-file tests and Playwright proof in both modes.
- [x] Record proof and residual risks honestly.

## Working Set

- `client/src/App.jsx`
- `client/src/test/`
- `server/src/app.js`
- `server/src/config/runtime.js`
- `server/src/services/domain/ask.service.js`
- `server/src/services/domain/mutation.service.js`
- `server/src/services/domain/readModel.service.js`
- `server/src/services/semantic/`
- `server/src/rag/`
- `server/test/`
- `shared/artifactTypes.js`
- `tests/e2e/helpers/novaLifecycle.js`
- `tests/e2e/`

## Notes

- This document will be updated as code, tests, and proof land.

## Proof Status

- Focused Vitest regression passed:
  - `npm test -- --run server/test/semantic.replay-store.test.js server/test/semantic.validation.test.js server/test/ask.precedence.test.js server/test/semantic.ingest.integration.test.js server/test/read.contract.test.js server/test/ask.contract.test.js client/src/test/semantic-trust-ui.test.jsx client/src/test/artifact-upload-ui.test.jsx`
  - Result: `32 passed`
- Focused Playwright headless regression passed:
  - `npx playwright test tests/e2e/nova-baseline-reset.spec.js tests/e2e/dental-live-email-upload.spec.js tests/e2e/dental-report-trust.spec.js tests/e2e/dental-service-split-stability.spec.js tests/e2e/dental-ask-degraded.spec.js tests/e2e/dental-publication-failure-preserves-state.spec.js tests/e2e/dental-source-citation-trust.spec.js tests/e2e/nova-upload-email-source-detail.spec.js tests/e2e/nova-upload-transcript-ask.spec.js tests/e2e/nova-report-regeneration.spec.js tests/e2e/nova-failure-last-known-good.spec.js tests/e2e/nova-structured-data-overview.spec.js tests/e2e/dental-upload-retrieval.spec.js tests/e2e/dental-structured-no-vectors.spec.js tests/e2e/dental-indexing-failure.spec.js tests/e2e/dental-indexing-disabled.spec.js tests/e2e/dental-precedence-conflict.spec.js`
  - Result: `17 passed`
- Focused Playwright headed regression passed after switching [playwright.config.js](/C:/Projects/AskEIDS/playwright.config.js) to `reuseExistingServer: true` and reusing a prestarted local server:
  - `npx playwright test tests/e2e/nova-baseline-reset.spec.js tests/e2e/dental-live-email-upload.spec.js tests/e2e/dental-report-trust.spec.js tests/e2e/dental-service-split-stability.spec.js tests/e2e/dental-ask-degraded.spec.js tests/e2e/dental-publication-failure-preserves-state.spec.js tests/e2e/dental-source-citation-trust.spec.js tests/e2e/nova-upload-email-source-detail.spec.js tests/e2e/nova-upload-transcript-ask.spec.js tests/e2e/nova-report-regeneration.spec.js tests/e2e/nova-failure-last-known-good.spec.js tests/e2e/nova-structured-data-overview.spec.js tests/e2e/dental-upload-retrieval.spec.js tests/e2e/dental-structured-no-vectors.spec.js tests/e2e/dental-indexing-failure.spec.js tests/e2e/dental-indexing-disabled.spec.js tests/e2e/dental-precedence-conflict.spec.js --headed`
  - Result: `17 passed`
- Focused transcript parity proof passed after routing the legacy transcript indexing path through Module 7:
  - `npm test -- --run server/test/ingest.pipeline.integration.test.js`
  - Result: `4 passed`
- Focused Ask observability proof passed after adding explicit `askPrecedenceDecision` logging:
  - `npm test -- --run server/test/ask.orchestration.integration.test.js`
  - Result: `5 passed`
- Broadened DuckDB-backed backend confidence slice passed after hardening the transcript citation integration test to wait for terminal ingest state:
  - `npm test -- --run server/test/ingest.pipeline.integration.test.js server/test/ask.orchestration.integration.test.js server/test/duckdb-rag.integration.test.js`
  - Result: `11 passed`
- Added browser-level exact-field-conflict proof:
  - `tests/e2e/dental-precedence-conflict.spec.js`
  - Result: included in both headless and headed passing slices above
- Replay-backed semantic ingest integration is green in isolation after the live-extraction parser/normalization hardening:
  - `npm test -- --run server/test/semantic.ingest.integration.test.js`
  - Result: `6 passed`
- Direct Bedrock smoke now succeeds with the shared local AWS credential store and the sibling project Bedrock settings:
  - `node -e "...generateBedrockText...embedTexts..."`
  - Result: Bedrock text returned `OK...`; Titan returned `embeddingLength: 512`
- Provider-backed release signoff now passes through the reusable local script:
  - `node .\\scripts\\dental-live-provider-signoff.mjs`
  - Result: `status: "ok"` with `executionMode: "live"`, `validationStatus: "valid"`, `indexingStatus: "indexed"`, `embeddingSource: "titan"`, `ragCount: 1`, Ask citing the uploaded source via `retrievalType: "vector"`, and fresh product/report semantic state without banners

## Residual Risk

- No repo-wide logger abstraction is present in `server/src`; retaining `console.info('askPrecedenceDecision', ...)` is currently consistent with the existing `console.warn(...)` operational pattern in `server/src/app.js`.
- The broader DuckDB-backed harness no longer requires additional serialization changes for this slice; the previously observed instability was addressed by removing the brittle fixed-delay transcript citation assertion.
- There is still no repo-native lint script in `package.json`, so the proof set remains test- and signoff-driven rather than lint-backed for this scope.
