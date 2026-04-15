# FSFS Completion Plan - EIDS Product Knowledge Hub

## Overview
- Objective: document the remaining work required to truthfully state that the EIDS Product Knowledge Hub FSFS is complete, all acceptance criteria are met, and the Definition of Done is satisfied.
- Current reality: the repository is a strong corpus-driven prototype with live client/server behavior, DuckDB retrieval plus durable DuckDB-backed structured runtime persistence, and passing lower-level plus Playwright proof for the currently implemented workflows.
- User-directed architecture adjustment: do not complete the original Bedrock Knowledge Base / OpenSearch Serverless path. Keep DuckDB as the retrieval store, but complete the remaining cloud-backed architecture with Amazon S3 for artifact storage, Amazon Bedrock Runtime for Amazon Titan Text Embeddings V2 and Amazon Nova Pro v1, and the rest of the AWS-backed operational stack needed for the app to be a full-stack implementation.
- This document is an execution plan, not a claim of completion.

## Progress Update - 2026-04-15
- Phase 1 foundation work is complete:
  - centralized env/runtime config now exists
  - sibling-project credential/model config can be loaded without copying secrets into AskEIDS
  - GovCloud single-region assertions exist
  - S3/filesystem artifact storage abstraction exists
  - Titan embedding and Nova generation seams exist
  - transcript/export flows use the shared artifact store
  - shell/guardrail proof exists (`html-shell.test.js`, runtime fail-fast mismatch tests)
- Local proof remains green after the cutover:
  - expanded backend suite passed
  - production build passed
  - Playwright passed headless
  - Playwright passed headed
- The app is still **not** FSFS-complete:
  - structured persistence is durable in DuckDB but still not Aurora/Postgres-backed
  - background jobs are still in-process timers
  - connectors/audit/traceability are still incomplete

## Progress Update - 2026-04-15 (Phase 2)
- Phase 2 durability/service-boundary work is complete:
  - structured runtime source of truth moved to `runtime-state.duckdb`
  - durable repository boundary implemented (`runtimeState.repository.js`)
  - app business logic extracted into service modules (`readModel`, `ask`, `mutation`)
  - report sections now persist generated and current edited bodies separately
  - snapshot/update failure preservation is integration-tested
  - `app.js` reduced from 1118 lines to 261 lines
- Proof passed:
  - expanded backend suite (24 passing tests)
  - production build
  - Playwright headless (12/12)
  - Playwright headed (12/12)

## Executive Answer
The entire FSFS has **not** been implemented yet.

### Why not
1. The current runtime is still a prototype architecture rather than the full target architecture.
   - Structured state is not persisted in Aurora PostgreSQL.
   - Raw and normalized artifacts are not persisted in S3.
   - Async ingest/report/export work is not running through SQS-backed workers.
   - Ask/report generation is not yet using live Bedrock Runtime for Titan embeddings and Nova Pro generation.
2. The backend module inventory from the FSFS does not exist as implemented service boundaries.
   - The repo currently has a small number of files, with most behavior concentrated in `server/src/app.js`.
   - The FSFS expects distinct modules for auth, read services, ingest normalization, extraction, chunking, retrieval, generation, validation, reports, exports, connectors, telemetry, and snapshots.
3. Large portions of the backend acceptance criteria are still unimplemented.
   - Email ingestion and normalization are not implemented.
   - Mailbox connector and ADO connector flows are not implemented.
   - Audit persistence is not implemented beyond in-memory/runtime capture.
   - Export jobs are local and simplified rather than durable artifact workflows.
4. The test matrix required by the FSFS is incomplete.
   - The repo currently has a narrow backend test set and a good but still incomplete Playwright suite.
   - There is not yet one-or-more-test traceability for every `AC-FE-###`, `AC-BE-###`, and `AC-INT-###` item.
5. The DoD cannot honestly be checked complete while the cloud-backed runtime, traceability, and remaining user-visible workflows are still missing.

## Current State Summary

