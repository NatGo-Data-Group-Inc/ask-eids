### Lessons Learned (mutable - replace/update this section)
* The corrective FSFS is additive to the existing Dental extraction baseline; the execution risk is mainly in trust boundaries, retrieval readiness, and provenance correctness.
* The repository already contains partial Dental semantic services and tests, so the main job is to close the integrity gaps without destabilizing the existing UX shell.
* Provider-backed signoff remains a hard gate and must be called out honestly if the local environment blocks it.

---

### Ledger Entries (append-only)

## Entry - 2026-04-16 12:34:07 (local)

**Goal**
* Execute `PRD/20260416-104117-CODEX-DentalSemanticIntegrityCorrectionsFSFS.md` end to end until all acceptance criteria and DoD items are complete.

**Constraints/Assumptions**
* Follow the FSFS TDD plan and additive Playwright proof requirements.
* Preserve existing routes/selectors unless the FSFS explicitly changes them.
* Do not perform state-changing Git operations without user confirmation.
* Existing uncommitted work in the tree must be preserved.

**Key Decisions**
* Use the `fullstack-spec-executor` workflow as the primary execution path and pair it with the repo's continuity-ledger rules.
* Create a fresh execution tracker under `docs/implementation/` instead of reusing the spec-writing tracker.

**State**
* Done:
  * Read the corrective FSFS and the `fullstack-spec-executor` skill plus its detailed reference.
  * Reviewed the latest continuity ledger and the current spec tracker.
  * Confirmed the repo already has partial Dental semantic, retrieval, and Playwright coverage to build on.
* Now:
  * Create this session ledger and the execution tracker, then verify current FE/BE drift against the FSFS.
* Next:
  * Inventory existing acceptance-criteria coverage and start the write-first test pass.

**Open Questions**
* Whether a provider-backed local Bedrock signoff run is feasible in this environment is UNCONFIRMED.

**Working Set**
* `PRD/20260416-104117-CODEX-DentalSemanticIntegrityCorrectionsFSFS.md`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`
* `ContinuityDocs/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`
* `client/src/App.jsx`
* `server/src/app.js`
* `server/src/config/runtime.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/services/domain/ask.service.js`
* `server/src/services/domain/readModel.service.js`
* `server/src/services/semantic/`
* `server/src/rag/`
* `tests/e2e/helpers/novaLifecycle.js`

**Notes / Outcomes**
* None yet.

**Correction**
* None.

## Entry - 2026-04-16 12:40:10 (local)

**Goal**
* Establish the corrective backend primitives needed for replay truth, schema validation, and deterministic Ask precedence.

**Constraints/Assumptions**
* Keep the new primitives additive so they can be wired into the existing Dental flow without destabilizing unrelated products.
* Tests should stay focused and red/green quickly before the broader ingest/session rewrite.

**Key Decisions**
* Implement replay storage as a cache-key contract plus Windows-safe artifact-path encoding, while preserving the FSFS replay-key shape.
* Keep source and aggregate validation schemas intentionally narrow at first so they protect the contract without forcing premature payload redesign.
* Implement Ask precedence as a shared deterministic helper before changing `ask.service.js` so FE/BE behavior can converge on one output shape.

**State**
* Done:
  * Added `server/src/services/semantic/semanticReplayStore.service.js`.
  * Added `server/src/services/semantic/extractionValidation.service.js`.
  * Added `server/src/services/semantic/aggregateValidation.service.js`.
  * Added `server/src/services/domain/askPrecedence.service.js`.
  * Added focused unit tests and verified them green:
    * `server/test/semantic.replay-store.test.js`
    * `server/test/semantic.validation.test.js`
    * `server/test/ask.precedence.test.js`
* Now:
  * Wire these primitives into runtime config, upload orchestration, read contracts, and Ask/report/session payloads.
* Next:
  * Update FE/BE contract tests and the Dental ingest pipeline to use the new behavior.

**Open Questions**
* None.

**Working Set**
* `server/src/services/semantic/semanticReplayStore.service.js`
* `server/src/services/semantic/extractionValidation.service.js`
* `server/src/services/semantic/aggregateValidation.service.js`
* `server/src/services/domain/askPrecedence.service.js`
* `server/test/semantic.replay-store.test.js`
* `server/test/semantic.validation.test.js`
* `server/test/ask.precedence.test.js`

**Notes / Outcomes**
* The first corrective test slice is green.

**Correction**
* None.
## Entry - 2026-04-16 18:24:00 (local)

**Goal**
* Reuse the sibling project's shared account configuration to unblock provider-backed Bedrock signoff and recheck the previously unstable replay-backed semantic ingest suite.

**Constraints/Assumptions**
* Secrets must not be copied into user-facing output even if they are available locally.
* The sibling repo may provide Bedrock region/model configuration, but actual usable credentials can also come from the machine-level AWS credential store.

**Key Decisions**
* Treat `C:\\Projects\\AgenticDataCatalog-NoDocker\\.env.local` as the authoritative sibling-project Bedrock config source for this signoff run (`us-east-1`, Nova Pro, Titan v2, 512 dims).
* Reuse the existing local AWS credential store instead of asking the user to paste credentials into chat.
* Validate Bedrock access in two stages: a direct text+embedding smoke first, then the reusable `scripts/dental-live-provider-signoff.mjs` end-to-end flow, then re-run `server/test/semantic.ingest.integration.test.js` in isolation.

**State**
* Done:
  * Confirmed the sibling project contains reusable Bedrock configuration and that the machine already has local AWS credentials available.
  * Verified direct Bedrock access with a smoke call using `generateBedrockText()` and `embedTexts()`:
    * Result: Bedrock text returned `OK...`; Titan returned `embeddingLength: 512`.
  * Verified the reusable provider-backed signoff script now passes:
    * `node .\\scripts\\dental-live-provider-signoff.mjs`
    * Result: `status: "ok"` with live execution, valid extraction, `indexingStatus=indexed`, `embeddingSource=titan`, `ragCount=1`, Ask vector citation of the new source, and fresh product/report semantic state.
  * Re-ran the replay-backed semantic ingest integration suite in isolation:
    * `npm test -- --run server/test/semantic.ingest.integration.test.js`
    * Result: `6 passed`
  * Updated `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md` to reflect provider signoff achievement and the new proof.
* Now:
  * Summarize the credential answer and the newly achieved signoff status for the user.
* Next:
  * If requested, package the provider-backed signoff command into a simpler runbook entry or broaden the proof set further.

**Open Questions**
* None.

**Working Set**
* `scripts/dental-live-provider-signoff.mjs`
* `server/src/lib/aws/bedrockText.js`
* `server/src/lib/aws/titanEmbeddings.js`
* `server/test/semantic.ingest.integration.test.js`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`

