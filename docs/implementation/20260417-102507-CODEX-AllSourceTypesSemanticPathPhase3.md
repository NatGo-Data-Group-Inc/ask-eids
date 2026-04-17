---
name: Phase 3 — All Text Source Types Through the Semantic Path
description: Route transcripts, decision memos, weekly updates, documents, and structured imports (CSVs) through the same semantic extraction path that currently handles emails only. Phase 2's aggregate then sees every text-based upload, not just 2 of 24.
type: implementation
---

# Phase 3 — All Text Source Types Through the Semantic Path

**Predecessors**
- `docs/implementation/20260417-012639-CODEX-PerDocPromptEvalPhase1.md` — per-doc extraction prompt
- `docs/implementation/20260417-094441-CODEX-AggregateStatusPromptPhase2.md` — aggregate-status prompt + wire-up

## Context

After Phase 2, the LLM aggregate drives `product.status` when ingest flows through the "email semantic path" — but that path today fires only for emails, because of two narrow gates in `server/src/services/domain/mutation.service.js`:

```js
// queueArtifactJob, ~line 994:
if (validated.sourceType === 'transcript' && !useSemanticServicePath) {
  return queueTranscriptJob(...);    // transcript intercept
}
// ~line 990:
const useSemanticServicePath = productLiveAllowed
  && effectiveFeatureFlags.enableDentalSemanticServiceSplit    // dental-named flag
  && sourceFamilyClass === 'retrieval_eligible';               // excludes CSVs (fixed_schema_structured)
```

So for the 24 non-baseline dental uploads in the lifecycle corpus, only 2 (the two emails) currently populate `state.sourceExtractions[]`. The aggregate therefore sees 2 of 24 signals. That's the thin-evidence gap Phase 2's closing notes flagged. **Phase 3 fixes it** by routing every text-based upload through the same semantic path.

Internal fact that makes this cheap: `runEmailSemanticIngest` (`server/src/services/semantic/semanticIngestOrchestrator.service.js`) is already source-type-agnostic — the `email` in the name is historical. It delegates to `normalizeSourceArtifact` which already handles `.eml`, `.md`, `.csv`, `.docx` (Phase 2 added mammoth for docx). Most of the work is removing the gating that keeps non-email types out, not building new extraction machinery.

## Goals

1. **Every text-format upload produces a `sourceExtraction`.** Email, transcript, decision memo, weekly update, document, risk export, blocker export, action-item export, PI-objectives export, ADO export.
2. **The aggregate fires for every ingest**, not just emails, so `product.status` reflects the full evidence set.
3. **Structured imports (CSVs) still populate `data.risks/blockers/pi/actionItems`** via the existing `parseStructuredImportRows` path — we keep that side-effect alongside the new LLM extraction.
4. **Flag rename** from `enableDentalSemanticServiceSplit` → `enableSemanticServicePath` so nothing in the codebase still calls this a dental-only feature.
5. **Function rename** `runEmailSemanticIngest` → `runSemanticIngest`.

## Scope

**In**
- `mutation.service.js` — remove the transcript intercept, widen `useSemanticServicePath` to include `fixed_schema_structured` (with the structured side-effect preserved), rename the flag check.
- `runtime.js` / `featureFlags.service.js` — rename the flag; keep the env variable short and clear (`ENABLE_SEMANTIC_SERVICE_PATH`).
- `semanticIngestOrchestrator.service.js` — rename `runEmailSemanticIngest` → `runSemanticIngest`; confirm it handles non-email normalizer outputs (participant list may be empty, etc.).
- `executionPolicy.service.js` — confirm `liveSourceFamilies` default (`['email']`) is widened so non-email families get `live` execution when requested; otherwise non-email stays on replay forever. Either default to all known families or drop the family-level gate for `replay` mode specifically.
- `sourceNormalization.service.js` — already has a generic branch for non-email; add whatever small tweaks are needed (e.g. use `title` in previewText when normalized text is thin).
- Tests: `semantic.execution-policy.test.js`, `semantic.ingest.integration.test.js`, and any test that asserts "transcript goes to queueTranscriptJob" — update to reflect the new routing.
- Regression: re-run the Phase-2 aggregate harness against regenerated fixtures that now include the richer non-email extractions.

