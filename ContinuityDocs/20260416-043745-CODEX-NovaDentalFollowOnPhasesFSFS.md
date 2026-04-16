### Lessons Learned (mutable - replace/update this section)
* The current AskEIDS codebase already has the right public route shape for the next Dental phases; the biggest gaps are trust clarity and backend service ownership, not route design.
* The safest follow-on scope is hybrid and source-family-scoped: prove one live Bedrock path first, then expand trust surfaces, then harden the orchestration boundary.

---

### Ledger Entries (append-only)

## Entry - 2026-04-16 04:37:45 (local)

**Goal**
* Write a new FSFS for the next three Dental follow-on phases after the initial extraction-first execution.

**Constraints/Assumptions**
* Use the `fullstack-spec-creator` workflow and keep the spec grounded in the current AskEIDS codebase.
* Preserve existing product routes and mixed-mode portfolio behavior.
* Scope the live Bedrock baseline to Dental email for this follow-on plan.

**Key Decisions**
* Phase 1 is a hybrid live/replay rollout with Dental email as the only live family.
* Phase 2 prioritizes user trust surfaces: exact citations where available and explicit degraded-state messaging.
* Phase 3 focuses on moving Dental semantic orchestration into dedicated services without changing route contracts.

**State**
* Done:
  * Reviewed prior execution continuity.
  * Re-scanned FE/BE code areas relevant to routes, runtime config, mutation/read-model flow, ask/report behavior, and test patterns.
  * Authored the new FSFS in `PRD/20260416-043745-CODEX-NovaDentalFollowOnPhasesFSFS.md`.
  * Created the implementation tracker in `docs/implementation/20260416-043745-CODEX-NovaDentalFollowOnPhasesFSFS.md`.
* Now:
  * Hand off the new spec to the user.
* Next:
  * Wait for the user to choose whether to execute the new phases or refine the spec further.

**Open Questions**
* None.

**Working Set**
* `PRD/20260416-043745-CODEX-NovaDentalFollowOnPhasesFSFS.md`
* `docs/implementation/20260416-043745-CODEX-NovaDentalFollowOnPhasesFSFS.md`
* `client/src/App.jsx`
* `client/src/lib/api.js`
* `server/src/config/runtime.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/services/domain/readModel.service.js`
* `server/src/services/domain/ask.service.js`
* `server/src/services/rag/generation.service.js`
* `server/src/services/ingest/corpusImport.service.js`
* `server/src/services/state/runtimeState.repository.js`
* `shared/artifactTypes.js`

**Notes / Outcomes**
* The new spec is intentionally narrower than the original Dental extraction-first FSFS: it covers the next three recommended phases rather than re-specifying the entire migration.
* The spec makes hybrid execution and trust-state visibility first-class so the next implementation wave proves real-environment value before larger rollout work.


