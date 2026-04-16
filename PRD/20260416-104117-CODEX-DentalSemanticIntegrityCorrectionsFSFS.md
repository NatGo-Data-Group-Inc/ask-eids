# Full-Stack Feature Specification: Dental Semantic Integrity Corrections

## 1. Document Overview

| Attribute | Detail |
| :--- | :--- |
| Document Title | Full-Stack Feature Specification: Dental Semantic Integrity Corrections |
| Status | Draft |
| Version | 1.0 |
| Date Last Updated | April 16, 2026 |
| Technical Lead | Codex |
| UX Lead | Codex |
| Target Frontend | AskEIDS React 18 + Vite SPA rooted in `client/src/App.jsx` with API helpers in `client/src/lib/api.js` |
| Target Backend | AskEIDS Node.js + Express service with DuckDB runtime state, filesystem artifact store, and Bedrock-compatible text generation |
| Source System | The current partially implemented Dental semantic path in `server/src/services/semantic/`, `server/src/services/domain/mutation.service.js`, and `server/src/services/ingest/corpusImport.service.js` |
| Runtime Environment | Local/dev Node + React, GovCloud-compatible Bedrock runtime for live proof where available, filesystem runtime artifacts, DuckDB runtime state |
| Existing UI Library | No third-party component library detected; custom React views and custom styling in `client/src/styles/runtime.css` plus CSS variables defined in `index.html` |
| Key Dependencies | `react`, `react-router-dom`, `@tanstack/react-query`, `express`, `duckdb`, `ajv`, `multer`, `mailparser`, `mammoth`, `pdf-parse`, `@aws-sdk/client-bedrock-runtime`, `@playwright/test`, `vitest` |

**Assumptions:**
- The current code already includes semantic service boundaries for execution policy, source normalization, extraction, freshness, and publication, but those boundaries are not yet semantically trustworthy.
- The current route shell remains the product UX anchor: `/portfolio` and `/products/:productId?tab=overview|timeline|data|sources|reports` stay intact.
- `GET /api/v1/session` already exists and can be extended to carry effective feature flags to the frontend.
- The runtime `evalCacheDir` in `server/src/config/runtime.js` is the correct replay-cache root for deterministic extraction replay artifacts.
- `overview-current-state` is already present in the current `client/src/App.jsx`; if any branch or refactor path lacks it, this corrective scope must add and preserve it.
- Non-production reset behavior may continue to exist, but it must stop acting as the hidden authority for feature behavior.

**Open Questions (Resolved Pre-Generation):**
- Replay truth boundary: replay means cache-backed model output lookup only. Heuristic semantic generation is not replay and is prohibited.
- Extraction validation boundary: parseable JSON is insufficient; AJV/schema validation is required before persistence, citation projection, or publication.
- Aggregate validation boundary: aggregate/publication payloads are schema-validated before publish and before any published aggregate record is replaced.
- Trust-banner authority: the backend returns explicit banner visibility and tone metadata. The frontend must not infer warning state from message presence alone.
- Flag authority: runtime feature flags plus explicit non-production reset overrides are authoritative. `featureMode` strings are deprecated and may only survive as backward-compatible reset aliases during migration.
- Aggregate provenance: `publishedFromRunId` must refer to a dedicated aggregate publication run, never to the source-extraction run.
- Publish monotonicity boundary: an older async job may not overwrite a newer valid published aggregate. Publication must use a monotonic compare-and-swap guard keyed by aggregate version, evidence version, or source-set hash.

## 2. Feature Summary & Target End State

### 2.1 Executive Summary

This corrective FSFS hardens the current Dental semantic implementation so the system’s trust claims become true in both code and UX. The existing direction is sound, but three core trust boundaries are currently blurred: replay is not real replay, extraction validity is not truly validated, and rollout flags do not actually gate behavior. A fourth issue then leaks into the UX: reports display warning-style semantic trust banners even when the state is fresh. A fifth issue weakens auditability: published aggregates point to source runs instead of distinct aggregate publication runs.

The target end state is a system where:
- replay mode reads previously captured extraction payloads from a real replay store and fails closed on cache miss;
- all live and replay extraction payloads are schema-validated before they can influence source detail, Ask, reports, or product state;
- aggregate/publication payloads are schema-validated before publish;
- feature flags named in runtime configuration actually control UI trust surfaces and the semantic service split;
- fresh reports do not show warning banners;
- degraded/stale reports do show warning banners with explicit backend-controlled visibility;
- stale async publication attempts are rejected when a newer valid aggregate is already published;
- aggregate publication provenance is distinct from source extraction provenance and traceable through `state_prompt_runs` and `state_product_aggregates`.

### 2.2 Concrete Changes Inventory

| # | Layer | Location | Change Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| 1 | BE | `server/src/services/semantic/novaSourceExtraction.service.js` | Modified | Replace heuristic replay generation with cache-backed replay lookup and typed cache-miss failure. |
| 2 | BE | `server/src/services/semantic/semanticReplayStore.service.js` | New | Add a replay-store boundary responsible for replay key creation, cache reads, cache writes, and replay metadata. |
| 3 | BE | `server/src/services/semantic/extractionValidation.service.js` + schema files | New | Add AJV-backed schema validation for source extraction payloads before persistence/publication. |
| 4 | BE | `server/src/services/semantic/aggregateValidation.service.js` + schema files | New | Add AJV-backed schema validation for aggregate/publication payloads before publish. |
| 5 | BE | `server/src/services/domain/mutation.service.js` + orchestrator path | Modified | Route semantic behavior through real flags, not `featureMode`, and preserve last-known-good state on replay miss or invalid extraction. |
| 6 | BE | `server/src/services/semantic/semanticPublication.service.js` | Modified | Emit a dedicated aggregate publication run, enforce monotonic compare-and-swap publication, and ensure `publishedFromRunId` references the aggregate run. |
| 7 | Both | `server/src/app.js`, `client/src/App.jsx` | Modified | Make report trust banner visibility backend-authoritative and suppress the banner in fresh states while preserving the current flat report API shape. |
| 8 | Both | `GET /api/v1/session`, `POST /api/v1/test/reset` | Modified | Expose effective feature flags and make non-production overrides explicit, structured, and observable. |
| 9 | FE | `client/src/App.jsx` | Modified | Stop surfacing `featureMode` as a user-facing semantic indicator; use real trust/provenance state instead. |
| 10 | Both | Vitest + Playwright coverage | Modified | Add replay-hit, replay-miss, invalid-extraction, fresh-report, degraded-report, flag-gating, and monotonic-publication proof. |

### 2.3 Target End State Description

When this corrective scope is complete, a Dental email upload in replay mode will either read a real cached extraction artifact and continue through validation, citation projection, aggregate validation, and monotonic publication, or it will fail with an explicit replay-cache-miss outcome that preserves the last known good aggregate. A Dental email upload in live mode will produce model output that is schema-validated before it can be stored or projected. Aggregate publication attempts from older jobs will be rejected when a newer valid aggregate is already active. Reports will only display `report-semantic-state-banner` when the backend marks the semantic state as degraded or stale, and the route shape for reports will remain flat so the current frontend contract stays stable. Operators will be able to trust the named feature flags because those flags will actually control rendering and execution. Aggregate publication history will be auditable because source extraction runs and aggregate publication runs will be distinct records.

## 3. User Research & Context

### 3.1 Target User Personas

**Persona 1: Dental Product Manager / Evidence Owner**
- Role/Context: Uploads Dental evidence, checks Sources, and relies on Ask and reports.
- Goals: Trust that a replay-backed or live-backed semantic refresh is real, not fabricated.
- Pain Points: A successful-looking upload currently does not prove replay truth or schema validity.
- Technical Proficiency: Intermediate
- Usage Frequency: Daily

**Persona 2: Leadership Reviewer**
- Role/Context: Consumes reports and Ask answers without reading engineering logs.
- Goals: Avoid false warning states when the current product understanding is actually fresh.
- Pain Points: Warning-style report banners currently look degraded even when the semantic state is fine.
- Technical Proficiency: Beginner to Intermediate
- Usage Frequency: Weekly

**Persona 3: Product/Platform Operator**
- Role/Context: Manages rollout risk, validates prompt changes, and debugs semantic state issues.
- Goals: Trust that replay, live execution, and aggregate provenance mean what the system says they mean.
- Pain Points: Current flags over-promise control, and current provenance does not separate extraction from publication.
- Technical Proficiency: Advanced
- Usage Frequency: As needed during rollout and incident analysis