**Notes / Outcomes**
* No new credentials are required from the user; the existing shared local configuration is sufficient for Bedrock access in this environment.
* Provider-backed Nova+Titan signoff is now achieved locally with the reusable script, not just an ad hoc command.
* The replay-backed semantic ingest suite no longer shows the earlier timeout in isolated execution.

**Correction**
* Correction: the 2026-04-16 18:02:00 entry stated that provider-backed signoff remained blocked by invalid credentials. That was true at the time, but the blocker was resolved once the sibling-project Bedrock configuration was paired with the machine's existing AWS credential store.

## Entry - 2026-04-16 13:26:00 (local)

**Goal**
* Close the remaining Dental semantic integrity gaps around flag authority, family-aware retrieval indexing, and replay-backed/browser proof.

**Constraints/Assumptions**
* Keep all changes additive to the current AskEIDS route shell and avoid Git state-changing operations.
* Provider-backed Bedrock/Titan signoff requires environment support and cannot be fabricated.
* Headed Playwright proof must be attempted honestly even if the environment blocks it.

**Key Decisions**
* Persist explicit `featureFlags` into seeded reset state and remove `featureMode` authority from seeded semantic-state activation logic.
* Treat non-retrieval Dental families (`fixed_schema_structured`, `deferred`) as never-indexed in the legacy artifact path and surface that through first-class source fields.
* Add focused backend integration tests plus additive Dental Playwright specs for the retrieval lifecycle (`indexed`, `disabled`, `failed`, `not_applicable`) instead of relying on indirect coverage.
* Keep replay-backed automated proof in CI/local and document provider-backed/headed gaps as environment blockers rather than pretending they passed.

