# Phase 2 Execution - Durable Structured Persistence And Service Boundaries

## Overview
- Phase: 2
- Objective: replace file-backed runtime JSON state with durable structured persistence and extract state operations behind service/repository boundaries while preserving API and UI behavior.
- Source references:
  - `docs/implementation/20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md`
  - `docs/implementation/20260415-083603-CODEX-FsfsExecution.md`
  - `EIDS-Product-Knowledge-Hub-Full-Stack-Functional-Spec.md`

## Phase 2 Acceptance Criteria (Execution Scope)
1. Structured application state is no longer stored in `runtime-db.json` as the primary source of truth.
2. Durable schema for currently implemented flows exists and is bootstrapped reproducibly.
3. Corpus bootstrap loads into durable storage.
4. Read endpoints use durable storage as primary source.
5. Snapshot-like state survives recompute/reset without destructive loss of valid prior state.
6. Audit persistence remains durable for successful mutations.
7. Report edits preserve generated vs current body behavior.
8. Product-scoped role resolution remains enforced server-side.
9. `app.js` delegates state persistence to extracted service/repository boundaries.
10. Integration tests cover persistence behavior.
11. Existing API contract behavior remains stable for read/report/ask paths.
12. Runtime/state reset path remains deterministic for test harness use.

## Definition Of Done (Phase 2)
- All scoped acceptance criteria above are implemented and verified.
- `runtime-db.json` is not used as the primary persistence source by the app runtime.
- Durable state file/database exists and is populated on bootstrap.
- State repository/service modules exist and are used by `app.js`.
- Required tests pass:
  - backend integration tests including new persistence tests
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
- Documentation and continuity ledger are updated with proof outcomes.

## Test Mapping
| AC | Test File | Test Name | Status |
| --- | --- | --- | --- |
| 1,2,10 | `server/test/runtime-state.repository.integration.test.js` | `uses durable duckdb state store instead of runtime json` | Passed |
| 3,4,11 | `server/test/runtime-state.repository.integration.test.js` | `persists mutations across app instances using durable state` | Passed |
| 5,12 | `server/test/runtime-state.repository.integration.test.js` | `preserves prior snapshot state if a recompute/update mutator fails` | Passed |
| 7 | `server/test/runtime-state.repository.integration.test.js` | `persists report generated and current section bodies separately` | Passed |
| 4,8,11 | `server/test/read.contract.test.js` | existing read contract tests | Passed |
| 6,11 | `server/test/audit.integration.test.js` | existing audit + report edit/export audit coverage | Passed |
| 11 | `tests/e2e/*.spec.js` | full UI/API contract regression (headless + headed) | Passed |

## Implementation Checklist
- [x] Add runtime state DB path to runtime config.
- [x] Add extracted state repository/service module under `server/src/services/state/`.
- [x] Implement schema bootstrap and corpus reset/load into durable store.
- [x] Rewire `readState`, `writeState`, `updateState`, and reset paths in `app.js` to repository.
- [x] Ensure old `runtime-db.json` path is no longer used as primary source.
- [x] Add Phase 2 persistence integration tests.
- [x] Extract domain logic from `app.js` into read/ask/mutation service modules.
- [x] Run full backend proof.
- [x] Run build + Playwright headless + headed.
- [x] Update execution docs and ledger.

## Storage Architecture (Phase 2 Source Of Truth)
- Primary structured runtime source of truth: `server/runtime/runtime-state.duckdb`
- Legacy `server/runtime/runtime-db.json` is no longer the primary state store and is removed during reset.
- Repository boundary: `server/src/services/state/runtimeState.repository.js`
- Domain-service boundaries:
  - Read models: `server/src/services/domain/readModel.service.js`
  - Ask orchestration (app-layer): `server/src/services/domain/ask.service.js`
  - Mutations/jobs/reports/exports: `server/src/services/domain/mutation.service.js`
- App shell/orchestration only: `server/src/app.js` (reduced from 1118 lines to 261 lines in this phase)

## Progress Log
- 2026-04-15 13:04:59: Phase 2 execution doc created.
- 2026-04-15 13:11:00: Added durable runtime-state repository wiring and initial persistence tests.
- 2026-04-15 13:18:00: Extracted read, ask, and mutation business logic into service modules; thinned `app.js`.
- 2026-04-15 13:21:00: Added snapshot-failure preservation test and report generated/current body persistence test.
- 2026-04-15 13:24:00: Phase 2 proof run passed:
  - `npm test -- server/test/read.contract.test.js server/test/ask.contract.test.js server/test/duckdb-rag.integration.test.js server/test/runtime.config.test.js server/test/artifact-store.test.js server/test/titan-embeddings.test.js server/test/audit.integration.test.js server/test/html-shell.test.js server/test/runtime-state.repository.integration.test.js`
  - `npm run build`
  - `npx playwright test`
  - `npx playwright test --headed`
