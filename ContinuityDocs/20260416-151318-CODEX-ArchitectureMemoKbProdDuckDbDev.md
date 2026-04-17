### Lessons Learned (mutable - replace/update this section)
* Bedrock Knowledge Bases is the target production retrieval substrate; DuckDB retrieval remains useful for local/dev cost control.
* DuckDB suitability for production runtime state is a separate decision from production vector retrieval.

---

### Ledger Entries (append-only)

## Entry - 2026-04-16 15:13:18 (local)

**Goal**
* Update the stove-pipe prevention architecture memo so it reflects the current retrieval decision: Bedrock Knowledge Bases in production, DuckDB retrieval only in dev/test to save cost.

**Constraints/Assumptions**
* Do not perform Git state-changing operations without user confirmation.
* Keep the memo leadership-readable while making the retrieval architecture explicit.
* Treat production vector retrieval and production runtime state as separate architectural decisions.

**Key Decisions**
* Frame Bedrock Knowledge Bases as the production retrieval substrate in the memo.
* Frame DuckDB retrieval as dev/test-only because concurrent/shared production vector-store use is not the intended target in this architecture.

**State**
* **Done:**
  * Reviewed the updated architecture memo and validated the current retrieval-provider implementation plus ADC's KB adapter.
* **Now:**
  * Patch the memo language around persistence/retrieval and sequencing.
* **Next:**
  * Re-read the edited memo and summarize the final wording changes.

**Open Questions**
* None.

**Working Set**
* `docs/architecture/20260416-143720-CODEX-StovepipePreventionPatternsForAskEIDSAndADC.md`
* `server/src/rag/retrievalProvider.js`
* `AgenticDataCatalog-NoDocker/shared/src/vectorStores/knowledgeBases.js`

**Notes / Outcomes**
* None yet.

**Correction**
* None.

## Entry - 2026-04-16 15:24:35 (local)

**Goal**
* Remove the v1 changelog block so the memo reads like a first-version leadership artifact.

**Constraints/Assumptions**
* Keep the already-corrected architecture language intact.
* Make only the presentation change requested by the user.

**Key Decisions**
* Delete the `Changelog since v1.0` section entirely rather than trying to shorten it.

**State**
* **Done:**
  * Removed the changelog block from the top of the memo.
  * Verified that the document now flows directly from the metadata table into `## TL;DR`.
* **Now:**
  * Report the docs-only change back to the user.
* **Next:**
  * None unless the user wants more wording cleanup.

**Open Questions**
* None.

**Working Set**
* `docs/architecture/20260416-143720-CODEX-StovepipePreventionPatternsForAskEIDSAndADC.md`
* `ContinuityDocs/20260416-151318-CODEX-ArchitectureMemoKbProdDuckDbDev.md`

**Notes / Outcomes**
* The memo now presents as a clean v1 document instead of an iteration log.

**Correction**
* None.

## Entry - 2026-04-16 15:20:55 (local)

**Goal**
* Apply the final leadership-review wording refinements to the architecture memo.

**Constraints/Assumptions**
* Keep the document technically accurate without overstating compliance certainty.
* Preserve the current architectural direction: thin shared platform foundation, KB for production retrieval, DuckDB retrieval only in dev/test.

**Key Decisions**
* Rename section 1 so the heading matches the actual mix of overlap and divergence risk.
* Add a deployment-topology caveat to AskEIDS DuckDB runtime state.
* Soften the section 6 re-approval sentence from a hard claim to a likely-review/change-control outcome.

**State**
* **Done:**
  * Renamed section 1 to `Current Overlap and Divergence Risks`.
  * Added the DuckDB-compatible concurrency-boundaries caveat to section 5.1.
  * Softened the section 6 compliance/re-approval wording.
  * Re-read the edited lines for consistency.
* **Now:**
  * Summarize the final doc state back to the user.
* **Next:**
  * None unless the user wants additional wording or related spec updates.

**Open Questions**
* None.

**Working Set**
* `docs/architecture/20260416-143720-CODEX-StovepipePreventionPatternsForAskEIDSAndADC.md`
* `ContinuityDocs/20260416-151318-CODEX-ArchitectureMemoKbProdDuckDbDev.md`

**Notes / Outcomes**
* The memo now reads more defensibly for leadership review without changing the underlying recommendation.

**Correction**
* None.

## Entry - 2026-04-16 15:15:40 (local)

**Goal**
* Lock the memo wording so production retrieval is Bedrock Knowledge Bases and DuckDB retrieval is dev/test-only.

**Constraints/Assumptions**
* Keep the memo aligned with the actual codebase seams: AskEIDS still aliases `kb` to DuckDB today, while ADC already has a KB adapter.
* Avoid overstating what this decision implies for production runtime state.

**Key Decisions**
* Strengthen the memo language so KB is the only supported production retrieval substrate in this plan.
* Keep DuckDB retrieval explicitly limited to dev/test for cost control and offline/local workflows.
* State plainly that DuckDB runtime state is a separate decision from vector retrieval.

**State**
* **Done:**
  * Updated the changelog, TL;DR, `VectorStore` row, and §5.2 vector-retrieval section of the architecture memo.
* **Now:**
  * Re-read the edited sections for consistency and leadership readability.
* **Next:**
  * Summarize the exact changes back to the user.

**Open Questions**
* None.

**Working Set**
* `docs/architecture/20260416-143720-CODEX-StovepipePreventionPatternsForAskEIDSAndADC.md`
* `ContinuityDocs/20260416-151318-CODEX-ArchitectureMemoKbProdDuckDbDev.md`

**Notes / Outcomes**
* The memo now distinguishes production retrieval from production runtime state more clearly.

**Correction**
* None.
