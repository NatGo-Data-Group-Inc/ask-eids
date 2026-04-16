# Nova Extraction FSFS Task Tracker

| Attribute | Detail |
| :--- | :--- |
| Task | Full-Stack Feature Specification for Nova Pro-driven corpus extraction and UI state |
| Status | Complete |
| Owner | Codex |
| Last Updated | 2026-04-15 20:12:00 local |
| Primary Deliverable | `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md` |

## Objective
Generate a complete FSFS for migrating AskEIDS toward Nova Pro-driven semantic extraction so Dental / DenClass UI state is influenced by model-produced JSON rather than deterministic semantic parsing.

## Locked Decisions
- Rollout is Dental-first; Optima and ESSENCE remain legacy-derived temporarily.
- Live Nova Pro is used for local prompt/eval iteration; replay/cached outputs are required for automated tests and E2E stability.
- Deterministic handling remains for normalization, OCR fallback, fixed-schema structured exports, validation, persistence, and read-model projection.
- Nova Pro owns semantic extraction and aggregation.

## Deliverables
- [x] FSFS written to `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`
- [x] Continuity ledger created/updated for this task
- [ ] Final summary returned with concrete follow-on options

## Verification
- Verified the FSFS exists at `PRD/20260415-194909-CODEX-NovaExtractionDentalFSFS.md`.
- Verified the document includes architecture, API contract, phased plan, acceptance criteria, Playwright proof stubs, frontend handoff, backend handoff, non-goals, and appendix sections.
- Verified the document now aligns Playwright selector usage with the current app where possible and explicitly marks required new selectors where current coverage is insufficient.
- Verified the document now defines an internal reset/replay admin contract, gold semantic-accuracy thresholds, sharper structured-row truth boundaries, richer aggregate versioning metadata, and explicit anti-semantic-fallback language.
