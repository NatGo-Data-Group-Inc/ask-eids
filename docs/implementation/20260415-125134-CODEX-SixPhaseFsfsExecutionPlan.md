# Six-Phase FSFS Execution Plan - EIDS Product Knowledge Hub

## Document Metadata
- Document type: implementation plan
- Source of truth inputs:
  - `EIDS-Product-Knowledge-Hub-Full-Stack-Functional-Spec.md`
  - `docs/implementation/20260415-083603-CODEX-FsfsExecution.md`
  - `docs/implementation/20260415-121923-CODEX-FsfsCompletionPlan.md`
- Planning objective: break the remaining FSFS work into six production-oriented phases that can be completed one at a time, each with its own acceptance criteria, proof expectations, and phase Definition of Done.
- Intended use: execution control document for iterative delivery.

## Executive Summary
This plan converts the remaining EIDS Product Knowledge Hub FSFS into six discrete phases. Each phase is designed to produce a stable, reviewable increment that can be accepted independently while still moving the system toward the full production-ready target.

The plan intentionally uses the FSFS acceptance criteria as the baseline and adds phase-specific production-readiness criteria where the original FSFS is too broad to serve as a tight exit gate. A phase is complete only when:
- its scoped acceptance criteria are implemented
- its required automated proof passes
- its phase-specific Definition of Done is satisfied
- its documentation and traceability are updated

## Global Planning Principles
1. No product/report/chat/source facts may be hardcoded into `index.html` or the page shell.
2. All domain content rendered in the app must be application-derived from runtime data, stored artifacts, or generated outputs constrained by evidence.
3. DuckDB is the approved retrieval store for this implementation.
4. S3-compatible artifact storage, Bedrock Runtime seams for Titan and Nova, and durable structured persistence must all exist before the system can be called production-ready.
5. Every phase must preserve passing automated proof for the previously accepted phases.
6. A later phase may not weaken or silently bypass the guarantees introduced by an earlier phase.

## Final Target State By End Of Phase 6
By the end of Phase 6, the system must be able to truthfully claim all of the following:
- The app is a live full-stack implementation rather than a prototype shell.
- All visible product data, source data, Ask responses, and report outputs are runtime-derived.
- Structured state is durable and queryable.
- Artifact ingestion, retrieval, reporting, export, and connector flows are durable and observable.
- The app is production-ready for internal deployment in its target environment.
- The complete acceptance matrix and Definition of Done are satisfied.

## Phase Dependency Model
- Phase 1 is required before all other phases.
- Phase 2 depends on Phase 1.
- Phase 3 depends on Phase 2.
- Phase 4 depends on Phases 2 and 3.
- Phase 5 depends on Phases 2, 3, and 4.
- Phase 6 depends on all prior phases.

## Phase Status
- Phase 1: Complete (2026-04-15)
- Phase 2: Complete (2026-04-15)
- Phase 3: Complete (2026-04-15)
- Phase 4: Complete (2026-04-15)
- Phase 5: Complete (2026-04-15)
- Phase 6: Complete (2026-04-15)

---

## Phase 1 - Runtime Foundation And Delivery Baseline

### Objective
Establish the production-shaped runtime skeleton so subsequent feature work lands on a stable foundation instead of further expanding prototype-only patterns.

### Scope
- Environment loading and validation
- single-region guardrails
- artifact storage abstraction
- Bedrock Runtime seams for Titan and Nova
- safe local defaults for development and automated proof
- process stability and startup diagnostics
- implementation documentation and phase traceability baseline

### In Scope
- `server/src/config/*`
- `server/src/lib/aws/*`
- `server/src/lib/storage/*`
- startup/runtime assertions
- proof-preserving toggles for local/test execution
- documentation updates

### Out Of Scope
- durable database migration work
- connectors
- full report/orchestration rewrite
- full worker/queue architecture

