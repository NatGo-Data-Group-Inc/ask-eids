# Phase 5 Runbook Prompt

## Execution Prompt
```text
You are working in C:\Projects\AskEIDS.

Your task is to COMPLETE ONLY Phase 5 from:
C:\Projects\AskEIDS\docs\implementation\20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md

You may begin only after confirming Phases 1 through 4 are complete or explicitly accepted. Continue until every Phase 5 acceptance criterion and DoD item is fully satisfied and proven.

Hard rules:
1. Follow `AGENTS.md`.
2. Follow the continuity ledger.
3. Keep all report/export content runtime-derived and evidence-honest.
4. Do not move to Phase 6.
5. Do not use git state-changing actions.

Execution workflow:
1. Audit current weekly/report/export/job behavior against Phase 5 criteria.
2. Update docs with a Phase 5 checklist and traceability rows.
3. Write or update tests first for every open requirement.
4. Complete weekly updates, report generation, edit conflicts, exports, durable jobs, telemetry, and audit coverage.
5. Re-run all required proof in both Playwright modes.
6. Update docs and ledger.
7. Report Phase 5 complete only when all criteria and DoD items are satisfied.

Complete Phase 5 only.
```

## Phase Objective
Finish the authoring and output side of the product: weekly updates, report generation, section editing, exports, durable job execution, telemetry, and operational traceability.

## Acceptance Criteria
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

## Definition Of Done
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