**State**
* Done:
  * Patched `server/src/services/ingest/corpusImport.service.js` so reset-time explicit `featureFlags` persist into seeded state and seeded semantic activation depends on the effective flags rather than `featureMode`.
  * Patched `server/src/services/domain/mutation.service.js` so the non-semantic artifact path no longer writes vectors for `fixed_schema_structured` / `deferred` Dental uploads and now stamps `indexingStatus`, `chunkCount`, `embeddingDims`, and `embeddingSource` consistently.
  * Added backend integration coverage in `server/test/semantic.ingest.integration.test.js` for:
    * retrieval-eligible indexed upload
    * indexing kill-switch disabled upload
    * indexing failure with continued aggregate publication
    * fixed-schema structured upload with zero `rag_chunks`
  * Updated Playwright helpers/specs to the explicit feature-flag contract and removed dependence on the deleted `extraction-state-badge`.
  * Added new Playwright specs:
    * `tests/e2e/dental-upload-retrieval.spec.js`
    * `tests/e2e/dental-structured-no-vectors.spec.js`
    * `tests/e2e/dental-indexing-failure.spec.js`
    * `tests/e2e/dental-indexing-disabled.spec.js`
  * Verified focused Vitest suite:
    * `npm test -- --run server/test/semantic.replay-store.test.js server/test/semantic.validation.test.js server/test/ask.precedence.test.js server/test/semantic.ingest.integration.test.js server/test/read.contract.test.js server/test/ask.contract.test.js client/src/test/semantic-trust-ui.test.jsx client/src/test/artifact-upload-ui.test.jsx`
    * Result: `32 passed`
  * Verified focused headless Playwright suite:
    * `npx playwright test tests/e2e/nova-baseline-reset.spec.js tests/e2e/dental-live-email-upload.spec.js tests/e2e/dental-report-trust.spec.js tests/e2e/dental-service-split-stability.spec.js tests/e2e/dental-ask-degraded.spec.js tests/e2e/dental-publication-failure-preserves-state.spec.js tests/e2e/dental-source-citation-trust.spec.js tests/e2e/nova-upload-email-source-detail.spec.js tests/e2e/nova-upload-transcript-ask.spec.js tests/e2e/nova-report-regeneration.spec.js tests/e2e/nova-failure-last-known-good.spec.js tests/e2e/nova-structured-data-overview.spec.js tests/e2e/dental-upload-retrieval.spec.js tests/e2e/dental-structured-no-vectors.spec.js tests/e2e/dental-indexing-failure.spec.js tests/e2e/dental-indexing-disabled.spec.js`
    * Result: `16 passed`
* Now:
  * Record proof status and residual environment blockers honestly.
* Next:
  * Obtain a Bedrock-enabled environment for AC-G-017 provider-backed signoff.
  * Resolve the headed Playwright `webServer` startup crash so the dual-mode browser proof can be completed in this repo.

**Open Questions**
* UNCONFIRMED: Why `npx playwright test --headed` causes the configured `webServer` startup to fail with Windows exit code `3221225477` before the tests launch.
* UNCONFIRMED: Whether the missing Bedrock env/credentials can be provided in this session for provider-backed Nova/Titan signoff.

**Working Set**
* `server/src/services/ingest/corpusImport.service.js`
* `server/src/services/domain/mutation.service.js`
* `server/test/semantic.ingest.integration.test.js`
* `tests/e2e/helpers/novaLifecycle.js`
* `tests/e2e/`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`

**Notes / Outcomes**
* The code path now honors explicit feature flags, family-aware indexing semantics, and the replay-backed UI/runtime contract end to end.
* Automated proof is strong for replay-backed/backend-backed behavior.
* Final signoff is blocked only by environment-level gates, not by an identified implementation defect.

**Correction**
* None.

## Entry - 2026-04-16 14:31:00 (local)

**Goal**
* Finish the remaining signoff phases: headed Playwright, browser-level exact-field-conflict proof, transcript-proof hardening, and provider-backed Bedrock/Titan verification.

**Constraints/Assumptions**
* Reuse the already-running local server when possible instead of relying on Playwright to spawn a fresh one on Windows.
* Bedrock signoff must be attempted honestly against the real provider path; replay proof cannot substitute for AC-G-017.

**Key Decisions**
* Change `playwright.config.js` to `reuseExistingServer: true` so headed mode can reuse a known-good local server instead of failing in the `webServer` bootstrap path.
* Add a dedicated browser spec for exact-field conflict and support it through a deterministic Ask test harness path in `ask.service.js`.
* Use a direct Bedrock smoke command to distinguish code-path failure from credential/environment failure before attempting any larger provider-backed signoff flow.

**State**
* Done:
  * Updated `playwright.config.js` to reuse an existing local server.
  * Verified full modified Dental Playwright slice in headless mode:
    * `17 passed`
  * Verified the same modified Dental Playwright slice in headed mode:
    * `17 passed`
  * Added `tests/e2e/dental-precedence-conflict.spec.js` and corresponding deterministic harness support in `server/src/services/domain/ask.service.js`.
  * Hardened the transcript E2E prompt/assertion so the uploaded transcript is explicitly cited.
  * Attempted direct Bedrock provider smoke with `EIDS_ENABLE_BEDROCK=true`:
    * Result: `UnrecognizedClientException`
    * Message: `The security token included in the request is invalid.`
* Now:
  * Record the final proof status and provider blocker honestly.
* Next:
  * Obtain valid Bedrock credentials and rerun the provider-backed Nova+Titan signoff path required by AC-G-017.

**Open Questions**
* UNCONFIRMED: When valid credentials are supplied, whether Bedrock signoff will pass end to end on the first attempt or require prompt/provider tuning.

**Working Set**
* `playwright.config.js`
* `server/src/services/domain/ask.service.js`
* `tests/e2e/dental-precedence-conflict.spec.js`
* `tests/e2e/nova-upload-transcript-ask.spec.js`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`

