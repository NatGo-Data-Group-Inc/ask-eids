# Phase 4 Runbook Prompt

## Execution Prompt
```text
You are working in C:\Projects\AskEIDS.

Your task is to COMPLETE ONLY Phase 4 from:
C:\Projects\AskEIDS\docs\implementation\20260415-125134-CODEX-SixPhaseFsfsExecutionPlan.md

You may begin only after confirming Phases 1 through 3 are complete or explicitly accepted. Continue until every Phase 4 acceptance criterion and DoD item is fully satisfied and proven.

Hard rules:
1. Follow `AGENTS.md`.
2. Follow the continuity ledger.
3. Keep DuckDB as the retrieval store.
4. Use Titan for embeddings and Nova for synthesis through Bedrock Runtime seams.
5. Keep all answer/report/source content runtime-derived.
6. Do not move to Phase 5.
7. Do not use git state-changing actions.

Execution workflow:
1. Audit current ingest/retrieval/Ask behavior against Phase 4 criteria.
2. Update docs with a Phase 4 checklist and traceability rows.
3. Write or update tests first for every open requirement.
4. Complete ingestion, normalization, chunking, retrieval, Ask synthesis, and validation.
5. Re-run all required proof in both Playwright modes.
6. Update docs and ledger.
7. Report Phase 4 complete only when all criteria and DoD items are satisfied.

Complete Phase 4 only.
```

## Phase Objective
Complete the evidence pipeline so new artifacts are durably ingested, normalized, indexed into DuckDB via Titan embeddings, and used by Ask with evidence-backed Nova synthesis.

## Acceptance Criteria
1. `AC-FE-017` through `AC-FE-024` are fully implemented and explicitly mapped to tests.
2. `AC-BE-009` through `AC-BE-024` are fully implemented, with any KB-specific wording satisfied by the DuckDB equivalent.
3. `AC-INT-003`, `AC-INT-004`, `AC-INT-005`, and `AC-INT-009` are fully implemented against the live backend.
4. Transcript uploads create durable source records, durable ingest jobs, raw artifacts, normalized artifacts, and DuckDB-indexed retrieval entries.
5. Ask uses structured retrieval from durable state, DuckDB retrieval using Titan embeddings, Nova synthesis constrained by evidence, and post-generation validation.
6. Ask returns `complete`, `partial`, or `insufficientEvidence` honestly based on evidence thresholds.
7. Retrieval filtering remains backend-generated and product-scoped.
8. Uploaded transcript evidence becomes searchable and citable after ingest completion.
9. OCR fallback exists for scanned PDFs when text extraction is insufficient.
10. The Ask path retries appropriate transient failures within budget and logs the retry.
11. Unknown or invalid source IDs in model output are rejected safely.
12. No user-visible Ask answer is produced from unsupported evidence.

## Definition Of Done
- All scoped Ask/ingest acceptance criteria are complete in the matrix.
- Durable ingestion plus DuckDB indexing plus Ask proof exists end to end.
- The following proof passes:
  - ingest contract/integration tests
  - normalization tests
  - chunk/sidecar tests
  - Ask orchestration/validation tests
  - Playwright upload-to-Ask evidence tests
  - headless and headed Playwright runs
- The system can ingest a new transcript in a proof environment and then answer a question citing that transcript.
- Failure states for ingest and Ask are both scoped and non-crashing.
