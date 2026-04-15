# FSFS Execution - EIDS Product Knowledge Hub

## Overview
- Objective: execute the EIDS Product Knowledge Hub FSFS end-to-end in this repository while preserving the existing `index.html` as the single app entry page.
- Execution mode: fullstack-spec-executor.
- Current repo reality: static prototype only. The implementation therefore needs to bootstrap the full client/server/test stack around the existing page shell.
- Retrieval decision: use a DuckDB-backed vector store as the approved retrieval implementation for this app instead of Bedrock Knowledge Bases / OpenSearch Serverless.
- Runtime decision: keep live AWS integration on the application side through Amazon S3-compatible artifact storage seams and Amazon Bedrock Runtime seams for Titan embeddings and Nova Pro generation, with local-safe defaults during proof runs unless `EIDS_ENABLE_BEDROCK=1` or `EIDS_ARTIFACT_STORE_MODE=s3` is intentionally enabled.
- Corpus-runtime decision: all portfolio, product, timeline, data, sources, Ask, and report content shown in the prototype UI now derives from the imported `EIDS-Prototype-Document-Pack` corpus instead of the old seeded fixture payloads.

## Acceptance Criteria
- The repo contains a real client/server application aligned with the FSFS.
- The existing `index.html` remains the only HTML entry point.
- The frontend and backend honor the documented API contracts and core user-visible acceptance criteria.
- Lower-level tests and Playwright proof are added for the implemented workflows.
- Prototype retrieval/index storage is isolated from application-state storage and runs through a provider seam that can later swap from `duckdb` to `bedrock-kb` without changing Ask/report contracts.
- Transcript ingestion updates the retrieval index so Ask answers can cite newly ingested evidence.
- Runtime config loads sibling-project AWS/Bedrock settings from `C:/Projects/AgenticDataCatalog-NoDocker` without hardcoding secrets into AskEIDS.
- The HTML shell contains only app/frame markup and generic UI copy; product facts, source content, Ask answers, and report content are derived by the application at runtime.

## Definition Of Done
- `index.html` mounts the real application.
- The app serves live backend-backed portfolio and product views.
- Mutations, Ask, and reports are implemented through real API flows.
- Automated tests pass for the implemented acceptance map.
- Playwright verification passes headless and headed for the implemented scenarios.
- DuckDB stores prototype document/chunk/vector retrieval data for AskEIDS.
- The server retrieval code depends on a vector/retrieval provider seam rather than direct KB-specific logic.
- The app no longer renders hardcoded seeded product/report/source facts; runtime content comes from imported corpus artifacts and subsequent live mutations.

## Test Mapping
| Area | Initial Test Target | Status |
| --- | --- | --- |
| Session/portfolio/product contracts | `server/test/read.contract.test.js` | Passing |
| DuckDB transcript ingest + retrieval | `server/test/duckdb-rag.integration.test.js` | Passing |
| Portfolio/product route rendering | `client/src/test/portfolio.test.jsx` | Planned |
| Portfolio to product E2E | `tests/e2e/portfolio-to-product.spec.js` | Passing (headless + headed) |
| Real document-pack upload + Ask E2E | `tests/e2e/doc-pack-upload-ask.spec.js` | Passing (headless + headed) |
| Ask/report/user-visible flows | `tests/e2e/*.spec.js` + lower-level contracts | Passing (headless + headed) |