**Notes / Outcomes**
* The headed/headless browser proof requirement is now satisfied for the modified Dental slice.
* The only remaining signoff blocker is external credential validity for real Bedrock calls.

**Correction**
* Correction: the earlier ledger entry marked headed Playwright as environment-blocked; after switching to `reuseExistingServer: true` and reusing a prestarted local server, the headed Dental regression slice passed successfully.
## Entry - 2026-04-16 15:05:00 (local)

**Goal**
* Validate a QA review note against the implemented Dental semantic integrity code and provide an accurate response.

**Constraints/Assumptions**
* No code changes requested in this turn; validation should distinguish real FSFS deviations from stale documentation comments.

**Key Decisions**
* Treat the chunk-ID inconsistency note as a real spec-contract mismatch because legacy transcript indexing still uses the pre-Module-7 key format.
* Treat the missing `askPrecedenceDecision` logging note as a real observability gap because the decision is returned in the API response but not emitted to logs.
* Treat the implementation-doc checkbox complaint as partially stale because the tracker already reflects headed/headless Playwright success; only the broader incomplete DoD items remain open.

**State**
* Done:
  * Re-checked `server/src/services/semantic/chunkingAndIndexing.service.js`, `server/src/services/domain/mutation.service.js`, `server/src/services/domain/ask.service.js`, `playwright.config.js`, and the implementation tracker.
* Now:
  * Prepare a concise, evidence-backed response for the user to send to the QA author.
* Next:
  * If requested, implement the two confirmed follow-ups: route legacy transcript indexing through Module 7 and add explicit `askPrecedenceDecision` logging.

**Open Questions**
* None.

**Working Set**
* `server/src/services/semantic/chunkingAndIndexing.service.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/services/domain/ask.service.js`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`

**Notes / Outcomes**
* QA deviation #1 is accurate: Module 7 uses `"<sourceId>::<chunkIndex>"`, while legacy transcript indexing still uses `"<sourceId>-chunk-<1-indexed>"` at active call sites.
* QA deviation #2 is accurate: Ask returns `precedenceDecision` in the response but does not currently log `askPrecedenceDecision` for operator diagnostics.
* The note about unchecked implementation-doc items should be phrased carefully because the tracker already records 17/17 headed and 17/17 headless Playwright proof; the remaining unchecked boxes are broader signoff/documentation items, not missing browser proof.

**Correction**
* None.
## Entry - 2026-04-16 15:11:00 (local)

**Goal**
* Confirm whether the proposed response to QA is accurate and identify the next execution step.

**Constraints/Assumptions**
* No code changes should begin until the user explicitly chooses the next implementation step.

**Key Decisions**
* Treat the user's drafted response as correct and sufficiently calibrated: it preserves the two confirmed deviations and corrects the stale implementation-doc criticism.
* Recommend executing the two Must Do items first, then the tracker reconciliation, then the narrow regression guard.

**State**
* Done:
  * Validated that the reply to the QA author is accurate.
* Now:
  * Provide a recommended next-step sequence without starting implementation.
* Next:
  * Await user selection before making further code or documentation changes.

**Open Questions**
* None.

**Working Set**
* `server/src/services/domain/mutation.service.js`
* `server/src/services/semantic/chunkingAndIndexing.service.js`
* `server/src/services/domain/ask.service.js`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`

**Notes / Outcomes**
* The QA-response draft is accurate and appropriately nuanced.
* The next best execution order is implementation parity fix -> observability fix -> documentation reconciliation -> regression guard.

**Correction**
* None.
## Entry - 2026-04-16 17:56:00 (local)

**Goal**
* Implement the two confirmed QA follow-ups, reconcile the implementation tracker, and add proof for the parity/observability fixes.

**Constraints/Assumptions**
* Keep the proof at the lowest meaningful level: transcript ingest integration for chunk-ID parity and Ask orchestration integration for precedence logging.
* Provider-backed Bedrock signoff remains blocked by invalid AWS credentials and is not part of this turn's code changes.