### Phase Acceptance Criteria
1. The runtime loads AskEIDS-owned configuration first and may optionally supplement model/runtime settings from `C:\Projects\AgenticDataCatalog-NoDocker` without copying secrets into AskEIDS.
2. The application enforces single-region operation rules at startup and fails fast on invalid region configuration.
3. Artifact operations for raw, normalized, and export content run through a shared abstraction rather than direct scattered file writes.
4. The retrieval layer uses the Titan embedding seam instead of the old hardcoded embedding function.
5. Ask/report generation seams exist for Bedrock Runtime/Nova even if live invocation remains feature-gated for proof environments.
6. Local, test, headless, and headed proof runs remain deterministic without requiring live AWS credentials.
7. Background job failures in the current in-process implementation are recorded as job failures instead of crashing the server.
8. The HTML shell remains generic and contains no hardcoded domain facts.
9. The execution docs clearly record the architecture choice: `DuckDB + S3-compatible artifact storage seam + Bedrock Runtime seam`, not Knowledge Bases/AOSS.
10. Direct tests exist for runtime config, artifact storage behavior, and embedding fallback behavior.

### Phase DoD
- All Phase 1 acceptance criteria are implemented.
- The following proof passes:
  - targeted backend tests for runtime/config/storage/embedding
  - existing backend read/Ask/retrieval tests
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- The runtime can be started locally without manual code edits.
- The implementation ledger and execution docs are updated.
- No newly introduced console errors or backend crashes occur during the phase proof run.

### Phase Exit Artifacts
- updated execution doc
- updated completion-plan doc
- continuity ledger entry
- passing backend/build/Playwright proof log

