# Phase 1 Runbook Prompt

## Execution Prompt
```text
You are working in C:\Projects\AskEIDS.

Your task is to COMPLETE ONLY Phase 1 from:
C:\Projects\AskEIDS\docs\implementation\20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md

You must continue working until Phase 1 is entirely implemented and its acceptance criteria and Definition of Done are fully satisfied. Do not stop at partial progress, analysis, or a plan. If Phase 1 is already partially implemented, first audit the current state against the Phase 1 acceptance criteria and DoD, then close every remaining gap, re-run proof, and update the documentation so Phase 1 can be honestly marked complete.

Hard rules:
1. Follow `AGENTS.md`.
2. Follow the continuity ledger in `ContinuityDocs/20260415-083125-CODEX-WireExistingHtmlToFsfs.md`.
3. Follow these implementation docs:
   - `docs/implementation/20260415-083603-CODEX-FsfsExecution.md`
   - `docs/implementation/20260415-121923-CODEX-FsfsCompletionPlan.md`
   - `docs/implementation/20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md`
4. Use credentials/model settings from `C:\Projects\AgenticDataCatalog-NoDocker` where appropriate, but do not copy secrets into AskEIDS.
5. Do not use Bedrock Knowledge Bases or OpenSearch Serverless. DuckDB remains the retrieval store.
6. No product/source/report/chat facts may be hardcoded into `index.html`. All domain content must be application-derived at runtime.
7. Do not finalize until every Phase 1 acceptance criterion and the full Phase 1 DoD are satisfied and proven.
8. Do not perform git state-changing actions.

Execution workflow:
1. Audit the current codebase against the Phase 1 acceptance criteria and Definition of Done.
2. Update the active implementation doc with a Phase 1 checklist showing complete, partial, and missing items.
3. Write or update tests first for each missing or partial Phase 1 requirement.
4. Implement the remaining Phase 1 work.
5. Re-run all required proof until green.
6. Update docs and the continuity ledger.
7. Report Phase 1 complete only if every Phase 1 criterion and DoD item is truly satisfied.

Do not move to Phase 2.
Complete Phase 1 only.
```

## Phase Objective
Establish the runtime foundation and delivery baseline so all later phases land on stable, production-shaped seams.

## Acceptance Criteria
1. The runtime loads AskEIDS-owned configuration first and may optionally supplement model/runtime settings from `C:\Projects\AgenticDataCatalog-NoDocker` without copying secrets into AskEIDS.
2. The application enforces single-region operation rules at startup and fails fast on invalid region configuration.
3. Artifact operations for raw, normalized, and export content run through a shared abstraction rather than direct scattered file writes.
4. The retrieval layer uses the Titan embedding seam instead of the old hardcoded embedding function.
5. Ask/report generation seams exist for Bedrock Runtime/Nova even if live invocation remains feature-gated for proof environments.
6. Local, test, headless, and headed proof runs remain deterministic without requiring live AWS credentials.
7. Background job failures in the current in-process implementation are recorded as job failures instead of crashing the server.
8. The HTML shell remains generic and contains no hardcoded domain facts.
9. The execution docs clearly record the architecture choice: DuckDB + S3-compatible artifact storage seam + Bedrock Runtime seam, not Knowledge Bases/AOSS.
10. Direct tests exist for runtime config, artifact storage behavior, and embedding fallback behavior.

## Definition Of Done
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