### Implemented Well
- Existing `index.html` remains the only HTML shell.
- Portfolio, product, timeline, data, sources, Ask, quick views, transcript upload, weekly updates, reports, exports, and role-based views are wired as a live app.
- The app's displayed domain content is corpus-driven from `EIDS-Prototype-Document-Pack`, not from the original seeded literals.
- The prototype uses DuckDB-backed retrieval with provider indirection and live transcript indexing.
- Current proof includes:
  - backend contract/integration tests for core read and Ask paths
  - build proof
  - Playwright headless proof
  - Playwright headed proof

### Implemented Only as Prototype Substitutes
- Local filesystem storage instead of S3
- DuckDB durable runtime store instead of Aurora PostgreSQL
- In-process async simulation instead of SQS workers
- DuckDB local embeddings/search instead of Titan-embedded vectors persisted through an AWS-backed ingestion pipeline
- Corpus-derived report drafting instead of Nova Pro-backed section generation with validation/retry
- Local export files instead of durable export artifacts and job tracking

### Not Implemented Yet
- Real AWS object storage path
- Real Bedrock Runtime integration for Titan embeddings and Nova Pro generation
- Real durable structured persistence with schema/migrations and snapshot rebuilds
- Email ingestion pipeline and attachment linking
- Mailbox connector
- ADO REST connector
- Optional ADO MCP enrichment adapter
- Telemetry/audit persistence and operational observability
- Full acceptance-criterion traceability and complete automated test coverage

## Architecture Delta From The Original FSFS
The original FSFS specifies Bedrock Knowledge Bases + OpenSearch Serverless as the managed retrieval layer. Per updated user direction, this completion plan intentionally replaces that portion with:
- DuckDB as the product retrieval store
- Amazon Titan Text Embeddings V2 invoked directly through Bedrock Runtime for embedding generation
- Amazon Nova Pro v1 invoked directly through Bedrock Runtime for answer/report synthesis
- Amazon S3 for raw, normalized, chunk, and export artifact storage

This means the implementation should preserve the same user-facing behavior and evidence controls while changing the retrieval storage mechanism.

### Required Spec Amendment
Before closing the implementation as complete, the execution documents should record:
- Bedrock Knowledge Bases: removed from runtime plan
- OpenSearch Serverless: removed from runtime plan
- DuckDB vector store: promoted from prototype exception to approved implementation choice for this release path
- Bedrock Runtime for Titan and Nova: remains required
- All acceptance criteria that mention KB-specific sync/retrieve behavior should be reworded to equivalent DuckDB + Titan behavior so the final DoD is honest

## Gap Assessment Against The FSFS

### Frontend Acceptance Criteria Status
| Area | Status | Notes |
| --- | --- | --- |
| App shell and search (`AC-FE-001` to `AC-FE-004`) | Partial | Working user flow exists, but component/integration traceability is incomplete and keyboard-specific proof needs explicit coverage review. |
| Portfolio (`AC-FE-005` to `AC-FE-008`) | Mostly implemented | Live and Playwright-covered, but component-level traceability is still incomplete. |
| Quick views (`AC-FE-009` to `AC-FE-010`) | Mostly implemented | User-visible flow exists; dedicated AC traceability is still incomplete. |
| Product shell and routing (`AC-FE-011` to `AC-FE-013`) | Mostly implemented | Deep-linking and tab behavior are working, but explicit 403/404 UI proof needs tightening. |
| Overview (`AC-FE-014` to `AC-FE-016`) | Mostly implemented | Health and role-based UI exist; recent-signal-to-timeline proof should be made explicit. |
| Ask (`AC-FE-017` to `AC-FE-021`) | Partial | UI is present and tested, but still needs real Bedrock/Nova-backed completion plus broader error-state proof. |
| Upload transcript (`AC-FE-022` to `AC-FE-024`) | Partial | User-visible flow exists, but current ingest path is local/runtime-backed rather than full cloud-backed and durable. |
| Update weekly (`AC-FE-025` to `AC-FE-026`) | Partial | Current write path exists, but not yet durable/Aurora-backed and needs more formal proof. |
| Timeline/Data/Sources (`AC-FE-027` to `AC-FE-030`) | Mostly implemented | Live and Playwright-covered at a workflow level; component/integration traceability remains incomplete. |
| Reports (`AC-FE-031` to `AC-FE-036`) | Partial | Visible flow exists, but generation/export are still simplified prototype flows. |
| Accessibility and responsive (`AC-FE-037` to `AC-FE-039`) | Partial | Unsupported viewport is implemented; keyboard and reduced-motion proof are incomplete. |

