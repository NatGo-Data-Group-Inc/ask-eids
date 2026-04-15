# Phase 3 Runbook Prompt

## Execution Prompt
```text
You are working in C:\Projects\AskEIDS.

Your task is to COMPLETE ONLY Phase 3 from:
C:\Projects\AskEIDS\docs\implementation\20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md

You may begin only after confirming Phases 1 and 2 are complete or explicitly accepted. Continue until every Phase 3 acceptance criterion and DoD item is fully satisfied and proven.

Hard rules:
1. Follow `AGENTS.md`.
2. Follow the continuity ledger.
3. Preserve runtime-derived UI data; do not hardcode domain facts into the HTML shell.
4. Do not move to Phase 4.
5. Do not use git state-changing actions.

Execution workflow:
1. Audit current FE/BE/INT read-experience coverage against Phase 3.
2. Update the docs with a Phase 3 checklist and traceability rows.
3. Write or update tests first for each open requirement.
4. Finish the read experience and accessibility hardening.
5. Re-run all required proof in both Playwright modes.
6. Update docs and ledger.
7. Report Phase 3 complete only when all scoped criteria and DoD items are satisfied.

Complete Phase 3 only.
```

## Phase Objective
Finish and harden the complete read experience so routing, search, tabs, sources, permissions, and accessibility behaviors are production-grade.

## Acceptance Criteria
1. `AC-FE-001` through `AC-FE-016` are fully implemented and explicitly mapped to tests.
2. `AC-FE-027` through `AC-FE-030` are fully implemented and explicitly mapped to tests.
3. `AC-FE-035`, `AC-FE-037`, `AC-FE-038`, and `AC-FE-039` are fully implemented and explicitly mapped to tests.
4. `AC-BE-001` through `AC-BE-008` are fully satisfied for the read experience and reflected in live backend behavior.
5. `AC-INT-001`, `AC-INT-002`, and `AC-INT-008` are fully satisfied against the live backend.
6. Keyboard traversal works across top navigation, search palette, product cards, tabs, filter chips, source rows, and modal triggers.
7. Reduced-motion behavior is implemented and verified.
8. Unsupported viewport behavior is enforced below 1024px.
9. Read-only users cannot see or trigger mutating controls in the read experience.
10. 403, 404, and validation failure states render the correct scoped UI rather than generic fallbacks.
11. No visible product/source/report facts are embedded statically into the HTML shell.
12. Search results and product navigation continue to be fully runtime-derived.

## Definition Of Done
- All scoped FE/BE/INT criteria for the read experience are complete in the traceability matrix.
- Full Playwright coverage exists for all user-visible read workflows in this phase.
- Accessibility acceptance for keyboard, semantics, focus, and reduced motion has explicit proof.
- Headless and headed Playwright passes remain green.
- No console errors appear during the phase proof suite.
