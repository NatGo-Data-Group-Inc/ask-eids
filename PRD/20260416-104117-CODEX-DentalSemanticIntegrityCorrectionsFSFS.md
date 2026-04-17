# Full-Stack Feature Specification: Dental Semantic Integrity Corrections

## 1. Document Overview

| Attribute | Detail |
| :--- | :--- |
| Document Title | Full-Stack Feature Specification: Dental Semantic Integrity Corrections |
| Status | Draft — corrective-scope v2.2 decouples aggregate publication from indexing outcome (Option 2): indexing failures surface as `completed` with `indexingStatus=failed` on the affected source; aggregate publishes unconditionally on validated Nova JSON; Ask emits `RETRIEVAL_NOT_READY` for un-retrievable sources. v2.1 canonicalization, idempotency + atomicity, retry/re-ingest semantics, and the deterministic Ask precedence algorithm remain. |
| Version | 2.2 |
| Date Last Updated | April 16, 2026 |
| Technical Lead | Codex |
| UX Lead | Codex |
| Target Frontend | AskEIDS React 18 + Vite SPA rooted in `client/src/App.jsx` with API helpers in `client/src/lib/api.js` |
| Target Backend | AskEIDS Node.js + Express service with DuckDB runtime state, filesystem artifact store, and Bedrock-compatible text generation |
| Source System | The current partially implemented Dental semantic path in `server/src/services/semantic/`, `server/src/services/domain/mutation.service.js`, and `server/src/services/ingest/corpusImport.service.js` |
| Runtime Environment | Local/dev Node + React, GovCloud-compatible Bedrock runtime for live proof where available, filesystem runtime artifacts, DuckDB runtime state |
| Existing UI Library | No third-party component library detected; custom React views and custom styling in `client/src/styles/runtime.css` plus CSS variables defined in `index.html` |
| Key Dependencies | `react`, `react-router-dom`, `@tanstack/react-query`, `express`, `duckdb`, `ajv`, `multer`, `mailparser`, `mammoth`, `pdf-parse`, `@aws-sdk/client-bedrock-runtime`, `@playwright/test`, `vitest`; existing retrieval stack: `server/src/lib/aws/titanEmbeddings.js` (Titan `amazon.titan-embed-text-v2:0`), `server/src/rag/prototypeDuckDbStore.js` (`rag_chunks` table), `server/src/rag/retrievalProvider.js`, `server/src/services/rag/chunking.service.js` (`buildChunkArtifacts`), `server/src/services/rag/structuredRetrieval.service.js` |

**Assumptions:**
- The current code already includes semantic service boundaries for execution policy, source normalization, extraction, freshness, and publication, but those boundaries are not yet semantically trustworthy.
- The current route shell remains the product UX anchor: `/portfolio` and `/products/:productId?tab=overview|timeline|data|sources|reports` stay intact.
- `GET /api/v1/session` already exists and can be extended to carry effective feature flags to the frontend.
- The runtime `evalCacheDir` in `server/src/config/runtime.js` is the correct replay-cache root for deterministic extraction replay artifacts.
- `overview-current-state` is already present in the current `client/src/App.jsx`; if any branch or refactor path lacks it, this corrective scope must add and preserve it.
- Non-production reset behavior may continue to exist, but it must stop acting as the hidden authority for feature behavior.
- `shared/artifactTypes.js` is the authoritative source-family/source-type constant (`SOURCE_TYPES`, `SOURCE_TYPE_DEFINITIONS`, `getSourceFamily`, `isStructuredImportType`). The family name for weekly narrative artifacts is `weekly_update` (not `weekly_narrative`).
- `rag_chunks` in `server/src/rag/prototypeDuckDbStore.js` is the authoritative retrieval index. Titan embedding calls must go through `embedTexts` / `embedQuery` in `server/src/lib/aws/titanEmbeddings.js`; pseudo-embeddings are test-only.
- Upload → indexing is currently wired only for transcript uploads via `server/src/services/domain/mutation.service.js` (`indexTranscriptEvidence` around line 91). All other retrieval-eligible families rely on app-boot reindex in `server/src/app.js`. This corrective scope generalizes the per-upload indexing pattern to all retrieval-eligible families, gated by the new `ENABLE_DENTAL_RETRIEVAL_INDEXING` flag.

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

This corrective FSFS hardens the current Dental semantic implementation so the system's trust claims become true in both code and UX, and it closes the end-to-end lifecycle loop so that every uploaded retrieval-eligible document is truly retrievable after ingest. The existing direction is sound, but five trust and completeness boundaries are currently blurred: replay is not real replay, extraction validity is not truly validated, rollout flags do not actually gate behavior, reports display warning-style semantic banners even when fresh, and published aggregates point to source runs instead of distinct aggregate publication runs. On top of that, the full semantic lifecycle is only partially wired: only transcript uploads reach the `rag_chunks` vector index post-upload, so newly ingested emails, narrative documents, slide decks, and weekly updates are not retrievable until the app restarts.

The target end state is a system that runs the complete lifecycle — `normalize → Nova JSON → validate → persist → chunk → Titan embed → DuckDB vector rows → aggregate JSON → validate → publish → update app surfaces` — for every retrieval-eligible Dental upload, and keeps fixed-schema structured exports on a separate deterministic path. Specifically:
- replay mode reads previously captured extraction payloads from a real replay store and fails closed on cache miss;
- all live and replay extraction payloads are schema-validated before they can influence source detail, Ask, reports, or product state;
- aggregate/publication payloads are schema-validated before publish;
- feature flags named in runtime configuration actually control UI trust surfaces and the semantic service split;
- fresh reports do not show warning banners;
- degraded/stale reports do show warning banners with explicit backend-controlled visibility;
- stale async publication attempts are rejected when a newer valid aggregate is already published;
- aggregate publication provenance is distinct from source extraction provenance and traceable through `state_prompt_runs` and `state_product_aggregates`;
- every successful retrieval-eligible upload (with indexing enabled) produces chunk artifacts, Titan embeddings, and `rag_chunks` rows so that the new source is immediately retrievable via DuckDB vector search;
- fixed-schema structured exports (`risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`) update deterministic row truth and aggregate state but never create `rag_chunks` rows;
- Ask resolves precedence deterministically: structured retrieval wins on fixed-schema row facts; vector retrieval wins on narrative/causal/context questions; on exact-field conflict between a structured row and narrative evidence, structured row truth wins and narrative is retained as context;
- no user-visible surface (Overview, Source Detail, Ask, Reports, Timeline) is ever updated from unvalidated model output or heuristic fallback.

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
| 11 | BE | `server/src/services/semantic/chunkingAndIndexing.service.js` | New | Module 7: for retrieval-eligible Dental families with indexing enabled, chunk normalized/validated source, call Titan, and persist `rag_chunks` rows with full product/source/family metadata. Reuses `buildChunkArtifacts`, `embedTexts`, `prototypeDuckDbStore.indexDocuments`. |
| 12 | BE | `server/src/services/domain/mutation.service.js` | Modified | Generalize the transcript-only `indexTranscriptEvidence` pattern (around line 91) to all retrieval-eligible families; gate on `features.enableDentalRetrievalIndexing`; stamp `indexingStatus` on the source record. |
| 13 | BE | `shared/artifactTypes.js` + `server/src/config/runtime.js` | Modified | Derive a `getSourceFamilyClass()` helper from existing `SOURCE_TYPE_DEFINITIONS` / `isStructuredImportType`; add `features.enableDentalRetrievalIndexing` (env `ENABLE_DENTAL_RETRIEVAL_INDEXING`). |
| 14 | BE | `server/src/services/domain/ask.service.js` | Modified | Wire the precedence rule: structured wins on fixed-schema row facts, vector wins on narrative, both-fire returns merged+labeled sources, and on exact-field conflict structured row truth wins with narrative cited for context. |
| 15 | FE | `client/src/App.jsx` | Modified | Source Detail renders `indexingStatus` (hidden when `not_applicable`); Ask source chips label structured vs. vector and expose a precedence note on conflict. |

### 2.3 Target End State Description

When this corrective scope is complete, a Dental email upload in replay mode will either read a real cached extraction artifact and continue through validation, citation projection, chunking, Titan embedding, DuckDB `rag_chunks` persistence, aggregate validation, and monotonic publication — or it will fail with an explicit replay-cache-miss outcome that preserves the last known good aggregate. A Dental email upload in live mode will produce model output that is schema-validated before it can be stored, projected, embedded, or indexed. A Dental narrative document, slide deck, transcript, or `weekly_update` upload will run the same full lifecycle and will be immediately retrievable via DuckDB vector search after `completed` — without requiring an app restart. A fixed-schema structured export upload (`risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`) will update deterministic row truth and aggregate state but will not create any `rag_chunks` rows. `spreadsheet_attachment` uploads are explicitly deferred — they normalize and store as sources but do not participate in retrieval in this corrective scope.

Aggregate publication attempts from older jobs will be rejected when a newer valid aggregate is already active. Reports will only display `report-semantic-state-banner` when the backend marks the semantic state as degraded or stale, and the route shape for reports will remain flat so the current frontend contract stays stable. Operators will be able to trust the named feature flags because those flags will actually control rendering and execution. Aggregate publication history will be auditable because source extraction runs and aggregate publication runs will be distinct records. Ask will resolve structured vs. vector precedence deterministically and label source chips so the reader can tell at a glance which evidence drove the answer, with structured row truth winning on exact-field conflicts. No user-visible surface will ever be updated from unvalidated model output or heuristic fallback. Release signoff requires one provider-backed local/dev proof of the full round-trip (Nova Pro + Titan + DuckDB + Ask retrieval + aggregate publication + surface refresh); replay-only proof is insufficient.

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
- 100% of retrieval-eligible Dental uploads (`email`, `transcript`, `document`, `slide_deck`, `weekly_update`) with `enableDentalRetrievalIndexing=true` produce ≥1 `rag_chunks` row whose `source_id` equals the new `sourceId`, with a Titan embedding of length `bedrock.embedDims`, L2-normalized within tolerance.
- 100% of fixed-schema structured export uploads (`risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`) produce 0 new `rag_chunks` rows while still updating Data/Overview/Reports.
- A product-scoped DuckDB vector search for a unique phrase from a just-uploaded retrieval-eligible source returns at least one chunk from that source, without an app restart or reset.
- Ask cites a newly uploaded retrieval-eligible Dental source in an answer after `completed`, without a reset.
- Required Playwright proof passes in both headed and headless modes, with one explicit local-only Bedrock-backed proof path documented for environments where live Bedrock is available. Release signoff requires at least one provider-backed run covering Nova Pro extraction + Titan embedding + `rag_chunks` persistence + Ask retrieval hit + aggregate publication + surface refresh; replay-only proof is not sufficient for signoff.

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
   - UI response: Sources show the new source with `indexingStatus=indexed`, report page remains fresh, and no report warning banner appears if the aggregate published successfully.
   - API calls: `GET /api/v1/jobs/:jobId`, `GET /api/v1/products/:productId`, `GET /api/v1/products/:productId/sources`, `GET /api/v1/products/:productId/reports/:reportId`
   - Backend processing: Read latest published aggregate, latest extraction record, and surface-specific trust banner contract. `rag_chunks` rows for the new source are now present and searchable.
   - API response: Existing route shapes with corrected semantic visibility fields and the new `indexingStatus`, `sourceFamilyClass`, `chunkCount`, `embeddingDims` fields.
   - UI transition: Report view omits `report-semantic-state-banner` because `showBanner=false`.

3. **Ask about the new source**
   - User action: Opens Ask and asks a question referencing content from the just-uploaded source.
   - API call: `POST /api/v1/products/dental/ask`
   - Backend processing: Precedence resolver queries structured retrieval first (for fixed-schema facts) and DuckDB vector retrieval for narrative evidence; the new source surfaces via vector search.
   - API response: `sources[*]` includes the new source with `retrievalType=vector`; if a structured export also matched, its chip carries `retrievalType=structured`.
   - UI transition: Answer renders with labeled source chips; no reset was required.

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

