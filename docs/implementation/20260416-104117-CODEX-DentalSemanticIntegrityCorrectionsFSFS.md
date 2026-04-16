# Dental Semantic Integrity Corrections FSFS Tracker

| Attribute | Detail |
| :--- | :--- |
| Task | Write a corrective FSFS for the confirmed Dental semantic integrity issues |
| Status | Completed |
| Owner | Codex |
| Last Updated | 2026-04-16 11:24:38 local |
| Output PRD | `PRD/20260416-104117-CODEX-DentalSemanticIntegrityCorrectionsFSFS.md` |
| Continuity Ledger | `ContinuityDocs/20260416-045835-CODEX-NovaDentalFollowOnPhasesFSFSExecution.md` |

## Overview

This tracker covers specification work only. The purpose is to produce an implementation-ready FSFS that corrects the confirmed Dental semantic integrity issues in the current path:

1. Replay mode is heuristic generation instead of cache-backed replay truth.
2. Report trust messaging renders as a warning even in fresh states.
3. Extraction output is JSON-parsed but not schema-validated before persistence/publication.
4. Runtime feature flags exist but do not actually control the behavior they claim to gate.
5. Aggregate publication provenance is blurred because published aggregate records point at source-extraction runs.
6. Aggregate payloads can still be malformed unless publication output is validated before publish.
7. Older async jobs can overwrite newer valid aggregate state unless publication is monotonic.
8. The report contract and report E2E examples must stay aligned with the current flat route shape and current report entry flow.

The corrective FSFS must preserve the existing route shell, the current React/Vite + Express architecture, and the stable user-facing selectors that already exist, including `overview-current-state`.

## Acceptance Criteria Focus

### Global

- [ ] The FSFS defines replay as cache-backed artifact lookup keyed by normalized input hash, prompt version, model id, and source family.
- [ ] The FSFS explicitly forbids heuristic replay generation and requires fail-closed behavior on replay cache miss.
- [ ] The FSFS defines authoritative source and aggregate validation contracts using AJV/schema validation before persistence or publication.
- [ ] The FSFS makes report warning visibility backend-authoritative and eliminates false warning banners in fresh report states.
- [ ] The FSFS makes `ENABLE_DENTAL_TRUST_SURFACES` and `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` real behavior gates rather than dead config.
- [ ] The FSFS requires distinct aggregate publication provenance separate from source extraction provenance.
- [ ] The FSFS defines monotonic publication rules so older async jobs cannot overwrite newer valid aggregate state.
- [ ] The FSFS preserves existing routes and stable selectors unless a change is explicitly justified.

### Frontend

- [ ] Product, Ask, Source Detail, and Reports retain current page composition in `client/src/App.jsx`.
- [ ] Reports render `report-semantic-state-banner` only when the backend marks the banner visible.
- [ ] Trust surfaces disappear when the trust-surface flag is off.
- [ ] Fresh reports do not present warning styling.

### Backend

- [ ] Replay store, extraction validation, feature-flag gating, and aggregate provenance each have dedicated module or contract ownership.
- [ ] `GET /api/v1/session` and `POST /api/v1/test/reset` become the authoritative feature-flag handshake for the frontend and test harness.
- [ ] The semantic service split is controlled by the real runtime flag path, not by persisted `featureMode` strings.

## Definition of Done

- [x] The PRD exists in `PRD/` with a timestamped filename and full FSFS structure.
- [x] The PRD contains a unified API contract, phased FE/BE plan, strict acceptance criteria, and Playwright proof mapping.
- [x] The PRD explicitly covers all five confirmed issues and preserves the existing `overview-current-state` selector as non-work.
- [x] This tracker reflects the final document path and current drafting status.
- [x] The continuity ledger is updated with the new spec artifact paths and key decisions.

## Test Mapping Intent

| Corrective Area | Planned Proof |
| :--- | :--- |
| Replay truth and cache miss behavior | Backend unit/integration tests + full-stack replay hit/miss Playwright |
| Extraction schema validation | Backend unit/integration tests + failure-state E2E |
| Honest report trust banner behavior | Frontend component tests + seeded fresh/degraded report Playwright |
| Real feature-flag gating | Session/reset contract tests + frontend gating tests + E2E flag-on/flag-off proof |
| Aggregate publication provenance and monotonic publish integrity | Backend integration and repository tests |

## Implementation Checklist

- [x] Confirm the valid issues against the current codebase.
- [x] Re-scan the frontend, backend, runtime config, and E2E helper paths relevant to the fixes.
- [x] Create the timestamped tracker.
- [x] Write the timestamped corrective FSFS.
- [x] Append the continuity ledger with the new spec paths and decisions.

## Working Set

- `client/src/App.jsx`
- `client/src/lib/api.js`
- `client/src/styles/runtime.css`
- `server/src/app.js`
- `server/src/config/runtime.js`
- `server/src/services/domain/mutation.service.js`
- `server/src/services/domain/readModel.service.js`
- `server/src/services/domain/ask.service.js`
- `server/src/services/semantic/novaSourceExtraction.service.js`
- `server/src/services/semantic/semanticPublication.service.js`
- `server/src/services/ingest/corpusImport.service.js`
- `server/src/services/state/runtimeState.repository.js`
- `tests/e2e/helpers/novaLifecycle.js`
- `tests/e2e/dental-live-email-upload.spec.js`
- `tests/e2e/dental-report-trust.spec.js`

## Notes

- Existing code already contains a semantic services directory and trust-surface UI, so this FSFS is a corrective hardening spec rather than a greenfield design.
- The new spec now adds aggregate validation, monotonic publish protection, explicit replay hashing/artifact rules, flat report-route preservation, and seeded-report E2E flow corrections.
- The new spec should remove `featureMode` as a behavior-control mechanism while preserving temporary backward compatibility only where necessary for non-production reset flows.
