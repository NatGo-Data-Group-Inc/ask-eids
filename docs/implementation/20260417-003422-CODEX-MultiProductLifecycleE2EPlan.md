---
name: Multi-Product Lifecycle E2E Plan
description: Plan for a Playwright lifecycle spec that ingests the EIDS Prototype Document Pack one document at a time across dental + essence + optima and validates the green end state across the entire AskEIDS UI surface.
type: implementation
---

# Multi-Product Lifecycle E2E Plan (Dental + Essence + Optima)

## Overview

Build one Playwright end-to-end spec that exercises the **full AskEIDS lifecycle** by ingesting the EIDS Prototype Document Pack **one artifact at a time, in `ingest_order`**, across all three seeded products (`dental`, `essence`, `optima`). After each upload the spec asserts that the corresponding UI surfaces have advanced. After the final upload the spec asserts a fixed **green end state** across portfolio, product overview, sources, data, reports, and ask.

The existing `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` covers dental in isolation and is the proven pattern this plan extends. The new spec is **net-new** — it does not replace the dental-only spec; it widens the lens to multi-product and adds the strict end-state assertions that pin down the "green test result" the user asked us to define first.

## Scope

**In scope**
- A single Playwright file: `tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js`.
- A shared helper module: `tests/e2e/lifecycle/eids-pack-lifecycle.helpers.js` (generalises the existing dental helpers to take a `productId` filter or include all products).
- Reset to `wave-00-baseline`, then upload all 29 non-baseline manifest rows in `ingest_order`, interleaving products as the manifest dictates.
- Per-upload assertion that the artifact surfaces in its product's Sources tab.
- After each wave boundary, an interim assertion against the affected product(s).
- A final **green end-state block** asserting portfolio cards, status badges, sources lists, data tabs, ask answers, and report generation across all three products.
- A `report-generate` step exercised on dental (the only product with a multi-wave story rich enough to drive a meaningful report).

**Out of scope (this iteration)**
- Modifying server, ingest, or seed code.
- Changing the existing dental-only lifecycle spec.
- Power-user features (export, weekly-update mutation, connector sync).
- Read-only / role-permission matrix coverage (separate specs already exist).

## Assumptions and Constraints

1. `POST /api/v1/test/reset` with `{ corpusWave: 'wave-00-baseline' }` seeds **all three products at baseline** simultaneously. Verified by the manifest (15 dental + 5 essence + 7 optima baseline rows, all under the same wave folder) and the reset handler in `server/src/app.js:416-444` that re-runs `buildInitialCorpusState` for the configured `maxWave`.
2. Upload contract is unchanged: `POST /api/v1/products/:productId/sources` accepts multipart `file` + `metadataFile` and returns `{ status, sourceId, jobId? }`. Confirmed at `server/src/app.js:266-281` and consumed today by `tests/e2e/lifecycle/dental-pack-lifecycle.helpers.js:147-199`.
3. The durable job pump (`ensureDurableJobPump` in `server/src/app.js:112-125`) drains pending jobs in the background; the helper's existing strategy of polling the Sources tab for the new `source-item-{sourceId}` is sufficient — no direct `/api/v1/jobs/:jobId` polling is needed.
4. Manifest source-of-truth is `EIDS-Prototype-Document-Pack/00-operator-guide/MASTER-MANIFEST.csv`. Synthetic content is generated only when the listed `relative_path` does not exist on disk (existing helper behaviour preserved).
5. The product status badge maps `status_signal` → label via `labelForStatus()` in `server/src/services/ingest/corpusImport.service.js:243`: `healthy → "On Track"`, `risk → "At Risk"`, anything else → `"Caution"`. The badge text is what the spec asserts; the underlying `product.status` enum is implementation detail. The product's *current* label is derived from the latest-dated entry, not the latest `ingest_order`.
6. The seeded portfolio includes exactly `dental`, `essence`, `optima` at the time of writing. If a fourth product is later added, the spec should fail loudly on the portfolio-cards assertion so the test gets updated intentionally.
7. Test runtime: ~29 sequential uploads × ~3–6s per cycle ≈ 90–180s. `test.setTimeout(600000)` (10 min) gives generous headroom and matches the 480000 currently used by the dental-only spec.

## Wave-by-Wave Behaviour Reference

Pulled from `MASTER-MANIFEST.csv`. `*` = no documents in this wave for that product.