- **Invalid live extraction:** Bedrock returns JSON that parses but fails schema validation. The source is stored, extraction is marked invalid, and publication does not proceed. No chunking, embedding, or indexing occurs.
- **Trust surfaces disabled:** Session feature flags return `enableDentalTrustSurfaces=false`; the frontend does not render freshness/citation trust UI even if backend semantic state exists.
- **Service split disabled:** Uploads use the current coordinator path, but only when the service-split flag is off. The flag must be the authority, not `featureMode`.
- **Legacy reset request:** A non-production test reset may still send `featureMode`; the backend may translate it to explicit flags temporarily but must emit a deprecation warning and persist explicit flag state.
- **Fixed-schema structured export upload:** A `risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, or `ado_export` file is uploaded. The backend parses deterministic rows, validates them, assembles and validates the aggregate, and publishes it — but does NOT chunk, embed, or insert `rag_chunks` rows. The source record carries `sourceFamilyClass=fixed_schema_structured` and `indexingStatus=not_applicable`. Data/Overview/Reports surfaces refresh; Ask uses structured retrieval for these facts.
- **Embedding/indexing failure (aggregate publication still proceeds):** Extraction succeeded and was AJV-valid, but Titan embedding or DuckDB persistence failed. Module 7's transaction rolls back (no partial `rag_chunks` rows). The source record is stamped `indexingStatus=failed` with a typed error (`EMBEDDING_UNAVAILABLE` or `INDEXING_FAILED`). The orchestrator continues: aggregate assembly, validation, and monotonic CAS publication proceed using the already-validated Nova JSON — retrieval readiness is a separate property of the source, not a precondition for aggregate truth. The job terminal state is `completed`. Overview/Timeline/Reports refresh. Ask emits `RETRIEVAL_NOT_READY` as a soft warning for that source until it is re-uploaded. See §13.6 Terminal Job Semantics and §21.2 Decision Log ("Option 2 — decouple publication from indexing outcome").
- **Indexing disabled by kill-switch:** `features.enableDentalRetrievalIndexing=false` for a retrieval-eligible family. Extraction, validation, and aggregate publication still succeed. The source record carries `indexingStatus=disabled` and no `rag_chunks` rows are written. Ask may return `RETRIEVAL_NOT_READY` as a soft warning when the disabled source would otherwise have been cited.
- **`spreadsheet_attachment` upload (deferred):** A generic workbook attachment is normalized and stored as a source, but is explicitly not retrieval-eligible in this corrective scope. `sourceFamilyClass=deferred`, `indexingStatus=not_applicable`. No vectors are created. Canonical workbook normalization is out of scope and will be specified in a follow-on FSFS.
- **Ask precedence — both fire:** A question matches both a structured export row and a narrative source. The answer merges both, labels source chips with `retrievalType=structured` vs `retrievalType=vector`, and renders them in that order (structured first).
- **Ask precedence — exact-field conflict:** A structured row and a narrative source disagree on the same exact field value. The answer uses the structured value as the field-of-record; the narrative source is still cited for context/causality and its chip carries a precedence note. The resolution is logged in `askPrecedenceDecision`.

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

**Stage 5: Extraction Validation + Family Class Resolution**
- Input: raw extraction JSON + source type.
- Processing: validate with AJV schema; resolve `sourceFamilyClass` from `shared/artifactTypes.js` via `getSourceFamilyClass()` → one of `retrieval_eligible`, `fixed_schema_structured`, or `deferred`. Skip Stages 6a/6b for non-`retrieval_eligible` classes.
- Output: `ValidatedSourceExtraction` + `sourceFamilyClass`.
- Failure mode: throw typed `EXTRACTION_INVALID` with validation error details; no publication.

**Stage 6a: Citation Projection**
- Input: validated extraction + normalization coordinate map.
- Processing: resolve exact or fallback citations.
- Output: `CitationProjectionResult`.
- Failure mode: explicit fallback mode, but only after extraction is valid.

**Stage 6b: Chunking + Titan Embedding + DuckDB Indexing** (retrieval-eligible families only; gated by `features.enableDentalRetrievalIndexing`)
- Input: normalized source text, validated extraction, `sourceFamilyClass`, product/source metadata.
- Processing: call `buildChunkArtifacts` to split into ~650-token chunks; call `embedTexts` against Titan (`bedrock.embedModelId`, default `amazon.titan-embed-text-v2:0`); L2-normalize each embedding; persist rows into `rag_chunks` via `prototypeDuckDbStore.indexDocuments` with `product_id`, `source_id`, `source_type`, `source_date`, `chunk_index`, and family metadata. Stamp `indexingStatus=indexed`, `chunkCount`, `embeddingDims` on the source record.
- Output: `IndexingResult { chunkCount, embeddingDims, embeddingSource }`.
- Failure mode: on Titan unavailability throw `EMBEDDING_UNAVAILABLE`; on DuckDB write failure throw `INDEXING_FAILED`. Module 7's own transaction rolls back so no partial `rag_chunks` rows remain; the source record is stamped `indexingStatus=failed` with the typed error. **The orchestrator continues to Stage 7 and Stage 8: aggregate publication proceeds on the already-validated Nova JSON. Retrievability is decoupled from publication (Option 2 in §21.2).** Pseudo-embeddings are permitted only when `retrieval.allowPseudoEmbeddings=true` (test-only); `embeddingSource=pseudo` in that case and release signoff is not satisfiable.
- Kill-switch behavior: when `features.enableDentalRetrievalIndexing=false`, Stage 6b is skipped for retrieval-eligible families, `indexingStatus=disabled` is stamped, no `rag_chunks` rows are written, and aggregate publication still proceeds. This path is now symmetric with the Titan/DuckDB-failure path — only the status value differs (`disabled` vs `failed`).
- Family-class bypass: `fixed_schema_structured` families skip Stage 6b entirely (`indexingStatus=not_applicable`, no `rag_chunks` rows written, proceed directly to Stage 7). `deferred` families (including `spreadsheet_attachment`) also skip Stage 6b (`indexingStatus=not_applicable`) and are explicitly not retrieval-eligible in this corrective scope.

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
| `server/src/services/domain/mutation.service.js` (lines ~89-99, `indexTranscriptEvidence`) | Invokes `retrievalProvider.indexDocuments` only for transcript uploads | Same module generalized via new Module 7 to all retrieval-eligible families, gated by `features.enableDentalRetrievalIndexing` | BE | Adapt | Only transcripts reach the vector index post-upload today; other retrieval-eligible families require reset to become retrievable. This is the primary lifecycle gap this corrective scope closes. |
| `server/src/rag/prototypeDuckDbStore.js` (existing `rag_chunks` table + `indexDocuments`) | Schema and API exist, but per-upload writes are wired only for transcripts | Same module, extended to record full product/source/family metadata required by Ask precedence and surface attribution | BE | Keep + Wire Through Ingest | Reuses the existing authoritative retrieval store rather than inventing a new one. |
| `server/src/lib/aws/titanEmbeddings.js` (`embedTexts`, `embedQuery`, `getEmbeddingDims`) | Implemented; callable via `embeddingsAvailable` gate | Same module, called from Module 7 during ingest for retrieval-eligible families | BE | Keep + Wire Through Ingest | Live provider-backed proof path already exists; this scope just starts using it on ingest. |
| `server/src/rag/retrievalProvider.js` (`getRetrievalProvider`) | Exists and returns the DuckDB store factory | Same module; used by Module 7 for writes and by `ask.service.js` for reads | BE | Keep | No change to the factory contract. |
| `server/src/services/rag/chunking.service.js` (`buildChunkArtifacts`) | Implemented, ~650-token chunking by paragraph | Same module, reused by Module 7 | BE | Keep | Avoid reinventing chunking logic. |
| `server/src/services/rag/structuredRetrieval.service.js` (`retrieveStructuredEvidence`) | Implemented for risks/blockers/decisions read-model pulls | Same module; participates in Ask precedence as the structured-retrieval side of the merge | BE | Keep + Wire Precedence | Used alongside vector retrieval with explicit precedence rules. |
| `server/src/services/domain/ask.service.js` | Uses retrieval provider + structured retrieval but precedence is implicit | Same module with explicit `askPrecedenceMerge` logic and labeled source chips | BE | Adapt | Precedence must be testable and observable. |
| `shared/artifactTypes.js` (`SOURCE_TYPE_DEFINITIONS`, `isStructuredImportType`) | Defines source-type registry; no family-class helper | Same module + new derived `getSourceFamilyClass()` helper returning `retrieval_eligible | fixed_schema_structured | deferred` | BE | Adapt | Keeps the matrix in one canonical location rather than duplicating it across services. |

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
- `DIV-005`: Retrieval-eligible uploads of emails, narrative documents, slide decks, and `weekly_update` artifacts now update `rag_chunks` post-upload (in addition to the existing transcript path). Previously non-transcript retrieval required an app-boot reindex from seeded state.
- `DIV-006`: Fixed-schema structured exports never create `rag_chunks` rows. Row truth and aggregate truth are authoritative for their facts; vector retrieval for these families is explicitly out of scope.
- `DIV-007`: Ask precedence is now an explicit, testable contract (structured wins on fixed-schema row facts, vector wins on narrative, both-fire merged and labeled, structured row truth wins on exact-field conflict).
- `DIV-008`: `spreadsheet_attachment` is explicitly deferred — normalized and stored, but not retrieval-eligible — pending canonical workbook text extraction.
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

**Module 7: Chunking + Titan Embedding + DuckDB Indexing Service**
- File(s): new `server/src/services/semantic/chunkingAndIndexing.service.js`; reuses `server/src/services/rag/chunking.service.js` (`buildChunkArtifacts`), `server/src/lib/aws/titanEmbeddings.js` (`embedTexts`, `getEmbeddingDims`, `embeddingsAvailable`), `server/src/rag/prototypeDuckDbStore.js` (`indexDocuments`), `server/src/rag/retrievalProvider.js` (`getRetrievalProvider`).
- Responsibility: for retrieval-eligible Dental uploads with indexing enabled, chunk the normalized source text, generate Titan embeddings, and persist `rag_chunks` rows with product/source/family metadata required by Ask precedence and surface attribution. Stamp `indexingStatus`, `chunkCount`, `embeddingDims`, and `embeddingSource` on the source record.
- Inputs: `{ productId, sourceId, sourceType, sourceFamilyClass, sourceDate, normalizedText, validatedExtraction, featureEnvelope }`.
- Outputs: `IndexingResult { indexingStatus, chunkCount, embeddingDims, embeddingSource }`.
- Behavior:
  - `sourceFamilyClass === 'retrieval_eligible'` + indexing enabled → chunk → embed → index; stamp `indexingStatus=indexed`.
  - `sourceFamilyClass === 'retrieval_eligible'` + indexing disabled → no chunks, no embeddings, no writes; stamp `indexingStatus=disabled`; return early.
  - `sourceFamilyClass === 'fixed_schema_structured'` → Module 7 is not invoked; `indexingStatus=not_applicable`.
  - `sourceFamilyClass === 'deferred'` → Module 7 is not invoked; `indexingStatus=not_applicable`.
- Error handling (publication-decoupled per Option 2, §21.2):
  - Titan unavailability or embedding dimension mismatch → throw `EMBEDDING_UNAVAILABLE`; Module 7's own DuckDB transaction rolls back cleanly; the source record is stamped `indexingStatus=failed` with the typed error; the orchestrator is notified but continues to Stage 7/Stage 8. Aggregate publication proceeds on the already-validated Nova JSON. Job terminal state is `completed`; retrievability for that source is a separate property surfaced via `indexingStatus` and Ask's `RETRIEVAL_NOT_READY` warning.
  - DuckDB write failure → throw `INDEXING_FAILED`; same decoupled behavior as above.
  - Pseudo-embeddings used (`retrieval.allowPseudoEmbeddings=true`) → allowed in test only; `embeddingSource=pseudo` is stamped and release signoff is not satisfiable with pseudo embeddings.
- Caller: invoked by the semantic ingest orchestrator between Stage 6a (citation projection) and Stage 7 (aggregate assembly); the existing `indexTranscriptEvidence` call in `server/src/services/domain/mutation.service.js:91` is refactored to route through Module 7 so all retrieval-eligible families share one code path.

**Idempotency contract (authoritative):**

- Module 7 writes are idempotent per `sourceId`. Every invocation for a given `sourceId` performs, within a single DuckDB transaction:
  1. `DELETE FROM rag_chunks WHERE source_id = :sourceId AND product_id = :productId` (purge any prior rows for this source, regardless of previous `chunk_index` count).
  2. `INSERT INTO rag_chunks ...` for each newly generated chunk with the current embeddings and metadata.
  3. Stamp the source record's `indexing_status`, `chunk_count`, `embedding_dims`, `embedding_source`, `indexed_at`.
- Retries (operator or automated) are therefore safe: `chunk_count` always reflects the latest successful run; no orphan rows can accumulate.
- `rag_chunks.chunk_id` MUST be deterministic given (`source_id`, `chunk_index`) — e.g., `"<sourceId>::<chunkIndex>"`. The existing `chunk_id` primary key in `prototypeDuckDbStore.js` remains; Module 7 computes it deterministically rather than using a random UUID, so replaying the same input produces byte-identical keys.

**Atomicity contract (authoritative):**

- The DuckDB transaction in Module 7 encloses: chunk delete, chunk inserts, and indexing-specific source-record stamping (`indexing_status`, `chunk_count`, `embedding_dims`, `embedding_source`, `indexed_at`). If ANY step fails, the transaction rolls back and:
  - No partial `rag_chunks` rows for that `sourceId` remain (only the prior committed state is visible).
  - Module 7 throws the typed error (`EMBEDDING_UNAVAILABLE` or `INDEXING_FAILED`).
- After the Module 7 transaction either commits (`indexingStatus=indexed`) or rolls back, a separate short transaction stamps the FINAL `indexing_status` field on the source record — `indexed` on success, `failed` on exception, `disabled` on kill-switch skip, `not_applicable` on family-class bypass. This stamp is a single-row update and is always atomic.
- **Aggregate publication decoupling (Option 2, §21.2):** once the source record carries a stable final `indexing_status`, the orchestrator proceeds unconditionally to Stage 7 (aggregate assembly/validation) and Stage 8 (aggregate CAS publication). Indexing outcome does NOT gate publication. Retrievability is carried on the source record and surfaced by Ask as `RETRIEVAL_NOT_READY` when appropriate.
- Aggregate CAS in Stage 8 is repository-level atomic: the compare-and-swap read+write happens in a single DuckDB transaction so concurrent publications cannot observe a torn state.
- Source-record stamping performed in earlier stages (extraction, citation projection) that precedes Module 7 is a separate short transaction; these fields remain committed regardless of Module 7's outcome.

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
| `server/src/lib/aws/titanEmbeddings.js` pseudo-embedding fallback | Pseudo-embeddings used when Titan unavailable AND `retrieval.allowPseudoEmbeddings=true` | Test-only behavior; fails release signoff | Keep for tests; forbid in production by policy; release signoff requires Titan-backed round-trip |
| App-boot-only reindex for non-transcript retrieval-eligible families | `server/src/app.js:46-50` rebuilds `rag_chunks` from seeded corpus on startup | Per-upload indexing makes newly uploaded narrative/email/slide/weekly_update sources retrievable immediately; boot rebuild is still allowed as a seed path | Keep boot path for seeding; add per-upload path via Module 7 |

## 12. Data Model & Storage

### 12.1 Schema Changes

**`state_source_extractions` additions / corrections**
- `validation_status` must be one of `valid`, `invalid`, `failed`.
- `validation_errors_json` stores AJV validation details when invalid.
- `replay_key` stores the actual replay key used for replay-mode reads.
- `replay_status` stores `hit`, `miss`, or `not_applicable`.
- `execution_mode_effective`, `source_family`, `citation_mode`, and `warning_codes_json` remain part of the semantic truth boundary.
- `source_family_class` enum (`retrieval_eligible`, `fixed_schema_structured`, `deferred`), derived via `getSourceFamilyClass()` against `shared/artifactTypes.js`.
- `indexing_status` enum (`not_applicable`, `queued`, `indexed`, `failed`, `disabled`). `not_applicable` is reserved for families that are never indexed in this scope (`fixed_schema_structured`, `deferred`). `disabled` is used only when the retrieval indexing kill-switch is off for a retrieval-eligible family.
- `chunk_count` integer — number of `rag_chunks` rows written for this source (`0` when indexing did not run).
- `embedding_dims` integer — the embedding vector length when indexing wrote rows, else `null`.
- `embedding_source` enum (`titan`, `pseudo`, `none`). `pseudo` is permitted only in test contexts (`retrieval.allowPseudoEmbeddings=true`) and is not sufficient for release signoff.

**`rag_chunks` required metadata coverage** (the table already exists in `server/src/rag/prototypeDuckDbStore.js`; this scope tightens the metadata contract for new writes):
- `product_id` must equal the owning product (`dental` in this scope).
- `source_id` must equal the newly created source's id.
- `source_type` must equal the `SOURCE_TYPES` key from `shared/artifactTypes.js`.
- `source_date` must be populated for sources with a canonical date.
- `chunk_index` (stored inside the `metadata_json` payload or as a dedicated column) must be set and stable.
- `embedding_json` must parse to a numeric array of length `bedrock.embedDims` and be L2-normalized within tolerance.

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

This is the single authoritative shape for effective feature flags. All endpoints that expose or accept feature flags (`GET /api/v1/session`, `POST /api/v1/test/reset` request + response, `POST /api/v1/products/:productId/sources` response) MUST use this exact key set. Adding or removing a key is a breaking change.

```json
{
  "enableNovaDentalLiveEmail": false,
  "enableDentalTrustSurfaces": true,
  "enableDentalSemanticServiceSplit": true,
  "enableExtractionReplayMode": true,
  "enableDentalRetrievalIndexing": true
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
  "sourceFamilyClass": "retrieval_eligible",
  "indexingStatus": "indexed",
  "chunkCount": 6,
  "embeddingDims": 1024,
  "embeddingSource": "titan",
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

**Contract: `SourceFamilyEligibility`**
```json
{
  "sourceType": "weekly_update",
  "sourceFamily": "document",
  "sourceFamilyClass": "retrieval_eligible",
  "retrievalEligible": true,
  "deferred": false,
  "structured": false
}
```

**Contract: `IndexingStatus`**
```json
{
  "indexingStatus": "indexed",
  "chunkCount": 6,
  "embeddingDims": 1024,
  "embeddingSource": "titan",
  "indexedAt": "2026-04-16T14:48:22.000Z",
  "failureReason": null
}
```

**Contract: `IndexingResult` (Module 7 return)**
```json
{
  "indexingStatus": "indexed",
  "chunkCount": 6,
  "embeddingDims": 1024,
  "embeddingSource": "titan",
  "chunks": [
    {
      "chunkId": "src-2401::0",
      "chunkIndex": 0,
      "byteLength": 2042
    }
  ]
}
```

**Contract: `AskPrecedenceDecision`**
```json
{
  "question": "When is the staged mitigation scheduled?",
  "structuredHits": [
    {
      "sourceId": "src-risk-export-12",
      "sourceType": "risk_export",
      "fieldName": "mitigation_due_date",
      "fieldValue": "2026-04-18"
    }
  ],
  "vectorHits": [
    {
      "sourceId": "src-2401",
      "sourceType": "email",
      "score": 0.82,
      "chunkId": "src-2401::2"
    }
  ],
  "resolution": "merged",
  "exactFieldConflict": false,
  "winner": "structured",
  "narrativeCitedForContext": true
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

### 12.3 Source-Family Eligibility Matrix

This matrix is derived from `shared/artifactTypes.js` (`SOURCE_TYPES` / `SOURCE_TYPE_DEFINITIONS` / `isStructuredImportType`) via a new helper `getSourceFamilyClass(sourceType) → 'retrieval_eligible' | 'fixed_schema_structured' | 'deferred'`. It defines per-source-type lifecycle expectations for this corrective scope.

**Retrieval-eligible — chunk + Titan embed + `rag_chunks` row writes required when indexing flag is on:**

| Source Type | Source Family | Notes |
| :--- | :--- | :--- |
| `email` | `email` | Existing live/replay extraction path; newly generalized indexing path. |
| `transcript` | `transcript` | Already indexed per-upload via `indexTranscriptEvidence`; migrates to Module 7. |
| `document` | `document` | Narrative docs (md/docx/pdf). Includes any document whose `sourceType` resolves to `document`. |
| `slide_deck` | `slide_deck` | Narrative evidence from slides. |
| `weekly_update` | `document` | Weekly narrative artifacts. Name is `weekly_update` per `shared/artifactTypes.js`; it is **not** `weekly_narrative`. |

**Fixed-schema structured exports — deterministic row truth only; no `rag_chunks` rows ever written in this scope:**

| Source Type | Source Family | Notes |
| :--- | :--- | :--- |
| `risk_export` | `spreadsheet` | Row-of-record for risks; served to Ask via `retrieveStructuredEvidence`. |
| `blocker_export` | `spreadsheet` | Row-of-record for blockers. |
| `pi_objectives_export` | `spreadsheet` | Row-of-record for PI objectives. |
| `action_item_export` | `spreadsheet` | Row-of-record for action items. |
| `ado_export` | `spreadsheet` | Row-of-record for ADO work items. |

**Deferred — explicitly out of this corrective scope:**

| Source Type | Reason |
| :--- | :--- |
| `spreadsheet_attachment` | Canonical workbook text extraction is not specified. Normalize + store as a source is allowed; retrieval indexing is forbidden until a follow-on FSFS defines workbook normalization. Source record carries `sourceFamilyClass=deferred`, `indexingStatus=not_applicable`. |

**Legacy alias:** `weekly` (per `SOURCE_TYPES` in `shared/artifactTypes.js`, line 23) is retained for existing retrieval/filter routing but is not a new intake type in this scope. New weekly narrative uploads use `weekly_update`.

### 12.4 Replay Keying, Artifact Format, and Publish Guards

- Replay-key hash algorithm: SHA-256.
- Canonical serialization: UTF-8 JSON with sorted object keys, normalized `\n` line endings, and no transient runtime fields.
- Replay artifact path convention: `<evalCacheDir>/<sourceFamily>/<modelId>/<promptVersion>/<schemaVersion>/<sha256>.json`.
- Replay invalidation rule: any change to prompt version, model id, source-family schema version, or canonical normalized payload changes the replay key and results in a miss until a new artifact is captured.
- Replay artifact envelope must persist `rawOutputText`, `parsedJson`, and `validatedPayload`; callers consume `validatedPayload`.
- Aggregate publish guard: publication compares the expected latest aggregate version, evidence version, and source-set hash against current published state before replacement.
- Stale publication behavior: if the guard no longer matches, the publish is rejected as `STALE_PUBLICATION_REJECTED`.

### 12.5 Storage Architecture

- Primary store: DuckDB runtime-state tables already in use.
- Replay store: filesystem artifacts under `runtimeConfig.semantic.evalCacheDir` with replay key -> JSON envelope mapping.
- Retrieval index: `rag_chunks` table in the DuckDB runtime database (schema owned by `server/src/rag/prototypeDuckDbStore.js`). Per-upload writes route through Module 7 for retrieval-eligible families; fixed-schema structured exports do not write to this table.
- Artifact boundary: replay artifacts contain captured raw model output, parsed JSON, validated payload, and schema/prompt metadata; they are not synthesized at read time.
- Consistency rule: if extraction validation, aggregate validation, aggregate publication, embedding generation, or DuckDB indexing fails, the published aggregate remains unchanged and no new `rag_chunks` rows publish for that source.
- Monotonicity rule: older async jobs may not replace a newer valid published aggregate.
- **Idempotency rule** (see §11.1 Module 7): re-running Module 7 for the same `sourceId` deletes existing `rag_chunks` rows for that source and inserts replacement rows inside one DuckDB transaction. Duplicates are structurally impossible; `chunk_id` is deterministic (`"<sourceId>::<chunkIndex>"`).
- **Atomicity rule** (see §11.1 Module 7): chunk-delete + chunk-insert + source-record indexing-field stamping are wrapped in a single DuckDB transaction. A failure mid-stage rolls back to the prior committed state; no torn index is ever visible to Ask.
- **Observability rule**: every failed or rolled-back Module 7 transaction logs `sourceId`, `productId`, `stageName`, `errorCode`, and the prior vs attempted `chunk_count` so operators can diagnose without re-reading raw DuckDB state.

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
    "enableExtractionReplayMode": true,
    "enableDentalRetrievalIndexing": true
  }
}
```

`featureFlags` conforms to the `EffectiveFeatureFlags` contract in §12.2. The session response MUST include the full key set — no partial flag payloads.

**`POST /api/v1/products/:productId/sources`**

Request remains existing multipart contract.

Response (`202`):
```json
{
  "jobId": "job-1042",
  "sourceId": "src-2401",
  "status": "queued",
  "title": "Dental Vendor Mitigation Confirmed",
  "sourceType": "email",
  "sourceFamilyClass": "retrieval_eligible",
  "effectiveExecutionMode": "replay",
  "effectiveFeatureFlags": {
    "enableNovaDentalLiveEmail": false,
    "enableDentalTrustSurfaces": true,
    "enableDentalSemanticServiceSplit": true,
    "enableExtractionReplayMode": true,
    "enableDentalRetrievalIndexing": true
  },
  "updatedDomains": ["sources", "ask", "reports"]
}
```

`effectiveFeatureFlags` conforms to `EffectiveFeatureFlags` in §12.2 — full key set, no partial payloads.

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
    "sourceFamilyClass": "retrieval_eligible",
    "extractionStatus": "completed",
    "validationStatus": "valid",
    "indexingStatus": "indexed",
    "chunkCount": 6,
    "embeddingDims": 1024,
    "embeddingSource": "titan",
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

For fixed-schema structured exports (e.g., `risk_export`), the same shape is used with `sourceFamilyClass="fixed_schema_structured"`, `indexingStatus="not_applicable"`, `chunkCount=0`, `embeddingDims=null`, `embeddingSource="none"`. For `spreadsheet_attachment`, `sourceFamilyClass="deferred"`, `indexingStatus="not_applicable"`. When the indexing kill-switch is off for a retrieval-eligible source, `indexingStatus="disabled"`, `chunkCount=0`.

**`POST /api/v1/products/:productId/ask`**
```json
{
  "status": "complete",
  "answerHtml": "<strong>Evidence-backed response:</strong> ...",
  "sources": [
    {
      "sourceId": "src-risk-export-12",
      "title": "Dental Risk Register",
      "meta": "2026-04-16 - risk_export",
      "sourceType": "risk_export",
      "retrievalType": "structured",
      "precedenceNote": null
    },
    {
      "sourceId": "src-2401",
      "title": "Dental Vendor Mitigation Confirmed",
      "meta": "2026-04-16 - email",
      "sourceType": "email",
      "retrievalType": "vector",
      "precedenceNote": "Cited for context; structured row is the field-of-record."
    }
  ],
  "precedenceDecision": {
    "resolution": "merged",
    "exactFieldConflict": false,
    "winner": "structured",
    "narrativeCitedForContext": true
  },
  "retrievalWarnings": [],
  "semanticState": {
    "freshnessStatus": "degraded",
    "usesLastKnownGood": true,
    "showBanner": true,
    "bannerTone": "warning",
    "message": "This answer is using the last published product understanding while newer evidence is still being validated."
  }
}
```

When a retrieval-eligible source that would otherwise have matched is currently `indexingStatus=disabled` or `indexingStatus=failed`, the response includes a `retrievalWarnings` entry of the form `{ "code": "RETRIEVAL_NOT_READY", "sourceId": "src-...", "message": "This source is not yet retrievable." }`. This is a soft warning and does not change `status`.

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
    "enableExtractionReplayMode": true,
    "enableDentalRetrievalIndexing": true
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
    "enableExtractionReplayMode": true,
    "enableDentalRetrievalIndexing": true
  },
  "sourceFamilyModes": {
    "email": "replay",
    "document": "replay",
    "transcript": "replay",
    "slide_deck": "replay",
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
| Embedding unavailable | async completed job with `indexingStatus=failed` on the new source | `EMBEDDING_UNAVAILABLE` (returned as a source-scoped warning, not a job-level failure) | Retry requires re-upload (new `sourceId`) | Show indexing-failed label + recovery copy on Source Detail; Overview/Timeline/Reports refresh normally; Ask shows `RETRIEVAL_NOT_READY` chip when the source would match | Module 7 transaction rolls back; stamp `indexingStatus=failed`; orchestrator continues to Stage 7/8; aggregate publication proceeds on validated Nova JSON |
| Indexing failed | async completed job with `indexingStatus=failed` on the new source | `INDEXING_FAILED` (source-scoped) | Retry requires re-upload | Same as above | DuckDB write failed; Module 7 transaction rolls back; aggregate publication proceeds (Option 2) |
| Retrieval not ready | Ask 200 with `retrievalWarnings[]` | `RETRIEVAL_NOT_READY` | N/A (soft warning) | Show warning chip on the affected source in Ask; do not block the answer | Emit warning when a source that would match is currently `indexingStatus=disabled` or `indexingStatus=failed` |

### 13.4 State-API-Backend Mapping Table

| User Action | UI State (Before) | API Call | Backend Processing | API Response | UI State (After) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Upload replay-backed email with cache hit | Overview idle | `POST /sources` | normalize -> replay lookup hit -> AJV validate -> citations -> publish | `202` with `effectiveExecutionMode=replay` | Processing then refreshed state |
| Upload replay-backed email with cache miss | Overview idle | `POST /sources` + `GET /jobs/:jobId` | normalize -> replay lookup miss | failed job with `REPLAY_CACHE_MISS` | Error panel, last-known-good state preserved |
| Open fresh seeded report | Reports tab with `reportId` | `GET /reports/:reportId` | compute report semantic presentation | flat report response with `showBanner=false` | No semantic warning banner |
| Open degraded seeded report | Reports tab with `reportId` | `GET /reports/:reportId` | compute degraded semantic presentation | flat report response with `showBanner=true`, `bannerTone=warning` | Warning banner visible |
| Reset non-prod runtime with trust surfaces off | Any | `POST /api/v1/test/reset` | persist explicit feature flags | effective flags returned | UI stops rendering trust surfaces after refetch |
| Upload retrieval-eligible email with indexing enabled | Overview idle | `POST /sources` | normalize -> extract -> validate -> citations -> chunk -> Titan embed -> `rag_chunks` -> aggregate validate -> publish | `202` with `sourceFamilyClass=retrieval_eligible` | Processing then refreshed state; Source Detail shows `indexingStatus=indexed` |
| Ask about newly uploaded retrieval-eligible source | Overview after successful upload | `POST /ask` | structured+vector precedence merge; new source matches via DuckDB vector search | Ask response cites `src-2401` with `retrievalType=vector` | Answer renders with labeled source chip; no reset required |
| Upload fixed-schema structured export (e.g., risk_export) | Overview idle | `POST /sources` | normalize -> parse rows -> validate rows -> aggregate validate -> publish (Stage 6b skipped) | `202` with `sourceFamilyClass=fixed_schema_structured` | Data tab updates; Source Detail shows `indexingStatus=not_applicable`; 0 new `rag_chunks` rows |
| Upload retrieval-eligible source with embedding failure | Overview idle | `POST /sources` + `GET /jobs/:jobId` | normalize -> extract -> validate -> chunk -> Titan throws -> Module 7 rolls back -> stamp `indexingStatus=failed` -> aggregate still validates and publishes | `completed` job; source carries `indexingStatus=failed` with `EMBEDDING_UNAVAILABLE` reason | Overview refreshes with the new aggregate; Source Detail shows `indexingStatus=failed` + recovery copy; Ask emits `RETRIEVAL_NOT_READY` when that source would match |
| Upload retrieval-eligible source with kill-switch off | Overview idle | `POST /sources` | full lifecycle minus Stage 6b; aggregate still publishes | `202` with `sourceFamilyClass=retrieval_eligible` | Source Detail shows `indexingStatus=disabled`; Ask returns `RETRIEVAL_NOT_READY` soft-warn for that source |
| Ask question with structured+narrative exact-field conflict | Any | `POST /ask` | precedence resolver picks structured row for field value; narrative cited for context | response with `precedenceDecision.exactFieldConflict=true`, `winner=structured` | Answer uses structured value prominently; narrative chip carries precedence note |

### 13.5 Internal Service Contracts

- `resolveEffectiveFeatureFlags({ runtimeConfig, persistedSemanticConfig, overrideFeatureFlags, legacyFeatureMode }) -> EffectiveFeatureFlags`
- `buildReplayKey({ normalizedPayload, promptVersion, modelId, sourceFamily }) -> string`
- `readReplayExtraction({ replayKey }) -> ReplayLookupResult`
- `validateSourceExtraction({ sourceFamily, payload }) -> ValidatedSourceExtraction`
- `validateAggregatePayload({ productId, aggregatePayload }) -> ValidatedAggregatePayload`
- `publishAggregateFromExtraction({ productId, sourceExtractionRun, validatedAggregatePayload, currentAggregate, publicationGuard }) -> { aggregateRun, aggregateRecord }`
- `getSourceFamilyClass({ sourceType }) -> 'retrieval_eligible' | 'fixed_schema_structured' | 'deferred'` (new helper in `shared/artifactTypes.js`; derives from `SOURCE_TYPE_DEFINITIONS` and `isStructuredImportType`).
- `chunkNormalizedSource({ sourceId, productId, normalizedText, metadata }) -> Array<ChunkArtifact>` (wraps `buildChunkArtifacts`).
- `embedChunks({ chunks, embedModelId, embedDims }) -> Array<{ chunkId, embedding: number[], embeddingSource }>` (wraps `embedTexts`).
- `indexChunks({ provider, chunks, embeddings, productId, sourceId, sourceType, sourceDate }) -> IndexingResult` (wraps `prototypeDuckDbStore.indexDocuments`).
- `runChunkingAndIndexing({ validatedExtraction, normalizedSource, featureEnvelope }) -> IndexingResult` (Module 7 entry point; enforces family-class gating and kill-switch semantics).
- `searchRetrievalEligible({ productId, query, topK }) -> Array<RetrievalHit>` (thin wrapper over `retrievalProvider.search`).
- `askPrecedenceMerge({ question, structuredHits, vectorHits }) -> { sources: Array<SourceChip>, decision: AskPrecedenceDecision, retrievalWarnings: Array<RetrievalWarning> }` — enforces: structured wins on fixed-schema row facts; vector wins on narrative/causal questions; both-fire returns merged+labeled sources; on exact-field conflict structured row truth wins with narrative cited for context.

### 13.6 Terminal Job Semantics (Family-Aware)

Job status must be one of `queued`, `in_progress`, `completed`, `partial`, `failed`. The `completed` state is defined per `sourceFamilyClass` and is the ONLY state that may claim a successful full lifecycle. **Per Option 2 (§21.2), `completed` for retrieval-eligible families is defined by aggregate-side success; retrievability is a secondary property observable on the source record via `indexingStatus`.** `partial` and `failed` preserve last-known-good aggregate state.

**`completed` — retrieval-eligible family (`email`, `transcript`, `document`, `slide_deck`, `weekly_update`):**

All of the following must be true for the job to be marked `completed`, regardless of whether indexing succeeded, was disabled, or failed:

1. Raw artifact persisted.
2. Normalized artifact persisted.
3. Source extraction acquired (live via Bedrock or replay via cache read).
4. Source extraction schema-valid (AJV).
5. Citation projection complete.
6. Module 7 (Stage 6b) ran to a terminal retrieval state — one of:
   - **`indexingStatus=indexed`** when `enableDentalRetrievalIndexing=true` AND Titan + DuckDB writes succeeded. Must have ≥1 chunk, ≥1 Titan embedding with `embeddingSource=titan` (`pseudo` test-only), vector length = `bedrock.embedDims`, and ≥1 `rag_chunks` row with full product/source/family metadata and L2-normalized embedding. `chunkCount > 0`.
   - **`indexingStatus=disabled`** when `enableDentalRetrievalIndexing=false`. Module 7 is skipped. `chunkCount = 0`.
   - **`indexingStatus=failed`** when `enableDentalRetrievalIndexing=true` AND Titan or DuckDB threw. Module 7's transaction rolled back cleanly; no partial `rag_chunks` rows; `chunkCount = 0`; failure reason recorded.
7. Aggregate assembled and schema-valid (AJV).
8. Monotonic aggregate publication CAS succeeded (`publishedFromRunId` references the aggregate publication run).
9. Runtime/read-model refreshed.

**Retrievability implication (authoritative):**
- `completed` + `indexingStatus=indexed` → the source is retrievable via DuckDB vector search (citable in Ask without reset).
- `completed` + `indexingStatus=disabled` → Ask emits `RETRIEVAL_NOT_READY` for that source. Recovery: re-upload after re-enabling the flag, or app-boot seed rebuild.
- `completed` + `indexingStatus=failed` → Ask emits `RETRIEVAL_NOT_READY` for that source. Recovery: re-upload once Titan/DuckDB is healthy (new `sourceId`; failed record retained for audit). The aggregate already reflects this source's validated Nova JSON — no re-publication is needed post-recovery for Overview/Timeline/Reports freshness; only the retrievability of this specific `sourceId` is affected.

**`completed` — fixed-schema structured exports (`risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`):**

1. Raw artifact persisted.
2. Deterministic rows parsed.
3. Row validation passed.
4. Aggregate assembled and schema-valid (AJV).
5. Monotonic aggregate publication CAS succeeded.
6. Runtime/read-model refreshed.
7. Source record stamped with `sourceFamilyClass=fixed_schema_structured`, `indexingStatus=not_applicable`, `chunkCount=0`, `embeddingDims=null`.
8. NO `rag_chunks` rows are written for that `sourceId`.

**`completed` — deferred families (`spreadsheet_attachment` in this scope):**

Normalize + store are allowed; publication may proceed if the family participates in aggregate truth, but this corrective scope does not add such participation. Source record carries `sourceFamilyClass=deferred`, `indexingStatus=not_applicable`.

**`partial`:**

Source (and where applicable, normalized artifact) were stored, aggregate publication attempted but did not complete successfully. Last-known-good aggregate remains active. User-facing state must disclose degraded or preserved-state status via the backend-authoritative banner contract. Examples: `AGGREGATE_INVALID` (aggregate payload failed AJV), `PUBLICATION_FAILED` (publication exception), `STALE_PUBLICATION_REJECTED` (monotonic CAS guard mismatch).

**Note:** Indexing failures (`EMBEDDING_UNAVAILABLE`, `INDEXING_FAILED`) are NOT `partial` under Option 2 — the aggregate still publishes, so the job is `completed` with `indexingStatus=failed` on the affected source. This is intentional asymmetry between aggregate truth (which remains healthy) and retrieval readiness (which is degraded per source).

**`failed`:**

Required semantic processing could not produce a trustworthy result — typically replay cache miss in strict replay mode (`REPLAY_CACHE_MISS`), invalid extraction that blocks aggregate input (`EXTRACTION_INVALID`), source normalization failure, or orchestrator-level faults. No new semantic state may publish. Last-known-good aggregate remains active.

**Ask precedence rule (policy summary):**

When a question can be answered from both structured retrieval and vector retrieval:
- Structured retrieval wins on fixed-schema row facts (e.g., a specific `mitigation_due_date` column value from `risk_export`).
- Vector retrieval wins on narrative, causal, or context questions (why, how, what happened).
- If both fire, the response merges sources and labels each chip with `retrievalType=structured | vector`; structured chips render first.
- If the two conflict on the value of an **exact field**, the structured row value wins as the field-of-record; the narrative source is still cited for context and its chip carries a precedence note. The resolution is logged in `askPrecedenceDecision`.

### 13.7 Ask Precedence — Deterministic Evaluation Algorithm (authoritative)

This section converts the policy above into an executable contract. All Ask-side implementations MUST produce byte-identical `AskPrecedenceDecision` output given the same inputs. Two independent implementations are expected to be compile-compatible against this spec.

**Signature:**

```
askPrecedenceMerge({
  question: string,
  productId: string,
  structuredHits: Array<StructuredHit>,   // from retrieveStructuredEvidence
  vectorHits: Array<VectorHit>,           // from retrievalProvider.search
  productSourceIndex: Array<SourceIndexEntry>   // for RETRIEVAL_NOT_READY emission
}) -> {
  sources: Array<SourceChip>,             // ordered, labeled
  decision: AskPrecedenceDecision,
  retrievalWarnings: Array<RetrievalWarning>
}
```

Where:

```
StructuredHit = {
  sourceId: string,
  sourceType: string,
  matchedFieldName: string | null,
  fieldValue: string | number | null,
  matchConfidence: number,      // 0..1, deterministic from row-match rules
  sourceDate: ISO8601 | null
}

VectorHit = {
  sourceId: string,
  sourceType: string,
  chunkId: string,
  score: number,                // cosine similarity, 0..1
  sourceDate: ISO8601 | null,
  assertsFieldName: string | null,      // best-effort field extraction from chunk
  assertedFieldValue: string | null
}

SourceIndexEntry = {
  sourceId: string,
  sourceType: string,
  sourceFamilyClass: 'retrieval_eligible' | 'fixed_schema_structured' | 'deferred',
  indexingStatus: 'indexed' | 'queued' | 'failed' | 'disabled' | 'not_applicable',
  productScopedTextMatch: boolean        // cheap metadata prefilter for RETRIEVAL_NOT_READY
}
```

**Algorithm:**

1. **Run both retrievers.** Structured retrieval runs first so its hits are available during classification. Vector retrieval runs in parallel or immediately after; neither short-circuits the other.
2. **Classify intent (deterministic — no model inference):**
   - Tokenize `question` (lowercase, strip punctuation, split on whitespace, stem with a fixed stemmer).
   - Compute `exactFieldQuery = true` iff there exists any `StructuredHit` where `matchedFieldName` (normalized by the same stemmer) appears as a token in the question AND `fieldValue != null`.
   - Otherwise `intent = 'narrative'`.
3. **Detect exact-field conflict** (only when `exactFieldQuery=true`):
   - `exactFieldConflict = true` iff there exists a pair (`StructuredHit s`, `VectorHit v`) where `s.matchedFieldName == v.assertsFieldName` AND `normalize(s.fieldValue) != normalize(v.assertedFieldValue)`.
4. **Resolve:**
   - If `exactFieldQuery=true`:
     - `winner = 'structured'`.
     - `narrativeCitedForContext = vectorHits.length > 0`.
     - Answer body uses the winning structured `fieldValue` verbatim (it is the field-of-record).
     - `resolution = exactFieldConflict ? 'structured_wins_conflict' : 'structured_wins_no_conflict'`.
   - Else if `structuredHits.length > 0 && vectorHits.length > 0`:
     - `winner = 'merged'`. `exactFieldConflict = false`. `resolution = 'merged'`.
   - Else if `structuredHits.length > 0`:
     - `winner = 'structured'`. `resolution = 'structured_only'`.
   - Else if `vectorHits.length > 0`:
     - `winner = 'vector'`. `resolution = 'vector_only'`.
   - Else:
     - `winner = 'none'`. `resolution = 'no_evidence'`. `sources = []`.
5. **Build chip ordering (stable sort — deterministic tie-breaks):**
   - Structured chips first (always, when present). Within structured:
     1. Exact-field matches (highest first by `matchConfidence`).
     2. Non-exact matches by `matchConfidence` descending.
     3. Tie-break: `sourceDate` descending (null last).
     4. Final tie-break: `sourceId` ascending (lexicographic).
   - Vector chips second. Within vector:
     1. `score` descending.
     2. Tie-break: `sourceDate` descending (null last).
     3. Final tie-break: `sourceId` ascending.
   - When `exactFieldQuery=true`, narrative/vector chips ALWAYS carry `precedenceNote = "Cited for context; structured row is the field-of-record."`
   - When `exactFieldConflict=true`, the winning structured chip carries `ask-structured-row-badge`; conflicting narrative chips carry the precedence note above AND are annotated with `conflictingFieldValue` for operator inspection.
6. **Retrieval-not-ready warnings:**
   - For every `SourceIndexEntry e` where `e.sourceFamilyClass == 'retrieval_eligible'`, `e.productScopedTextMatch == true`, and `e.indexingStatus ∈ {'disabled', 'failed', 'queued'}`:
     - Emit `retrievalWarnings[] += { code: 'RETRIEVAL_NOT_READY', sourceId: e.sourceId, indexingStatus: e.indexingStatus }`.
   - This is a soft warning — it does not change `status` and does not alter chip ordering.
7. **Log `askPrecedenceDecision`** with the question hash (SHA-256 of the normalized question), `productId`, `resolution`, `exactFieldConflict`, `winner`, `narrativeCitedForContext`, structured hit count, vector hit count, and the chosen winning `sourceId` (if any). This log is operator-diagnosable and test-fixture-reproducible.

**Determinism contract:**

- No step above uses model inference, random seeds, or wall-clock time.
- String normalization (tokenization, stemming, value normalization) MUST be identical across callers — implemented in a shared helper.
- Two invocations with the same inputs produce identical `sources` ordering, identical `decision`, and identical `retrievalWarnings` (order included).
- A fixture-based test MUST compare full output equality (not just structural).

**Example — exact-field conflict:**

Question: `"When is the staged mitigation due?"`
- `structuredHits = [{ sourceId: "src-risk-12", matchedFieldName: "mitigation_due_date", fieldValue: "2026-04-18", matchConfidence: 0.95, sourceDate: "2026-04-16", sourceType: "risk_export" }]`
- `vectorHits = [{ sourceId: "src-2401", chunkId: "src-2401::2", score: 0.82, sourceDate: "2026-04-15", sourceType: "email", assertsFieldName: "mitigation_due_date", assertedFieldValue: "2026-04-19" }]`
- Result: `exactFieldQuery=true`, `exactFieldConflict=true`, `winner="structured"`, `resolution="structured_wins_conflict"`, `narrativeCitedForContext=true`.
- Chips: `[{ sourceId: "src-risk-12", retrievalType: "structured", badge: "field-of-record" }, { sourceId: "src-2401", retrievalType: "vector", precedenceNote: "Cited for context; structured row is the field-of-record.", conflictingFieldValue: "2026-04-19" }]`.
- Answer body uses `"2026-04-18"` (the structured value).

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
| `ENABLE_DENTAL_RETRIEVAL_INDEXING` | boolean | true in dev/test | No | BE | Per-upload retrieval indexing kill-switch for retrieval-eligible Dental families. Maps to `features.enableDentalRetrievalIndexing` on the runtime config object (camelCase convention). When off, retrieval-eligible uploads publish with `indexingStatus=disabled`. Must be explicitly enabled in production. |
| `EIDS_ENABLE_BEDROCK` | boolean | false in test | No | BE | Existing gate that must be true for Titan calls to reach Bedrock; required for release-signoff provider-backed proof. |
| `EIDS_RETRIEVAL_PROVIDER` | string | `duckdb` | No | BE | Existing retrieval provider selector (`duckdb` | `duckdb-bedrock` | `kb`). Corrective scope stays on `duckdb`. |

### 14.2 Feature-Flag Rules

| Flag | Default | Side | Required Behavior |
| :--- | :--- | :--- | :--- |
| `ENABLE_NOVA_DENTAL_LIVE_EMAIL` | false | Both | When false, email-family policy cannot resolve to live. |
| `ENABLE_DENTAL_TRUST_SURFACES` | false | Both | When false, trust UI is hidden and backend read models return `showBanner=false` plus omit trust-specific rendering emphasis. |
| `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` | false | BE | When false, semantic service split path is not used. When true, upload/publication flows must route through semantic services. |
| `ENABLE_EXTRACTION_REPLAY_MODE` | true in test | BE | When false, replay mode is not available. When true, replay uses the real replay store only. |
| `ENABLE_DENTAL_RETRIEVAL_INDEXING` | true in dev/test | BE | When true, Module 7 runs for retrieval-eligible Dental uploads (Stage 6b). When false, retrieval-eligible uploads skip Stage 6b, stamp `indexingStatus=disabled`, and still publish; Ask may emit `RETRIEVAL_NOT_READY` soft-warn. Never gates fixed-schema structured exports (they are family-class excluded, not flag excluded). |

### 14.3 Override Rules

- Non-production reset requests may override flags only through the `featureFlags` object.
- `legacyFeatureMode` may be accepted only as a deprecated alias that is translated into `featureFlags` server-side during migration.
- Public UI must not display `featureMode` as semantic provenance.
- `featureMode` must not appear in end-user route payloads after this corrective scope lands.
- `featureMode` alias support is non-production only and must be removed after the corrective scope lands and test helpers have migrated to explicit `featureFlags`.
- `retrieval.allowPseudoEmbeddings` is test-only. Production signoff with `embeddingSource=pseudo` anywhere in the current window is explicitly forbidden; release signoff must include at least one Titan-backed provider proof (AC-G-017).

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
- `sourceFamilyClass`
- `retrievalEligible`
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
- `indexingStatus`
- `chunkCount`
- `embeddingDims`
- `embeddingSource`
- `embedModelId`
- `retrievalProvider`
- `askPrecedenceDecision` (on Ask responses)
- `retrievalWarningCodes` (on Ask responses)

### 15.3 Failure Modes & Recovery

| Failure Scenario | Detection | User Impact | System Impact | Recovery |
| :--- | :--- | :--- | :--- | :--- |
| Replay cache miss | replay store miss | Upload fails with preserved-state copy | No new extraction/publication | Seed cache or switch to live |
| Invalid extraction | AJV validation failure | Upload fails with validation copy | Invalid extraction persisted, no publication | Fix prompt/cache artifact and retry |
| Invalid aggregate payload | aggregate AJV validation failure | Upload fails with preserved-state copy | New source extraction exists, aggregate not published | Fix aggregate projector/schema and retry publication |
| Publication failure | publication exception | Degraded last-known-good surfaces remain | Aggregate not updated | Retry publication only |
| Stale async publication | publish guard mismatch | User keeps seeing newest valid state | Older job does not overwrite newer aggregate | No recovery required; retry only from newest state |
| Trust flags off | session feature flags | Trust UI hidden | Read-model surfaces stay conservative | Re-enable flag and refetch |
| Titan embedding unavailable | `embedTexts` throws / Bedrock error | Aggregate-side posture refreshes normally; that specific source is not retrievable via Ask (shows `RETRIEVAL_NOT_READY`) | `indexingStatus=failed`; no `rag_chunks` rows for that `sourceId`; aggregate CAS proceeds on validated Nova JSON (Option 2) | Restore Titan availability; re-upload to index (new `sourceId`). Overview/Timeline/Reports do NOT require a re-publish |
| DuckDB `rag_chunks` write failure | `indexDocuments` throws | Same as above | Same as above | Re-upload; if persistent, inspect DuckDB runtime file under `runtimeConfig.storage.paths.duckDbFile` |
| Retrieval indexing disabled (kill-switch) | `features.enableDentalRetrievalIndexing=false` | Retrieval-eligible source publishes but is not citable in Ask | `indexingStatus=disabled`; 0 `rag_chunks` rows | Re-enable the flag; reset and re-ingest or rely on app-boot seed rebuild |
| Pseudo-embedding fallback active | `retrieval.allowPseudoEmbeddings=true` in test | Functionally works but `embeddingSource=pseudo` on source record | Release signoff cannot be claimed | For signoff, run with Titan enabled and `allowPseudoEmbeddings=false` |
| Ask precedence conflict | structured row and narrative disagree on an exact field | User sees structured value as field-of-record; narrative chip carries precedence note | `askPrecedenceDecision.exactFieldConflict=true` logged | No user recovery required; operator can inspect decision log |

### 15.4 Rollback Plan

- Rollback trust-surface UI by disabling `ENABLE_DENTAL_TRUST_SURFACES`.
- Rollback service split by disabling `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT`.
- Replay truth and validation do not roll back to heuristic mode; rollback must remain fail-closed.
- Rollback retrieval indexing by disabling `ENABLE_DENTAL_RETRIEVAL_INDEXING`. Existing `rag_chunks` rows remain (they are still valid for prior sources); new retrieval-eligible uploads publish with `indexingStatus=disabled` until the flag is re-enabled.

### 15.5 Retry and Re-Ingest Semantics (authoritative)

The following is the single operator-facing contract for recovery. It is binding — implementations may not invent alternative retry paths.

**`REPLAY_CACHE_MISS` (strict replay mode):**
- Source is not stored. Nothing to roll back.
- Recovery: seed the replay cache with the required artifact OR switch the source family to live mode, then re-upload. The new upload produces a new `sourceId`.

**`EXTRACTION_INVALID`:**
- Source is stored as `validationStatus=invalid` for audit. Validation errors are persisted.
- Recovery: fix the prompt, fix the replay cache artifact, or fix the upstream model configuration, then re-upload. Re-upload produces a new `sourceId`. The failed record is retained for audit and is never auto-retried.

**`EMBEDDING_UNAVAILABLE` / `INDEXING_FAILED` (Option 2 — decoupled from publication):**
- Source is stored; extraction is valid. Module 7's transaction rolled back so no partial `rag_chunks` rows exist. Source record carries `indexingStatus=failed` and a typed failure reason.
- Aggregate already reflects the new source's validated Nova JSON — the aggregate CAS publication proceeded unconditionally. Overview/Timeline/Reports are fresh; no re-publication is required once indexing is restored.
- Retrievability for this specific `sourceId` remains degraded until the artifact is re-uploaded. Ask emits `RETRIEVAL_NOT_READY` for that source when it would otherwise match.
- Recovery (this corrective scope): re-upload the artifact once Titan/DuckDB is healthy. Re-upload produces a new `sourceId` that runs the clean lifecycle. The failed record is retained for audit and is never auto-retried.
- **Out of scope:** a reindex-only endpoint that reuses the existing `sourceId` (would require a dedicated `POST /sources/:sourceId/reindex` route and state-machine transitions `failed → queued → indexed`). Deferred to a follow-on FSFS.

**`indexingStatus=disabled` (kill-switch off for a retrieval-eligible family):**
- Source is stored and aggregate may have published. No `rag_chunks` rows were written.
- Recovery when the flag flips back on:
  - New uploads index normally.
  - Existing `disabled` sources are NOT auto-reindexed in this scope.
  - The existing app-boot seed path (`server/src/app.js:46-50`: `resetPrototypeDuckDbStore` + `provider.indexDocuments(buildCorpusDocuments(state))`) continues to rebuild from seeded state at process restart — this is the supported recovery channel until a dedicated reindex endpoint lands.
  - Re-upload is also a valid recovery, producing a new `sourceId`.

**`PUBLICATION_FAILED` / `AGGREGATE_INVALID`:**
- Source is stored; extraction valid; Module 7 succeeded (`rag_chunks` rows exist); aggregate publication failed.
- Recovery: fix the aggregate assembler/schema and retry publication only. This does NOT require re-uploading the source or re-embedding. A publication-only retry path is in scope for the publication service (§11.1 Module 5) but does not introduce a new operator-facing endpoint in this scope — retries are triggered by the next successful ingest or by a targeted admin action.

**`STALE_PUBLICATION_REJECTED`:**
- Expected behavior under concurrent uploads. No recovery required — the newer valid aggregate is already active.

**User-facing copy during recovery (authoritative):**
- `indexingStatus=failed` Source Detail copy: `This source was stored, but indexing did not complete. Re-upload the file once the embedding service is available.`
- `indexingStatus=disabled` Source Detail copy: `Retrieval indexing is currently disabled for Dental. This source is stored and published, but Ask cannot cite it until indexing is re-enabled.`
- `indexingStatus=queued` Source Detail copy: `Indexing in progress. This source will become searchable once indexing completes.`
- Ask `RETRIEVAL_NOT_READY` chip copy: `This source is stored but not yet retrievable.`

**Idempotency guarantees visible to the user:**
- Re-uploading the exact same artifact produces a distinct `sourceId` (the ingest path treats each upload as a new record). Deduplication is out of scope for this corrective pass.
- If a reindex-only endpoint is later added, it MUST reuse Module 7's idempotent transaction so that retrying a reindex on the same `sourceId` is safe (§11.1 idempotency contract).

## 16. Phased Implementation Plan

### 16.1 Phase Overview

| Phase | Name | FE Scope | BE Scope | Stub/Mock Boundary | Integration Checkpoint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Replay Truth & Validation | Minimal new error rendering | Add replay store, explicit hashing/artifact rules, and AJV validation; remove heuristic replay | FE may use failed-job fixtures for replay miss/invalid extraction | Replay cache hit and miss both behave truthfully |
| 2 | Honest Trust Presentation & Real Flags | Gate trust UI from session flags; fix report banner rendering | Make session/reset/read-model behavior flag-authoritative | FE may use fixture session payloads with flags | Fresh report shows no banner; trust surfaces hide until flags resolve and remain hidden when disabled |
| 3 | Aggregate Integrity & Provenance Hardening | No major UX change | Add aggregate validation, monotonic publish CAS, aggregate publication runs, and corrected provenance fields | No FE mock needed | Publication is valid, monotonic, and queryable |
| 4 | Retrieval Lifecycle & Provider-Backed Signoff | Source Detail renders `indexingStatus`; Ask chips label structured vs. vector; `RETRIEVAL_NOT_READY` soft-warn copy | Add Module 7 (chunking + Titan + `rag_chunks`); generalize the transcript-only indexing pattern; wire Ask precedence; add `ENABLE_DENTAL_RETRIEVAL_INDEXING` and `features.enableDentalRetrievalIndexing`; add `getSourceFamilyClass` helper | None — real Titan + DuckDB only for the signoff proof | Retrieval-eligible upload → Ask cites new source without reset; structured upload → 0 `rag_chunks` rows; kill-switch off path; provider-backed round-trip proof |

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

**Phase 4: Retrieval Lifecycle & Provider-Backed Signoff**
- Backend tasks:
  - Add `features.enableDentalRetrievalIndexing` to `server/src/config/runtime.js` and the session/reset contracts.
  - Add `getSourceFamilyClass()` helper to `shared/artifactTypes.js`.
  - Create Module 7 at `server/src/services/semantic/chunkingAndIndexing.service.js`, reusing `buildChunkArtifacts`, `embedTexts`, `getEmbeddingDims`, and `prototypeDuckDbStore.indexDocuments`.
  - Generalize the transcript-only indexing call in `server/src/services/domain/mutation.service.js` (around line 91, `indexTranscriptEvidence`) to invoke Module 7 for all retrieval-eligible Dental families.
  - Tighten `rag_chunks` metadata coverage so every new row carries `product_id`, `source_id`, `source_type`, `source_date`, and `chunk_index`.
  - Wire explicit Ask precedence in `server/src/services/domain/ask.service.js` via `askPrecedenceMerge`, logging `askPrecedenceDecision` and emitting `retrievalWarnings`.
  - Extend source-detail read model to expose `sourceFamilyClass`, `indexingStatus`, `chunkCount`, `embeddingDims`, `embeddingSource`.
- Frontend tasks:
  - Render `indexingStatus` on Source Detail when `sourceFamilyClass=retrieval_eligible`; hide when `not_applicable`.
  - Add `retrievalType=structured|vector` labels on Ask source chips; render precedence note on conflict.
  - Render `RETRIEVAL_NOT_READY` soft-warn inline when Ask returns it.
- Integration checkpoint:
  - Upload a retrieval-eligible source → Ask cites it via vector retrieval in the same session without reset.
  - Upload a `risk_export` → Data/Overview update, 0 new `rag_chunks` rows, Ask structured retrieval serves the facts.
  - Toggle `ENABLE_DENTAL_RETRIEVAL_INDEXING=false` → retrieval-eligible upload still publishes with `indexingStatus=disabled`; Ask returns `RETRIEVAL_NOT_READY` for that source.
  - One provider-backed local/dev proof (Nova + Titan + DuckDB + Ask retrieval + publication + surface refresh) passes.

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
- `AC-G-012`: Every successful retrieval-eligible Dental upload with `enableDentalRetrievalIndexing=true` completes the full lifecycle: raw artifact persistence, normalized artifact persistence, schema-valid source extraction JSON acquisition, source extraction persistence, citation projection, chunk creation, Titan embedding generation, DuckDB `rag_chunks` persistence, aggregate JSON assembly, aggregate validation, monotonic aggregate publication, and runtime read-model refresh.
- `AC-G-013`: No job may be marked `completed` unless all required lifecycle steps for its `sourceFamilyClass` succeed (per §13.6). Any downstream failure after source storage yields `partial` or `failed`, and preserves the last known good published aggregate.
- `AC-G-014`: Application surfaces (Overview, Source Detail, Ask, Reports, Timeline, Data) may only be updated from validated source JSON, validated aggregate JSON, or explicitly allowed deterministic structured rows. Raw model prose, parse-but-unvalidated JSON, and heuristic fallbacks are forbidden from updating user-visible state.
- `AC-G-015`: Every successfully completed retrieval-eligible Dental upload with `enableDentalRetrievalIndexing=true` AND `indexingStatus=indexed` produces at least one retrieval chunk and a corresponding Titan embedding persisted in `rag_chunks` with `productId`, `sourceId`, `sourceType` (from `shared/artifactTypes.js`), `sourceDate`, and `chunkIndex` metadata. When `indexingStatus ∈ {disabled, failed}` the upload may still be `completed` per Option 2 but produces 0 `rag_chunks` rows.
- `AC-G-016`: After a retrieval-eligible upload reaches `completed` with `indexingStatus=indexed`, a product-scoped retrieval query containing a unique phrase from the uploaded source returns at least one chunk from that source via DuckDB vector retrieval (`prototypeDuckDbStore.search`), without any app restart or reset. When `indexingStatus ∈ {disabled, failed}` retrieval for that `sourceId` is expected to return no chunks and Ask emits `RETRIEVAL_NOT_READY`.
- `AC-G-017`: Release signoff is not satisfied by replay-only proof. At least one local/dev provider-backed run must prove Nova Pro extraction, Titan embedding generation (`embeddingSource=titan`), DuckDB `rag_chunks` persistence, Ask retrieval hit on the newly uploaded source, aggregate publication, and user-visible surface refresh for Dental. Pseudo-embeddings (`embeddingSource=pseudo`) never count toward signoff.
- `AC-G-018`: No user-visible surface (Overview, Source Detail, Ask, Reports, Timeline, Data) is updated from unvalidated model output at any point.

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
- `AC-FE-011`: Source Detail renders `indexingStatus` (and, optionally, `chunkCount` / `embeddingDims`) for retrieval-eligible sources (`sourceFamilyClass=retrieval_eligible`). When `indexingStatus=not_applicable` (fixed-schema structured or deferred families), the indicator is hidden. When `indexingStatus=disabled` or `failed`, a visible label explains the state.
- `AC-FE-012`: Source Detail `summary`, `decisions[*]`, `warnings[*]`, and `confidence` map 1:1 to the validated Nova JSON for retrieval-eligible and email/document/transcript-family sources. The UI reads from the validated extraction fields; no heuristic-derived summary is rendered.
- `AC-FE-013`: Overview, Timeline, and Reports derive their product-posture content exclusively from validated aggregate JSON. The UI may not derive Overview/Timeline/Reports content from raw model output, unvalidated JSON, or `featureMode`.
- `AC-FE-014`: Ask answer source chips label retrieval type (`retrievalType=structured` vs `retrievalType=vector`). On exact-field conflict (`precedenceDecision.exactFieldConflict=true`), the structured chip is rendered first/prominently and the narrative chip carries a precedence note; the structured value is used as the field-of-record in the answer body.
- `AC-FE-015`: Source Detail renders recovery-guidance copy (per §15.5) when `indexingStatus` is `failed`, `disabled`, or `queued`. The copy exactly matches the authoritative strings defined in §15.5 so operators and testers can locate them by text.

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
- `AC-BE-014`: Every successful ingest for a retrieval-eligible Dental source family (`email`, `transcript`, `document`, `slide_deck`, `weekly_update`) with `features.enableDentalRetrievalIndexing=true` produces ≥1 chunk and ≥1 `rag_chunks` row whose `source_id` equals the new `sourceId`.
- `AC-BE-015`: Each persisted `rag_chunks.embedding_json` parses to a numeric array of length `bedrock.embedDims` and is L2-normalized within tolerance (magnitude ≈ 1 ± 1e-4). The stored metadata includes `productId`, `sourceId`, `sourceType` (from `shared/artifactTypes.js`), `sourceDate`, and `chunkIndex`.
- `AC-BE-016`: Embedding generation for retrieval-eligible Dental families in live/provider-backed mode uses `config.bedrock.embedModelId` (default `amazon.titan-embed-text-v2:0`) via `server/src/lib/aws/titanEmbeddings.js:embedTexts`. Pseudo embeddings may be used only when `retrieval.allowPseudoEmbeddings=true` and are marked `embeddingSource=pseudo` on the source record.
- `AC-BE-017`: If chunking, Titan embedding generation, or DuckDB `rag_chunks` persistence fails for a retrieval-eligible family, Module 7's DuckDB transaction rolls back cleanly — no partial `rag_chunks` rows remain for that `sourceId`. The source record is stamped `indexingStatus=failed` with the typed error (`EMBEDDING_UNAVAILABLE` or `INDEXING_FAILED`). **Per Option 2 (§21.2), aggregate publication proceeds unconditionally on the already-validated Nova JSON**: aggregate assembly, schema validation, and monotonic CAS all run. The job terminal state is `completed` and Overview/Timeline/Reports refresh. Retrievability for that `sourceId` remains degraded until the source is re-uploaded.
- `AC-BE-018`: Fixed-schema structured exports (`risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`) do not create any `rag_chunks` rows in this corrective scope. They update row truth and aggregate state through deterministic parsing plus validated aggregate publication. Their source records carry `sourceFamilyClass=fixed_schema_structured` and `indexingStatus=not_applicable`.
- `AC-BE-019`: Ask uses DuckDB vector retrieval via `server/src/rag/retrievalProvider.js` for retrieval-eligible uploaded sources and `server/src/services/rag/structuredRetrieval.service.js:retrieveStructuredEvidence` for fixed-schema structured exports. The precedence merge is implemented in `askPrecedenceMerge` and is testable.
- `AC-BE-020`: When structured and vector evidence conflict on the value of an exact field, `askPrecedenceMerge` returns `precedenceDecision.exactFieldConflict=true`, `winner=structured`, and `narrativeCitedForContext=true`. The structured value is used as the field-of-record; narrative sources are retained as context in the response. The decision is logged as `askPrecedenceDecision`.
- `AC-BE-021`: When `features.enableDentalRetrievalIndexing=false`, retrieval-eligible Dental uploads still complete extraction, validation, and aggregate publication. The source record is stamped `indexingStatus=disabled` and no `rag_chunks` rows are written. Ask returns a `retrievalWarnings[]` entry of code `RETRIEVAL_NOT_READY` for the affected source while the flag is off.
- `AC-BE-022`: Module 7 writes are idempotent per `sourceId`. A repeat invocation for the same `sourceId` purges existing `rag_chunks` rows (by `source_id` + `product_id`) and inserts replacement rows inside one DuckDB transaction; `chunk_id` is deterministically `"<sourceId>::<chunkIndex>"` so replays produce byte-identical keys. A repeat ingest test must observe `chunk_count` equal to the latest run, not accumulated across runs.
- `AC-BE-023`: Module 7 is atomic. Chunk delete + chunk inserts + source-record indexing-field stamping (`indexing_status`, `chunk_count`, `embedding_dims`, `embedding_source`, `indexed_at`) run in one DuckDB transaction. A forced mid-transaction failure test must show: no partial `rag_chunks` rows remain for the affected `sourceId`, and the source record's indexing fields retain their prior values. The typed error (`EMBEDDING_UNAVAILABLE` or `INDEXING_FAILED`) is thrown; aggregate publication (Stage 8) does not observe a torn state.
- `AC-BE-024`: `askPrecedenceMerge` implements the deterministic algorithm in §13.7 exactly. A fixture-based test with a frozen input set must produce byte-identical `AskPrecedenceDecision`, `sources` ordering, and `retrievalWarnings` ordering across runs and across two independent implementations. No step may use model inference, random seeds, or wall-clock time.
- `AC-BE-025`: Indexing outcome does not gate aggregate publication for retrieval-eligible families (Option 2, §21.2). Given successful source extraction + validation, Stage 7/8 MUST run regardless of whether Stage 6b ended `indexed`, `disabled`, or `failed`. A test fixture with Titan throwing must show: Module 7 rollback observable (no `rag_chunks` rows), `indexingStatus=failed` stamped, aggregate version incremented, monotonic CAS succeeded, job terminal state `completed`, Ask `retrievalWarnings[]` containing `RETRIEVAL_NOT_READY` for the affected `sourceId`.

### 17.4 Cross-Cutting Integration Acceptance Criteria

- `AC-INT-001`: Resetting state with trust surfaces disabled causes the frontend to hide trust surfaces after refetch.
- `AC-INT-002`: Uploading a Dental email in replay mode with a cache hit refreshes product state through the real backend path.
- `AC-INT-003`: Uploading a Dental email in replay mode with a cache miss preserves last-known-good state and surfaces replay-miss messaging.
- `AC-INT-004`: Opening a fresh report after successful publication shows no semantic warning banner.
- `AC-INT-005`: Opening a degraded report after publication failure shows a semantic warning banner.
- `AC-INT-006`: Headed and headless Playwright runs use the same scripts and assertions.
- `AC-INT-007`: Concurrent uploads preserve the newest valid published aggregate and reject stale publication attempts.
- `AC-INT-008`: Uploading a retrieval-eligible Dental source (e.g., `email`, `document`, `slide_deck`, `weekly_update`) with indexing enabled and Titan healthy results in visible Source Detail updates (`indexingStatus=indexed`) and makes the source retrievable by content through DuckDB vector search.
- `AC-INT-009`: A newly uploaded retrieval-eligible Dental source with `indexingStatus=indexed` can be cited in Ask after the job reaches `completed`, without requiring a reset.
- `AC-INT-010`: A newly uploaded Dental source that changes aggregate meaning updates the relevant application surfaces after publication: Overview, Sources, Ask, and Reports, plus Timeline/Data when applicable to that source family.
- `AC-INT-011`: If vector indexing fails after extraction succeeds (`EMBEDDING_UNAVAILABLE` or `INDEXING_FAILED`), the system stamps `indexingStatus=failed` on the source and DOES NOT misrepresent the source as retrieval-ready. Per Option 2, aggregate publication still proceeds — the job terminal state is `completed`, Overview/Timeline/Reports refresh, and Ask emits `RETRIEVAL_NOT_READY` for the affected source until it is re-uploaded.
- `AC-INT-012`: Uploading a fixed-schema structured export produces 0 `rag_chunks` rows for that `sourceId` while still updating Data, Overview, and Reports. Ask uses structured retrieval to serve facts from that source.
- `AC-INT-013`: When a structured export and a narrative source disagree on the same exact field, Ask returns the structured value as the field-of-record and cites the narrative source for context only; the frontend renders the structured chip prominently and the narrative chip with a precedence note.
- `AC-INT-014`: Re-uploading after `EMBEDDING_UNAVAILABLE` / `INDEXING_FAILED` produces a new `sourceId` and runs a full clean lifecycle. The previous failed source remains visible with `indexingStatus=failed` for audit. Source Detail for the new source shows `indexingStatus=indexed` and Ask can cite it without a reset.

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
| `E2E-DENTAL-UPLOAD-RETRIEVAL-008` | Upload a retrieval-eligible Dental source (`email` or `document`) and cite it in Ask via DuckDB vector search without reset | Live Backend-Backed E2E | Seeded replay artifact OR live Bedrock env; `enableDentalRetrievalIndexing=true` | `AC-G-012`, `AC-G-015`, `AC-G-016`, `AC-BE-014`-`016`, `AC-INT-008`, `AC-INT-009` |
| `E2E-DENTAL-STRUCTURED-NO-VECTORS-009` | Upload a `risk_export` and confirm Data tab updates with 0 new `rag_chunks` rows | Live Backend-Backed E2E | `risk_export` fixture | `AC-BE-018`, `AC-INT-012` |
| `E2E-DENTAL-INDEXING-FAILURE-010` | Simulated Titan failure during retrieval-eligible upload; job reaches `completed` with `indexingStatus=failed`; aggregate publishes (Option 2); Ask shows `RETRIEVAL_NOT_READY` for the affected source | Live Backend-Backed E2E | Reset with `testCase: 'embeddingFailure'` | `AC-BE-017`, `AC-BE-025`, `AC-INT-011` |
| `E2E-DENTAL-INDEXING-DISABLED-011` | `enableDentalRetrievalIndexing=false`; retrieval-eligible upload publishes with `indexingStatus=disabled` and no `rag_chunks` writes; Ask emits `RETRIEVAL_NOT_READY` soft-warn | Live Backend-Backed E2E | Reset with the kill-switch off | `AC-BE-021`, `AC-FE-011` |
| `E2E-DENTAL-PRECEDENCE-CONFLICT-012` | Seeded structured row and narrative disagree on an exact field; Ask returns structured value with narrative cited for context | Live Backend-Backed E2E | Seeded risk_export + narrative email fixture with conflicting dates | `AC-BE-019`, `AC-BE-020`, `AC-FE-014`, `AC-INT-013` |
| `E2E-DENTAL-LIVE-BEDROCK-SIGNOFF-013` | Provider-backed Nova + Titan + DuckDB + Ask retrieval + publication + surface refresh round-trip | Live Backend-Backed E2E (local/dev only; required for release signoff; documented but not scripted in CI) | `EIDS_ENABLE_BEDROCK=true`, `retrieval.allowPseudoEmbeddings=false`, Titan credentials | `AC-G-017` |

### 17.6 Definition of Done

The corrective feature is complete only when all of the following are true:

**Traceability**
- All `AC-G-*`, `AC-FE-*`, `AC-BE-*`, and `AC-INT-*` items are mapped to proof (unit, integration, or E2E).

**Full lifecycle implementation**
- Every retrieval-eligible Dental upload family (`email`, `transcript`, `document`, `slide_deck`, `weekly_update`) has an implementation path that performs the full semantic lifecycle defined in §13.6 `completed` for retrieval-eligible families.

**Persistence guarantees — retrieval-eligible**

For every successfully completed retrieval-eligible Dental upload, the system has persisted (always):
- raw artifact
- normalized artifact
- validated source extraction JSON
- prompt-run / provenance metadata
- validated aggregate JSON
- published aggregate provenance (distinct aggregate publication run)

Plus, **when `enableDentalRetrievalIndexing=true` AND Titan + DuckDB writes succeeded** (`indexingStatus=indexed`):
- chunk artifacts
- Titan embeddings (`embeddingSource=titan` for production; `pseudo` allowed in test only)
- DuckDB `rag_chunks` rows with full product/source/family metadata and L2-normalized embeddings

When `indexingStatus ∈ {disabled, failed}` (per Option 2, §21.2), the aggregate side persists as above, `rag_chunks` does NOT receive rows for that `sourceId`, and retrievability for that source is surfaced via Source Detail's `indexingStatus` plus Ask's `RETRIEVAL_NOT_READY` warning.

**Persistence guarantees — fixed-schema structured exports**
- For every successfully completed fixed-schema structured export (`risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`), the system has persisted:
  - raw artifact
  - validated deterministic row truth
  - validated aggregate JSON
  - published aggregate provenance
  - 0 `rag_chunks` rows for that `sourceId`

**Trust gates**
- No user-visible surface (Overview, Source Detail, Ask, Reports, Timeline, Data) is updated from unvalidated model output or heuristic semantic fallback.
- Replay mode is cache-backed and fail-closed.
- Extraction validation uses AJV/schema validation prior to publication.
- Aggregate validation uses AJV/schema validation prior to publication.
- Monotonic publish CAS prevents stale async jobs from overwriting newer valid state.
- Report warning visibility is backend-authoritative and fresh reports show no warning banner.
- Runtime feature flags truthfully control trust-surface rendering, service-split behavior, and retrieval indexing (kill-switch).
- Published aggregate provenance is distinct from source extraction provenance.
- The report read route remains flat in this corrective pass.
- `featureMode` is no longer returned in end-user route payloads and no longer controls runtime behavior.

**Surface refresh**
- Overview, Sources, Ask, and Reports update from published semantic state after successful publication; Timeline and Data update when the uploaded source family affects them.

**Retrieval readiness**
- A newly uploaded retrieval-eligible Dental source is retrievable by content through DuckDB vector retrieval (`prototypeDuckDbStore.search`) after the job reaches `completed` AND `indexingStatus=indexed`, without any app restart or reset.
- Ask can cite newly indexed retrieval-eligible sources in an answer without a reset.
- When `indexingStatus ∈ {disabled, failed}` the aggregate still publishes (Option 2, §21.2) but the specific source is surfaced via `RETRIEVAL_NOT_READY`; Ask does not silently omit it.

**Ask precedence**
- Structured retrieval wins on fixed-schema row facts.
- Vector retrieval wins on narrative/causal/context questions.
- Both-fire returns merged and labeled sources (`retrievalType=structured | vector`).
- On exact-field conflict, structured row truth wins as the field-of-record; narrative is cited for context; the decision is logged in `askPrecedenceDecision`.

**Release signoff (mandatory, non-negotiable)**
- At least one local/dev provider-backed proof run demonstrates the complete round-trip with Titan-backed embeddings (`embeddingSource=titan`):
  - Nova Pro extraction
  - Titan embedding generation
  - DuckDB `rag_chunks` persistence
  - Ask retrieval hit on the newly uploaded source
  - Aggregate publication
  - Application-surface refresh (Overview / Source Detail / Ask / Reports)
- Replay-only proof is insufficient for final signoff.
- `embeddingSource=pseudo` is not acceptable anywhere in the signoff window.

**Test execution**
- All required unit, integration, and Playwright proofs pass in both headed and headless modes, except for the explicitly documented local-only live-provider proof (`E2E-DENTAL-LIVE-BEDROCK-SIGNOFF-013`).

### 17.7 Usability Testing Plan

- Operator task: verify replay cache miss is clearly distinguished from generic upload failure.
- PM task: verify a fresh report feels calm and not falsely degraded.
- Reviewer task: verify degraded report messaging is clear and actionable.
- PM task: upload a narrative document and immediately ask a question about its content — confirm that Ask cites the new document without requiring a reset.
- Operator task: flip `ENABLE_DENTAL_RETRIEVAL_INDEXING` off, upload a retrieval-eligible source, then ask about it — confirm the Ask response shows `RETRIEVAL_NOT_READY` for that source and the source's Source Detail shows `indexingStatus=disabled`.
- Reviewer task: view a source after upload and confirm `indexingStatus` clearly communicates whether the source is retrievable (`indexed`), pending (`queued`), unavailable (`failed` / `disabled`), or not applicable (structured exports).

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
// Validates: AC-G-001, AC-BE-001, AC-BE-002, AC-BE-003, AC-INT-002
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
// Validates: AC-G-001, AC-FE-007, AC-INT-003
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
// Validates: AC-G-005, AC-FE-003, AC-FE-008, AC-FE-010, AC-INT-001
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

```javascript
// E2E-DENTAL-UPLOAD-RETRIEVAL-008
// Proof Type: Live Backend-Backed E2E
// Validates: AC-G-012, AC-G-015, AC-G-016, AC-BE-014, AC-BE-015, AC-INT-008, AC-INT-009
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Retrieval-eligible upload is citable in Ask without reset', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });

  await page.goto('/products/dental?tab=overview');
  const { sourceId } = await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await expect(page.getByTestId('overview-current-state')).toBeVisible();

  // Navigate to Source Detail — `source-indexing-status` lives on Source Detail, not Overview (§18.4).
  await page.goto(`/products/dental?tab=sources&sourceId=${sourceId}`);
  await expect(page.getByTestId('source-indexing-status')).toContainText(/indexed/i);

  await page.goto('/products/dental?tab=ask');
  await page.getByTestId('ask-input').fill('When is the staged mitigation scheduled?');
  await page.getByTestId('ask-submit').click();
  // Chip label is the retrievalType (`vector` | `structured`), not the sourceType — see §18.4.
  await expect(page.getByTestId('ask-source-type-chip').first()).toContainText(/vector/i);
});
```

```javascript
// E2E-DENTAL-STRUCTURED-NO-VECTORS-009
// Proof Type: Live Backend-Backed E2E
// Validates: AC-BE-018, AC-INT-012
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact, countRagChunksForSource } from './helpers/novaLifecycle.js';

test('Fixed-schema structured export produces no rag_chunks rows', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });

  await page.goto('/products/dental?tab=data');
  const { sourceId } = await uploadNovaArtifact(page, { fixtureKey: 'dental-risk-export' });
  const chunkCount = await countRagChunksForSource(request, { sourceId });
  expect(chunkCount).toBe(0);

  // Source Detail hides `source-indexing-status` when indexingStatus === 'not_applicable' (AC-FE-011).
  await page.goto(`/products/dental?tab=sources&sourceId=${sourceId}`);
  await expect(page.getByTestId('source-indexing-status')).toHaveCount(0);
});
```

```javascript
// E2E-DENTAL-INDEXING-FAILURE-010
// Proof Type: Live Backend-Backed E2E
// Validates: AC-BE-017, AC-BE-025, AC-INT-011
// Option 2: aggregate publication is decoupled from indexing outcome — the job is `completed`,
// aggregate refreshes, and only retrievability for the affected source is degraded.
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Embedding failure still publishes aggregate and marks indexing failed', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
    testCase: 'embeddingFailure',
  });

  await page.goto('/products/dental?tab=overview');
  const { sourceId } = await uploadNovaArtifact(page, {
    fixtureKey: 'wave03-vendor-mitigation-email',
    testCase: 'embeddingFailure',
  });

  // Aggregate-side refresh happened — Overview renders the updated current state and no preserved-state banner.
  await expect(page.getByTestId('overview-current-state')).toBeVisible();
  await expect(page.getByTestId('semantic-degraded-banner')).toHaveCount(0);

  // Source Detail shows indexing failure and recovery copy.
  await page.goto(`/products/dental?tab=sources&sourceId=${sourceId}`);
  await expect(page.getByTestId('source-indexing-status')).toContainText(/failed/i);

  // Ask emits RETRIEVAL_NOT_READY for the affected source.
  await page.goto('/products/dental?tab=ask');
  await page.getByTestId('ask-input').fill('What did the vendor confirm?');
  await page.getByTestId('ask-submit').click();
  await expect(page.getByTestId('retrieval-not-ready-notice')).toBeVisible();
});
```

```javascript
// E2E-DENTAL-INDEXING-DISABLED-011
// Proof Type: Live Backend-Backed E2E
// Validates: AC-BE-021, AC-FE-011
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Indexing kill-switch off publishes without rag_chunks and Ask shows RETRIEVAL_NOT_READY', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: false,
    },
  });

  await page.goto('/products/dental?tab=overview');
  const { sourceId } = await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });

  // Navigate to Source Detail — `source-indexing-status` lives on Source Detail, not Overview (§18.4).
  await page.goto(`/products/dental?tab=sources&sourceId=${sourceId}`);
  await expect(page.getByTestId('source-indexing-status')).toContainText(/disabled/i);

  await page.goto('/products/dental?tab=ask');
  await page.getByTestId('ask-input').fill('What did the vendor confirm?');
  await page.getByTestId('ask-submit').click();
  await expect(page.getByTestId('retrieval-not-ready-notice')).toBeVisible();
});
```

```javascript
// E2E-DENTAL-PRECEDENCE-CONFLICT-012
// Proof Type: Live Backend-Backed E2E
// Validates: AC-BE-019, AC-BE-020, AC-FE-014, AC-INT-013
import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Ask precedence: structured row wins on exact-field conflict; narrative cited for context', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
    testCase: 'precedenceConflict',
  });

  await page.goto('/products/dental?tab=ask');
  await page.getByTestId('ask-input').fill('When is the mitigation due?');
  await page.getByTestId('ask-submit').click();

  const chips = page.getByTestId('ask-source-type-chip');
  await expect(chips.first()).toContainText(/risk_export|structured/i);
  await expect(page.getByTestId('ask-precedence-note')).toBeVisible();
});
```

> `E2E-DENTAL-LIVE-BEDROCK-SIGNOFF-013` is documented in §17.5 as the required release-signoff round-trip. It is local/dev-only (`EIDS_ENABLE_BEDROCK=true`, `retrieval.allowPseudoEmbeddings=false`, Titan credentials) and is not scripted in CI. The proof obligation is: upload a retrieval-eligible source → observe Nova extraction via Bedrock → observe Titan embedding → observe `rag_chunks` row written → observe Ask citation of the new source → observe aggregate publication → observe Overview/Source Detail refresh. Signoff artifacts include logs showing `embeddingSource=titan` and a `rag_chunks` count delta of ≥1 for the new `sourceId`.

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
| `artifact-processing-error` | Replay miss / invalid extraction / publication failure / indexing failure terminal state |
| `source-indexing-status` | Source Detail retrieval indexing state (`indexed` / `queued` / `failed` / `disabled`); hidden when `not_applicable` |
| `source-family-class` | Source Detail family class badge (`retrieval_eligible` / `fixed_schema_structured` / `deferred`) for operator inspection |
| `ask-source-type-chip` | Per-source chip on Ask answers labeling `retrievalType=structured` vs `vector` |
| `ask-structured-row-badge` | Prominent badge on the structured chip when it is the field-of-record in an exact-field conflict |
| `ask-precedence-note` | Narrative-source precedence note when structured won on an exact field |
| `retrieval-not-ready-notice` | Ask-side soft-warn when a source matches but `indexingStatus` is `disabled` or `failed` |

### 18.5 Frontend Test Expectations

- `semantic-header-hides-featuremode-and-respects-trust-flag`
- `reports-render-banner-only-when-showBanner-is-true`
- `source-detail-hides-citation-trust-when-flag-off`
- `artifact-upload-renders-replay-miss-and-invalid-extraction-copy`
- `source-detail-shows-indexing-status-for-retrieval-eligible-sources-only`
- `source-detail-hides-indexing-status-when-not-applicable`
- `ask-labels-structured-vs-vector-sources`
- `ask-renders-precedence-note-on-exact-field-conflict`
- `ask-shows-retrieval-not-ready-when-indexing-disabled-or-failed`
- `overview-timeline-reports-derive-from-validated-aggregate-only`

## 19. Backend Engineering Handoff

### 19.1 Primary Module Impact

- `server/src/config/runtime.js`: make the named flags authoritative and persistable; add `features.enableDentalRetrievalIndexing` (env `ENABLE_DENTAL_RETRIEVAL_INDEXING`) following the existing camelCase convention at lines 89-96.
- `server/src/app.js`: extend session and reset contracts; preserve the current flat report semantic response shape while extending it; the boot-time `resetPrototypeDuckDbStore` + `provider.indexDocuments(buildCorpusDocuments(state))` path (lines ~46-50) remains as a seed path and is not removed.
- `server/src/services/domain/mutation.service.js`: use effective flags rather than `featureMode`; preserve last-known-good on replay miss/invalid extraction; refactor the transcript-only `indexTranscriptEvidence` block (around line 91) to call the new Module 7 entry point for all retrieval-eligible Dental families, gated by `features.enableDentalRetrievalIndexing`; stamp `indexingStatus` on the source record.
- `server/src/services/semantic/novaSourceExtraction.service.js`: use replay store + validation.
- `server/src/services/semantic/aggregateValidation.service.js`: validate aggregate payloads prior to publish.
- `server/src/services/semantic/semanticPublication.service.js`: emit aggregate publication runs and enforce monotonic publish CAS.
- `server/src/services/semantic/chunkingAndIndexing.service.js` (NEW — Module 7): chunking + Titan + DuckDB indexing entry point; reuses `buildChunkArtifacts`, `embedTexts`, `prototypeDuckDbStore.indexDocuments`.
- `server/src/services/semantic/semanticIngestOrchestrator.service.js`: invoke Module 7 between Stage 6a (citation projection) and Stage 7 (aggregate assembly); branch on `sourceFamilyClass` and on the retrieval indexing flag; propagate `indexingStatus`, `chunkCount`, `embeddingDims`, `embeddingSource` into the source record written by the repository layer.
- `server/src/rag/prototypeDuckDbStore.js`: tighten `rag_chunks` metadata coverage for new writes (`product_id`, `source_id`, `source_type`, `source_date`, `chunk_index`). No schema breakage — existing rows remain readable.
- `server/src/rag/retrievalProvider.js`: no change to the factory contract; used by Module 7 for writes and `ask.service.js` for reads.
- `server/src/lib/aws/titanEmbeddings.js`: no behavior change; caller must assert `embeddingSource=titan` for signoff gating.
- `server/src/services/rag/chunking.service.js`: `buildChunkArtifacts` reused; no change.
- `server/src/services/rag/structuredRetrieval.service.js`: reused; participates in Ask precedence merge.
- `server/src/services/domain/ask.service.js`: implement `askPrecedenceMerge` (structured wins on fixed-schema row facts; vector wins on narrative; both-fire merged and labeled; exact-field conflict → structured wins, narrative cited for context); emit `retrievalWarnings` with `RETRIEVAL_NOT_READY` when a matching source has `indexingStatus` disabled/failed; log `askPrecedenceDecision`.
- `server/src/services/domain/readModel.service.js`: surface `sourceFamilyClass`, `indexingStatus`, `chunkCount`, `embeddingDims`, `embeddingSource` on source detail payloads.
- `server/src/services/state/runtimeState.repository.js`: persist new provenance/validation/indexing fields (`source_family_class`, `indexing_status`, `chunk_count`, `embedding_dims`, `embedding_source`).
- `shared/artifactTypes.js`: add `getSourceFamilyClass(sourceType) → 'retrieval_eligible' | 'fixed_schema_structured' | 'deferred'` using existing `SOURCE_TYPE_DEFINITIONS` and `isStructuredImportType`.
- `client/src/App.jsx`: add `source-indexing-status`, `source-family-class`, `ask-source-type-chip`, `ask-structured-row-badge`, `ask-precedence-note`, `retrieval-not-ready-notice` selectors; render trust surfaces only when enabled; render `indexingStatus` per AC-FE-011.
- `client/src/lib/api.js`: no new helpers required; existing `apiGet`/`apiSend`/`apiUpload` remain authoritative.
- `tests/e2e/helpers/novaLifecycle.js`: extend `resetLifecycleState` to pass `enableDentalRetrievalIndexing`, `testCase: 'embeddingFailure' | 'precedenceConflict'`, and add `countRagChunksForSource(request, { sourceId })` helper (reads through an existing admin/debug route or directly queries DuckDB in test context).

### 19.2 TDD Plan (Combined)

**Frontend Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `semantic-header-hides-featuremode-and-respects-trust-flag` | Component / Integration | `AC-FE-002`, `AC-FE-003` | Yes |
| `reports-render-banner-only-when-showBanner-is-true` | Component / Integration | `AC-FE-004`, `AC-FE-005`, `AC-FE-006` | Yes |
| `artifact-upload-renders-replay-miss-and-invalid-extraction-copy` | Component / Integration | `AC-FE-007` | Yes |
| `source-detail-hides-citation-trust-when-flag-off` | Component / Integration | `AC-FE-008` | Yes |
| `source-detail-shows-indexing-status-for-retrieval-eligible-sources-only` | Component / Integration | `AC-FE-011` | Yes |
| `source-detail-maps-nova-json-fields-to-ui-1-to-1` | Component / Integration | `AC-FE-012` | Yes |
| `overview-timeline-reports-derive-from-validated-aggregate-only` | Component / Integration | `AC-FE-013` | Yes |
| `ask-labels-structured-vs-vector-sources` | Component / Integration | `AC-FE-014` | Yes |
| `ask-shows-retrieval-not-ready-when-indexing-disabled-or-failed` | Component / Integration | `AC-FE-011`, `AC-BE-021` | Yes |

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
| `module7-chunks-embeds-and-writes-rag-chunks-for-retrieval-eligible` | Integration | `AC-G-012`, `AC-G-015`, `AC-BE-014` | Yes |
| `titan-embeddings-have-correct-dim-and-l2-normalized` | Unit / Integration | `AC-BE-015` | Yes |
| `titan-embed-model-id-matches-config` | Contract | `AC-BE-016` | Yes |
| `embedding-failure-marks-indexing-failed-and-blocks-publish` | Integration | `AC-BE-017`, `AC-INT-011` | Yes |
| `structured-export-writes-zero-rag-chunks-rows` | Integration | `AC-BE-018`, `AC-INT-012` | Yes |
| `ask-precedence-merges-structured-and-vector-with-labels` | Integration | `AC-BE-019` | Yes |
| `ask-precedence-conflict-resolves-to-structured-row-truth` | Integration | `AC-BE-020`, `AC-INT-013` | Yes |
| `retrieval-indexing-kill-switch-disables-stage-6b` | Integration | `AC-BE-021`, `AC-INT-008` | Yes |
| `provider-backed-signoff-round-trip` | Manual / Provider-Backed | `AC-G-017` | Local/dev only |
| `get-source-family-class-matches-artifact-types-definitions` | Unit | `AC-G-015`, `AC-BE-014`, `AC-BE-018` | Yes |
| `module7-is-idempotent-per-source-id` | Integration | `AC-BE-022` | Yes |
| `module7-rolls-back-on-mid-transaction-failure` | Integration | `AC-BE-023` | Yes |
| `ask-precedence-merge-is-deterministic-from-fixture` | Unit | `AC-BE-024` | Yes |
| `reindex-path-reuses-new-source-id-and-preserves-failed-audit-record` | Integration | `AC-INT-014` | Yes |

**Cross-Cutting Test Inventory**

| Test Name | Type | Proof Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- | :--- |
| `dental-replay-hit.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-002`, `AC-INT-006` | Yes |
| `dental-replay-miss.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-003`, `AC-INT-006` | Yes |
| `dental-report-fresh-no-banner.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-004`, `AC-INT-006` | Yes |
| `dental-report-degraded-banner.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-005`, `AC-INT-006` | Yes |
| `dental-trust-flag-gating.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-001`, `AC-INT-006` | Yes |
| `concurrent-aggregate-publication.integration.test.js` | Backend Integration | Live Backend-Backed | `AC-INT-007` | Yes |
| `dental-upload-retrieval.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-008`, `AC-INT-009` | Yes |
| `dental-structured-no-vectors.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-012` | Yes |
| `dental-indexing-failure.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-011` | Yes |
| `dental-indexing-disabled.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-BE-021`, `AC-FE-011` | Yes |
| `dental-precedence-conflict.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed E2E | `AC-INT-013`, `AC-BE-020` | Yes |
| `dental-live-bedrock-signoff.manual.md` | Manual runbook | Live Provider-Backed | `AC-G-017` | Local/dev only — not CI |

**Stub / Mock Inventory**

| Stub/Mock | Side | Purpose | Phase Removed |
| :--- | :--- | :--- | :--- |
| Session fixture with feature flags | FE | Allows UI gating work before backend session changes land | Phase 2 integration |
| Replay artifact fixture files in eval cache | BE | Deterministic replay proof in test and CI | Long-term retained |
| `testCase: 'embeddingFailure'` reset hook | BE test harness | Forces Titan call to throw so `AC-BE-017` / `AC-INT-011` can be proven deterministically | Long-term retained |
| `testCase: 'precedenceConflict'` seed | BE test harness | Seeds a `risk_export` row and narrative email with conflicting `mitigation_due_date` values for `AC-BE-020` / `AC-INT-013` | Long-term retained |
| `countRagChunksForSource` test helper | BE/E2E | Counts `rag_chunks` rows for a `sourceId` to prove structured-no-vectors and retrieval-ready invariants | Long-term retained |

## 20. Out of Scope (Non-Goals)

- Live rollout for non-email source families.
- A redesign of the overall Dental product page layout.
- New design-system adoption.
- A wholesale replacement of the existing Ask or report generation approach.
- Backfilling historical aggregates with newly separated aggregate publication runs.
- Canonical workbook text extraction for `spreadsheet_attachment`. This family is explicitly deferred. In this scope, `spreadsheet_attachment` uploads normalize and store as a source but do not chunk, embed, or create `rag_chunks` rows. A follow-on FSFS must define the canonical workbook normalization before retrieval for this family can be considered.
- Backfilling vectors for previously ingested retrieval-eligible sources. This scope adds per-upload indexing for new uploads only; existing sources continue to rely on the app-boot seed rebuild until re-uploaded or re-indexed under a follow-on scope.
- Rebuilding/invalidating existing `rag_chunks` rows when prompt version, model id, embedding model, or source-family schema version changes. Cache invalidation and reindex sweeps are future work.
- Non-Dental portfolio retrieval indexing. Only Dental is gated by `features.enableDentalRetrievalIndexing` in this corrective scope.
- Multi-product Ask precedence and cross-product retrieval merging.

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
- `server/src/services/semantic/semanticIngestOrchestrator.service.js`
- `server/src/services/semantic/chunkingAndIndexing.service.js` (NEW — Module 7)
- `server/src/services/ingest/corpusImport.service.js`
- `server/src/services/state/runtimeState.repository.js`
- `server/src/services/rag/chunking.service.js`
- `server/src/services/rag/structuredRetrieval.service.js`
- `server/src/rag/prototypeDuckDbStore.js`
- `server/src/rag/retrievalProvider.js`
- `server/src/lib/aws/titanEmbeddings.js`
- `shared/artifactTypes.js`
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
| Option B (narrowed): fixed-schema structured exports excluded from vector indexing | 2026-04-16 | Keeps row-of-record precedence clean and avoids duplicated retrieval paths for facts that already have deterministic truth | Option A (index everything as canonical text) rejected — would require a canonical workbook normalization that does not exist; Option B (broad exclusion of all CSV/XLSX) was rejected as too blunt |
| `spreadsheet_attachment` explicitly deferred | 2026-04-16 | Canonical workbook text extraction is not defined; normalizing + storing is allowed, but retrieval indexing is not | Indexing raw cell dumps rejected — low retrieval quality and ambiguous precedence |
| `indexingStatus` added as first-class source field | 2026-04-16 | Converts "is this source retrievable?" from inferred state to an observable column on source records; enables `RETRIEVAL_NOT_READY` and operator diagnosis | Inferring retrieval state from presence of `rag_chunks` rows rejected — too opaque for FE and for tests |
| Enum includes `disabled`; `not_applicable` is reserved for never-indexed families | 2026-04-16 | Kill-switch state must be distinguishable from structural exclusion | Reusing `not_applicable` for disabled rejected — would lose incident-response visibility |
| Separate kill-switch `ENABLE_DENTAL_RETRIEVAL_INDEXING` | 2026-04-16 | Safer operational design for incident response than folding into the service-split flag | Folding into `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` rejected |
| Ask precedence: structured wins on exact-field conflicts; narrative cited for context | 2026-04-16 | Exact field values already have deterministic truth in structured exports; narrative adds context/causality but does not override row-of-record | Always-vector-wins rejected (would overwrite known-good data); always-structured-wins for all questions rejected (would discard narrative context) |
| Release signoff requires provider-backed Nova + Titan + DuckDB + Ask round-trip | 2026-04-16 | Replay-only proof cannot demonstrate Titan availability, real embedding dims, or actual vector retrieval against a live provider | Replay-only signoff rejected |
| Family name is `weekly_update` (not `weekly_narrative`) | 2026-04-16 | Matches authoritative constant in `shared/artifactTypes.js:19` | Using a new family identifier rejected to avoid a rename |
| Reuse existing `prototypeDuckDbStore`, `titanEmbeddings`, `buildChunkArtifacts` rather than invent new modules | 2026-04-16 | Infrastructure already exists; gap was wiring, not capability | Building new retrieval/indexing stack rejected |
| `EffectiveFeatureFlags` is a single authoritative shape used by session, reset, and upload responses | 2026-04-16 | Prevents drift where some routes return a 4-flag subset and others return 5; makes FE state machine deterministic | Per-endpoint subsets rejected |
| `source-indexing-status` is a Source Detail selector only — never an Overview selector | 2026-04-16 | Overview narrative already communicates posture; duplicating indexing status on Overview muddies responsibility and bloated the header | Adding a second surface for the same field rejected |
| Module 7 is idempotent per `sourceId` via delete-then-insert in one DuckDB transaction; `chunk_id` is deterministic | 2026-04-16 | Replay retries and operator retries must not duplicate `rag_chunks` rows; deterministic `chunk_id` makes test comparisons byte-stable | Upsert-by-natural-key rejected (chunking boundaries may change between runs, leaving orphans); random UUIDs rejected (breaks byte-stable tests) |
| Module 7 is atomic: delete + insert + source-record stamping run in one DuckDB transaction | 2026-04-16 | Prevents torn-state reads by Ask and guarantees clean rollback on `EMBEDDING_UNAVAILABLE` / `INDEXING_FAILED` | Service-level intent without repository-level atomicity rejected |
| Retry after indexing failure requires re-upload with a new `sourceId`; failed record retained for audit | 2026-04-16 | A reindex-only endpoint that reuses the `sourceId` introduces a new state-machine transition (`failed → queued → indexed`) that deserves its own follow-on design | Reindex-only endpoint deferred |
| Ask precedence algorithm is fully deterministic (no model inference, no random, no wall-clock) | 2026-04-16 | Two independent implementations must produce byte-identical decisions; classification by token-match + normalized field-value compare is sufficient for the fixed-schema + narrative families in scope | LLM-based intent classification rejected for this scope |
| Playwright script header AC lists are authoritative alongside the §17.5 scenario table and must agree | 2026-04-16 | The v2.0 draft had mismatches (`E2E-DENTAL-TRUST-FLAG-005` header claimed `AC-G-003` when the table correctly listed `AC-G-005`); a consistency pass prevents proof-matrix drift | Relying on the table alone rejected — the script header is what engineers read first |
| Option 2 — aggregate publication is decoupled from indexing outcome for retrieval-eligible families | 2026-04-16 | Nova JSON is already AJV-validated and is the aggregate's actual input; retrievability is a separate property already surfaced by `RETRIEVAL_NOT_READY`. A Titan or DuckDB outage must not freeze Overview/Timeline/Reports freshness. This also makes the failure path symmetric with the kill-switch-off path — both produce `completed` with a non-`indexed` `indexingStatus` and no `rag_chunks` rows | Option 1 (strict coupling — never publish without `indexingStatus=indexed`, including tightening the kill-switch to not-publish) rejected: lowest availability during provider outages. Option 3 (asymmetric status quo: kill-switch-off publishes, failure-case does not) rejected: subtle and surprising to operators; two failure modes with divergent behavior for no real trust gain |
