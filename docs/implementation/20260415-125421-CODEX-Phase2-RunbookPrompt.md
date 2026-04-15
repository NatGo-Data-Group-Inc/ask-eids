# Phase 2 Runbook Prompt

## Execution Prompt
```text
You are working in C:\Projects\AskEIDS.

Your task is to COMPLETE ONLY Phase 2 from:
C:\Projects\AskEIDS\docs\implementation\20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md

You may begin only after confirming Phase 1 is complete or explicitly accepted. Continue until every Phase 2 acceptance criterion and Phase 2 Definition of Done item is fully satisfied and proven.

Hard rules:
1. Follow `AGENTS.md`.
2. Follow the continuity ledger in `ContinuityDocs/20260415-083125-CODEX-WireExistingHtmlToFsfs.md`.
3. Keep the HTML shell generic and free of domain facts.
4. Keep DuckDB as the retrieval store.
5. Do not move to Phase 3.
6. Do not use git state-changing actions.

Execution workflow:
1. Audit the current implementation against the Phase 2 criteria.
2. Update the implementation docs with a Phase 2 checklist and traceability table.
3. Write or update tests first for each missing or partial requirement.
4. Replace file-backed structured runtime state with durable structured persistence and extract service boundaries.
5. Re-run all required proof.
6. Update docs and ledger.
7. Report Phase 2 complete only if every criterion and DoD item is satisfied.

Complete Phase 2 only.
```

## Phase Objective
Replace file-backed structured runtime state with durable structured persistence and extract clear service and repository boundaries from the monolithic server.

## Acceptance Criteria
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

## Definition Of Done
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