| Product   | wave-00 baseline (seeded) | wave-01 operational | wave-02 escalation | wave-03 recovery | Final badge |
|-----------|---------------------------|----------------------|---------------------|-------------------|-------------|
| dental    | 15 (mixed: baseline/caution/healthy) | 8 (1 healthy, 1 caution, 6 risk) | 9 (8 risk, 1 caution) | 7 (all caution — recovery, latest 2026-04-16) | **Caution** |
| essence   | 5 (all risk)              | * | 2 (both risk, latest 2026-04-12) | * | **At Risk** |
| optima    | 7 (all healthy)           | 2 (both healthy) | * | 1 (healthy, latest 2026-04-16)         | **On Track** |

Total uploads driven by the spec: **29** (24 dental + 2 essence + 3 optima), interleaved by `ingest_order`.

## Acceptance Criteria

### Global (run once at the end)
- **AC-G-01** Portfolio shows three cards: `product-card-dental`, `product-card-essence`, `product-card-optima`.
- **AC-G-02** Portfolio card status text matches: dental = `Caution`, essence = `At Risk`, optima = `On Track`.
- **AC-G-03** Top-nav search for `ESSENCE` returns at least one `search-result-product-essence` entry **and** at least one source result whose label matches `/Document Gap Followup/i` (a wave-02 escalation upload).
- **AC-G-04** Telemetry endpoint accepts a heartbeat from the client (smoke check that the server is still responsive after the full upload sequence).

### Dental (`/products/dental`)
- **AC-D-01** `product-status-badge` text is `Caution`.
- **AC-D-02** Sources tab contains **39** `source-item-*` rows (15 baseline + 24 uploaded).
- **AC-D-03** Sources tab contains a row whose label matches `/Dental Leadership Readout Deck/`.
- **AC-D-04** Sources tab contains a row whose label matches `/Dental Vendor Recovery Call Transcript/`.
- **AC-D-05** Data tab → `data-subtab-blockers` shows `data-row-B-003` (escalated blocker survives recovery wave).
- **AC-D-06** Reports tab: clicking `generate-report-button` produces `report-section-executive-summary` within 60 s, **and** the section text contains a recovery-wave keyword (regex `/recovery|remediation|mitigated/i`).
- **AC-D-07** Ask box: `"What evidence supports the recovery path?"` returns `ask-answer` containing at least one `ask-source-type-chip` and zero `ask-evidence-gap-warning` elements.

### Essence (`/products/essence`)
- **AC-E-01** `product-status-badge` text is `At Risk`.
- **AC-E-02** Sources tab contains **7** `source-item-*` rows (5 baseline + 2 uploaded).
- **AC-E-03** Sources tab contains a row whose label matches `/ESSENCE Handoff Working Session Transcript/`.
- **AC-E-04** Sources tab contains a row whose label matches `/Document Gap Followup/`.
- **AC-E-05** Ask box: `"What blockers are open on the ESSENCE handoff?"` returns `ask-answer` with at least one citation chip.

### Optima (`/products/optima`)
- **AC-O-01** `product-status-badge` text is `On Track`.
- **AC-O-02** Sources tab contains **10** `source-item-*` rows (7 baseline + 3 uploaded).
- **AC-O-03** Sources tab contains a row whose label matches `/Optima Weekly Update — April 16/` (the wave-03 recovery confirmation).
- **AC-O-04** Sources tab contains a row whose label matches `/Optima Decision Log Update/` (a wave-01 operational upload).
- **AC-O-05** Ask box: `"What was the latest Optima weekly update?"` returns `ask-answer` with no `ask-degraded-banner`.

### Per-upload micro-assertion (runs 29 times)
- **AC-P-01** After each `POST /api/v1/products/:productId/sources` returns a 2xx, the new `source-item-{sourceId}` becomes visible on the corresponding product's Sources tab within 30 s.

## Definition of Done

A feature is complete only when:
1. All AC-G, AC-D, AC-E, AC-O, and AC-P criteria above are mapped to one or more concrete Playwright `expect(...)` calls in `eids-pack-multi-product-lifecycle.spec.js`.
2. `npx playwright test tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js` passes locally end-to-end (against `npm run dev`) on a fresh state.
3. The traceability table at the bottom of this document is filled in (criterion → file:line → status).
4. The dental-only spec (`dental-pack-lifecycle.spec.js`) still passes — the new helper extension must not regress it.
5. This implementation document is updated with final pass/fail status, any deviations, and a short post-mortem of surprises.
6. A continuity ledger entry is appended in `ContinuityDocs/` recording: spec landed, ACs satisfied, runtime observed, any flake notes.

## Implementation Plan