**Out**
- Binary `.pdf` and `.pptx` (2 + 1 of 29 lifecycle docs). Still deferred — they need `pdf-parse` / pptx decoding in `sourceNormalization`. Separate Phase 3.1.
- `deferred`-class source types (`slide_deck`, `spreadsheet_attachment`, `ado` action field) — these never enter the semantic path by design. No change.
- Legacy `queueTranscriptJob` function. Either deleted (if nothing else calls it) or left as a dead-code helper the transcript route no longer uses. Decide during implementation.
- UI work on the badge, drivers/riskFactors popover — still Phase 4 territory.
- GovCloud parity.

## Assumptions & constraints

1. `runEmailSemanticIngest` works for non-email types today. **Risk**: `participants` field is email-specific. For non-email sources, `normalized.participants` is `[]`. Need to confirm nothing downstream (citation projection, chunking) hard-requires participants.
2. `parseStructuredImportRows` and `extractArtifactContent` currently run in the legacy path. When a CSV now routes through the semantic path, the `data.risks[]` / `data.blockers[]` updates must still happen. **Decision**: call `parseStructuredImportRows` from inside the semantic path (or from a post-extraction step) for `fixed_schema_structured` types.
3. The dental-named flag `enableDentalSemanticServiceSplit` is referenced in `runtime.js:94`, `featureFlags.service.js:22,36,43-46`, `executionPolicy.service.js` (already touched Phase 2), and `mutation.service.js:990`. A full rename is a small cross-file edit, but `featureFlagsFromLegacyMode` uses it to derive legacy modes — keep the same semantics under the new name.
4. **Pre-existing test failure** `runtime-state.repository.integration.test.js > persists Dental extraction records, aggregate snapshots, and prompt runs in durable state` fails today (Phase 2 confirmed this is pre-existing). Phase 3's widening may accidentally *fix* it (since more ingests now produce sourceExtractions) or may require a flag-controlled seed path — worth checking early.
5. Budget: re-running the dump script after Phase 3 wiring is free (cached); running the aggregate harness again across 4 fixtures × 3 stability ≈ $0.04. If Phase 3 changes the aggregate prompt itself (it shouldn't), add another ~$0.10 for iteration.

## Architecture sketch

Before (Phase 2):
```
upload → queueArtifactJob
           │
           ├── if sourceType === 'transcript' && !useSemanticServicePath:
           │     queueTranscriptJob (legacy path, no LLM)
           │
           ├── if useSemanticServicePath (email + dental + flag):
           │     runEmailSemanticIngest → sourceExtraction → [phase2] aggregate
           │
           └── else (everything else — csv, md, docx, pdf…):
                 legacy extractArtifactContent path (no LLM, no aggregate)
```

After (Phase 3):
```
upload → queueArtifactJob
           │
           ├── if useSemanticServicePath (any product in allowlist + flag + source is text):
           │     runSemanticIngest → sourceExtraction → aggregate
           │         └── additionally, for fixed_schema_structured:
           │               parseStructuredImportRows → data.risks/blockers/pi/actionItems
           │
           └── else (binary-only fallback, or flag off):
                 legacy extractArtifactContent path
```

The gate becomes:
```js
const textFamily = ['retrieval_eligible', 'fixed_schema_structured'].includes(sourceFamilyClass);
const useSemanticServicePath = productLiveAllowed
  && effectiveFeatureFlags.enableSemanticServicePath
  && textFamily;
```

No more `sourceType === 'transcript'` intercept. Transcripts flow through `runSemanticIngest` like any other text source. The specialised `queueTranscriptJob` (which did `product.health.coverage +4`, etc.) becomes dead code — either delete it, or keep as a reference if the health bump behaviour should carry over (probably not, since aggregate now drives status).

## Acceptance criteria

**Wiring**
- **AC-1** Uploading a `.md` decision_memo for dental produces a row in `state.sourceExtractions[]` with `productId='dental'` and a non-empty `payload.summary`.
- **AC-2** Uploading a `.docx` transcript for dental produces a row in `state.sourceExtractions[]`. `queueTranscriptJob` is NOT invoked.
- **AC-3** Uploading a `.csv` risk_export for dental (a) produces a `sourceExtractions[]` row AND (b) still updates `data.risks[]` rows via `parseStructuredImportRows`.
- **AC-4** Uploading an essence transcript produces a row — proves product-agnosticism (Phase 2 gate widening is effective across the semantic path, not just for emails).
- **AC-5** Uploading a `.pptx` or `.pdf` still takes the legacy path (no LLM) — Phase 3.1 covers those.

**Aggregate behaviour**
- **AC-6** After any of the AC-1..AC-4 ingests, the `[phase2] aggregate synth ok` log fires, and `product.statusLabel` reflects the LLM's return.
- **AC-7** Regenerating the Phase-2 aggregate fixtures via `dump-sourceExtractions.mjs` now produces 26 extractions (same as before Phase 3 — the dump always bypassed production routing via direct Bedrock), so aggregate fixtures are unchanged. **But** a lifecycle E2E that drives extractions through the REAL API now produces the same count as the dump.

**Regression**
- **AC-8** Full `npx vitest run server/test/semantic.*` still green (20/20 plus any new coverage).
- **AC-9** The pre-existing `runtime-state.repository.integration.test.js > persists Dental extraction records…` test either passes as a side-effect of wider routing, or stays at its prior-failure baseline (no new regressions).
- **AC-10** Phase-2 stability run: 4 fixtures × 3 consecutive passes against the (unchanged) aggregate prompt.

**End-to-end (the payoff)**
- **AC-11** Run the existing multi-product Playwright lifecycle spec (`tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js`) with `EIDS_ENABLE_BEDROCK=true`, `ENABLE_SEMANTIC_SERVICE_PATH=true`, `EIDS_ALLOW_NON_GOVCLOUD_FOR_DEV=true`. At the end-of-run assertion point, the three product-card badges are **LLM-synthesized** (not seed-derived). Resolving the spec's unrelated sources-list rendering race is part of this AC. *This is the original lifecycle goal from the start of this arc, finally becoming true.*

## Definition of done

| # | Item |
|---|------|
| 1 | All ACs above pass (AC-11 is the capstone) |
| 2 | Renames applied: `enableDentalSemanticServiceSplit` → `enableSemanticServicePath`, `runEmailSemanticIngest` → `runSemanticIngest`, env `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` → `ENABLE_SEMANTIC_SERVICE_PATH` |
| 3 | Transcript intercept at `mutation.service.js:~994` removed; `queueTranscriptJob` either deleted or has its remaining callers audited |
| 4 | Structured imports routed through semantic path AND still update `data.risks/blockers/pi/actionItems` |
| 5 | `executionPolicy.service.js` either widens `liveSourceFamilies` default beyond `email`, or confirms the replay-mode fallback is acceptable for non-email types |
| 6 | Test updates: `semantic.execution-policy.test.js` adds non-email live coverage; any test asserting the transcript intercept is rewritten |
| 7 | Phase-2 aggregate harness re-run (4 × 3) still passes; Phase-2 implementation doc's AC-12 flipped from NOT YET VALIDATED → PASS with screenshot + run artifacts |
| 8 | This implementation doc updated with: iteration log, AC pass table, Bedrock spend, end-to-end proof (Playwright report path), Phase 4 handoff |
| 9 | Continuity ledger opened at `ContinuityDocs/<ts>-CODEX-AllSourceTypesSemanticPathPhase3.md` on kick-off |

## Verification

```bash
# Env (same as Phase 2 + new flag name)
export EIDS_ENABLE_BEDROCK=true
export EIDS_AWS_REGION=us-east-1
export AWS_PROFILE=default
export ENABLE_SEMANTIC_SERVICE_PATH=true
export ENABLE_EXTRACTION_REPLAY_MODE=true
export EIDS_ALLOW_NON_GOVCLOUD_FOR_DEV=true

# 1. Unit + integration
npx vitest run server/test/semantic.execution-policy.test.js \
               server/test/semantic.replay-store.test.js \
               server/test/semantic.ingest.integration.test.js \
               server/test/semantic.validation.test.js

# 2. Phase 2 aggregate harness still green
for f in aggregate-dental-post-wave01 aggregate-dental-post-wave03 aggregate-essence-post-wave02 aggregate-optima-post-wave03; do
  for i in 1 2 3; do node scripts/prompt-eval/aggregate-run.mjs $f || exit 1; done
done

# 3. End-to-end smoke: upload one non-email doc, confirm sourceExtraction is created + aggregate fires
#    (scripts/prompt-eval/live-upload-smoke.mjs — new helper, optional)
node scripts/prompt-eval/live-upload-smoke.mjs ingest-30  # dental transcript
# expect: [phase2] aggregate synth ok ... ingest-30 ... drivers=N risks=M

# 4. Playwright lifecycle — the capstone
npx playwright test tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js --reporter=line
```

## Files to edit / create

**Edit**
- `server/src/services/domain/mutation.service.js` — remove transcript intercept; widen gate; run `parseStructuredImportRows` inside semantic path for `fixed_schema_structured`
- `server/src/services/semantic/semanticIngestOrchestrator.service.js` — rename function; confirm non-email correctness
- `server/src/services/semantic/executionPolicy.service.js` — rename flag check; widen `liveSourceFamilies` OR document why replay-only is OK
- `server/src/services/semantic/featureFlags.service.js` — rename flag default + legacy-mode mappings
- `server/src/config/runtime.js` — rename env
- `server/test/semantic.execution-policy.test.js` — new non-email coverage
- `server/test/semantic.ingest.integration.test.js` — update any test asserting the transcript intercept
- `tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js` — fix the sources-list rendering race (unrelated Phase-2.1 bug surfaced earlier)

**Create**
- `scripts/prompt-eval/live-upload-smoke.mjs` (optional quality-of-life) — uploads one doc via API and tails the aggregate log
- `ContinuityDocs/<ts>-CODEX-AllSourceTypesSemanticPathPhase3.md` — ledger on kick-off

**Delete (candidates)**
- `queueTranscriptJob` in `mutation.service.js:759` if no remaining callers after intercept removal
- Any dead references in `app.js:258` route handler — the `/transcripts` endpoint itself might still be useful as a back door, but it should delegate to the same `runSemanticIngest` path

## Risks

- **Transcript health-bump loss.** `queueTranscriptJob` bumps `product.health.coverage +4, overall +2` (mutation.service.js:932-934). When transcripts route through the semantic path instead, that bump disappears — unless we replicate it. Decision to make during implementation: does the LLM aggregate's new grounding replace the need for that heuristic? Probably yes.
- **Structured-import double-processing.** If we run both LLM extraction AND `parseStructuredImportRows` on the same CSV, we need to be sure they don't race on `data.risks[]`. Since both write inside `updateState`, atomicity is preserved.
- **Transcript size.** Wave-02 dental has a ~2800-char normalised transcript; that's fine. But if a future transcript is 50k chars, we should think about Nova's 900-token output limit (could truncate long summaries). Not Phase 3's problem — note as Phase 4 consideration.
- **Flag rename regression.** Dev envs with the old env var `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` set will silently stop working after the rename. Post a brief note in the implementation doc closeout.

## Phase 4 preview (not in this plan)

- **Binary source types** (.pdf via `pdf-parse`, .pptx via a decoder). Covers the remaining 3 lifecycle docs.
- **Scheduled aggregate refresh** (daily cron) independent of ingest events — keeps `product.status` fresh even when no new docs land.
- **UI surfaces** for aggregate drivers / riskFactors — "Why this status?" popover on the badge with clickable `anchorSourceIds` → source-detail drawer.
- **GovCloud parity** run of Phase 1, 2, 3 prompts + wire-up.

## Why this matters (one paragraph)

Phase 2 proved the aggregate machinery works and gets the right answer *when it has data*. Phase 3 gives it data. Today the LLM badge on dental reflects 2 extractions; after Phase 3 it reflects 22. For essence, today's badge reflects 1 extraction (the wave-02 email); after Phase 3 it reflects both (1 email + 1 transcript). Without this, the original lifecycle — "upload 29 docs one at a time, watch the status badge evolve to the LLM's synthesis of everything we've seen" — is running with one eye closed. Phase 3 opens the other eye.
