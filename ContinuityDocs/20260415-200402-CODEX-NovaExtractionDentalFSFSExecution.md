### Lessons Learned (mutable - replace/update this section)
* The repo already has strong read-model and runtime-state boundaries, but Dental semantic behavior is still primarily deterministic.
* The fastest safe path is to layer extraction-first metadata and projections onto existing contracts, then replace Dental-specific semantic derivation behind flags.

---

### Ledger Entries (append-only)

## Entry - 2026-04-15 20:04:02 (local)

**Goal**
* Execute `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md` end to end against the current AskEIDS codebase.

**Constraints/Assumptions**
* Use the `fullstack-spec-executor` skill workflow and the repo's proof-driven engineering process.
* Preserve mixed-mode behavior so Dental can move to extraction-first without regressing Optima or ESSENCE.
* Replay-backed automation remains the default proof boundary for automated suites.

**Key Decisions**
* Start by verifying current FE/BE drift from the FSFS before changing contracts.
* Create a dedicated execution tracker in `docs/implementation/` for acceptance-criteria mapping, TDD, and DoD progress.

**State**
* Done: Skill/reference review, repo scan, current architecture check, prior FSFS docs review.
* Now: Create execution tracking docs and identify the highest-value implementation gaps.
* Next: Write/update tests first for the missing extraction-first Dental behavior, then implement code phase by phase.

**Open Questions**
* None.

**Working Set**
* `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
* `client/src/App.jsx`
* `server/src/app.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/services/ingest/corpusImport.service.js`
* `server/src/services/state/runtimeState.repository.js`

**Notes / Outcomes**
* Current Dental artifact ingestion stores normalized text and updates existing runtime state, but it does not yet persist Nova-style extraction records, aggregate snapshots, or the new reset contract required by the FSFS.

## Entry - 2026-04-15 20:18:31 (local)

**Goal**
* Complete the Dental extraction-first FSFS execution and collect proof.

**Constraints/Assumptions**
* Keep the existing mixed-mode product experience stable.
* Prove the new Dental flow with lower-level tests plus real Playwright runs in both headless and headed modes.

**Key Decisions**
* Implement extraction-first metadata as durable runtime state (`sourceExtractions`, `productAggregates`, `promptRuns`) and expose it through the existing read model rather than redesigning the FE contract surface.
* Reuse the existing upload/read/report flows and add the FSFS-required selectors, reset contract, and source-detail semantics on top of them.
* Keep replay as the automated execution mode and preserve last-known-good product posture on forced extraction failure.

**State**
* Done: Runtime config flags, reset contract, semantic-state persistence, read-model/source-detail contract updates, React selector updates, FSFS-aligned Playwright helper/spec creation, headless/headed verification, screenshot capture.
* Now: Prepare final implementation summary and prioritized next-step recommendations.
* Next: Wait for user direction on which follow-on hardening or product-polish item to implement next.

**Open Questions**
* None.

**Working Set**
* `server/src/config/runtime.js`
* `server/src/app.js`
* `server/src/services/ingest/corpusImport.service.js`
* `server/src/services/state/runtimeState.repository.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/services/domain/readModel.service.js`
* `client/src/App.jsx`
* `tests/e2e/helpers/novaLifecycle.js`
* `tests/e2e/nova-*.spec.js`

**Notes / Outcomes**
* New contract proof passed in `server/test/read.contract.test.js` and `server/test/runtime-state.repository.integration.test.js`.
* Existing ingest and updated FE tests passed in `server/test/ingest.pipeline.integration.test.js` and `client/src/test/artifact-upload-ui.test.jsx`.
* New Dental extraction-first Playwright scenarios passed in both headless and headed execution.
* Screenshot evidence captured in `baseline-headed-proof.png`, `source-detail-headed-proof.png`, and `report-regeneration-headed-proof.png`.