### 3.2 User Problem Statement

As a Dental user or operator, I need semantic execution, trust messaging, and provenance to reflect the actual backend behavior, because otherwise I cannot tell whether a semantic update was truly replayed, truly validated, honestly fresh, or properly published.

### 3.3 Success Criteria

**User-Facing:**
- Fresh reports render without a warning-style semantic banner.
- Degraded or stale reports render with an explicit warning banner driven by backend state.
- Trust surfaces disappear when the trust-surface feature flag is disabled.
- Upload failures caused by replay cache miss or invalid extraction explicitly state that product understanding was not refreshed and last known good state remains active.

**System-Level:**
- 100% of replay-mode Dental source extractions either read a replay artifact from cache or fail with `REPLAY_CACHE_MISS`; none silently fabricate extraction output.
- 100% of persisted Dental source extractions marked `validationStatus=valid` have passed AJV/schema validation.
- 100% of published Dental aggregates marked valid have passed aggregate-schema validation before publish.
- 100% of published Dental aggregates set `publishedFromRunId` to a prompt run whose role/scope is aggregate publication.
- 100% of stale publication attempts are rejected when a newer valid aggregate has already been published.
- `ENABLE_DENTAL_TRUST_SURFACES` and `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` each cause a measurable behavior change in backend response shapes and/or frontend rendering.
- Required Playwright proof passes in both headed and headless modes, with one explicit local-only Bedrock-backed proof path documented for environments where live Bedrock is available.

## 4. User Flows & End-to-End Data Flow

### 4.1 Primary User Flow A: Replay Cache Hit Upload

**Entry Point:** User opens `/products/dental?tab=overview` in replay mode with trust surfaces and service split enabled.

1. **Submit Dental email**
   - User action: Uploads a `.eml` artifact from the existing upload modal.
   - UI response: Existing modal and processing panel remain. Status indicates replay extraction, not live extraction.
   - API call: `POST /api/v1/products/dental/sources`
   - Backend processing: Resolve effective flags -> resolve execution policy -> normalize source -> compute replay key -> read replay artifact from cache -> validate extraction schema -> project citations -> publish aggregate using service split if enabled -> refresh runtime state.
   - API response: `202 Accepted` with `jobId`, `sourceId`, `effectiveExecutionMode`, and `effectiveFeatureFlags`.
   - UI transition: Processing panel updates, then Overview/Sources/Ask/Reports refresh against new published state.

2. **Observe refreshed state**
   - User action: Waits for completion or navigates to Sources/Reports.
   - UI response: Sources show the new source, report page remains fresh, and no report warning banner appears if the aggregate published successfully.
   - API calls: `GET /api/v1/jobs/:jobId`, `GET /api/v1/products/:productId`, `GET /api/v1/products/:productId/sources`, `GET /api/v1/products/:productId/reports/:reportId`
   - Backend processing: Read latest published aggregate, latest extraction record, and surface-specific trust banner contract.
   - API response: Existing route shapes with corrected semantic visibility fields.
   - UI transition: Report view omits `report-semantic-state-banner` because `showBanner=false`.

### 4.2 Primary User Flow B: Replay Cache Miss

1. **Submit Dental email in replay mode without matching cache artifact**
   - API call: `POST /api/v1/products/dental/sources`
   - Backend processing: Resolve replay mode -> normalize -> compute replay key -> cache miss.
   - Backend result: No extraction payload is synthesized. Job ends failed/partial with `REPLAY_CACHE_MISS` and last known good aggregate remains active.
   - UI transition: Processing panel/error state explains that replay evidence was unavailable and product understanding did not refresh.

### 4.3 Primary User Flow C: Fresh vs Degraded Reports

1. **Open report in fresh state**
   - API call: `GET /api/v1/products/dental/reports/:reportId`
   - Backend processing: Compute semantic freshness and presentation contract.
   - API response: `semanticState.showBanner=false`, `semanticState.message=null`, `semanticState.bannerTone=null`.
   - UI transition: Coverage/regeneration surfaces remain, but `report-semantic-state-banner` is absent.

2. **Open report in degraded/last-known-good state**
   - API call: same route.
   - Backend processing: Semantic freshness detects degraded/stale state.
   - API response: `semanticState.showBanner=true`, `semanticState.bannerTone='warning'`, `semanticState.message='This report reflects the last published product understanding...'`.
   - UI transition: `report-semantic-state-banner` is visible with warning styling.

### 4.4 Alternative Flows & Edge Cases

- **Invalid live extraction:** Bedrock returns JSON that parses but fails schema validation. The source is stored, extraction is marked invalid, and publication does not proceed.
- **Trust surfaces disabled:** Session feature flags return `enableDentalTrustSurfaces=false`; the frontend does not render freshness/citation trust UI even if backend semantic state exists.
- **Service split disabled:** Uploads use the current coordinator path, but only when the service-split flag is off. The flag must be the authority, not `featureMode`.
- **Legacy reset request:** A non-production test reset may still send `featureMode`; the backend may translate it to explicit flags temporarily but must emit a deprecation warning and persist explicit flag state.

### 4.5 Backend Data Flow (Corrected Pipeline Stages)

**Stage 1: Effective Feature Resolution**
- Input: runtime env flags, persisted semantic config, optional non-production reset overrides.
- Processing: Compute effective flags for trust surfaces, live email, replay mode, and service split.
- Output: `SemanticFeatureEnvelope`.
- Failure mode: invalid override shape fails closed and returns `VALIDATION_ERROR`.

**Stage 2: Execution Policy Resolution**
- Input: `SemanticFeatureEnvelope`, product id, source family, runtime mode.
- Processing: Decide `live`, `replay`, or `disabled`.
- Output: `SemanticExecutionDecision`.
- Failure mode: disabled policy returns explicit execution-disabled behavior.

**Stage 3: Source Normalization**
- Input: raw email artifact.
- Processing: normalize text, headers, line map, preview, stable normalization version.
- Output: `NormalizedSourcePayload`.
- Failure mode: normalization failure prevents extraction.

**Stage 4: Extraction Acquisition**
- Input: normalized payload + execution decision.
- Processing: if `live`, call Bedrock and capture raw JSON; if `replay`, compute replay key and read the replay store.
- Output: raw extraction JSON + provider/replay metadata.
- Failure mode: replay miss throws `REPLAY_CACHE_MISS`; no heuristic fallback allowed.

**Stage 5: Extraction Validation**
- Input: raw extraction JSON.
- Processing: validate with AJV schema.
- Output: `ValidatedSourceExtraction`.
- Failure mode: throw typed `EXTRACTION_INVALID` with validation error details; no publication.

**Stage 6: Citation Projection**
- Input: validated extraction + normalization coordinate map.
- Processing: resolve exact or fallback citations.
- Output: `CitationProjectionResult`.
- Failure mode: explicit fallback mode, but only after extraction is valid.

**Stage 7: Aggregate Assembly & Validation**
- Input: validated extraction, current aggregate, feature envelope.
- Processing: assemble next aggregate payload, compute source-set hash / publication guard, and validate the aggregate with AJV schema.
- Output: `ValidatedAggregatePayload`.
- Failure mode: throw `AGGREGATE_INVALID`; preserve last known good aggregate.

**Stage 8: Monotonic Aggregate Publication**
- Input: validated aggregate payload, current aggregate metadata, feature envelope.
- Processing: emit source prompt run, emit aggregate publication run, then replace the published aggregate only if the compare-and-swap guard still matches the latest published state.
- Output: new published aggregate plus provenance records.
- Failure mode: reject stale async publication with `STALE_PUBLICATION_REJECTED`; preserve last known good aggregate and keep the newer published state active.

**Stage 9: Read-Model Shaping**
- Input: runtime state + surface context + feature flags.
- Processing: compute surface-specific banner visibility and remove hidden feature behavior from the public UI when flags are off.
- Output: stable route payloads.
- Failure mode: default conservatively to degraded messaging where appropriate; never fabricate freshness.

## 5. Parity Matrix (Current Corrective Gaps -> Target Behavior)

### 5.1 Module-Level Parity Decisions

