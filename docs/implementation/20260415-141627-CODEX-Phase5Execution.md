# Phase 5 Execution - Weekly Updates, Reports, Exports, Jobs, And Operational Traceability

## Overview
- Phase: 5
- Objective: finish authoring/output behavior with durable report/export jobs, conflict-safe report editing, non-blocking telemetry, and auditable mutation traceability.
- Source references:
  - `docs/implementation/20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md`
  - `docs/implementation/20260415-125421-CODEX-Phase5-RunbookPrompt.md`
  - `EIDS-Product-Knowledge-Hub-Full-Stack-Functional-Spec.md`

## Phase 5 Acceptance Criteria (Execution Scope)
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

## Definition Of Done (Phase 5)
- All scoped report/export/job acceptance criteria are complete.
- Queue-backed or equivalently durable worker execution is in place for report/export jobs.
- Required proof passes:
  - weekly update tests
  - report generation/load/edit/conflict tests
  - export artifact tests
  - telemetry/audit tests
  - Playwright report workflow tests in headless and headed mode
- Artifact exports can be downloaded and validated after job completion.
- No job-path failure causes an unhandled process crash.

## Gap Audit (Start State)
- `queueReportJob` and `queueExportJob` currently rely on `setTimeout` in `mutation.service` and are not recovered/replayed as durable worker tasks.
- `updateReportSection` does not currently perform stale-write conflict checks.
- Telemetry endpoint writes through awaited state mutation; failures can bubble to caller (`/api/v1/telemetry` not hard non-blocking).
- Export failure behavior is only implicit and does not yet have dedicated contract proof for report readability preservation.
- Audit coverage includes weekly/report section/export start, but report generation start/completion actions are not explicitly proven.

## Test Mapping (Living)
| AC | Test File | Test Name | Initial Status | Final Status |
| --- | --- | --- | --- | --- |
| FE-025, FE-026 | `tests/e2e/weekly-update.spec.js` | weekly validation + publish + overview refresh | Passing baseline | Passed |
| FE-031, FE-032, FE-033, FE-034, FE-036 | `tests/e2e/report-generate-edit-export.spec.js` | generate + loading + rendered sections + edit + export busy | Passing baseline | Passed |
| FE-035 | `tests/e2e/read-only-permissions.spec.js` | read-only report hides edit controls and keeps export | Passing baseline | Passed |
| FE-034 + BE-030 | `tests/e2e/report-edit-conflict.spec.js` | stale section save returns conflict with recoverable UI | New (failing first) | Passed |
| BE-027, BE-028, BE-029 | `server/test/report-jobs.integration.test.js` | durable report generation persists sections + body separation | New (failing first) | Passed |
| BE-030 | `server/test/report-jobs.integration.test.js` | stale section save returns 409 conflict | New (failing first) | Passed |
| BE-031, BE-032 | `server/test/export.integration.test.js` | export job traceability + failure path preserves report readability | New (failing first) | Passed |
| BE-037 | `server/test/telemetry.integration.test.js` | telemetry remains non-blocking when persistence fails | New (failing first) | Passed |
| BE-038 + phase audit scope | `server/test/audit.integration.test.js` | audit coverage includes weekly/report start/report section/export | Update (failing first) | Passed |
| INT-006, INT-007 | `tests/e2e/report-generate-edit-export.spec.js` | report generated -> persisted edit survives reload | Passing baseline | Passed |
| Phase AC 14 | `server/test/report-jobs.integration.test.js` | durable job payload and state persist in durable store-backed job rows | New (failing first) | Passed |

## Implementation Checklist
- [x] Add failing backend tests for durable report/export jobs, conflict, telemetry non-blocking, and export failure/readability behavior.
- [x] Add failing Playwright conflict scenario proof for stale report save and recovery UX.
- [x] Replace in-process report/export `setTimeout` job execution with durable worker loop behavior that replays pending/running jobs from state.
- [x] Add optimistic-concurrency token/version support for report sections and enforce `409 CONFLICT` on stale saves.
- [x] Harden telemetry ingestion so failures never block caller and are safely swallowed/logged.
- [x] Expand audit writes/tests to cover all phase-scope mutation actions.
- [x] Preserve report content availability during export and failure states.
- [x] Run backend targeted suites, full build, and full Playwright headless + headed proof.
- [x] Update phase status docs and continuity ledger with completion evidence.

## Files Implemented In Phase 5
- Backend:
  - `server/src/services/domain/mutation.service.js`
  - `server/src/app.js`
- Frontend:
  - `client/src/App.jsx`
- Backend tests:
  - `server/test/report-jobs.integration.test.js`
  - `server/test/export.integration.test.js`
  - `server/test/telemetry.integration.test.js`
  - `server/test/audit.integration.test.js`
- E2E tests:
  - `tests/e2e/report-edit-conflict.spec.js`

## Proof Record (2026-04-15)
- Targeted Phase 5 backend tests:
  - `npm test -- server/test/report-jobs.integration.test.js server/test/export.integration.test.js server/test/telemetry.integration.test.js server/test/audit.integration.test.js`
  - Result: passed (`4 files`, `7 tests`).
- Full backend suite:
  - `npm test`
  - Result: passed (`15 files`, `40 tests`).
- Build:
  - `npm run build`
  - Result: passed.
- Playwright headless:
  - `npx playwright test`
  - Result: passed (`22 tests`).
- Playwright headed:
  - `npx playwright test --headed`
  - Result: passed (`22 tests`).

## Phase 5 Completion Record
- Acceptance Criteria: 14/14 satisfied
- DoD: satisfied
- Phase status: complete (2026-04-15)

## Progress Log
- 2026-04-15 14:16:27: Phase 5 execution doc created; gap audit completed; tests-first execution starting.
- 2026-04-15 14:20:41: Added failing backend tests for report/export durability, stale save conflict, telemetry non-blocking, and audit coverage expansion.
- 2026-04-15 14:25:54: Implemented durable report/export worker pump, payload-rich job rows, report revision conflict enforcement, telemetry non-blocking handling, and report/export failure recording.
- 2026-04-15 14:26:21: Full backend suite + build + Playwright headless/headed proof completed; Phase 5 marked complete.
