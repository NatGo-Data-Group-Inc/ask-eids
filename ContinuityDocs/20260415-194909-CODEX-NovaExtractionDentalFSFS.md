### Lessons Learned (mutable - replace/update this section)
* AskEIDS already has clean boundaries for runtime state, retrieval state, and read-model projection; the FSFS should preserve those rather than route prompt JSON straight into UI components.
* The repo is strongest when deterministic logic handles normalization and validation, while Nova Pro handles semantic interpretation and aggregation.

---

### Ledger Entries (append-only)

## Entry - 2026-04-15 19:49:09 (local)

**Goal**
* Write a full-stack feature specification for Nova Pro-driven semantic extraction so corpus documents influence the app through model-produced JSON.

**Constraints/Assumptions**
* Follow the `fullstack-spec-creator` skill template and write the FSFS to `PRD/`.
* Use Dental as the first migrated product while leaving Optima and ESSENCE on legacy-derived behavior temporarily.
* Use live Nova Pro for development/eval iteration and replayed outputs for automated tests.

**Key Decisions**
* Preserve deterministic normalization, OCR fallback, fixed-schema structured export parsing, validation, persistence, and read-model projection.
* Move semantic interpretation, product-state aggregation, Ask grounding, and report inputs to Nova Pro.
* Treat source extraction JSON as the durable semantic truth and aggregate product JSON as a recomputable materialization.

**State**
* Done: Codebase and skill scan, architecture framing, rollout and execution-mode decisions.
* Now: Write the FSFS and supporting task record files.
* Next: Return the completed spec path and summary.

**Open Questions**
* None.

**Working Set**
* `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
* `docs/implementation/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
* `server/src/app.js`
* `server/src/services/ingest/corpusImport.service.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/services/domain/readModel.service.js`
* `server/src/services/domain/ask.service.js`
* `server/src/rag/prototypeDuckDbStore.js`
* `shared/artifactTypes.js`

**Notes / Outcomes**
* The FSFS will be written as a hybrid staged migration plan, not an all-at-once replacement of deterministic infrastructure with Nova.

## Entry - 2026-04-15 20:00:00 (local)

**Goal**
* Complete and hand off the FSFS for Dental-first Nova Pro extraction and aggregation.

**Constraints/Assumptions**
* The FSFS must follow the `fullstack-spec-creator` structure and remain aligned to the current AskEIDS architecture.
* Replay-backed automation remains mandatory even though live Nova is the development/eval target.

**Key Decisions**
* The final spec treats deterministic normalization, fixed-schema structured parsing, validation, persistence, and read-model projection as retained infrastructure.
* Semantic interpretation, product aggregation, Ask grounding, and report inputs are specified as Nova-owned responsibilities.
* The rollout is explicitly staged and mixed-mode safe: Dental migrates first while Optima and ESSENCE remain legacy-derived.

**State**
* Done: FSFS written to `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`; implementation tracker updated.
* Now: Prepare final summary and next-step recommendations.
* Next: User selects whether to proceed with gold schema design, eval harness, or API/runtime integration planning.

**Open Questions**
* None.

**Working Set**
* `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
* `docs/implementation/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
* `ContinuityDocs/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`

**Notes / Outcomes**
* The completed FSFS includes the unified API contract, phased FE/BE implementation plan, strict acceptance criteria across global/frontend/backend/integration tiers, and replay-backed Playwright proof requirements for headed and headless execution.

## Entry - 2026-04-15 20:12:00 (local)

**Goal**
* Tighten the FSFS based on external review so it is implementation-ready against the current AskEIDS app shape.

**Constraints/Assumptions**
* Keep the FSFS aligned to the existing selector/test surface in `client/src/App.jsx` and `tests/e2e/` where possible.
* Preserve the already-chosen Dental-first, live-dev/replay-test architecture.

**Key Decisions**
* The PRD now explicitly distinguishes current selectors from required new selectors.
* The PRD now formally defines the internal reset/replay contract on `POST /api/v1/test/reset`.
* The PRD now uses gold semantic-accuracy thresholds and sharpened structured-row truth rules rather than JSON-validity-only success.
* Aggregate/version metadata and anti-hidden-fallback rules are now explicit in the storage and backend handoff sections.

**State**
* Done: Patched the PRD with review-driven corrections; updated implementation tracker verification notes.
* Now: Return the revised assessment and concrete next-step choices.
* Next: If requested, move from spec to schema/eval-harness implementation planning.

**Open Questions**
* None.

**Working Set**
* `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
* `docs/implementation/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
* `ContinuityDocs/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`

**Notes / Outcomes**
* The FSFS now resolves the review’s highest-value issues without changing the core architecture or phase plan.
