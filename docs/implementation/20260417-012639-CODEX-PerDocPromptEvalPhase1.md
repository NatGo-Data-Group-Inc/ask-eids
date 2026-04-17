---
name: Per-Document Extraction Prompt Iteration — Phase 1
description: Iteration log + AC pass record for Phase 1 of the per-document Nova Pro prompt-eval harness, baselined on the first non-baseline lifecycle document (ingest_order=28).
type: implementation
---

# Per-Document Extraction Prompt Iteration — Phase 1

Source plan: `C:\Users\bockf\.claude\plans\let-s-start-with-creating-distributed-pie.md`
Continuity ledger: not opened (single-session task — fits the "trivial / information-only" exception).

## Overview

Built a standalone Node harness that calls live commercial AWS Bedrock Nova Pro with the project's existing generic source-extraction prompt, validates the response against the production AJV schema, and runs content assertions against a hand-crafted JSON expectation. Iterated the prompt against the first lifecycle-uploaded document (`ingest_order=28` — "Email — Test Schedule Approval") until 3 consecutive runs passed all assertions.

The harness is product-agnostic — it bypasses the `executionPolicy.service.js` `productId === 'dental'` gate by calling Bedrock directly, so the same prompt + same harness can be retargeted at any document for any product.

## Scope

**In scope (this phase)**
- Standalone harness under `scripts/prompt-eval/`
- One expected-JSON baseline (`expected/ingest-28.json`)
- Iteration of the production prompt strings in `server/src/services/semantic/novaSourceExtraction.service.js`
- Refactor to expose `EXTRACTION_SYSTEM_PROMPT` / `buildExtractionUserPrompt` / `buildLiveExtraction` so the harness and production are guaranteed to use identical prompt strings

**Out of scope (deliberate — Phase 2+)**
- Aggregate-status prompt that reduces accumulated extractions → `productAggregates[].status` (drives badge instead of seed-driven `latestStatus`)
- Widening the dental-only `executionPolicy` gate so the live path runs for `essence`, `optima`, etc. inside production
- GovCloud (`us-gov-west-1`) parity verification
- Multi-document validation across other source types (transcript, decision_memo, blocker_export, ...)
- UI assertions that the JSON appears at `source-detail-summary` / `source-detail-citations`

## Acceptance criteria — all PASS

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC-1 | Harness invokes live Bedrock and receives parseable JSON for ingest-28 | ✓ | `scripts/prompt-eval/runs/ingest-28-2026-04-17-012535.json` (and 2 successors) |
| AC-2 | Response passes `validateSourceExtraction` (AJV) | ✓ | "schema validation passed" in run output |
| AC-3 | `decisions[]` contains ≥ 1 entry with `confidence === 'high'` and `label` matches `/approv(e\|al\|ed)/i` | ✓ | `"approve revised test schedule"`, confidence high |
| AC-4 | `warnings[]` contains ≥ 1 entry matching `/environment\|readiness\|certif\|valid/i` | ✓ | `"The environment is not considered ready until actual validation is achieved."` |
| AC-5 | `summary` contains `Sohl` and `/test schedule\|cadence/i` | ✓ | "Dr. Minji Sohl approved the revised test schedule for Sprint 2 …" |
| AC-6 | Top-level `confidence === 'high'` | ✓ | `"confidence": "high"` |
| AC-7 | Three consecutive runs all pass AC-1..AC-6 | ✓ | Stability runs at 01:25:35 / 01:25:36 / 01:25:37 UTC, all green |
| AC-8 | Final committed prompt has zero product- or document-specific wording | ✓ | Replaced "Approve revised test schedule" example with generic "verb + object" rule (eval-3 → final) |

## Iteration log (the actual work)

| Attempt | Promp version | Outcome | Fix applied |
|---------|---------------|---------|-------------|
| `eval-1` | (unchanged production prompt) | **Schema fail** — Nova returned `warnings[0]` as an `{label, severity}` object; schema requires `string` | Added system rule: *"Each warning must be a single plain string sentence; never an object or nested fields."* |
| `eval-2` | (warnings-as-strings rule added) | **Content fail** — top-level `confidence === "medium"` although both decisions had `confidence: "high"`; model also split a caveat into a second decision (`label: "not ready"`) AND duplicated it as a warning | Added three rules: define what counts as a decision vs caveat; "Do not duplicate the same content as both a decision and a warning"; "Top-level confidence is the minimum confidence across all decisions" |
| `eval-3` | (decision/warning disambiguation + min-confidence rule) | **All assertions pass.** 3/3 stability also clean. | — |
| `eval-3 → final` | (AC-8 cleanup) | Replaced the single embedded example label with a generic "verb + object" rule so the prompt has no document-specific wording. | 3/3 stability re-verified |

The model output stabilised to the same single decision and same warnings list across all 3 stability runs (only minor wording variation in the second warning about "vendor timeline in writing").

## Files changed