### Backend Acceptance Criteria Status
| Area | Status | Notes |
| --- | --- | --- |
| Auth and scope (`AC-BE-001` to `AC-BE-003`) | Partial | Basic auth harness exists, but not a production-ready claims mapping and authorization service boundary. |
| Portfolio/product reads (`AC-BE-004` to `AC-BE-006`) | Mostly implemented | Live read contracts exist, but not yet Aurora-backed snapshot reads. |
| Search (`AC-BE-007` to `AC-BE-008`) | Mostly implemented | Functional, but still runtime-backed rather than durable DB-backed. |
| Ingestion (`AC-BE-009` to `AC-BE-013`) | Partial | Transcript intake exists, but S3 storage, durable source/job records, chunk sidecars, and retryable failures are not yet implemented as specified. |
| Email processing (`AC-BE-014` to `AC-BE-016`) | Not implemented | No mailbox/email normalization pipeline yet. |
| Transcript processing (`AC-BE-017` to `AC-BE-018`) | Partial | Basic transcript indexing exists, but durable extracted decision/action persistence and confidence storage are not fully implemented. |
| Ask orchestration (`AC-BE-019` to `AC-BE-024`) | Partial | API works, but Bedrock Runtime, Titan embeddings, Nova generation, retry logic, and strict validation are not complete. |
| Health and snapshots (`AC-BE-025` to `AC-BE-026`) | Partial | Health is computed from corpus import, but not from the full durable ingestion/snapshot pipeline. |
| Reports (`AC-BE-027` to `AC-BE-032`) | Partial | Report lifecycle exists, but not as durable SQS-worker-backed generation/persistence/export. |
| Connectors (`AC-BE-033` to `AC-BE-036`) | Not implemented | Mailbox and ADO connectors are absent. |
| Telemetry/audit (`AC-BE-037` to `AC-BE-038`) | Partial | Telemetry accept endpoint exists, but no durable audit persistence or full operational treatment. |

### Cross-Cutting Acceptance Criteria Status
| Area | Status | Notes |
| --- | --- | --- |
| Portfolio/product live integration (`AC-INT-001` to `AC-INT-002`) | Partial | Live end-to-end works, but not yet against Aurora snapshots. |
| Ask integration (`AC-INT-003` to `AC-INT-004`) | Partial | UX works, but not yet through Bedrock Runtime Titan/Nova path. |
| Upload to searchability (`AC-INT-005`) | Partial | Works in prototype form; not yet through S3 + durable storage + Bedrock Runtime embeddings. |
| Report integration (`AC-INT-006` to `AC-INT-007`) | Partial | Works in prototype form; not yet through durable job and artifact infrastructure. |
| Read-only permissions (`AC-INT-008`) | Mostly implemented | User-visible proof exists. |
| Ask failure handling (`AC-INT-009`) | Mostly implemented | Harness exists, but should be revalidated against real cloud dependency failures. |
| Single-region runtime guards (`AC-INT-010`) | Not implemented | No real GovCloud/AWS runtime guard enforcement exists yet. |

## Constraints For The Remaining Implementation
- Keep `index.html` as the only HTML entry shell.
- Keep DuckDB as the retrieval store.
- Use real S3 for raw, normalized, chunk, and export artifacts.
- Use real Bedrock Runtime for Titan embeddings and Nova Pro generation.
- Do not add Bedrock Knowledge Bases or OpenSearch Serverless.
- Preserve the current corpus-driven UI behavior while replacing prototype internals with durable infrastructure.
- Maintain proof-driven execution: spec/update doc -> tests -> implementation -> headless Playwright -> headed Playwright.

## Detailed Completion Plan

## Phase 0 - Re-baseline The Spec And Traceability
**Goal:** make the target honest before more implementation starts.

### Deliverables
- Update `docs/implementation/20260415-083603-CODEX-FsfsExecution.md` with the architecture change from KB/AOSS to DuckDB + Titan + Nova + S3.
- Create an acceptance traceability matrix that lists every `AC-FE`, `AC-BE`, and `AC-INT` item with:
  - implementation file(s)
  - test file(s)
  - current status
  - proof status