### Phase 1 Completion Record (2026-04-15)
- Acceptance Criteria: 10/10 satisfied
- DoD: satisfied
- Proof:
  - `npm test -- server/test/read.contract.test.js server/test/ask.contract.test.js server/test/duckdb-rag.integration.test.js server/test/runtime.config.test.js server/test/artifact-store.test.js server/test/titan-embeddings.test.js server/test/audit.integration.test.js server/test/html-shell.test.js`
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`

---

## Phase 2 - Durable Structured Persistence And Service Boundaries

### Objective
Replace file-backed structured runtime state with durable structured persistence and extract the monolithic app logic into clear service boundaries.

### Scope
- relational schema implementation
- repository/service boundaries
- durable storage for products, permissions, sources, jobs, reports, snapshots, telemetry, and audit rows
- replacement of runtime JSON as the system of record
- backend service extraction from `server/src/app.js`

### In Scope
- products
- principal roles
- source records
- source chunks metadata
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
- audit events
- sync runs
- connector profiles

### Out Of Scope
- mailbox and ADO connectors themselves
- fully durable queue workers
- full Ask/report orchestration rewrite

### Phase Acceptance Criteria
1. Structured application state is no longer stored in `runtime-db.json` as the primary source of truth.
2. The schema needed for current portfolio/product/timeline/data/sources/report/audit flows is implemented and bootstrapped reproducibly.
3. The system can load the document pack into durable structured storage through an application bootstrap/import path.
4. Read endpoints no longer depend on the old runtime JSON for primary product state.
5. Snapshot concepts from the FSFS are represented durably and can be refreshed without deleting previously valid snapshot state.
6. Audit events are durably persisted for successful mutation actions.
7. Report edits preserve generated content separately from current edited content.
8. Product-scoped role resolution is durable and enforced server-side.
9. The backend code is separated into service/repository units substantial enough to stop `app.js` from being the primary business-logic container.
10. The new persistence layer is covered by integration tests, not just unit tests.
11. Existing UI/API contracts for portfolio, product, timeline, data, sources, and reports remain stable unless explicitly versioned/documented.
12. Failure to refresh or recompute a snapshot must preserve the prior valid snapshot.

### Phase DoD
- All Phase 2 acceptance criteria are implemented.
- All read/write flows previously relying on runtime JSON have a durable persistence path.
- The following proof passes:
  - schema/migration tests
  - repository/service integration tests
  - contract tests for read endpoints
  - mutation tests for weekly/report edit/audit flows
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- `app.js` is materially thinner and delegates domain logic to service modules.
- Documentation includes a storage architecture section that reflects the new source of truth.

### Phase Exit Artifacts
- schema/migration documentation
- data bootstrap notes
- updated acceptance traceability matrix
- updated ledger entry

### Phase 2 Completion Record (2026-04-15)
- Acceptance Criteria: 12/12 satisfied
- DoD: satisfied
- Proof:
  - `npm test -- server/test/read.contract.test.js server/test/ask.contract.test.js server/test/duckdb-rag.integration.test.js server/test/runtime.config.test.js server/test/artifact-store.test.js server/test/titan-embeddings.test.js server/test/audit.integration.test.js server/test/html-shell.test.js server/test/runtime-state.repository.integration.test.js`
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- Major implementation outcomes:
  - Structured runtime source of truth moved to DuckDB-backed durable state repository.
  - Snapshot-failure preservation behavior added and tested.
  - Report section persistence now stores generated body separately from current edited body.
  - `server/src/app.js` reduced from 1118 lines to 261 lines by extracting read/ask/mutation services.

---

## Phase 3 - Read Experience Hardening And Accessibility Closure

### Objective
Finish and harden the complete read experience so the product shell, read-only workflows, navigation, deep links, and accessibility behaviors are production-grade.

### Scope
- app shell
- search
- portfolio
- quick views
- product shell and routing
- overview
- timeline
- data
- sources
- read-only role views
- accessibility and keyboard behavior
- unsupported viewport handling

### Phase Acceptance Criteria
1. `AC-FE-001` through `AC-FE-016` are fully implemented and explicitly mapped to tests.
2. `AC-FE-027` through `AC-FE-030` are fully implemented and explicitly mapped to tests.
3. `AC-FE-035`, `AC-FE-037`, `AC-FE-038`, and `AC-FE-039` are fully implemented and explicitly mapped to tests.
4. `AC-BE-001` through `AC-BE-008` are fully satisfied for the read experience and reflected in live backend behavior.
5. `AC-INT-001`, `AC-INT-002`, and `AC-INT-008` are fully satisfied against the live backend.
6. Keyboard traversal works across:
  - top navigation
  - search palette
  - product cards
  - tabs
  - filter chips
  - source rows
  - modal triggers
7. Reduced-motion behavior is implemented and verified.
8. Unsupported viewport behavior is enforced below 1024px.
9. Read-only users cannot see or trigger mutating controls in the read experience.
10. 403, 404, and validation failure states render the correct scoped UI rather than generic fallbacks.
11. No visible product/source/report facts are embedded statically into the HTML shell.
12. Search results and product navigation continue to be fully runtime-derived.

### Phase DoD
- All scoped FE/BE/INT criteria for the read experience are marked complete in the traceability matrix.
- Full Playwright coverage exists for all user-visible read workflows in this phase.
- Accessibility acceptance for keyboard, semantics, focus, and reduced motion has explicit proof.
- Headless and headed Playwright passes remain green.
- No console errors appear during the phase proof suite.

### Phase Exit Artifacts
- updated FE/BE/INT traceability rows
- accessibility notes
- read-flow Playwright proof record

### Phase 3 Completion Record (2026-04-15)
- Acceptance Criteria: 12/12 satisfied
- DoD: satisfied
- Proof:
  - `npm test -- server/test/read.contract.test.js server/test/read-scope.integration.test.js server/test/ask.contract.test.js server/test/duckdb-rag.integration.test.js server/test/runtime.config.test.js server/test/artifact-store.test.js server/test/titan-embeddings.test.js server/test/audit.integration.test.js server/test/html-shell.test.js server/test/runtime-state.repository.integration.test.js`
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- Major implementation outcomes:
  - Backend now enforces durable product-scoped read authorization and scoped portfolio/search/session responses.
  - Product route error mapping now renders explicit scoped 403/404/401 views.
  - Keyboard roving navigation added for tabs and filter chips.
  - Reduced-motion and focus-visible behaviors are explicitly enforced at the shell/style level.
  - Read-navigation flows and accessibility flows are covered by additive Playwright suites.

---

## Phase 4 - Ingestion, Normalization, Retrieval, And Ask Completion

### Objective
Complete the evidence pipeline so new artifacts are durably ingested, normalized, indexed into DuckDB via Titan embeddings, and then used by Ask with evidence-backed Nova synthesis.

### Scope
- transcript ingest hardening
- document normalization
- PDF extraction and OCR fallback
- chunking and metadata sidecars
- source/job state progression
- DuckDB indexing with Titan embeddings
- Ask orchestration, ranking, and evidence validation
- partial/insufficient/error state honesty

### Phase Acceptance Criteria
1. `AC-FE-017` through `AC-FE-024` are fully implemented and explicitly mapped to tests.
2. `AC-BE-009` through `AC-BE-024` are fully implemented, except any KB-specific wording must be satisfied by the DuckDB equivalent.
3. `AC-INT-003`, `AC-INT-004`, `AC-INT-005`, and `AC-INT-009` are fully implemented against the live backend.
4. Transcript uploads create durable source records, durable ingest jobs, raw artifacts, normalized artifacts, and DuckDB-indexed retrieval entries.
5. Ask uses:
  - structured retrieval from durable state
  - DuckDB retrieval using Titan embeddings
  - Nova synthesis constrained by evidence
  - post-generation validation
6. Ask returns `complete`, `partial`, or `insufficientEvidence` honestly based on evidence thresholds.
7. Retrieval filtering remains backend-generated and product-scoped.
8. Uploaded transcript evidence becomes searchable and citable after ingest completion.
9. OCR fallback exists for scanned PDFs when text extraction is insufficient.
10. The Ask path retries appropriate transient failures within budget and logs the retry.
11. Unknown or invalid source IDs in model output are rejected safely.
12. No user-visible Ask answer is produced from unsupported evidence.

### Phase DoD
- All scoped Ask/ingest acceptance criteria are complete in the matrix.
- Durable ingestion + DuckDB indexing + Ask proof exists end to end.
- The following proof passes:
  - ingest contract/integration tests
  - normalization tests
  - chunk/sidecar tests
  - Ask orchestration/validation tests
  - Playwright upload-to-Ask evidence tests
  - headless and headed Playwright runs
- The system can ingest a new transcript in a proof environment and then answer a question citing that transcript.
- Failure states for ingest and Ask are both scoped and non-crashing.

### Phase Exit Artifacts
- ingest pipeline notes
- Ask orchestration notes
- evidence-threshold documentation
- updated traceability rows

### Phase 4 Completion Record (2026-04-15)
- Acceptance Criteria: 12/12 satisfied
- DoD: satisfied
- Proof:
  - `npm test -- server/test/read.contract.test.js server/test/ask.contract.test.js server/test/duckdb-rag.integration.test.js server/test/read-scope.integration.test.js server/test/ingest.pipeline.integration.test.js server/test/ask.orchestration.integration.test.js server/test/runtime.config.test.js server/test/artifact-store.test.js server/test/titan-embeddings.test.js server/test/audit.integration.test.js server/test/html-shell.test.js server/test/runtime-state.repository.integration.test.js`
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- Major implementation outcomes:
  - Transcript ingest pipeline now performs normalization, extraction, chunk generation, metadata sidecars, and indexed evidence writes with explicit ingest states (`queued/running/completed/partial/failed`).
  - OCR fallback is available for low-text scanned-style inputs with explicit metadata (`ocrFallbackUsed`).
  - Ask now uses planner + structured retrieval + DuckDB retrieval + evidence pack + source-id validation + transient retry trace metadata.
  - Unknown source citations are rejected safely, and structured retrieval degradation produces explicit `partial` coverage warnings.
  - Read experience now surfaces pending ingest state in Overview while background ingest processing completes.

---

## Phase 5 - Weekly Updates, Reports, Exports, Jobs, And Operational Traceability

### Objective
Finish the authoring/output side of the product: weekly updates, report generation, section editing, exports, durable job execution, and operational traceability.

### Scope
- weekly update workflow hardening
- report generation orchestration
- section persistence and conflicts
- export generation
- durable job model and queue-backed workers
- telemetry ingestion hardening
- audit coverage expansion

### Phase Acceptance Criteria
1. `AC-FE-025`, `AC-FE-026`, and `AC-FE-031` through `AC-FE-036` are fully implemented and explicitly mapped to tests.
2. `AC-BE-025` through `AC-BE-032`, `AC-BE-037`, and `AC-BE-038` are fully implemented.
3. `AC-INT-006` and `AC-INT-007` are fully implemented against the live backend.
4. Weekly update publication writes durable structured state and a searchable/citable source artifact.
5. Report generation runs as a durable job rather than only in an in-process timer path.
6. Report sections preserve generated body and current edited body separately.
7. Stale report section edits return `409 CONFLICT` with stable user recovery behavior.
8. Export jobs produce valid artifacts and do not mutate report content.
9. Export failures are recorded without taking down report readability.
10. Telemetry ingestion remains non-blocking.
11. Audit persistence covers all mutation actions in scope for this phase.
12. Existing visible report content remains available during export or refresh actions.
13. Coverage warnings and partial-report honesty are preserved in the report UI and API.
14. Job status APIs reflect durable job state instead of transient memory-only state.

### Phase DoD
- All scoped report/export/job acceptance criteria are complete.
- Queue-backed or equivalently durable worker execution is in place for report/export jobs.
- The following proof passes:
  - weekly update tests
  - report generation/load/edit/conflict tests
  - export artifact tests
  - telemetry/audit tests
  - full Playwright report workflow tests in headless and headed mode
- Artifact exports can be downloaded and validated after job completion.
- No job-path failure causes an unhandled process crash.

### Phase Exit Artifacts
- report/export job architecture notes
- conflict-handling notes
- audit/telemetry traceability update

### Phase 5 Completion Record (2026-04-15)
- Acceptance Criteria: 14/14 satisfied
- DoD: satisfied
- Proof:
  - `npm test -- server/test/report-jobs.integration.test.js server/test/export.integration.test.js server/test/telemetry.integration.test.js server/test/audit.integration.test.js`
  - `npm test`
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- Major implementation outcomes:
  - Replaced in-process `setTimeout` report/export execution with durable state-backed job pumping (`pending/running/completed/failed`) and payload-rich job records.
  - Added report section revision-based optimistic concurrency with `409 CONFLICT` handling for stale saves.
  - Added explicit export failure injection/proof path while preserving report readability and non-mutating export behavior.
  - Hardened telemetry endpoint as non-blocking with swallowed persistence failures.
  - Expanded audit coverage to include report generation start/completion and export completion/failure lifecycle actions.

---

## Phase 6 - Connectors, Hardening, Full AC Closure, And Production Readiness

### Objective
Complete the remaining system-of-record integrations, production hardening, observability, and full acceptance/DoD closure so the system is ready for production use.

### Scope
- mailbox connector
- email normalization and attachment linking
- ADO REST sync
- optional ADO MCP enrichment isolation
- connector observability and lag/failure handling
- rollback validation
- full AC traceability closure
- usability and production-readiness closeout

### Phase Acceptance Criteria
1. `AC-BE-014`, `AC-BE-015`, `AC-BE-016`, `AC-BE-033`, `AC-BE-034`, `AC-BE-035`, and `AC-BE-036` are fully implemented.
2. Any remaining partially complete acceptance criteria from earlier phases are closed and marked complete.
3. Connector runs are durable, replayable, and cursor/watermark-based.
4. Email ingestion supports parsing, quote stripping, attachment linking, and duplicate suppression.
5. ADO REST sync updates structured rows and timeline state deterministically.
6. Optional MCP enrichment remains non-blocking and never becomes the sole source of truth.
7. Connector lag and repeated failure are observable and alertable.
8. Rollback documentation exists and is validated in a non-production environment.
9. All `AC-FE-###`, `AC-BE-###`, and `AC-INT-###` items map to one or more automated tests or a documented approved alternate validation method.
10. All global quality gates `GQ-001` through `GQ-010` are satisfied.
11. Usability scenarios from the FSFS have an explicit completion record.
12. Design deliverables that are still required for handoff are completed or explicitly waived with justification.
13. The system can be described honestly as production-ready for the intended internal deployment context.

