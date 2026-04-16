### Lessons Learned (mutable - replace/update this section)
* Lifecycle E2E work should validate meaningful state transitions at the same granularity users experience them: portfolio posture, product evidence surfaces, Ask confidence, data imports, and reports.
* For this app, the corpus manifest and operator guide are the authoritative source for ingestion order and expected demo evolution.

---

### Ledger Entries (append-only)

## Entry - 2026-04-15 18:58:58 (local)

**Goal**
* Implement a detailed headed Playwright lifecycle workflow for Dental / DENCLASS that exercises onboarding from seed or empty-like state through the approved Gold-system document pack.
* Prove that the UI updates correctly as documents are uploaded wave by wave.

**Constraints/Assumptions**
* Follow repo `AGENTS.md` rules: maintain a session ledger and implementation doc, use proof-driven execution, and avoid GitHub state-changing commands without explicit approval.
* The app currently seeds corpus state on reset, so the workflow may need to approximate an empty-start by resetting and then layering additional uploaded evidence on top of seeded state unless the codebase already exposes a true empty project path.
* The requested workflow should run in headed Playwright mode and be detailed enough for lifecycle/demo validation, not just a narrow regression check.

**Key Decisions**
* Create a new task-specific ledger and implementation doc using the current timestamp prefix.
* Use the Dental entries in `MASTER-MANIFEST.csv` plus operator-guide files as the source of truth for lifecycle expectations.
* Reuse the existing Playwright harness and reset endpoint rather than inventing a separate external runner unless the existing suite proves too limited.

**State**
* Done: Reviewed the latest continuity doc, prior artifact-upload implementation doc, and current repo cleanliness.
* Now: Create task docs and map lifecycle checkpoints before implementation.
* Next: Add the detailed lifecycle Playwright workflow and validate it.

**Open Questions**
* Whether the current app supports a true empty-project start in the UI or whether the correct first proof should begin from seeded corpus state.

**Working Set**
* `ContinuityDocs/20260415-185858-CODEX-DentalLifecycleHeadedE2E.md`
* `docs/implementation/20260415-185858-CODEX-DentalLifecycleHeadedE2E.md`
* `EIDS-Prototype-Document-Pack/00-operator-guide/MASTER-MANIFEST.csv`
* `EIDS-Prototype-Document-Pack/00-operator-guide/INGESTION-ORDER.md`
* `EIDS-Prototype-Document-Pack/00-operator-guide/EXPECTED-DEMO-EVOLUTION.md`
* `EIDS-Prototype-Document-Pack/00-operator-guide/LEADERSHIP-DEMO-SCRIPT.md`
* `tests/e2e/`

**Notes / Outcomes**
* Prior upload and artifact-consumption features are already implemented and verified, so this task can focus on an end-to-end lifecycle runbook/workflow over the existing capabilities.

## Entry - 2026-04-15 20:12:00 (local)

**Goal**
* Finish the Dental lifecycle headed Playwright workflow and capture proof that the approved pack changes the UI as expected.

**Constraints/Assumptions**
* The app rejects future source dates relative to the local runtime day, so lifecycle fixtures dated 2026-04-16 cannot be submitted unchanged on 2026-04-15.
* Some GitHub-exported corpus files are missing original binary payloads, so the workflow must use source-type-safe synthetic stand-ins while preserving sidecar metadata.

**Key Decisions**
* Reset the runtime to `wave-00-baseline` for the lifecycle run instead of the full seeded corpus.
* Materialize missing transcript binaries as `.md` stand-ins so transcript normalization succeeds.
* Capture upload responses and wait for sources by returned `sourceId` rather than brittle title-only DOM matching.
* Clamp future upload-form dates to the current test day while retaining metadata sidecars for lifecycle context.

**State**
* Done:
  * Added lifecycle helpers and spec under `tests/e2e/lifecycle/`.
  * Extended source-type support in `shared/artifactTypes.js`.
  * Extended server reset/import behavior to support baseline-only corpus resets.
  * Verified the workflow with a headed Playwright run.
* Now:
  * Update implementation traceability and finalize the task summary.
* Next:
  * Share outcomes and recommended follow-on hardening work with the user.

**Open Questions**
* None.

**Working Set**
* `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js`
* `tests/e2e/lifecycle/dental-pack-lifecycle.helpers.js`
* `shared/artifactTypes.js`
* `server/src/services/ingest/corpusImport.service.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/app.js`
* `tests/e2e/test-helpers.js`
* `docs/implementation/20260415-185858-CODEX-DentalLifecycleHeadedE2E.md`

**Notes / Outcomes**
* Root-cause fixes during verification:
  * synthetic `.docx` transcript stand-ins failed transcript normalization; switched those stand-ins to `.md`
  * title-based source waits were brittle; switched to `sourceId`-based waits using the upload API response
  * wave-03 uploads initially stalled because the helper used `2026-04-16` while the runtime day was `2026-04-15`; the helper now clamps future form dates to today
* Verification proof:
  * Command: `npx playwright test tests/e2e/lifecycle/dental-pack-lifecycle.spec.js --headed --reporter=line`
  * Result: `1 passed (26.1s)`