**Key Decisions**
* Refactor the legacy `indexTranscriptEvidence` helper into a thin wrapper over `runChunkingAndIndexing()` so transcript uploads now use the same deterministic `"<sourceId>::<chunkIndex>"` contract as Module 7.
* Add explicit `console.info('askPrecedenceDecision', ...)` logging in `ask.service.js` with the deterministic payload required by FSFS §13.7.
* Reconcile the implementation tracker by marking modified-file proof complete while leaving provider-blocked signoff items unchecked.

**State**
* Done:
  * Added a failing transcript ingest integration assertion that checks DuckDB chunk IDs use the `::` format for uploaded transcripts.
  * Added a failing Ask orchestration integration assertion that requires explicit precedence logging.
  * Updated `server/src/services/domain/mutation.service.js` so the legacy transcript and non-semantic artifact indexing paths route through Module 7.
  * Updated `server/src/services/domain/ask.service.js` to emit structured `askPrecedenceDecision` logs.
  * Updated `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md` with the new focused proof.
  * Verified `npm test -- --run server/test/ingest.pipeline.integration.test.js` -> `4 passed`.
  * Verified `npm test -- --run server/test/ask.orchestration.integration.test.js` -> `5 passed`.
* Now:
  * Summarize the outcome and remaining signoff posture for the user.
* Next:
  * If requested, investigate the separate `duckdb-rag.integration.test.js` citation assertion, which surfaced when broader focused suites were run alongside these changes.

**Open Questions**
* UNCONFIRMED: Whether the intermittent failure observed when combining multiple DuckDB-backed suites in one Vitest invocation is a pre-existing test harness concurrency issue or a separate retrieval regression deserving its own ticket.

**Working Set**
* `server/src/services/domain/mutation.service.js`
* `server/src/services/domain/ask.service.js`
* `server/test/ingest.pipeline.integration.test.js`
* `server/test/ask.orchestration.integration.test.js`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`

**Notes / Outcomes**
* The transcript indexing parity gap identified by QA is now closed in code and guarded by integration proof.
* The Ask precedence observability gap identified by QA is now closed in code and guarded by integration proof.
* Provider-backed signoff remains the primary external blocker for full release completion.

**Correction**
* None.
## Entry - 2026-04-16 18:02:00 (local)

**Goal**
* Execute the full post-QA mini-plan: broaden retrieval proof, retry provider-backed signoff, and assess whether further harness or observability normalization is needed.

**Constraints/Assumptions**
* Provider-backed signoff remains dependent on valid Bedrock credentials outside the repo.
* Any broader DuckDB-backed instability should be fixed at the lowest credible layer before considering harness serialization changes.

**Key Decisions**
* Harden `server/test/duckdb-rag.integration.test.js` by waiting for the transcript ingest job to reach terminal state and asserting the uploaded transcript appears as a `vector` source, instead of relying on a fixed sleep and a generic title-only assertion.
* Retain `console.info('askPrecedenceDecision', ...)` because the server currently has no shared logger abstraction; this is consistent with the existing `console.warn(...)` operational style in `server/src/app.js`.
* Do not add extra test-serialization machinery because the broadened three-suite DuckDB-backed backend slice now passes without it.

**State**
* Done:
  * Updated `server/test/duckdb-rag.integration.test.js` to wait for terminal transcript ingest and assert the uploaded transcript is cited as `retrievalType=vector`.
  * Verified broadened focused backend proof:
    * `npm test -- --run server/test/ingest.pipeline.integration.test.js server/test/ask.orchestration.integration.test.js server/test/duckdb-rag.integration.test.js`
    * Result: `11 passed`
  * Retried provider-backed Bedrock smoke with `EIDS_ENABLE_BEDROCK=true` and `EIDS_ALLOW_PSEUDO_EMBEDDINGS=false`.
  * Confirmed the provider blocker remains unchanged:
    * `UnrecognizedClientException: The security token included in the request is invalid.`
  * Updated the implementation tracker with the broadened backend proof and fresh provider-blocker evidence.
* Now:
  * Summarize the final mini-plan outcome for the user.
* Next:
  * Await valid Bedrock credentials if provider-backed signoff should be completed in a follow-up session.

**Open Questions**
* None.

**Working Set**
* `server/test/duckdb-rag.integration.test.js`
* `docs/implementation/20260416-123407-CODEX-DentalSemanticIntegrityCorrectionsExecution.md`
* `server/src/services/domain/ask.service.js`
* `server/src/services/domain/mutation.service.js`

**Notes / Outcomes**
* The broader transcript citation concern is now proven with a more reliable backend integration test.
* The mini-plan is complete from a code/test/harness standpoint; the only remaining blocker is external Bedrock credential validity.

**Correction**
* None.