- Add a DoD checklist section that distinguishes `complete`, `prototype-complete`, and `not started`.

### Blocking Output
- No remaining work should claim “FSFS complete” until this matrix exists and is updated continuously.

### Test Work
- Add a meta-tracking doc rather than executable tests for this phase.

## Phase 1 - AWS Foundation And Runtime Configuration
**Goal:** establish the real cloud runtime skeleton while preserving the current UI.

### Backend Work
- Introduce AWS configuration and client factories for:
  - S3
  - Bedrock Runtime
  - optional Textract
  - SQS
  - Secrets Manager
- Add explicit region enforcement and startup guards to ensure only the configured GovCloud/commercial dev region is used.
- Add `.env.example` / config validation for:
  - `AWS_REGION`
  - `AWS_S3_RAW_BUCKET`
  - `AWS_S3_NORMALIZED_BUCKET`
  - `AWS_S3_EXPORT_BUCKET`
  - `BEDROCK_GEN_MODEL_ID`
  - `BEDROCK_EMBED_MODEL_ID`
  - `SQS_*`
  - `AURORA_PG_URL`
- Reuse patterns from `C:\Projects\AgenticDataCatalog-NoDocker` for Bedrock/Titan config discipline, but adapt them to AskEIDS’s monorepo and no-KB architecture.

### Deliverables
- `server/src/config/*`
- `server/src/lib/aws/*`
- startup validation
- region guard integration tests

### Required Tests
- config validation tests
- region enforcement tests
- Bedrock/S3 client factory tests
- `AC-INT-010` proof plan

## Phase 2 - Durable Structured Persistence With Aurora/Postgres
**Goal:** replace runtime JSON as the source of truth for structured data.

### Backend Work
- Add migration files or schema bootstrap for the FSFS relational model, minus KB/AOSS-specific assumptions.
- Implement repositories/services for:
  - products
  - principal roles
  - source records
  - source chunks
  - timeline events
  - decisions
  - action items
  - risks
  - blockers
  - PI objectives
  - weekly updates
  - product snapshots
  - portfolio snapshots
  - ingest jobs
  - report runs
  - report sections
  - sync runs
  - connector profiles
  - audit events
- Move runtime import from “JSON boot state” to “corpus bootstrap into relational state.”
- Rebuild `/session`, `/portfolio`, `/products/:id`, `/timeline`, `/data`, `/sources`, and `/search` against durable persistence.

### Frontend Impact
- Minimal UI changes if contracts remain stable.
- Loading/error states may need refinement for real persistence latency.

### Required Tests
- schema migration tests
- repository integration tests
- contract tests for all read endpoints
- Playwright re-run of existing read flows against the DB-backed runtime

## Phase 3 - S3-Backed Ingestion Pipeline
**Goal:** make source intake durable and traceable.

### Backend Work
- Implement source intake service boundaries:
  - raw upload to S3
  - source record creation in DB
  - ingest job creation in DB
- Add normalized artifact persistence to S3.
- Add chunk artifact writing to S3.
- Generate deterministic chunk sidecars with metadata.
- Add explicit source/job status progression: `pending -> processing -> completed|partial|failed`.
- Implement document normalizers for:
  - markdown/text
  - docx via `mammoth`
  - pdf text extraction
  - Textract OCR fallback when needed
- Add manual import path foundations for `.eml`, `.msg`, `.zip` packs.

### Required Tests
- transcript upload contract tests
- oversized/unsupported upload tests
- S3 write tests with fakes
- normalization tests
- chunk sidecar tests
- job status progression tests
- Playwright upload flow rerun against real durable ingest storage

## Phase 4 - DuckDB + Titan Retrieval Pipeline
**Goal:** keep DuckDB, but make embeddings and retrieval production-like.

### Backend Work
- Refactor `prototypeDuckDbStore.js` into a real retrieval store module.
- Replace local deterministic embeddings with Titan embedding calls through Bedrock Runtime.
- Persist chunk embeddings in DuckDB with stable metadata and source linkage.
- Implement retrieval service with:
  - backend-generated product filters
  - sourceType/date filters
  - score ranking
  - per-source caps
  - evidence insufficiency thresholds
