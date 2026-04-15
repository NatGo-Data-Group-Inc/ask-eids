# Phase 4 Execution - Ingestion, Normalization, Retrieval, And Ask Completion

## Overview
- Phase: 4
- Objective: complete the evidence pipeline so transcript/document artifacts are normalized, chunked, indexed in DuckDB with Titan embeddings, and used by Ask via evidence-constrained Nova synthesis with safe validation.
- Source references:
  - `docs/implementation/20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md`
  - `docs/implementation/20260415-125421-CODEX-Phase4-RunbookPrompt.md`
  - `EIDS-Product-Knowledge-Hub-Full-Stack-Functional-Spec.md`

## Phase 4 Acceptance Criteria (Execution Scope)
1. `AC-FE-017` through `AC-FE-024` fully implemented and mapped to tests.
2. `AC-BE-009` through `AC-BE-024` fully implemented with DuckDB equivalents for KB-specific wording.
3. `AC-INT-003`, `AC-INT-004`, `AC-INT-005`, `AC-INT-009` fully implemented against live backend.
4. Transcript uploads create durable source/job rows and raw/normalized/chunk artifacts and index retrieval entries.
5. Ask uses structured retrieval + DuckDB evidence retrieval + Nova synthesis + post-generation validation.
6. Ask returns `complete`, `partial`, `insufficientEvidence` honestly based on evidence thresholds.
7. Retrieval filters remain backend-generated and product-scoped.
8. Uploaded transcript evidence becomes searchable and citable.
9. OCR fallback exists when text extraction is insufficient.
10. Ask retries transient failures within budget and logs retry metadata.
11. Unknown/invalid source IDs in model output are rejected safely.
12. No user-visible Ask answer is produced from unsupported evidence.

## Definition Of Done (Phase 4)
- All scoped ingest/Ask ACs complete in traceability matrix.
- Durable ingestion + DuckDB indexing + Ask proof exists end-to-end.
- Required proof passes:
  - ingest contract/integration tests
  - normalization tests
  - chunk/sidecar tests
  - Ask orchestration/validation tests
  - upload-to-Ask Playwright tests
  - full headless and headed Playwright
- Uploading a transcript in proof environment leads to a citable Ask answer.
- Ask and ingest failures remain scoped and non-crashing.

## Test Mapping (Living)
| AC | Test File | Test Name | Status |
| --- | --- | --- | --- |
| FE-017 | `tests/e2e/ask-upload-validation.spec.js` | `ask button stays disabled for short queries` | Passed |
| FE-018, FE-019, FE-020, FE-021 | `tests/e2e/ask-partial.spec.js`, `tests/e2e/kb-failure.spec.js` | ask loading/success/partial/scoped failure rendering | Passed |
| FE-022 | `tests/e2e/ask-upload-validation.spec.js` | `transcript modal remains open with user metadata when upload fails validation` | Passed |
| FE-023 | `tests/e2e/upload-transcript.spec.js` | `upload transcript queues ingest and later surfaces evidence` + pending ingest state check | Passed |
| FE-024 | `tests/e2e/ask-upload-validation.spec.js` | upload failure keeps modal open and preserves user metadata | Passed |
| BE-009, BE-010, BE-011, BE-012, BE-013, BE-017, BE-018 | `server/test/ingest.pipeline.integration.test.js` | ingest states, normalization, extraction, chunk/sidecar, OCR fallback | Passed |
| BE-019, BE-020, BE-021, BE-022, BE-023, BE-024 | `server/test/ask.orchestration.integration.test.js`, `server/test/ask.contract.test.js` | structured failure partial, insufficient evidence, retry trace, citation validation, product filters | Passed |
| INT-003, INT-004 | `tests/e2e/ask-partial.spec.js` | Ask answer + partial warning | Passed |
| INT-005 | `tests/e2e/upload-transcript.spec.js`, `tests/e2e/doc-pack-upload-ask.spec.js` | upload then searchable/citable Ask | Passed |
| INT-009 | `tests/e2e/kb-failure.spec.js` | scoped dependency failure rendering | Passed |

## Implementation Checklist
- [x] Create normalization services for transcript/document/email-equivalent ingest path.
- [x] Add OCR fallback helper path and failure classification.
- [x] Add deterministic chunk + metadata-sidecar service.
- [x] Rework transcript upload pipeline to persist raw + normalized + chunk artifacts and explicit ingest state transitions.
- [x] Add structured Ask planner/retrieval/evidence-pack/validation behavior for DuckDB-backed retrieval.
- [x] Add transient retry path for retrieval/generation with trace logging.
- [x] Enforce source-id validation on model output and safe fallback.
- [x] Ensure Ask completion state classification is threshold-driven.
- [x] Add backend tests first for each missing AC, then implement to pass.
- [x] Add/adjust Playwright tests for upload/ask/error proof.
- [x] Run backend/build/Playwright headless/Playwright headed proof.

## Files Implemented In Phase 4
- Backend:
  - `server/src/services/ingest/normalize/transcriptNormalizer.js`
  - `server/src/services/extract/transcriptExtraction.service.js`
  - `server/src/services/rag/chunking.service.js`
  - `server/src/services/rag/queryPlanner.service.js`
  - `server/src/services/rag/structuredRetrieval.service.js`
  - `server/src/services/rag/evidencePack.service.js`
  - `server/src/services/rag/generation.service.js`
  - `server/src/services/rag/validation.service.js`
  - `server/src/services/domain/ask.service.js`
  - `server/src/services/domain/mutation.service.js`
  - `server/src/services/domain/readModel.service.js`
  - `server/src/app.js`
- Tests:
  - `server/test/ingest.pipeline.integration.test.js`
  - `server/test/ask.orchestration.integration.test.js`
  - `server/test/duckdb-rag.integration.test.js`
  - `tests/e2e/ask-upload-validation.spec.js`
  - `tests/e2e/upload-transcript.spec.js`
  - `tests/e2e/doc-pack-upload-ask.spec.js`
- Frontend:
  - `client/src/App.jsx`

## Proof Record (2026-04-15)
- Backend regression (Phase 4 + prior-phase preservation):
  - `npm test -- server/test/read.contract.test.js server/test/ask.contract.test.js server/test/duckdb-rag.integration.test.js server/test/read-scope.integration.test.js server/test/ingest.pipeline.integration.test.js server/test/ask.orchestration.integration.test.js server/test/runtime.config.test.js server/test/artifact-store.test.js server/test/titan-embeddings.test.js server/test/audit.integration.test.js server/test/html-shell.test.js server/test/runtime-state.repository.integration.test.js`
  - Result: `12 files passed`, `34 tests passed`.
- Build:
  - `npm run build`
  - Result: passed.
- Playwright headless:
  - `npx playwright test`
  - Result: `21 passed`.
- Playwright headed:
  - `npx playwright test --headed`
  - Result: `21 passed`.

## Phase 4 Completion Record
- Acceptance Criteria: 12/12 satisfied
- DoD: satisfied
- Phase status: complete (2026-04-15)

## Progress Log
- 2026-04-15 13:53:22: Phase 4 execution doc created; gap analysis completed; TDD implementation started.
- 2026-04-15 14:04:00: Added failing ingest + ask orchestration integration tests and confirmed red baseline.
- 2026-04-15 14:08:00: Implemented transcript normalization/extraction/chunking pipeline, Ask planner/evidence/validation/retry flow, and product pending-ingest UI state.
- 2026-04-15 14:10:00: Completed backend regression + build + full Playwright headless and headed proof; Phase 4 marked complete.