### Phase DoD
- Every acceptance criterion in the FSFS is marked complete, waived with explicit rationale, or superseded by a documented DuckDB-equivalent criterion that is itself complete.
- Every blocking DoD checkbox from the FSFS is satisfied.
- Full automated proof passes:
  - full backend suite
  - full build
  - full headless Playwright suite
  - full headed Playwright suite
- Connector operations are observable and have failure-handling documentation.
- Rollback plan is documented and tested.
- Release-readiness documentation is complete.

### Phase Exit Artifacts
- final acceptance traceability matrix
- final DoD checklist with evidence links
- rollback validation record
- production readiness summary
- release handoff package

### Phase 6 Completion Record (2026-04-15)
- Acceptance Criteria: 13/13 satisfied
- DoD: satisfied
- Proof:
  - `npm test -- server/test/connectors.integration.test.js`
  - `npm test`
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- Major implementation outcomes:
  - Added durable connector integrations for mailbox and ADO REST sync with cursor/watermark semantics and replay-safe sync runs.
  - Added non-blocking optional ADO MCP enrichment adapter with explicit failure tolerance.
  - Added connector job orchestration endpoints:
    - `POST /api/v1/connectors/mailboxes/sync`
    - `POST /api/v1/connectors/ado/sync`
    - `GET /api/v1/connectors/status`
  - Added connector observability with lag/failure alert surfaces and durable sync run/audit traceability.
  - Closed final acceptance and DoD documentation artifacts in `docs/implementation/20260415-143350-CODEX-Phase6Execution.md`.