### Phase 1 — Helper extension (no test execution yet)
- New file: `tests/e2e/lifecycle/eids-pack-lifecycle.helpers.js`.
- Export `loadEidsLifecycleArtifacts({ productIds })`: same parser as the dental helper but with optional `productIds` filter (default = `['dental','essence','optima']`).
- Export `uploadLifecycleArtifact(page, descriptor)`: navigate to `/products/${descriptor.productId}?tab=overview` (parameterised — current dental helper hard-codes `dental`), then identical upload modal flow.
- Export `waitForArtifactToSurface(page, descriptor, uploadPayload)`: parameterise the product navigation the same way.
- The existing `dental-pack-lifecycle.helpers.js` is **not modified**; it stays as-is so the dental-only spec is untouched.

### Phase 2 — Spec authoring
- New file: `tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js`.
- `test.setTimeout(600000)`.
- `beforeEach`: `await resetAppState(request, { corpusWave: 'wave-00-baseline' })`.
- Body:
  1. **Baseline sanity**: visit `/portfolio`, assert all three cards are present and at their seeded baseline labels (dental = `Caution`, essence = `At Risk`, optima = `Healthy`). (Yes — optima is already healthy at baseline; the lifecycle keeps it that way.)
  2. **Sequential ingest loop**: iterate descriptors sorted by `ingestOrder`. For each: upload, wait for surface, and `test.step` so the trace is readable.
  3. **Per-wave boundary checkpoint** (after the last `ingestOrder` of each wave): visit the affected product's overview, assert badge has not unexpectedly regressed.
  4. **Final green end-state block**: run all AC-G / AC-D / AC-E / AC-O assertions in that order. Dental's report-generate is the longest single step — gate behind a single `await page.getByTestId('generate-report-button').click()` then `expect(...).toBeVisible({ timeout: 60_000 })`.

### Phase 3 — Validation
- Run `npx playwright test tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js --reporter=line`.
- Re-run dental-only spec to confirm no regression: `npx playwright test tests/e2e/lifecycle/dental-pack-lifecycle.spec.js`.
- Capture a single passing-trace screenshot (Playwright's HTML report) and reference its path here.

### Phase 4 — Document closeout
- Update Traceability table (below) with file:line references and status.
- Append continuity ledger entry under `ContinuityDocs/`.

## Test Mapping (to be filled during Phase 3)

| Criterion | Spec / step | Status |
|-----------|-------------|--------|
| AC-G-01   | `eids-pack-multi-product-lifecycle.spec.js:` _step "Final portfolio state"_ | planned |
| AC-G-02   | same | planned |
| AC-G-03   | _step "Top-nav search verification"_ | planned |
| AC-G-04   | _step "Telemetry smoke"_ | planned |
| AC-D-01..07 | _step "Dental green end state"_ | planned |
| AC-E-01..05 | _step "Essence green end state"_ | planned |
| AC-O-01..05 | _step "Optima green end state"_ | planned |
| AC-P-01   | per-upload `waitForArtifactToSurface` call inside the ingest loop | planned |

## Risks

- **Async report generation timing.** Dental's report uses the durable job pump; if the system is under load the 60 s ceiling could flake. Mitigation: bump to 90 s on first run if observed.
- **Source-count assertions are brittle.** If the seed corpus is later changed (new baseline doc added), AC-D-02 / AC-E-02 / AC-O-02 will fail. That is intentional — the count is part of the green contract — but the failure must point engineers back to this document.
- **Per-upload surface wait may race.** The existing dental spec already handles this by polling the Sources tab; we inherit that strategy. If the harness ever returns `sourceId: null`, the helper falls back to text matching by title (already implemented).
- **Multi-product interleaving.** If `ingestOrder` is reshuffled in a future manifest revision, the spec still works because it sorts by `ingestOrder` at runtime.

## Implementation Checklist

- [ ] Phase 1 — extract `eids-pack-lifecycle.helpers.js` from the dental helper, generalise on `productId`.
- [ ] Phase 2 — author `eids-pack-multi-product-lifecycle.spec.js` with all ACs realised as `expect(...)` calls.
- [ ] Phase 3 — run new spec end-to-end, capture report path, re-run dental-only spec for regression.
- [ ] Phase 4 — update Test Mapping table to `passing` with file:line references.
- [ ] Phase 4 — append continuity ledger entry.

## Current Status

- **2026-04-17 00:34 UTC** — Plan authored after option-1 confirmation. No code written yet. Awaiting user go-ahead to start Phase 1.
