### Lessons Learned (mutable - replace/update this section)
* The UXRD implementation requires strict red-green TDD and proof across integration plus Playwright coverage.
* The active deliverables for this session are the continuity ledger, an implementation document in docs/implementation, code changes, and passing headed/headless Playwright runs.

---

### Ledger Entries (append-only)

## Entry - 2026-04-15 15:39:18 (local)

**Goal**
* Implement `PRD/20260415-152123-CODEX-ArtifactUploadEvidenceConsumptionUXRD.md` end to end.
* Finish only when AC-001 through AC-028 are satisfied, the implementation doc is up to date, and Playwright passes in headless and headed modes.

**Constraints/Assumptions**
* Follow repo `AGENTS.md` rules: create continuity docs and implementation docs with timestamp-prefixed filenames, use red-green TDD, and avoid GitHub state-changing commands without user confirmation.
* Reuse existing AskEIDS UI patterns rather than introducing a new design language.
* Mobile remains unsupported below 1024px.

**Key Decisions**
* Use `20260415-153918-CODEX-ArtifactUploadEvidenceConsumptionImplementation.md` as the implementation document.
* Start by inspecting current product page, test harness, and data flows before writing failing tests.

**State**
* Done: Reviewed the UXRD, checked repo top-level structure, confirmed current timestamp, and loaded the session-ledger workflow.
* Now: Create required docs and inspect current app/test architecture.
* Next: Write failing integration and Playwright tests mapped to the UXRD acceptance criteria.

**Open Questions**
* None.

**Working Set**
* `PRD/20260415-152123-CODEX-ArtifactUploadEvidenceConsumptionUXRD.md`
* `ContinuityDocs/20260415-153918-CODEX-ArtifactUploadEvidenceConsumption.md`
* `docs/implementation/20260415-153918-CODEX-ArtifactUploadEvidenceConsumptionImplementation.md`

**Notes / Outcomes**
* Session started in coding mode, so continuity tracking is active for this task.

## Entry - 2026-04-15 16:07:00 (local)

**Goal**
* Complete the Artifact Upload and Evidence Consumption UXRD with proof through automated tests.

**Constraints/Assumptions**
* Proof requirement included full Playwright coverage in both headless and headed modes.
* Existing transcript upload behavior had to remain stable for legacy server tests while the UI moved to a generalized artifact experience.

**Key Decisions**
* Added a shared artifact-classification contract in `shared/artifactTypes.js` so client and server use the same extension/type rules.
* Kept the legacy transcript API path for backwards compatibility while introducing `/api/v1/products/:productId/sources` for the generalized artifact flow.
* Seeded `rep-seeded` and evidence-version tracking so stale-report regeneration can be proven in the UI.

**State**
* Done: Implemented generalized artifact upload, ingest-status panel, evidence update banner, expanded sources filters/detail drawer, Ask loading + retry, structured-import data impact, report regenerate notice, and accessibility-focused keyboard/focus behavior.
* Done: Updated Playwright specs and added client integration coverage for the new upload/retry surface.
* Done: Verified `npm test`, `npm run test:e2e`, and `npm run test:e2e:headed` all pass.
* Now: Finalize user handoff.
* Next: Wait for the user's choice on prioritized follow-up improvements.

**Open Questions**
* None.

**Working Set**
* `client/src/App.jsx`
* `client/src/styles/runtime.css`
* `client/src/test/artifact-upload-ui.test.jsx`
* `server/src/app.js`
* `server/src/services/domain/readModel.service.js`
* `server/src/services/domain/mutation.service.js`
* `server/src/services/ingest/artifactUpload.service.js`
* `server/src/services/ingest/corpusImport.service.js`
* `shared/artifactTypes.js`
* `docs/implementation/20260415-153918-CODEX-ArtifactUploadEvidenceConsumptionImplementation.md`

**Notes / Outcomes**
* `npm test` passed with 47/47 tests.
* `npm run test:e2e` passed with 28/28 tests.
* `npm run test:e2e:headed` passed with 28/28 tests.

## Entry - 2026-04-15 16:20:00 (local)

**Goal**
* Prevent generated runtime artifacts from being included in Git pushes.

**Constraints/Assumptions**
* User asked only for `.gitignore` correction, not history cleanup.
* Existing push rejection was caused by already tracked large files under `server/data/`.

**Key Decisions**
* Broadened `.gitignore` to ignore `.playwright-mcp/` and the full `server/data/` tree because the current repo snapshot shows those paths are generated runtime/test output.

**State**
* Done: Updated `.gitignore` to ignore local Playwright MCP logs and server runtime/test data.
* Now: Hand off the ignore change and explain remaining push implications.
* Next: If requested, clean tracked large files from Git/index/history using an explicitly approved Git workflow.

**Open Questions**
* None.

**Working Set**
* `.gitignore`
* `ContinuityDocs/20260415-153918-CODEX-ArtifactUploadEvidenceConsumption.md`

**Notes / Outcomes**
* This change prevents new files in those locations from being added, but does not by itself remove already tracked large blobs that caused the earlier GitHub push rejection.

## Entry - 2026-04-15 16:31:00 (local)

**Goal**
* Remove tracked runtime artifacts from Git history and push the repository to the private GitHub remote.

**Constraints/Assumptions**
* User explicitly approved Git cleanup and push work for phases 1 through 3.
* `server/data/` is a runtime/test directory resolved by `server/src/config/runtime.js`, not a required committed seed-data directory.

**Key Decisions**
* Used a full-history rewrite to preserve the local commit sequence while removing generated paths, instead of replacing history with a new orphan commit.
* Removed both `server/data/` and `.playwright-mcp/` from history, then pruned `refs/original` and unreachable objects before pushing.

**State**
* Done: Rewrote local history to remove generated runtime artifacts and browser-debug outputs.
* Done: Verified `git rev-list --objects --all` no longer returns `server/data/` or `.playwright-mcp/` paths.
* Done: Pushed cleaned `main` to `origin` at `https://github.com/ArchieDB-ai/AskEIDS.git`.
* Now: Commit the final proof documentation updates so the remote repo reflects the completed cleanup record.
* Next: Push the final documentation-only follow-up commit.

**Open Questions**
* None.

**Working Set**
* `.gitignore`
* `docs/implementation/20260415-162300-CODEX-GitHistoryCleanupForPush.md`
* `ContinuityDocs/20260415-153918-CODEX-ArtifactUploadEvidenceConsumption.md`

**Notes / Outcomes**
* `git count-objects -vH` dropped to a packed repository size of `473.55 KiB` after pruning.
* `git push -u origin main` succeeded after the history cleanup.