| Source Module | Current Behavior | Target Module | Layer | Decision | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `server/src/services/semantic/novaSourceExtraction.service.js` | Uses `buildReplayExtraction()` heuristic generation and `safeJsonParse()` only | `novaSourceExtraction.service.js` + `semanticReplayStore.service.js` + `extractionValidation.service.js` | BE | Adapt / Split | Replay must become real cache-backed replay and extraction must become schema-validated. |
| `server/src/services/semantic/semanticPublication.service.js` | Builds semantic state and aggregate records but does not separate aggregate run provenance | Same module with aggregate run emission | BE | Adapt | Publication provenance must be explicit without inventing a new persistence pattern. |
| `server/src/config/runtime.js` + `server/src/app.js` + reset flow | Defines trust/service-split flags, but runtime behavior still rides on `featureMode` | Same modules with real flag envelope contract | Both | Adapt | Keep current config surface, make it truthful and observable. |
| `client/src/App.jsx` report view | Renders report warning panel whenever `report.semanticState.message` exists | Same module with backend-authoritative `showBanner` contract | FE | Adapt | Prevent false warning banners while preserving the current report layout. |
| `tests/e2e/helpers/novaLifecycle.js` | Reset helper sends `featureMode` strings | Same helper with `featureFlags` object | Both | Adapt | Tests must prove the real runtime behavior gate. |
| `client/src/App.jsx` product header | Displays `featureMode` in the semantic chip | Same module without user-facing `featureMode` text | FE | Adapt | `featureMode` is an internal migration concept, not trustworthy user-facing provenance. |

### 5.2 Behavioral Equivalence Criteria

- `PEQ-001`: Existing routes remain stable.
- `PEQ-002`: Existing selectors remain stable, including `overview-current-state`, `semantic-freshness-badge`, `ask-degraded-banner`, and `report-regenerate-notice`.
- `PEQ-003`: Upload modal, Source Detail drawer, Ask flow, and Reports layout remain additive rather than redesigned.
- `PEQ-004`: Non-Dental portfolio behavior remains unchanged.

### 5.3 Intentional Divergences

- `DIV-001`: Replay cache miss is now a hard semantic failure instead of a hidden deterministic fallback.
- `DIV-002`: Fresh reports no longer show a warning-style semantic banner.
- `DIV-003`: Public semantic UI stops displaying `featureMode` as if it were meaningful runtime provenance.
- `DIV-004`: Published aggregate provenance now points to dedicated aggregate publication runs instead of source-extraction runs.
## 6. Interface Design Requirements

### 6.1 Screen/View Inventory

**View 1: Product Overview**
- Purpose: Show current product understanding, freshness badge, and degraded-state banner only when trust surfaces are enabled.
- Primary Actions: Upload artifact, navigate tabs.
- Data Source: `GET /api/v1/products/:productId` plus `GET /api/v1/session` for effective feature flags.

**View 2: Source Detail Drawer**
- Purpose: Show extraction summary, citation mode, warnings, and provenance limitations.
- Primary Actions: Inspect citations and source trust state.
- Data Source: `GET /api/v1/products/:productId/sources/:sourceId`.

**View 3: Ask**
- Purpose: Show semantic answers and degraded-state disclosure when the published aggregate is stale/degraded.
- Primary Actions: Ask questions, inspect answer sources.
- Data Source: `POST /api/v1/products/:productId/ask`.

**View 4: Reports**
- Purpose: Show report content, regeneration notice, and semantic warning banner only when `showBanner=true`.
- Primary Actions: Generate, regenerate, edit, export.
- Data Source: `GET /api/v1/products/:productId/reports/:reportId`.

**View 5: Session Bootstrap**
- Purpose: Hydrate frontend-visible feature flags and permission scope.
- Primary Actions: None directly.
- Data Source: `GET /api/v1/session`.

### 6.2 Information Architecture

- Primary: current product understanding, freshness status, and visible warning state.
- Secondary: citation exactness/fallback, upload processing outcomes, and report regeneration.
- Tertiary: operator-grade provenance and flag state available through backend fields or debug tooling, not prominently in the end-user header.
- Navigation model: preserve existing top nav and product-tab structure.

### 6.3 Layout & Responsive Requirements

- Preserve the current unsupported-mobile behavior below 1024px.
- Preserve the dense product-view header rhythm.
- Do not add new pages for replay or provenance diagnostics.

## 7. Interaction & Visual Design Specifications

### 7.1 Core Interactions

- **Upload artifact:** Existing modal remains. Processing/failure copy distinguishes `replay cache miss`, `invalid extraction`, `publication failed`, and `state preserved`.
- **Source Detail:** Citation mode and warning surfaces render only when trust surfaces are enabled.
- **Ask:** Existing degraded banner continues, but it should use backend banner visibility/tone if surfaced.
- **Reports:** `report-semantic-state-banner` renders only when `semanticState.showBanner===true`.

### 7.2 Feedback & Confirmation Patterns

- Replay cache miss copy: `Replay evidence is unavailable for this source. Product understanding was not refreshed.`
- Invalid extraction copy: `This source was stored, but AI extraction output failed validation. Last known good state remains active.`
- Publication failure copy: `This source was stored, but product understanding was not refreshed. Last known good state remains active.`
- Fresh report state: no semantic warning banner.

### 7.3 Design System & Component Usage

- Reuse current custom cards, warning panels, badges, modal shells, and drawer patterns in `client/src/App.jsx`.
- No new design system or third-party UI dependency is introduced.

### 7.4 Typography, Color, and Motion

- Preserve `Newsreader` for headings and `Outfit` for body text.
- Reserve warning panel styling for actual warning states only.
- Maintain current reduced-motion behavior.

## 8. Content & Copywriting Requirements

### 8.1 Content Strategy

- Tone: operational, honest, confidence-calibrated, and explicit about preserved state.
- Principle: the UI must never imply freshness or replay truth that the backend has not actually proven.

### 8.2 Required Copy Elements

- Replay cache miss: `Replay evidence is unavailable for this source. Product understanding was not refreshed.`
- Invalid extraction: `This source was stored, but AI extraction output failed validation. Last known good state remains active.`
- Degraded report banner: `This report reflects the last published product understanding. Regenerate after the current evidence refresh completes.`
- Fresh report state: no warning banner copy should render.
- Trust surfaces disabled: no extra copy; the trust UI is hidden rather than replaced with a disabled warning.

### 8.3 Localization Considerations

- English-only.
- Existing date/time formatting conventions remain unchanged.

## 9. Accessibility Requirements

### 9.1 WCAG Compliance

- Maintain WCAG AA contrast and focus expectations.
- Warning state must not rely on color alone; text copy remains required.

### 9.2 Keyboard Navigation

- Report editing, upload modal, and source drawer remain keyboard accessible.
- Hiding trust surfaces behind flags must not leave orphaned focus targets.

### 9.3 Screen Reader Support

- `aria-live` announcements remain in place for upload failures and completion states.
- If a report warning banner appears, it must be announced as new warning content.

## 10. States & Scenarios

### 10.1 All UI States

- **Fresh / Published:** semantic badge visible when enabled; report warning banner absent.
- **Degraded / Last-Known-Good:** semantic badge and warning panel visible when enabled.
- **Replay Cache Miss:** upload ends failed with preserved-state messaging.
- **Invalid Extraction:** upload ends failed/partial with validation-failure messaging.
- **Trust Surfaces Disabled:** no semantic freshness badge, no citation trust chip, no ask/report semantic warning surfaces.
- **Service Split Disabled:** user-visible flow remains stable, but the backend follows the non-split path.

### 10.2 Permission & Role-Based Views

- Lead/Editor: can upload and regenerate reports; sees trust surfaces when enabled.
- Read: sees the same trust-state read surfaces when enabled but cannot mutate.

## 11. Backend Module Design

### 11.1 Module Inventory

**Module 1: Semantic Replay Store**
- File(s): `server/src/services/semantic/semanticReplayStore.service.js`
- Responsibility: compute replay keys and load/store replay extraction artifacts in `evalCacheDir`.
- Inputs: normalized payload, prompt version, model id, source family.
- Outputs: replay payload, cache metadata, cache-hit/miss result.
- Error handling: throw `REPLAY_CACHE_MISS` on miss in replay mode.

**Module 2: Extraction Validation Service**
- File(s): `server/src/services/semantic/extractionValidation.service.js`, schema file(s) under the same folder.
- Responsibility: AJV validation for source extraction payloads.
- Inputs: raw parsed JSON, source family.
- Outputs: validated extraction payload or typed validation error.
- Error handling: throw `EXTRACTION_INVALID` with validation detail payload.

