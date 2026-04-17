### Lessons Learned (mutable - replace/update this section)
* The EIDS-Prototype-Document-Pack manifest already encodes the full multi-product lifecycle; do not invent new fixtures when the manifest answers the question.
* The existing `dental-pack-lifecycle.helpers.js` is a strong template — generalise on `productId` rather than copying.
* The product status badge text (`Healthy` / `Caution` / `At Risk`) is the user-visible contract; assert against label text, not the underlying enum.

---

### Ledger Entries (append-only)

## Entry - 2026-04-17 00:34 UTC

**Goal**
* Identify a complete AskEIDS lifecycle e2e flow that ingests documents one at a time and updates the UI, define the green end state, and write a Playwright plan.

**Constraints/Assumptions**
* User chose option 1: use the EIDS-Prototype-Document-Pack across `dental + essence + optima`. AgenticDataCatalog-NoDocker pack ruled out (no manifest, no metadata, no product mapping).
* Plan only — no test code written yet.
* Existing `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` must keep passing; new spec is additive.

**Key Decisions**
* New file: `tests/e2e/lifecycle/eids-pack-multi-product-lifecycle.spec.js`.
* New helper: `tests/e2e/lifecycle/eids-pack-lifecycle.helpers.js` (parameterised on `productId`); the dental helper is left untouched.
* Reset to `wave-00-baseline` (seeds all three products), then upload all 29 non-baseline manifest rows in `ingest_order`, interleaved across products.
* Final green end state: dental = `Caution`, essence = `At Risk`, optima = `Healthy`. Sources tab counts: 39 / 7 / 10. Reports + Ask asserted on dental; Ask asserted on all three.

**State**
* Done:
  * Mapped lifecycle UI surfaces (5 product tabs + portfolio + top-nav search).
  * Verified upload path: `POST /api/v1/products/:productId/sources` (multipart) → durable job pump → Sources tab `source-item-{sourceId}`.
  * Inventoried both candidate doc packs; confirmed AgenticDataCatalog mismatch.
  * Authored `docs/implementation/20260417-003422-CODEX-MultiProductLifecycleE2EPlan.md` with full ACs and DoD.
* Now: awaiting user go-ahead to start Phase 1 (helper extraction).
* Next: Phase 1 → Phase 2 → run + traceability fill-in.

**Open Questions**
* None blocking. Plan is approvable as written.

**Working Set**
* `docs/implementation/20260417-003422-CODEX-MultiProductLifecycleE2EPlan.md`
* `tests/e2e/lifecycle/dental-pack-lifecycle.spec.js` (reference)
* `tests/e2e/lifecycle/dental-pack-lifecycle.helpers.js` (helper to generalise)
* `EIDS-Prototype-Document-Pack/00-operator-guide/MASTER-MANIFEST.csv` (source of truth)
* `client/src/App.jsx` (UI selectors of record)
* `server/src/app.js` (routes + reset handler)

**Notes / Outcomes**
* Per-product wave coverage: dental waves 00→03 (full), essence waves 00 + 02 only, optima waves 00 + 01 + 03 only — confirmed against manifest counts.
* Total uploads driven by spec: 29 (24 dental + 2 essence + 3 optima).