- Remove prototype fallback branches that bypass evidence discipline.

### Required Tests
- Titan embedding client tests with fakes
- DuckDB indexing/search integration tests
- retrieval filter enforcement tests
- evidence threshold tests
- `AC-BE-024` direct proof

## Phase 5 - Nova Pro Ask Orchestration
**Goal:** complete the Ask path with real model generation and strict evidence validation.

### Backend Work
- Split Ask behavior into service boundaries:
  - query planner
  - structured retrieval
  - DuckDB retrieval
  - evidence packer
  - Nova generation
  - post-generation validation
- Use Nova Pro via Bedrock Runtime.
- Enforce strict JSON output contracts.
- Implement retry-on-timeout / malformed-output repair flow.
- Add trace IDs and latency capture.
- Sanitize answer HTML before returning to the client.

### Frontend Work
- Preserve current Ask UX but ensure the copy/states exactly match the error taxonomy.
- Add stronger partial vs insufficient-evidence rendering distinctions if needed.

### Required Tests
- planner unit tests
- evidence pack tests
- generation validation tests
- throttling/timeout retry tests
- contract tests for full/partial/error/insufficient evidence
- Playwright Ask success/failure/partial re-proof against the real orchestration path

## Phase 6 - Snapshot And Health Pipeline
**Goal:** compute health from durable data and keep UI reads fast and honest.

### Backend Work
- Implement health scoring service against durable records.
- Implement product snapshot and portfolio snapshot builders.
- Trigger recompute on:
  - source ingest completion
  - weekly update write
  - connector sync completion
  - report completion where relevant
- Preserve last-good snapshot behavior if recompute fails.
- Add stale snapshot indicators in API payloads where appropriate.

### Required Tests
- deterministic health scoring tests
- snapshot rollback / last-good retention tests
- contract tests for portfolio/product snapshot reads
- Playwright proof that freshness/gap messaging updates after ingest and weekly publish

## Phase 7 - Reports, Persistence, And Exports
**Goal:** replace the prototype report flow with the full durable report lifecycle.

### Backend Work
- Implement report runs and section persistence in Postgres.
- Generate report sections using Nova Pro with section-local evidence packs.
- Add concurrency/version checks for section edits.
- Implement export service for:
  - PDF
  - PPTX
  - copy payload
  - email payload/preparation
- Store export artifacts in S3.
- Track export jobs durably.

### Frontend Work
- Preserve current reports UX while tightening:
  - empty state
  - loading/polling behavior
  - conflict handling UI
  - export status/error behavior

### Required Tests
- report job persistence tests
- section edit conflict tests
- export artifact state tests
- Playwright report generate/edit/reload/export proof in headless and headed mode

## Phase 8 - Telemetry, Audit, And Observability
**Goal:** satisfy the operational and trust requirements in the FSFS.

### Backend Work
- Persist audit events for:
  - transcript upload
  - weekly publish
  - report edit
  - connector sync trigger
  - export trigger
- Persist or forward telemetry events without blocking callers.
- Add structured logging across request and job lifecycles.
- Add CloudWatch-compatible metric/log shaping.
- Add operational alarms/runbook notes in docs.

### Required Tests
- telemetry accept/non-blocking tests
- audit row persistence tests
- error/log shape tests where feasible

## Phase 9 - Mailbox And ADO Connectors
**Goal:** complete the remaining source freshness architecture.

### Backend Work
- Implement mailbox connector with cursoring, duplicate suppression, and attachment ingestion.
- Implement email normalization:
  - HTML-to-text
  - quote stripping
  - disclaimer stripping
  - thread reconstruction
- Implement ADO REST connector with watermarking and upserts.
- Implement optional ADO MCP enrichment adapter as non-blocking.
- Implement connector scheduler/runner and sync run tracking.

### Required Tests
- email normalization tests
- duplicate suppression tests
- mailbox cursor resume tests
- ADO upsert tests
- MCP non-blocking failure tests

## Phase 10 - Accessibility, UX, And Design Deliverables Closure
**Goal:** close the remaining frontend and design DoD items.