**Module 3: Aggregate Validation Service**
- File(s): `server/src/services/semantic/aggregateValidation.service.js`, schema file(s) under the same folder.
- Responsibility: AJV validation for aggregate/publication payloads prior to publish.
- Inputs: assembled aggregate payload, product id.
- Outputs: validated aggregate payload or typed validation error.
- Error handling: throw `AGGREGATE_INVALID` with validation detail payload.

**Module 4: Nova Source Extraction Service**
- File(s): `server/src/services/semantic/novaSourceExtraction.service.js`
- Responsibility: choose live provider or replay store, parse raw JSON, validate it, and return prompt-run metadata.
- Inputs: normalized source, execution decision, runtime config.
- Outputs: validated extraction + prompt run metadata.
- Error handling: no heuristic replay fallback.

**Module 5: Semantic Publication Service**
- File(s): `server/src/services/semantic/semanticPublication.service.js`
- Responsibility: persist source extraction records, persist prompt runs, emit aggregate publication runs, validate aggregate payloads, and replace the published aggregate atomically with monotonic CAS protection.
- Inputs: validated extraction, validated aggregate payload, current aggregate, feature envelope.
- Outputs: updated aggregate plus provenance ids.
- Error handling: preserve last-known-good aggregate on failure and reject stale async publication attempts.

**Module 6: Effective Feature Envelope Adapter**
- File(s): `server/src/config/runtime.js`, `server/src/app.js`, `server/src/services/domain/mutation.service.js`
- Responsibility: resolve env flags and explicit non-production overrides into a single effective feature envelope.
- Inputs: runtime env, persisted semantic config, reset request overrides.
- Outputs: `EffectiveFeatureFlags` and persisted semantic config.
- Error handling: invalid override payload rejects the reset request.

### 11.2 New Dependencies

| Dependency | Version/Service | Purpose | Risk/Concern |
| :--- | :--- | :--- | :--- |
| None required | Existing `ajv` and filesystem runtime are sufficient | Reuse current dependencies | Low |

### 11.3 Removed / Deprecated Behavior

| File/Module | Behavior Removed or Deprecated | Reason | Migration Path |
| :--- | :--- | :--- | :--- |
| `novaSourceExtraction.service.js` | `buildReplayExtraction()` heuristic replay | Replay must mean replay truth, not fabricated output | Replace with replay store reads |
| Public read-model/UI surfaces | `featureMode` as user-facing semantic provenance | It is a migration control concept, not trustworthy evidence provenance | Remove from UI payload consumption |
| `POST /api/v1/test/reset` | `featureMode` as behavior authority | Real feature flags must control runtime | Support legacy alias temporarily, but persist effective flags |

## 12. Data Model & Storage

### 12.1 Schema Changes

**`state_source_extractions` additions / corrections**
- `validation_status` must be one of `valid`, `invalid`, `failed`.
- `validation_errors_json` stores AJV validation details when invalid.
- `replay_key` stores the actual replay key used for replay-mode reads.
- `replay_status` stores `hit`, `miss`, or `not_applicable`.
- `execution_mode_effective`, `source_family`, `citation_mode`, and `warning_codes_json` remain part of the semantic truth boundary.

**`state_product_aggregates` additions / corrections**
- `published_from_run_id` must refer only to an aggregate publication run.
- `source_run_ids_json` stores the source extraction run ids used to build the aggregate.
- `validation_status` must be one of `valid`, `invalid`, `failed`.
- `validation_errors_json` stores aggregate-schema validation details when invalid.
- `source_set_hash` stores the canonical source-set hash used by monotonic publish CAS.
- `publication_guard_json` stores the evidence-version / aggregate-version / source-set-hash guard used for CAS comparison.
- `freshness_status` and `freshness_reason_json` remain the read-side trust basis.

**`state_prompt_runs` additions / corrections**
- `run_role` stores `source_extraction` or `aggregate_publication`.
- `parent_run_ids_json` stores the upstream source run ids for aggregate publication.
- `replay_key` remains populated for replay-mode source extraction runs.
- `cache_hit` is `true` only when a replay artifact was actually read.
- `guard_snapshot_json` stores the publication guard evaluated for aggregate publication runs.

### 12.2 Data Contracts

**Contract: `EffectiveFeatureFlags`**
```json
{
  "enableNovaDentalLiveEmail": false,
  "enableDentalTrustSurfaces": true,
  "enableDentalSemanticServiceSplit": true,
  "enableExtractionReplayMode": true
}
```

**Contract: `ReplayLookupResult`**
```json
{
  "replayKey": "email/amazon.nova-pro-v1:0/2026-04-16-email-v2/source-schema-v1/7f2d6a0f0d0e2d0c8b6b1c4e9c4d8a6c57b4d967c7e955734a6d68c2b7a2f4b9.json",
  "cacheHit": true,
  "artifactPath": "server/data/eval-cache/email/amazon.nova-pro-v1:0/2026-04-16-email-v2/source-schema-v1/7f2d6a0f0d0e2d0c8b6b1c4e9c4d8a6c57b4d967c7e955734a6d68c2b7a2f4b9.json",
  "payloadEnvelope": {
    "schemaVersion": "source-schema-v1",
    "promptVersion": "2026-04-16-email-v2",
    "rawOutputText": "{\"summary\":\"Vendor confirmed staged mitigation.\",\"decisions\":[...]}",
    "parsedJson": {
      "summary": "Vendor confirmed staged mitigation.",
      "decisions": [
        {
          "label": "Proceed with staged mitigation on April 18",
          "confidence": "high",
          "anchorText": "We can proceed with staged mitigation on April 18."
        }
      ],
      "warnings": [],
      "confidence": "high"
    },
    "validatedPayload": {
      "summary": "Vendor confirmed staged mitigation.",
      "decisions": [
        {
          "label": "Proceed with staged mitigation on April 18",
          "confidence": "high",
          "anchorText": "We can proceed with staged mitigation on April 18."
        }
      ],
      "warnings": [],
      "confidence": "high"
    }
  }
}
```

**Contract: `ValidatedSourceExtraction`**
```json
{
  "sourceId": "src-2401",
  "productId": "dental",
  "sourceType": "email",
  "summary": "Vendor confirmed staged mitigation.",
  "decisions": [
    {
      "label": "Proceed with staged mitigation on April 18",
      "confidence": "high",
      "anchorText": "We can proceed with staged mitigation on April 18."
    }
  ],
  "warnings": [],
  "confidence": "high"
}
```

**Contract: `SurfaceSemanticState`**
```json
{
  "executionMode": "replay",
  "freshnessStatus": "fresh",
  "usesLastKnownGood": false,
  "showBanner": false,
  "bannerTone": null,
  "message": null,
  "lastPublishedAt": "2026-04-16T14:48:21.000Z",
  "latestAttemptAt": "2026-04-16T14:48:21.000Z",
  "reasonCodes": []
}
```

**Contract: `ValidatedAggregatePayload`**
```json
{
  "aggregateId": "agg-dental-4",
  "productId": "dental",
  "aggregateVersion": 4,
  "evidenceVersion": 12,
  "sourceSetHash": "4a6e2e6b5f5b91452fbf6f92ef447cf7d0f2d05f8c4d57d9fbcf76d7f52f8d5f",
  "payload": {
    "summary": "Dental remains at risk because vendor staging remains gated by April 18 mitigation sequencing.",
    "status": "risk"
  }
}
```

### 12.3 Replay Keying, Artifact Format, and Publish Guards

- Replay-key hash algorithm: SHA-256.
- Canonical serialization: UTF-8 JSON with sorted object keys, normalized `\n` line endings, and no transient runtime fields.
- Replay artifact path convention: `<evalCacheDir>/<sourceFamily>/<modelId>/<promptVersion>/<schemaVersion>/<sha256>.json`.
- Replay invalidation rule: any change to prompt version, model id, source-family schema version, or canonical normalized payload changes the replay key and results in a miss until a new artifact is captured.
- Replay artifact envelope must persist `rawOutputText`, `parsedJson`, and `validatedPayload`; callers consume `validatedPayload`.
- Aggregate publish guard: publication compares the expected latest aggregate version, evidence version, and source-set hash against current published state before replacement.
- Stale publication behavior: if the guard no longer matches, the publish is rejected as `STALE_PUBLICATION_REJECTED`.

### 12.4 Storage Architecture

- Primary store: DuckDB runtime-state tables already in use.
- Replay store: filesystem artifacts under `runtimeConfig.semantic.evalCacheDir` with replay key -> JSON envelope mapping.
- Artifact boundary: replay artifacts contain captured raw model output, parsed JSON, validated payload, and schema/prompt metadata; they are not synthesized at read time.
- Consistency rule: if extraction validation, aggregate validation, or aggregate publication fails, the published aggregate remains unchanged.
- Monotonicity rule: older async jobs may not replace a newer valid published aggregate.