---

## Cross-Phase Proof Rules
Each phase must preserve all accepted prior-phase proof. No phase can be closed if it breaks previously accepted flows.

### Minimum Required Proof For Every Phase
- targeted backend tests for the phase scope
- `npm run build`
- `npx playwright test` for impacted user-visible flows
- `npx playwright test --headed` for the same impacted user-visible flows when the phase changes browser-visible behavior
- documentation update in `docs/implementation/`
- continuity ledger update

## Acceptance Traceability Requirement
For each phase, the execution doc must maintain a table with:
- Acceptance Criterion ID
- Phase
- Implementation file(s)
- Test file(s)
- Status
- Proof date
- Notes

## Criteria For Final Project Completion
The project can be declared complete only when:
1. All six phases are accepted.
2. The acceptance traceability matrix is fully closed.
3. The FSFS blocking DoD is fully closed.
4. The system is still truthful about the runtime source of every visible data element.
5. No domain facts are hardcoded into the HTML shell.

## Recommended Phase Completion Order
1. Phase 1 - Runtime Foundation And Delivery Baseline
2. Phase 2 - Durable Structured Persistence And Service Boundaries
3. Phase 3 - Read Experience Hardening And Accessibility Closure
4. Phase 4 - Ingestion, Normalization, Retrieval, And Ask Completion
5. Phase 5 - Weekly Updates, Reports, Exports, Jobs, And Operational Traceability
6. Phase 6 - Connectors, Hardening, Full AC Closure, And Production Readiness

## Operator Notes
- A phase should be finalized only when all of its acceptance criteria and its DoD are satisfied.
- If a phase reveals a missing prerequisite, that prerequisite must be added to the current phase or the phase must be reopened.
- Production-readiness language is forbidden until Phase 6 is fully accepted.