## Implementation Checklist
- [x] Bootstrap package, build, and test infrastructure.
- [x] Implement corpus-backed backend data store and read routes.
- [x] Port the prototype into React routes/components.
- [x] Introduce a retrieval provider seam with DuckDB as the active prototype backend.
- [x] Implement transcript ingestion, chunk/index persistence, and Ask retrieval against DuckDB.
- [x] Keep report lifecycle and non-retrieval app state working while app-state persistence migrates to durable DuckDB state storage.
- [x] Add and pass lower-level DuckDB retrieval tests.
- [x] Add and pass the full Playwright proof set required by the FSFS.
- [x] Add runtime foundation modules for env loading, GovCloud region guards, artifact storage, Titan embedding seams, and Nova generation seams.
- [x] Re-prove the backend suite plus Playwright headless/headed after the runtime cutover.
- [x] Persist audit events for successful mutation flows and prove them with integration coverage.
- [x] Add explicit shell and guardrail proof for Phase 1 (`index.html` domain-fact guard + fail-fast region mismatch tests).
- [x] Replace runtime JSON with durable structured persistence.
- [ ] Replace prototype background jobs with durable queue-backed workers.
- [ ] Complete connector, audit, and remaining FSFS traceability work.

## Notes
- Current runtime slice implemented in this phase:
  - `server/src/config/env.js` loads local env plus sibling-project credential/model settings.
  - `server/src/config/runtime.js` centralizes storage mode, region, model IDs, test/dev defaults, and GovCloud single-region assertions.
  - `server/src/lib/aws/bedrockCompliance.js`, `bedrockText.js`, `titanEmbeddings.js`, and `textract.js` introduce Bedrock/Titan/Nova/Textract seams.
  - `server/src/lib/storage/artifactStore.js` adds a filesystem-or-S3 artifact abstraction for raw, normalized, and export content.
  - `server/src/rag/prototypeDuckDbStore.js` now uses the Titan embedding seam instead of the old fixed local hash embedding function.
  - `server/src/app.js` now writes uploaded transcript artifacts and exported report artifacts through the shared artifact store and guards background report/export jobs against unhandled crashes.
- Local-safe proof behavior:
  - Live Bedrock calls are disabled unless `EIDS_ENABLE_BEDROCK=1`.
  - Artifact storage defaults to filesystem outside production unless `EIDS_ARTIFACT_STORE_MODE=s3` is explicitly enabled.
  - This keeps lower-level tests plus headless/headed Playwright proof deterministic while preserving the real integration seams for later enablement.
- Implemented proof in this slice:
  - `server/src/services/ingest/corpusImport.service.js` imports the real document pack manifest, metadata sidecars, source contents, structured exports, timelines, Ask suggestions, recent signals, and report sections into runtime state.
  - `server/src/app.js` now initializes runtime state from the imported corpus, derives quick views and reports from corpus state, and answers Ask queries from corpus-derived structured state plus DuckDB retrieval.
  - `server/src/rag/prototypeDuckDbStore.js` now isolates test-worker DuckDB files and serializes store operations so lower-level proof is stable under Vitest concurrency.
  - `client/src/App.jsx` now renders report headings and period labels from live product/report payloads instead of hardcoded Dental copy.
  - `server/test/runtime.config.test.js`, `artifact-store.test.js`, `titan-embeddings.test.js`, `audit.integration.test.js`, and `html-shell.test.js` prove the runtime/audit/shell layer directly.
  - `server/src/services/state/runtimeState.repository.js` is now the durable structured state source of truth and `runtime-db.json` is no longer primary.
  - `server/src/services/domain/readModel.service.js`, `ask.service.js`, and `mutation.service.js` now hold domain logic formerly concentrated in `server/src/app.js`.
  - `server/test/runtime-state.repository.integration.test.js` now proves durable cross-instance persistence, snapshot-failure preservation, and report `bodyGenerated` vs `bodyCurrent` separation.
  - Full proof commands completed successfully:
    - `npm test -- server/test/read.contract.test.js server/test/ask.contract.test.js server/test/duckdb-rag.integration.test.js server/test/runtime.config.test.js server/test/artifact-store.test.js server/test/titan-embeddings.test.js server/test/audit.integration.test.js server/test/html-shell.test.js server/test/runtime-state.repository.integration.test.js`
    - `npm run build`
    - `npx playwright test`
    - `npx playwright test --headed`