## 13. Unified API Contract (Single Source of Truth)

### 13.1 Endpoint Inventory

| UI Action | Method | Path | Purpose | Latency Target |
| :--- | :--- | :--- | :--- | :--- |
| Bootstrap session | GET | `/api/v1/session` | Load user identity, role scope, and effective feature flags | P95 < 300ms |
| Upload artifact | POST | `/api/v1/products/:productId/sources` | Queue semantic ingest with live or replay extraction | `202` within 500ms |
| Poll job | GET | `/api/v1/jobs/:jobId` | Read ingest stage/outcome | P95 < 300ms |
| Product overview | GET | `/api/v1/products/:productId` | Load projected product state | P95 < 500ms |
| Source detail | GET | `/api/v1/products/:productId/sources/:sourceId` | Load source trust/provenance details | P95 < 500ms |
| Ask | POST | `/api/v1/products/:productId/ask` | Generate answer plus semantic surface state | P95 < 4s replay / P95 < 8s live |
| Read report | GET | `/api/v1/products/:productId/reports/:reportId` | Load report content and banner contract | P95 < 500ms |
| Non-prod reset | POST | `/api/v1/test/reset` | Reset state with explicit feature-flag overrides | P95 < 750ms |

### 13.2 Request / Response Shapes

**`GET /api/v1/session`**
```json
{
  "user": {
    "sub": "user-123",
    "displayName": "B. Jennings",
    "email": "bjennings@example.mil"
  },
  "roles": [
    { "productId": "dental", "role": "lead" }
  ],
  "featureFlags": {
    "enableNovaDentalLiveEmail": false,
    "enableDentalTrustSurfaces": true,
    "enableDentalSemanticServiceSplit": true,
    "enableExtractionReplayMode": true
  }
}
```

**`POST /api/v1/products/:productId/sources`**

Request remains existing multipart contract.

Response (`202`):
```json
{
  "jobId": "job-1042",
  "sourceId": "src-2401",
  "status": "queued",
  "title": "Dental Vendor Mitigation Confirmed",
  "effectiveExecutionMode": "replay",
  "effectiveFeatureFlags": {
    "enableDentalTrustSurfaces": true,
    "enableDentalSemanticServiceSplit": true
  },
  "updatedDomains": ["sources", "ask", "reports"]
}
```

**`GET /api/v1/jobs/:jobId`**
```json
{
  "jobId": "job-1042",
  "jobType": "ingest",
  "status": "failed",
  "stage": "replay_lookup",
  "executionMode": "replay",
  "errorCode": "REPLAY_CACHE_MISS",
  "message": "Replay evidence is unavailable for this source. Product understanding was not refreshed.",
  "result": {
    "sourceId": "src-2401",
    "title": "Dental Vendor Mitigation Confirmed",
    "updatedDomains": ["sources", "ask", "reports"]
  }
}
```

**`GET /api/v1/products/:productId`**
```json
{
  "product": {
    "id": "dental",
    "semanticState": {
      "executionMode": "replay",
      "policyMode": "replay",
      "aggregateStatus": "published",
      "aggregateVersion": 4,
      "aggregateId": "agg-dental-4",
      "freshnessStatus": "fresh",
      "usesLastKnownGood": false,
      "showBanner": false,
      "bannerTone": null,
      "message": null,
      "lastPublishedAt": "2026-04-16T14:48:21.000Z",
      "latestAttemptAt": "2026-04-16T14:48:21.000Z",
      "reasonCodes": []
    }
  }
}
```
**`GET /api/v1/products/:productId/sources/:sourceId`**
```json
{
  "source": {
    "id": "src-2401",
    "title": "Dental Vendor Mitigation Confirmed",
    "sourceType": "email",
    "extractionStatus": "completed",
    "validationStatus": "valid",
    "summary": "Vendor confirmed staged mitigation.",
    "warnings": [],
    "confidence": "high",
    "citations": [
      {
        "label": "Lines 11-15",
        "kind": "line_range",
        "start": 11,
        "end": 15,
        "mode": "exact"
      }
    ],
    "citationMode": "exact",
    "executionMode": "replay",
    "replayStatus": "hit"
  }
}
```

**`POST /api/v1/products/:productId/ask`**
```json
{
  "status": "complete",
  "answerHtml": "<strong>Evidence-backed response:</strong> ...",
  "sources": [
    {
      "sourceId": "src-2401",
      "title": "Dental Vendor Mitigation Confirmed",
      "meta": "2026-04-16 - email"
    }
  ],
  "semanticState": {
    "freshnessStatus": "degraded",
    "usesLastKnownGood": true,
    "showBanner": true,
    "bannerTone": "warning",
    "message": "This answer is using the last published product understanding while newer evidence is still being validated."
  }
}
```

**`GET /api/v1/products/:productId/reports/:reportId`**

All existing top-level report fields remain flat. `semanticState` is additive within the current flat route shape.

```json
{
  "reportId": "rep-701",
  "reportType": "weekly",
  "generatedAt": "2026-04-16T14:48:21.000Z",
  "semanticState": {
    "freshnessStatus": "fresh",
    "usesLastKnownGood": false,
    "showBanner": false,
    "bannerTone": null,
    "message": null
  },
  "requiresRegeneration": false,
  "regenerateNotice": null,
  "sections": [
    {
      "sectionId": "executive-summary",
      "title": "Executive Summary",
      "body": "Dental remains at risk because mitigation staging remains constrained.",
      "revision": 1,
      "editedAt": null
    }
  ]
}
```

**`POST /api/v1/test/reset`**
```json
{
  "productId": "dental",
  "mode": "wave-00",
  "executionMode": "replay",
  "featureFlags": {
    "enableNovaDentalLiveEmail": false,
    "enableDentalTrustSurfaces": true,
    "enableDentalSemanticServiceSplit": true,
    "enableExtractionReplayMode": true
  }
}
```

Response:
```json
{
  "status": "ok",
  "productId": "dental",
  "mode": "wave-00",
  "executionMode": "replay",
  "effectiveFeatureFlags": {
    "enableNovaDentalLiveEmail": false,
    "enableDentalTrustSurfaces": true,
    "enableDentalSemanticServiceSplit": true,
    "enableExtractionReplayMode": true
  },
  "sourceFamilyModes": {
    "email": "replay",
    "document": "replay",
    "transcript": "replay",
    "spreadsheet": "replay"
  },
  "warnings": []
}
```

### 13.3 Error Contract

| Condition | HTTP Status / Job Outcome | Error Code | Retryable | FE Behavior | BE Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Replay cache miss | async failed job | `REPLAY_CACHE_MISS` | No in strict replay mode | Show preserved-state failure copy | Do not fabricate extraction; keep published aggregate |
| Live/replay extraction invalid | async failed job | `EXTRACTION_INVALID` | Yes after prompt/cache correction | Show validation failure copy | Persist invalid extraction state and validation errors |
| Aggregate payload invalid | async failed job | `AGGREGATE_INVALID` | Yes after schema/output correction | Show preserved-state failure copy | Do not replace published aggregate |
| Service disabled by flag | 409 or async failed job | `SEMANTIC_EXECUTION_DISABLED` | No | Show supported-mode/config message | Fail closed |
| Publication failure | async failed/partial | `PUBLICATION_FAILED` | Yes | Keep last-known-good UI and degraded messaging | Preserve current aggregate |
| Stale async publish rejected | async failed/partial | `STALE_PUBLICATION_REJECTED` | No | Keep newest valid published state visible | Reject older aggregate attempt |
| Upload validation failure | 400 | `VALIDATION_ERROR` | No | Existing inline modal errors | No write |
| Unauthorized | 401 | `UNAUTHORIZED` | No | Existing session-expired handling | Existing auth path |
| Forbidden | 403 | `FORBIDDEN` | No | Existing permission handling | Existing auth path |

### 13.4 State-API-Backend Mapping Table

