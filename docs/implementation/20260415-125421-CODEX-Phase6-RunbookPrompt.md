# Phase 6 Runbook Prompt

## Execution Prompt
```text
You are working in C:\Projects\AskEIDS.

Your task is to COMPLETE ONLY Phase 6 from:
C:\Projects\AskEIDS\docs\implementation\20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md

You may begin only after confirming Phases 1 through 5 are complete or explicitly accepted. Continue until every Phase 6 acceptance criterion and DoD item is fully satisfied and proven.

Hard rules:
1. Follow `AGENTS.md`.
2. Follow the continuity ledger.
3. Maintain the runtime-derived content rule through final completion.
4. Do not declare the system production-ready until all Phase 6 criteria and DoD items are proven complete.
5. Do not use git state-changing actions.

Execution workflow:
1. Audit current connector, hardening, observability, and traceability status against Phase 6.
2. Update docs with a Phase 6 checklist and final acceptance matrix.
3. Write or update tests first for every open requirement.
4. Complete connectors, hardening, full acceptance closure, rollback validation, and release-readiness documentation.
5. Re-run full proof in both Playwright modes.
6. Update docs and ledger.
7. Report Phase 6 complete only when the full system can honestly be called production-ready.

Complete Phase 6 only.
```

## Phase Objective
Complete the remaining system-of-record integrations, production hardening, observability, and full acceptance and DoD closure so the system is ready for production use.

## Acceptance Criteria
1. `AC-BE-014`, `AC-BE-015`, `AC-BE-016`, `AC-BE-033`, `AC-BE-034`, `AC-BE-035`, and `AC-BE-036` are fully implemented.
2. Any remaining partially complete acceptance criteria from earlier phases are closed and marked complete.
3. Connector runs are durable, replayable, and cursor or watermark based.
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

## Definition Of Done
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