### Frontend Work
- Add explicit keyboard-nav proof for tabs, chips, modals, drawers, and search palette.
- Add reduced-motion handling and proof.
- Audit 200 percent zoom and landmark semantics.
- Verify no console warnings/errors in all core Playwright scenarios.
- Produce the required design deliverables if they do not already exist:
  - user flow diagrams
  - high-fidelity state mockups for uncovered states
  - component specifications
  - copy deck
  - accessibility notes
  - design QA checklist

### Required Tests
- accessibility-focused Playwright scenarios
- keyboard traversal tests
- reduced-motion tests
- console-cleanliness assertions in the main E2E suite

## Phase 11 - Full Traceability And Final DoD Closure
**Goal:** only declare completion after every AC and DoD item is backed by proof.

### Required Work
- Build the final AC matrix with one-or-more automated tests per criterion.
- Ensure every end-to-end observable behavior appears in Playwright.
- Run the same Playwright suite:
  - headless
  - headed
- Capture screenshots for the headed proof run.
- Update implementation docs to mark every item complete.
- Produce a final release-readiness summary that explicitly names any residual non-goals.

## Detailed Test Expansion Plan

### Missing Or Incomplete Automated Coverage Categories
- frontend component tests for rendering/validation/role-state details
- backend integration tests for durable DB/S3/AWS flows
- backend tests for email/connectors/telemetry/audit
- explicit single-region runtime guard tests
- accessibility-specific UI proof
- full AC traceability matrix

### Required New Test Files (Representative)
- `client/src/test/app-shell.test.jsx`
- `client/src/test/portfolio-page.test.jsx`
- `client/src/test/product-overview.test.jsx`
- `client/src/test/upload-transcript-modal.test.jsx`
- `client/src/test/update-weekly-modal.test.jsx`
- `client/src/test/reports-view.test.jsx`
- `server/test/config.validation.test.js`
- `server/test/auth.integration.test.js`
- `server/test/search.contract.test.js`
- `server/test/ingest.s3.integration.test.js`
- `server/test/document-normalizer.test.js`
- `server/test/email-normalizer.test.js`
- `server/test/transcript-extraction.integration.test.js`
- `server/test/health-scoring.test.js`
- `server/test/report-orchestration.integration.test.js`
- `server/test/export.integration.test.js`
- `server/test/telemetry-audit.integration.test.js`
- `server/test/mailbox-connector.integration.test.js`
- `server/test/ado-connector.integration.test.js`
- `server/test/region-guard.integration.test.js`
- additional Playwright specs for:
  - accessibility/keyboard traversal
  - recent-signal to timeline routing
  - 403/404 product states
  - conflict handling UI
  - connector freshness display if surfaced

## Recommended Execution Order
1. Re-baseline the spec and traceability so completion claims become objective.
2. Stand up AWS config, S3, Bedrock Runtime, and Postgres so prototype internals can be replaced without churning the UI.
3. Move ingest, retrieval, Ask, health, and reports onto durable cloud-backed internals while preserving current contracts.
4. Add telemetry/audit/connector infrastructure.
5. Close accessibility, test traceability, and final DoD proof.

## Blocking Risks
- The current FSFS text still assumes Knowledge Bases and OpenSearch Serverless. If the spec is not amended, the team could build the wrong architecture while believing it is “following the spec.”
- Replacing runtime JSON with Postgres and local files with S3 is a significant internal rewrite; it should be staged behind stable API contracts.
- Bedrock Runtime integration can change latency and failure characteristics, so Playwright and backend retry/error-proof work must be rerun after that cutover.
- Connector work should not begin before durable ingest, audit, and snapshot foundations are in place.

## Immediate Next Work Package
If implementation resumes now, the highest-value sequence is:
1. Amend the execution docs for the DuckDB + Titan + Nova + S3 architecture.
2. Stand up AWS config validation and client factories.
3. Replace local runtime persistence with Postgres-backed read/write stores.
4. Move artifact storage to S3 and retrieval embeddings to Titan.
5. Rebuild Ask and reports on Nova Pro with durable jobs and exports.

## Completion Standard
This work should only be called complete when all of the following are true:
- all remaining prototype substitutions are removed or explicitly approved as final architecture,
- every acceptance criterion maps to automated proof,
- the same Playwright suite passes headless and headed after the cloud cutover,
- the DoD checklist can be checked without caveats.