| User Action | UI State (Before) | API Call | Backend Processing | API Response | UI State (After) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Upload replay-backed email with cache hit | Overview idle | `POST /sources` | normalize -> replay lookup hit -> AJV validate -> citations -> publish | `202` with `effectiveExecutionMode=replay` | Processing then refreshed state |
| Upload replay-backed email with cache miss | Overview idle | `POST /sources` + `GET /jobs/:jobId` | normalize -> replay lookup miss | failed job with `REPLAY_CACHE_MISS` | Error panel, last-known-good state preserved |
| Open fresh seeded report | Reports tab with `reportId` | `GET /reports/:reportId` | compute report semantic presentation | flat report response with `showBanner=false` | No semantic warning banner |
| Open degraded seeded report | Reports tab with `reportId` | `GET /reports/:reportId` | compute degraded semantic presentation | flat report response with `showBanner=true`, `bannerTone=warning` | Warning banner visible |
| Reset non-prod runtime with trust surfaces off | Any | `POST /api/v1/test/reset` | persist explicit feature flags | effective flags returned | UI stops rendering trust surfaces after refetch |

### 13.5 Internal Service Contracts

- `resolveEffectiveFeatureFlags({ runtimeConfig, persistedSemanticConfig, overrideFeatureFlags, legacyFeatureMode }) -> EffectiveFeatureFlags`
- `buildReplayKey({ normalizedPayload, promptVersion, modelId, sourceFamily }) -> string`
- `readReplayExtraction({ replayKey }) -> ReplayLookupResult`
- `validateSourceExtraction({ sourceFamily, payload }) -> ValidatedSourceExtraction`
- `validateAggregatePayload({ productId, aggregatePayload }) -> ValidatedAggregatePayload`
- `publishAggregateFromExtraction({ productId, sourceExtractionRun, validatedAggregatePayload, currentAggregate, publicationGuard }) -> { aggregateRun, aggregateRecord }`

## 14. Configuration & Feature Flags

### 14.1 Environment Variables