- **Edited**: `server/src/services/semantic/novaSourceExtraction.service.js` — replaced inline prompt strings with named exports `EXTRACTION_SYSTEM_PROMPT` and `buildExtractionUserPrompt(normalized, executionDecision)`; promoted `buildLiveExtraction` to an export; added the four new system-prompt rules listed above.
- **Created**: `scripts/prompt-eval/run.mjs` — harness that imports the production prompt strings + helpers, drives Bedrock, validates schema, and runs assertion checks.
- **Created**: `scripts/prompt-eval/expected/ingest-28.json` — hand-crafted JSON baseline + assertion config for the test document.
- **Created**: `scripts/prompt-eval/README.md` — env vars, run instructions, exit codes, cost note, iteration loop.
- **Created**: `scripts/prompt-eval/runs/` — auto-populated artifact directory holding per-run JSON for review.

## Regression check

`npx vitest run server/test/semantic.execution-policy.test.js server/test/semantic.replay-store.test.js server/test/semantic.ingest.integration.test.js server/test/semantic.validation.test.js`

- 17 of 18 tests pass with my prompt + export refactor.
- 1 failure: `semantic.execution-policy.test.js > resolves non-email Dental families to replay in hybrid mode` — `expected 'replay' to be 'disabled'`.
  - **Confirmed pre-existing**: stashed my changes to `novaSourceExtraction.service.js` and re-ran — the same test fails identically. Failure originates from already-uncommitted edits in `server/src/services/semantic/executionPolicy.service.js` (modified before this session). Not introduced by Phase 1.

## Final prompt content (system message)

```
You extract trusted product evidence from one source.
Return strict JSON only with exactly these keys: summary, decisions, warnings, confidence.
A decision is an explicit go/no-go commitment, approval, prioritization, or directive made in the source.
A caveat, condition, "not yet", "pending", risk, or qualifier on a decision is NOT a separate decision; it belongs in warnings.
Do not duplicate the same content as both a decision and a warning.
Each decision must include exactly these keys: label, confidence, anchorText.
label is a short imperative phrase (verb + object) describing the commitment; never a single word like "approved" or "rejected".
anchorText is a verbatim quoted span from the source that proves the decision.
Each warning must be a single plain string sentence; never an object or nested fields.
Confidence values must be exactly one of: low, medium, high.
Top-level confidence is the minimum confidence across all decisions; if there are no decisions, it is medium.
Do not return numeric confidence values.
Do not wrap the JSON in markdown fences.
```

User message template (interpolates only `productId`, `sourceType`, `promptVersion`, `normalizedText`):

```
Product: {productId}

Source type: {sourceType}

Prompt version: {promptVersion}

Normalized source:
{normalizedText}

Return only JSON. The top-level confidence field is required.
```

## Cost & timing

- Per run: ~$0.003 (commercial Nova Pro, ~600 input tokens, ~250 output tokens, temperature 0)
- Total iteration cost across `eval-1` → `eval-3` → AC-8 cleanup → 3 stability runs each = **~12 calls ≈ $0.04**
- Per-call latency: ~3 seconds end-to-end on us-east-1

## Phase 2 handoff

The accumulated per-document JSON now flows to `state.sourceExtractions[]` via `semanticPublication.service.js` (already implemented in production). The next phase consumes that accumulator:

1. **Aggregate prompt**: build a NEW generic prompt that takes `{productId, productName, sourceExtractions[]}` and produces `{status: healthy|caution|risk, statusLabel, drivers[], riskFactors[], confidence}`. Validate with `aggregateValidation.service.js`'s existing schema.
2. **Wire it**: write the aggregate output to `state.productAggregates[]` (already implemented as a write target). Replace the seed-driven `latestStatus = latestEntry.statusSignal` in `server/src/services/ingest/corpusImport.service.js:1106` with a read of the latest aggregate.
3. **Iterate the same way**: clone this harness shape (`scripts/prompt-eval/aggregate-run.mjs`), define expected aggregates per product, iterate against live Bedrock.
4. **Widen the gate**: `server/src/services/semantic/executionPolicy.service.js:39-46` requires `productId === 'dental'`. Phase 2 will need to remove that constraint for the aggregate path (and almost certainly for the per-doc path too, once we want essence/optima to extract live).
5. **Project context injection**: extend `buildExtractionUserPrompt` to interpolate `productName` (currently only `productId`) and a one-line digest of recent extractions. Useful for cross-document continuity.
6. **GovCloud parity**: re-run the same harness against `us-gov-west-1` with the same prompt. Should pass identically (model is the same).
7. **UI assertions**: the Playwright lifecycle spec already asserts the badge text — once Phase 2 widens the gate AND the aggregate prompt drives the status, those assertions become true end-to-end semantic assertions, not seed assertions.

## Definition of done — checklist

- [x] All ACs above pass
- [x] `scripts/prompt-eval/run.mjs`, `expected/ingest-28.json`, and `README.md` checked in (not committed; staged status pending user direction)
- [x] Final iterated prompt strings live in `novaSourceExtraction.service.js` as `EXTRACTION_SYSTEM_PROMPT` (single source of truth — harness imports it)
- [x] Last-good live response saved under `scripts/prompt-eval/runs/`
- [x] This implementation document written