| Variable | Type | Default | Required | Side | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ENABLE_NOVA_DENTAL_LIVE_EMAIL` | boolean | false | No | BE | Allows email-family live extraction when execution policy permits |
| `ENABLE_DENTAL_TRUST_SURFACES` | boolean | false | No | Both | Enables trust-surface rendering and read-model visibility |
| `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` | boolean | false | No | BE | Enables semantic orchestrator/publication service path |
| `ENABLE_EXTRACTION_REPLAY_MODE` | boolean | true in test | Yes | BE | Allows replay-mode execution |
| `EIDS_PROMPT_REGISTRY_VERSION` | string | `local-dev` | Yes | BE | Prompt version included in replay keys and run metadata |
| `EIDS_EVAL_CACHE_DIR` | string | runtime-local eval-cache path | Yes | BE | Root of replay cache artifacts |

### 14.2 Feature-Flag Rules

| Flag | Default | Side | Required Behavior |
| :--- | :--- | :--- | :--- |
| `ENABLE_NOVA_DENTAL_LIVE_EMAIL` | false | Both | When false, email-family policy cannot resolve to live. |
| `ENABLE_DENTAL_TRUST_SURFACES` | false | Both | When false, trust UI is hidden and backend read models return `showBanner=false` plus omit trust-specific rendering emphasis. |
| `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` | false | BE | When false, semantic service split path is not used. When true, upload/publication flows must route through semantic services. |
| `ENABLE_EXTRACTION_REPLAY_MODE` | true in test | BE | When false, replay mode is not available. When true, replay uses the real replay store only. |

### 14.3 Override Rules

- Non-production reset requests may override flags only through the `featureFlags` object.
- `legacyFeatureMode` may be accepted only as a deprecated alias that is translated into `featureFlags` server-side during migration.
- Public UI must not display `featureMode` as semantic provenance.
- `featureMode` must not appear in end-user route payloads after this corrective scope lands.
- `featureMode` alias support is non-production only and must be removed after the corrective scope lands and test helpers have migrated to explicit `featureFlags`.

## 15. Operational Concerns

### 15.1 Performance & Latency

- Replay cache lookup: P95 < 100ms.
- Replay-backed upload completion: P95 < 2s locally.
- Live upload completion: P95 < 15s locally when Bedrock is available.
- Report read: P95 < 500ms.

### 15.2 Observability & Debugging

Log and persist per run:
- `productId`
- `sourceId`
- `sourceFamily`
- `executionMode`
- `promptVersion`
- `modelId`
- `replayKey`
- `cacheHit`
- `validationStatus`
- `validationErrors`
- `aggregateRunId`
- `publishedFromRunId`
- `freshnessStatus`
- `sourceSetHash`
- `publicationGuard`

### 15.3 Failure Modes & Recovery

| Failure Scenario | Detection | User Impact | System Impact | Recovery |
| :--- | :--- | :--- | :--- | :--- |
| Replay cache miss | replay store miss | Upload fails with preserved-state copy | No new extraction/publication | Seed cache or switch to live |
| Invalid extraction | AJV validation failure | Upload fails with validation copy | Invalid extraction persisted, no publication | Fix prompt/cache artifact and retry |
| Invalid aggregate payload | aggregate AJV validation failure | Upload fails with preserved-state copy | New source extraction exists, aggregate not published | Fix aggregate projector/schema and retry publication |
| Publication failure | publication exception | Degraded last-known-good surfaces remain | Aggregate not updated | Retry publication only |
| Stale async publication | publish guard mismatch | User keeps seeing newest valid state | Older job does not overwrite newer aggregate | No recovery required; retry only from newest state |
| Trust flags off | session feature flags | Trust UI hidden | Read-model surfaces stay conservative | Re-enable flag and refetch |

### 15.4 Rollback Plan

- Rollback trust-surface UI by disabling `ENABLE_DENTAL_TRUST_SURFACES`.
- Rollback service split by disabling `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT`.
- Replay truth and validation do not roll back to heuristic mode; rollback must remain fail-closed.

## 16. Phased Implementation Plan

### 16.1 Phase Overview

| Phase | Name | FE Scope | BE Scope | Stub/Mock Boundary | Integration Checkpoint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Replay Truth & Validation | Minimal new error rendering | Add replay store, explicit hashing/artifact rules, and AJV validation; remove heuristic replay | FE may use failed-job fixtures for replay miss/invalid extraction | Replay cache hit and miss both behave truthfully |
| 2 | Honest Trust Presentation & Real Flags | Gate trust UI from session flags; fix report banner rendering | Make session/reset/read-model behavior flag-authoritative | FE may use fixture session payloads with flags | Fresh report shows no banner; trust surfaces hide until flags resolve and remain hidden when disabled |
| 3 | Aggregate Integrity & Provenance Hardening | No major UX change | Add aggregate validation, monotonic publish CAS, aggregate publication runs, and corrected provenance fields | No FE mock needed | Publication is valid, monotonic, and queryable |

### 16.2 Phase Details

**Phase 1: Replay Truth & Validation**
- Backend tasks: add replay store service, extraction schema validation, typed replay miss/invalid extraction outcomes, and tests.
- Frontend tasks: add/verify user-facing error copy for replay miss and invalid extraction.
- Integration checkpoint: replay hit publishes; replay miss preserves state; invalid extraction preserves state.

**Phase 2: Honest Trust Presentation & Real Flags**
- Backend tasks: extend `/api/v1/session`, `/api/v1/test/reset`, and read-model responses with effective feature flags and banner visibility contract.
- Frontend tasks: render trust surfaces only when flag-enabled, keep them hidden until session flags resolve, stop relying on `message` existence for report warning state, remove `featureMode` from user-facing semantic provenance, and preserve the current flat report-route shape.
- Integration checkpoint: fresh report has no banner; degraded report has banner; flag-off state hides trust surfaces without flicker.

**Phase 3: Aggregate Integrity & Provenance Hardening**
- Backend tasks: create aggregate publication runs, validate aggregate payloads, add monotonic publish CAS, wire `publishedFromRunId`, and expand repository tests.
- Frontend tasks: optional operator-facing debug readouts only if explicitly desired later; no UX redesign required now.
- Integration checkpoint: source run and aggregate run are distinct and traceable, and older async jobs cannot overwrite newer valid published state.

## 17. QA, Acceptance Criteria, and Definition of Done

### 17.1 Global Quality Gates

- `AC-G-001`: Replay mode may only use cache-backed replay artifacts. No deterministic heuristic semantic extraction is allowed in replay mode.
- `AC-G-002`: Any extraction that is persisted as `validationStatus=valid` has passed AJV/schema validation.
- `AC-G-003`: Any published aggregate marked valid has passed aggregate-schema validation before publish.
- `AC-G-004`: Older async publication attempts are rejected if a newer valid aggregate is already published.
- `AC-G-005`: `ENABLE_DENTAL_TRUST_SURFACES` and `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` each cause real behavior changes when toggled.
- `AC-G-006`: Fresh reports do not render `report-semantic-state-banner`.
- `AC-G-007`: Degraded or stale reports do render `report-semantic-state-banner` with warning styling.
- `AC-G-008`: `publishedFromRunId` on a published aggregate references an aggregate publication run, not a source extraction run.
- `AC-G-009`: Existing routes and key selectors remain stable, including `overview-current-state`.
- `AC-G-010`: The report read-route shape remains flat for this corrective pass.
- `AC-G-011`: Required Vitest and Playwright proof passes in both headless and headed modes.

### 17.2 Frontend Requirement-Level Acceptance Criteria

- `AC-FE-001`: Product Overview continues to render `overview-current-state`; if any branch lacks it, this scope adds and preserves it.
- `AC-FE-002`: Product Overview no longer presents `featureMode` as user-facing semantic provenance.
- `AC-FE-003`: Trust-surface UI elements render only when `session.featureFlags.enableDentalTrustSurfaces=true`.
- `AC-FE-004`: Reports render `report-semantic-state-banner` only when `report.semanticState.showBanner=true`.
- `AC-FE-005`: Fresh reports render no warning banner.
- `AC-FE-006`: Degraded reports render a warning banner with the backend-provided message.
- `AC-FE-007`: Upload failure messaging distinguishes replay cache miss from invalid extraction.
- `AC-FE-008`: Source Detail exact/fallback citation trust surfaces hide when trust surfaces are disabled.
- `AC-FE-009`: Existing regeneration notice continues to render independently of semantic warning visibility.
- `AC-FE-010`: Trust surfaces remain hidden until session feature flags are loaded; the frontend may not optimistically render trust UI before flag resolution.

### 17.3 Backend Requirement-Level Acceptance Criteria

- `AC-BE-001`: Replay key generation uses normalized input hash, prompt version, model id, and source family.
- `AC-BE-002`: Replay lookup reads stored artifacts from `evalCacheDir` and throws `REPLAY_CACHE_MISS` on miss.
- `AC-BE-003`: Live and replay extraction payloads are AJV-validated before they are returned to callers.
- `AC-BE-004`: Invalid extraction payloads are persisted as invalid/failed and do not publish new aggregate state.
- `AC-BE-005`: Effective feature flags are available through `GET /api/v1/session`.
- `AC-BE-006`: `POST /api/v1/test/reset` persists explicit feature flags and returns effective flags in the response.
- `AC-BE-007`: The semantic service split path is controlled by `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT`, not by `featureMode`.
- `AC-BE-008`: Report read payloads include `showBanner` and `bannerTone` fields.
- `AC-BE-009`: Published aggregates create a dedicated aggregate publication run.
- `AC-BE-010`: `publishedFromRunId` references that aggregate publication run.
- `AC-BE-011`: Aggregate/publication payloads are AJV-validated before publish.
- `AC-BE-012`: Monotonic publish CAS rejects stale async publication attempts when a newer valid aggregate is already active.
- `AC-BE-013`: End-user route payloads no longer return `featureMode`.

### 17.4 Cross-Cutting Integration Acceptance Criteria

- `AC-INT-001`: Resetting state with trust surfaces disabled causes the frontend to hide trust surfaces after refetch.
- `AC-INT-002`: Uploading a Dental email in replay mode with a cache hit refreshes product state through the real backend path.
- `AC-INT-003`: Uploading a Dental email in replay mode with a cache miss preserves last-known-good state and surfaces replay-miss messaging.
- `AC-INT-004`: Opening a fresh report after successful publication shows no semantic warning banner.
- `AC-INT-005`: Opening a degraded report after publication failure shows a semantic warning banner.
- `AC-INT-006`: Headed and headless Playwright runs use the same scripts and assertions.
- `AC-INT-007`: Concurrent uploads preserve the newest valid published aggregate and reject stale publication attempts.

### 17.5 Full-Stack E2E Scenarios

| Scenario ID | Workflow | Proof Type | Seed / Data Requirement | Acceptance Criteria Coverage |
| :--- | :--- | :--- | :--- | :--- |
| `E2E-DENTAL-REPLAY-HIT-001` | Upload Dental email in replay mode with cache hit | Live Backend-Backed E2E | Seeded replay artifact in `evalCacheDir` | `AC-G-001`, `AC-BE-001`-`003`, `AC-INT-002` |
| `E2E-DENTAL-REPLAY-MISS-002` | Upload Dental email in replay mode with cache miss | Live Backend-Backed E2E | Reset state with replay mode and no matching replay artifact | `AC-G-001`, `AC-FE-007`, `AC-INT-003` |
| `E2E-DENTAL-REPORT-FRESH-003` | Open seeded fresh report and confirm no semantic warning banner | Live Backend-Backed E2E | Seeded `reportId=rep-seeded` with fresh published state | `AC-G-006`, `AC-FE-004`, `AC-FE-005`, `AC-INT-004` |
| `E2E-DENTAL-REPORT-DEGRADED-004` | Open seeded degraded report and confirm warning banner | Live Backend-Backed E2E | Seeded `reportId=rep-seeded` plus publication-failure or stale-state fixture | `AC-G-007`, `AC-FE-006`, `AC-INT-005` |
| `E2E-DENTAL-TRUST-FLAG-005` | Reset with trust surfaces disabled and verify UI hides trust surfaces | Live Backend-Backed E2E | Reset override payload with trust surfaces off | `AC-G-005`, `AC-FE-003`, `AC-FE-008`, `AC-FE-010`, `AC-INT-001` |
| `E2E-DENTAL-LIVE-BEDROCK-006` | Upload Dental email in true live mode and validate real provider-backed flow | Live Backend-Backed E2E (local/dev only when Bedrock is available) | Bedrock-enabled local env + known email fixture | `AC-BE-003`, `AC-G-011` |
| `INT-DENTAL-STALE-PUBLISH-007` | Concurrent uploads attempt out-of-order aggregate publication | Backend Integration | Two uploads with interleaved publication timing | `AC-G-004`, `AC-BE-012`, `AC-INT-007` |

### 17.6 Definition of Done

The corrective feature is complete only when all of the following are true:
- All `AC-G-*`, `AC-FE-*`, `AC-BE-*`, and `AC-INT-*` items are mapped to proof.
- Replay mode is cache-backed and fail-closed.
- Extraction validation uses AJV/schema validation prior to publication.
- Aggregate validation uses AJV/schema validation prior to publication.
- Monotonic publish CAS prevents stale async jobs from overwriting newer valid state.
- Report warning visibility is backend-authoritative and fresh reports show no warning banner.
- Runtime feature flags truthfully control trust-surface rendering and service-split behavior.
- Published aggregate provenance is distinct from source extraction provenance.
- The report read route remains flat in this corrective pass.
- Headless and headed Playwright proof passes.

### 17.7 Usability Testing Plan

- Operator task: verify replay cache miss is clearly distinguished from generic upload failure.
- PM task: verify a fresh report feels calm and not falsely degraded.
- Reviewer task: verify degraded report messaging is clear and actionable.

### 17.8 Required Design Deliverables

- Updated API contract doc via this FSFS.
- Replay store keying and cache artifact guide.
- Trust-surface copy inventory for replay miss, invalid extraction, and degraded report states.
- Aggregate provenance note for operator/debug workflows.
- Aggregate validation schema and monotonic publish guard note.

### 17.9 Playwright Test Scripts

```javascript
// E2E-DENTAL-REPLAY-HIT-001
// Proof Type: Live Backend-Backed E2E
// Validates: AC-G-001, AC-BE-001, AC-BE-002, AC-INT-002
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental replay cache hit publishes refreshed state', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
    },
  });

  await page.goto('/products/dental?tab=overview');
  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await expect(page.getByTestId('overview-current-state')).toBeVisible();
  await expect(page.getByTestId('semantic-freshness-badge')).toContainText(/fresh/i);
});
```

```javascript
// E2E-DENTAL-REPLAY-MISS-002
// Proof Type: Live Backend-Backed E2E
// Validates: AC-FE-007, AC-INT-003
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental replay cache miss preserves last-known-good state', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
    },
    testCase: 'replayCacheMiss',
  });

  await page.goto('/products/dental?tab=overview');
  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email', testCase: 'replayCacheMiss' });
  await expect(page.getByTestId('artifact-processing-error')).toContainText(/Replay evidence is unavailable/i);
});
```

```javascript
// E2E-DENTAL-REPORT-FRESH-003
// Proof Type: Live Backend-Backed E2E
// Validates: AC-G-006, AC-FE-004, AC-FE-005, AC-INT-004
import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Fresh report shows no semantic warning banner', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
    },
  });

  await page.goto('/products/dental?tab=reports&reportId=rep-seeded');
  await expect(page.getByTestId('report-coverage-card')).toBeVisible();
  await expect(page.getByTestId('report-semantic-state-banner')).toHaveCount(0);
});
```

```javascript
// E2E-DENTAL-REPORT-DEGRADED-004
// Proof Type: Live Backend-Backed E2E
// Validates: AC-G-007, AC-FE-006, AC-INT-005
import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Degraded report shows semantic warning banner', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-02',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
    },
    testCase: 'publicationFailure',
  });

  await page.goto('/products/dental?tab=reports&reportId=rep-seeded&testCase=publicationFailure');
  await expect(page.getByTestId('report-semantic-state-banner')).toBeVisible();
});
```

```javascript
// E2E-DENTAL-TRUST-FLAG-005
// Proof Type: Live Backend-Backed E2E
// Validates: AC-G-003, AC-FE-003, AC-FE-008, AC-INT-001
import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Trust surfaces hide when trust feature flag is disabled', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: false,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
    },
  });

  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('semantic-freshness-badge')).toHaveCount(0);
});
```

## 18. Frontend Engineering Handoff (React Implementation Notes)

### 18.1 Route-Level Impact

- Preserve existing routes exactly.
- Continue using the current `ProductPage` tab structure in `client/src/App.jsx`.
- Trust/UI gating is driven by session-loaded feature flags and route payload banner contracts.
- Trust/UI gating defaults to hidden until session feature flags resolve.

### 18.2 Component and State Boundaries

- Keep the monolithic composition style in `client/src/App.jsx`.
- Extend the existing session query to read `featureFlags`.
- Remove dependence on `semanticState.featureMode` in UI rendering.
- Add report rendering logic based on `report.semanticState.showBanner` and `bannerTone`.

### 18.3 Data Fetching and Refresh Model

- Reuse `apiGet`, `apiSend`, and `apiUpload` in `client/src/lib/api.js`.
- Invalidate/refetch session-sensitive and product/report queries after reset flows in tests.
- Upload completion behavior continues to invalidate product, sources, ask, and reports.
- Trust surfaces default to hidden until the session query resolves; stale cached or missing session state may not briefly render trust UI.

### 18.4 Required `data-testid` Selectors

| Selector | Purpose |
| :--- | :--- |
| `overview-current-state` | Existing overview narrative selector; must remain stable |
| `semantic-freshness-badge` | Trust badge when enabled |
| `semantic-degraded-banner` | Overview degraded banner |
| `source-detail-citation-mode` | Source Detail trust indicator |
| `ask-degraded-banner` | Ask warning surface |
| `report-semantic-state-banner` | Report warning banner when visible |
| `report-regenerate-notice` | Existing regeneration notice |
| `artifact-processing-error` | Replay miss / invalid extraction / publication failure terminal state |

### 18.5 Frontend Test Expectations

- `semantic-header-hides-featuremode-and-respects-trust-flag`
- `reports-render-banner-only-when-showBanner-is-true`
- `source-detail-hides-citation-trust-when-flag-off`
- `artifact-upload-renders-replay-miss-and-invalid-extraction-copy`

## 19. Backend Engineering Handoff

### 19.1 Primary Module Impact

- `server/src/config/runtime.js`: make the named flags authoritative and persistable.
- `server/src/app.js`: extend session and reset contracts; preserve the current flat report semantic response shape while extending it.
- `server/src/services/domain/mutation.service.js`: use effective flags rather than `featureMode`; preserve last-known-good on replay miss/invalid extraction.
- `server/src/services/semantic/novaSourceExtraction.service.js`: use replay store + validation.
- `server/src/services/semantic/aggregateValidation.service.js`: validate aggregate payloads prior to publish.
- `server/src/services/semantic/semanticPublication.service.js`: emit aggregate publication runs and enforce monotonic publish CAS.
- `server/src/services/state/runtimeState.repository.js`: persist any added provenance/validation fields.

### 19.2 TDD Plan (Combined)

**Frontend Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `semantic-header-hides-featuremode-and-respects-trust-flag` | Component / Integration | `AC-FE-002`, `AC-FE-003` | Yes |
| `reports-render-banner-only-when-showBanner-is-true` | Component / Integration | `AC-FE-004`, `AC-FE-005`, `AC-FE-006` | Yes |
| `artifact-upload-renders-replay-miss-and-invalid-extraction-copy` | Component / Integration | `AC-FE-007` | Yes |
| `source-detail-hides-citation-trust-when-flag-off` | Component / Integration | `AC-FE-008` | Yes |

**Backend Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `semantic-replay-store-builds-key-and-reads-cache` | Unit | `AC-BE-001`, `AC-BE-002` | Yes |
| `semantic-replay-store-sha256-keying-is-stable` | Unit | `AC-BE-001` | Yes |
| `semantic-replay-store-throws-on-cache-miss` | Unit / Integration | `AC-BE-002` | Yes |
| `source-extraction-validates-live-and-replay-payloads` | Unit / Integration | `AC-BE-003`, `AC-BE-004` | Yes |
| `aggregate-payload-validates-before-publish` | Unit / Integration | `AC-BE-011` | Yes |
| `session-contract-exposes-effective-feature-flags` | Contract | `AC-BE-005` | Yes |
| `reset-contract-persists-feature-flags` | Contract / Integration | `AC-BE-006`, `AC-BE-007` | Yes |
| `report-contract-exposes-banner-visibility-fields` | Contract | `AC-BE-008` | Yes |
| `aggregate-publication-creates-distinct-run` | Integration | `AC-BE-009`, `AC-BE-010` | Yes |
| `stale-publication-is-rejected-by-guard` | Integration | `AC-BE-012` | Yes |
| `featuremode-is-not-returned-in-end-user-routes` | Contract | `AC-BE-013` | Yes |

**Cross-Cutting Test Inventory**

| Test Name | Type | Proof Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- | :--- |
| `dental-replay-hit.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-002`, `AC-INT-006` | Yes |
| `dental-replay-miss.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-003`, `AC-INT-006` | Yes |
| `dental-report-fresh-no-banner.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-004`, `AC-INT-006` | Yes |
| `dental-report-degraded-banner.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-005`, `AC-INT-006` | Yes |
| `dental-trust-flag-gating.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-001`, `AC-INT-006` | Yes |
| `concurrent-aggregate-publication.integration.test.js` | Backend Integration | Live Backend-Backed | `AC-INT-007` | Yes |

**Stub / Mock Inventory**

| Stub/Mock | Side | Purpose | Phase Removed |
| :--- | :--- | :--- | :--- |
| Session fixture with feature flags | FE | Allows UI gating work before backend session changes land | Phase 2 integration |
| Replay artifact fixture files in eval cache | BE | Deterministic replay proof in test and CI | Long-term retained |

## 20. Out of Scope (Non-Goals)

- Live rollout for non-email source families.
- A redesign of the overall Dental product page layout.
- New design-system adoption.
- A wholesale replacement of the existing Ask or report generation approach.
- Backfilling historical aggregates with newly separated aggregate publication runs.

## 21. Appendix

### 21.1 Referenced Code Areas

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
- `playwright.config.js`

### 21.2 Decision Log

| Decision | Date | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| Replay must fail closed on cache miss | 2026-04-16 | Trust claims are worse than visible failure if replay fabricates output | Heuristic fallback rejected |
| Report warning visibility is backend-authoritative | 2026-04-16 | Prevent false warnings and keep surface logic consistent | Message-presence inference rejected |
| Feature flags are exposed via session/reset contract | 2026-04-16 | Keeps FE/BE aligned without inventing a new config channel | Hidden runtime-only flags rejected |
| Aggregate provenance uses distinct aggregate publication runs | 2026-04-16 | Separates extraction truth from published aggregate truth | Reusing source run ids rejected |
| Report route shape stays flat in this corrective pass | 2026-04-16 | Avoids unnecessary FE migration during a trust-correction scope | Nested `report` object rejected |
| Aggregate publication uses schema validation plus CAS guard | 2026-04-16 | Prevents malformed or stale publishes from corrupting latest valid state | Atomic replace without monotonic guard rejected |
