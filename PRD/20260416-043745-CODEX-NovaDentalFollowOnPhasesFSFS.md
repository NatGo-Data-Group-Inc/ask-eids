# Full-Stack Feature Specification: Dental Nova Live Baseline, Trust Surfaces, and Semantic Service Hardening

## 1. Document Overview

| Attribute | Detail |
| :--- | :--- |
| **Document Title** | Full-Stack Feature Specification: Dental Nova Live Baseline, Trust Surfaces, and Semantic Service Hardening |
| **Status** | Draft |
| **Version** | 1.0 |
| **Date Last Updated** | April 16, 2026 |
| **Technical Lead** | Codex |
| **UX Lead** | Codex |
| **Target Frontend** | AskEIDS React 18 + Vite single-page application rooted in `client/src/App.jsx` |
| **Target Backend** | AskEIDS Node.js + Express service with DuckDB runtime state, DuckDB retrieval state, and AWS Bedrock-compatible text generation |
| **Source System (if migration)** | Existing Dental extraction-first substrate implemented in `server/src/services/ingest/corpusImport.service.js`, `server/src/services/domain/mutation.service.js`, `server/src/services/domain/readModel.service.js`, and `server/src/services/domain/ask.service.js` |
| **Runtime Environment** | React + Node.js in development, GovCloud-compatible AWS Bedrock runtime for live text generation, filesystem artifact store in local/dev, DuckDB for runtime and retrieval state |
| **Existing UI Library** | No third-party design system detected; custom React views and custom CSS in `client/src/styles/runtime.css` |
| **Key Dependencies** | `react`, `react-router-dom`, `@tanstack/react-query`, `express`, `duckdb`, `ajv`, `multer`, `mammoth`, `mailparser`, `pdf-parse`, `@aws-sdk/client-bedrock-runtime`, `@playwright/test`, `vitest` |

**Assumptions:**
- The prior Dental extraction-first metadata rollout is already in place: `state_source_extractions`, `state_product_aggregates`, `state_prompt_runs`, `product.semanticState`, and the current Dental Playwright lifecycle coverage exist and remain stable.
- Phase 1 proves the live Bedrock trust boundary for one Dental source family only: `email` sourced from `.eml` uploads and corpus artifacts.
- Hybrid execution is intentional in this follow-on scope: Dental email extraction can run live while other source families remain replay-backed or deterministic until later migration phases.
- Phase 2 focuses on user trust, not broader feature expansion: exact citations are required wherever the normalizer can supply exact coordinates, and explicit fallback wording is required where it cannot.
- Phase 3 is architectural hardening of the current semantic assembly, not a full portfolio-wide migration to dedicated live aggregation across every source family.
- Existing product routes, tabs, and read-model shapes remain the UX anchor; this effort adds trust/provenance fields and internal service boundaries rather than a UI redesign.

**Open Questions (Resolved Pre-Generation):**
- First live source family: `email`.
- Execution strategy: hybrid live/replay by source family, with live execution explicitly surfaced in UI and persisted in backend metadata.
- Trust-surface strategy: add explicit freshness/degraded-state messaging to Product Overview, Ask, Reports, and Source Detail rather than relying on implicit confidence.
- Service-hardening scope: split semantic orchestration into dedicated normalization, extraction, citation, freshness, and publication services while preserving existing route contracts.

---

## 2. Feature Summary & Target End State

### 2.1 Executive Summary

This feature set advances Dental beyond the current replay-heavy extraction-first substrate by establishing one real Bedrock-backed trust boundary, then making that trust legible to users, and finally hardening the backend so semantic processing no longer lives as broad helper logic inside `corpusImport.service.js` and `mutation.service.js`.

At the end of these three phases, a Dental email upload can run through a true live Nova extraction path, persist exact run metadata and exact line-level citations, refresh Dental runtime state through dedicated semantic services, and surface its freshness and degradation status consistently across Overview, Sources, Ask, and Reports. Users can tell whether a visible claim came from a fresh live extraction, a last-known-good aggregate snapshot, or a best-available fallback citation. Engineers can evolve the system safely because extraction, citation mapping, freshness computation, and publication are no longer embedded in large multi-purpose services.

### 2.2 Concrete Changes Inventory

| # | Layer (FE / BE / Both) | Location (Screen / Service / Module) | Change Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| 1 | BE | `runtime.js`, semantic execution policy | **Modified** | Introduce source-family-scoped live/replay execution policy so Dental email can run live while other families remain replay-backed. |
| 2 | BE | Email normalization and extraction path | **Modified / New** | Route Dental email artifacts through dedicated normalization, live Nova extraction, validation, and exact citation projection services. |
| 3 | BE | Prompt-run persistence and semantic publication | **Modified** | Persist provider request metadata, exact citation mode, and freshness/degraded-state reasons for every live extraction/publication. |
| 4 | FE | Product Overview header and knowledge health panel | **Modified** | Show semantic execution provenance, freshness, and degraded-state messaging without changing existing page routes or layout system. |
| 5 | FE | Source detail drawer | **Modified** | Replace best-effort synthetic citation presentation with exact citations where available and explicit fallback messaging where exact coordinates are not available. |
| 6 | Both | Ask flow | **Modified** | Ask answers expose when they are using fresh aggregate state versus last-known-good aggregate state and cite extraction-backed evidence more precisely. |
| 7 | Both | Reports flow | **Modified** | Reports surface stale or degraded semantic state before regeneration and identify when report sections reflect the last published aggregate instead of a newer failed/in-progress refresh. |
| 8 | BE | Semantic orchestration layer | **New / Refactored** | Split semantic assembly out of `corpusImport.service.js` and `mutation.service.js` into dedicated services for normalization, extraction, citation mapping, freshness, and publication. |
| 9 | Both | Evaluation and E2E proof path | **Modified** | Add hybrid live/replay test coverage, including live-email-specific proof and user-visible trust-state proof in headed and headless Playwright runs. |

### 2.3 Target End State Description

When these phases are complete, Dental email is no longer "semantically live in appearance only." A Dental `.eml` upload is normalized deterministically, extracted through live Nova under Bedrock when the live-email flag is enabled, validated into durable extraction JSON, and published into the same runtime read model the UI already consumes. Source Detail shows exact line references when available. Product Overview, Ask, and Reports clearly disclose whether the displayed state is fresh, stale, degraded, or last-known-good. Backend semantic logic is encapsulated in dedicated services with stable contracts, so future live source-family rollouts do not require further broad edits to `corpusImport.service.js` or `mutation.service.js`.

---

## 3. User Research & Context

### 3.1 Target User Personas

**Persona 1: Portfolio Lead**
- **Role/Context:** Reviews product posture across Dental, Optima, and ESSENCE.
- **Goals:** Trust whether a Dental status shift is based on genuinely refreshed evidence or a preserved last-known-good snapshot.
- **Pain Points:** Current Dental semantic surfaces look richer than legacy flows, but users still cannot reliably tell which claims are live, replayed, or stale.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Weekly to daily

**Persona 2: Dental Product Manager / Evidence Owner**
- **Role/Context:** Uploads Dental evidence and expects meaningful state changes.
- **Goals:** Confirm that a new Dental email really influenced the product state and that citations are traceable enough to defend decisions.
- **Pain Points:** A successful upload does not yet prove that a real provider-backed semantic extraction occurred, and current citations can look synthetic.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Daily

**Persona 3: Leadership Reviewer**
- **Role/Context:** Reads Ask answers and generated reports to make decisions quickly.
- **Goals:** Understand when information is current versus degraded without reading engineering logs or internal tooling.
- **Pain Points:** Reports and Ask answers can appear authoritative even when they rely on last-known-good state or evidence with weak provenance.
- **Technical Proficiency:** Beginner to Intermediate
- **Usage Frequency:** Weekly

**Persona 4: Product/Platform Operator**
- **Role/Context:** Verifies prompt changes, execution policy behavior, and rollout safety.
- **Goals:** Trace a visible UI state back to prompt version, provider execution, freshness calculation, and fallback reason.
- **Pain Points:** Current semantic behavior is spread across broad services, making it harder to debug and extend safely.
- **Technical Proficiency:** Advanced
- **Usage Frequency:** As needed during rollout and debugging

### 3.2 User Problem Statement

As a Dental user or reviewer, I need to know whether the product understanding I am seeing is truly based on fresh AI extraction and exact evidence coordinates, or whether the system is showing a preserved fallback state, because without that transparency I cannot tell how much trust to place in status, Ask answers, or reports.

### 3.3 Success Criteria

**User-Facing:**
- A Dental email upload can visibly complete through a live extraction path when enabled, and the UI states that this happened.
- Source detail shows exact citations for Dental email extractions and best-available fallback wording when exact coordinates are unavailable for other source families.
- Ask and Reports explicitly disclose stale or degraded aggregate state instead of silently presenting fallback output as fully current.
- The Product Overview header and knowledge health area show freshness/provenance without disrupting the current layout.

**System-Level:**
- 100% of successful live Dental email extractions persist provider-facing prompt-run metadata, validation status, and exact citation mode.
- At least 95% of successful Dental email live extractions persist exact line-range citations for surfaced semantic claims in replayable local/dev proof runs.
- Last-known-good aggregate publication remains intact across live extraction failures, citation projection failures, and publication failures.
- Phase-3 service split removes Dental semantic assembly from broad helper logic in `corpusImport.service.js` and `mutation.service.js` when the new hardening flag is enabled.
- Required Playwright workflows pass in both headed and headless modes, with live backend-backed proof where feasible and explicit fallback rationale where not.

---

## 4. User Flows & End-to-End Data Flow

### 4.1 Primary User Flow

**Entry Point:** User opens `/products/dental?tab=overview` and uploads a Dental email artifact while live-email extraction is enabled.

1. **Submit Dental email**
   - **User action:** Uploads an `.eml` artifact from the existing upload modal.
   - **UI response:** Upload modal submits as today; the overview shows queued/running ingest state with "Live AI extraction" messaging when applicable.
   - **API call:** `POST /api/v1/products/dental/sources`
   - **Backend processing:** Persist raw file, normalize email body and headers, apply source-family execution policy, call live Nova extraction for Dental email when enabled, validate JSON, project exact citations, persist extraction/prompt-run metadata, recompute/publish aggregate state, refresh retrieval index.
   - **API response:** `202 Accepted` with `jobId`, `sourceId`, effective execution mode, and polling URL.
   - **UI state transition:** Dental Overview shows processing with explicit stage and execution provenance.

2. **Observe refreshed Dental state**
   - **User action:** Waits for job completion or navigates to Sources, Ask, or Reports.
   - **UI response:** Existing tabs refresh through the existing product routes; the header and knowledge-health area show whether the new aggregate is fresh, degraded, or last-known-good.
   - **API calls:** `GET /api/v1/jobs/:jobId`, existing `GET /api/v1/products/:productId`, `GET /api/v1/products/:productId/sources`, source detail route, and report/read routes.
   - **Backend processing:** Read the latest published runtime state and semantic freshness metadata.
   - **API response:** Stable route shapes with new semantic trust fields.
   - **UI state transition:** Sources shows the new source and its exact citations; Overview, Ask, and Reports show refreshed trust-state indicators.

3. **Ask a question about the new email**
   - **User action:** Asks something like "Did the vendor commit to a recovery step?"
   - **UI response:** Existing Ask interaction remains, but a banner or inline notice declares whether the answer is based on a fresh aggregate or a last-known-good aggregate.
   - **API call:** `POST /api/v1/products/dental/ask`
   - **Backend processing:** Build evidence pack from published aggregate state, extraction records, and retrieval results; compute freshness/degraded-state metadata; generate answer with current Ask path; validate citations/source list.
   - **API response:** `200` with answer HTML, sources, evidence strength, and semantic freshness/degraded metadata.
   - **UI state transition:** Ask panel shows answer, citations, and trust banner without changing the current interaction pattern.

4. **Generate or review a report**
   - **User action:** Opens `/products/dental?tab=reports` and generates or revisits the report.
   - **UI response:** Existing reports view remains, but it shows whether the report is based on the latest published aggregate or a last-known-good state awaiting a newer publication.
   - **API calls:** `POST /api/v1/products/dental/reports`, `GET /api/v1/products/dental/reports/:reportId`, `GET /api/v1/jobs/:jobId`
   - **Backend processing:** Use published aggregate plus semantic freshness metadata to generate/read reports and regeneration state.
   - **API response:** Stable report routes with freshness/degraded additions.
   - **UI state transition:** Report view surfaces regeneration and semantic-state trust together.

### 4.2 Alternative Flows & Edge Cases

- **Hybrid replay mode:** Dental email extraction policy is set to replay in CI or local deterministic runs; the UI still shows the execution mode clearly and the backend persists replay metadata.
- **Live provider failure:** Bedrock call fails or times out; the upload job lands in failed or partial state, last-known-good aggregate remains active, and the UI explains that product understanding was not refreshed.
- **Citation projection failure:** Extraction JSON validates but exact coordinate projection fails; the source remains stored, exact citation status falls back to best-available, and the UI states that exact coordinates were unavailable.
- **Publication failure:** Extraction succeeds but aggregate publication fails; Ask and Reports continue using the last published aggregate and explicitly indicate degraded freshness.
- **Read-only viewer:** Can see provenance/freshness/degraded-state messaging but cannot upload or regenerate reports if current permissions already restrict those actions.

### 4.3 Backend Data Flow (Pipeline Stages)

**Stage 1: Source Family Execution Policy**
- **Input:** Product id, source type/family, runtime flags, test/reset execution mode.
- **Processing:** Determine whether this source runs `live`, `replay`, or `disabled`.
- **Output:** `SemanticExecutionDecision`.
- **Failure mode:** Disabled or invalid policy prevents live provider call and returns explicit configuration error.

**Stage 2: Email Normalization**
- **Input:** Raw `.eml` artifact and optional metadata file.
- **Processing:** Parse headers, plain text / HTML body, attachments metadata, and stable line map for citation projection.
- **Output:** `NormalizedSourcePayload` with coordinate map.
- **Failure mode:** Normalization failure prevents extraction call.

**Stage 3: Live Nova Email Extraction**
- **Input:** Normalized email payload, prompt version, execution decision.
- **Processing:** Call Bedrock/Nova live when policy is `live`; use replay cache when `replay`.
- **Output:** `SourceExtractionJson`.
- **Failure mode:** Provider or validation errors create a failed extraction record and preserve prior aggregate state.

**Stage 4: Validation and Exact Citation Projection**
- **Input:** `SourceExtractionJson`, normalization coordinate map.
- **Processing:** Validate JSON schema, resolve exact line references for surfaced claims, stamp citation mode and fallback reasons.
- **Output:** Durable extraction record with `citationMode`.
- **Failure mode:** If extraction JSON is valid but exact coordinate projection is partial, persist with warnings and explicit fallback mode.

**Stage 5: Aggregate Refresh and Publication**
- **Input:** Published aggregate, validated extraction set, current runtime state.
- **Processing:** Recompute/publish Dental aggregate through the dedicated publication boundary, then update runtime read model and retrieval index.
- **Output:** Published aggregate snapshot and runtime projection.
- **Failure mode:** Preserve last-known-good aggregate; surface degraded freshness to readers.

**Stage 6: Trust-State Computation**
- **Input:** Published aggregate snapshot, last successful run metadata, outstanding failed/in-progress semantic jobs.
- **Processing:** Compute `fresh`, `stale`, `degraded`, `lastKnownGood`, and display copy inputs for Overview, Ask, Reports, and Source Detail.
- **Output:** `SemanticTrustState`.
- **Failure mode:** If trust-state calculation fails, default conservatively to `degraded` and preserve current route availability.

### 4.4 Flow Diagram

A diagram produced from this spec should show existing product routes on the left, the upload modal and Ask/Reports actions in the center, and the backend pipeline on the right. The backend path should branch through execution-policy resolution, email normalization, live-or-replay Nova extraction, validation/exact citation projection, aggregate publication, trust-state computation, runtime projection, and retrieval refresh. Error branches should preserve last-known-good aggregate state and feed explicit trust-state banners back to Overview, Ask, Reports, and Source Detail.

---

## 5. Parity Matrix (Current Semantic Substrate -> Hardened Phase Target)

### 5.1 Module-Level Parity Decisions

| Source Module | Current Behavior | Target Module | Layer | Decision | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `server/src/services/ingest/corpusImport.service.js` | Builds Dental semantic metadata and seeded aggregate/read-model state via large helper flows | `sourceNormalization.service.js`, `citationProjection.service.js`, `semanticProjection.service.js` | BE | **Adapt / Split** | Preserve normalization/projection knowledge, but remove broad semantic assembly responsibilities. |
| `server/src/services/domain/mutation.service.js` | Orchestrates upload jobs, report generation, semantic state sync, and publication | `semanticIngestOrchestrator.service.js`, `semanticPublication.service.js`, slimmed mutation coordinator | BE | **Adapt / Split** | Keep job orchestration and route entry points, but extract semantic logic into dedicated services. |
| `server/src/services/domain/readModel.service.js` | Shapes product/source/report payloads from runtime state | Same module with expanded semantic trust fields | Both | **Port** | Existing route contracts and UI data shape remain the stable consumer surface. |
| `server/src/services/domain/ask.service.js` | Uses current product/read-model state plus retrieval to produce Ask responses | Same module with trust-state inputs and exact-source provenance | Both | **Adapt** | Keep current Ask flow, add explicit freshness/degraded-state semantics and stronger citation handling. |
| `server/src/services/rag/generation.service.js` | Deterministic draft plus optional Bedrock rewrite | Same module with trust-state-aware generation inputs | BE | **Adapt** | Preserve the current rewrite boundary while making stale/degraded conditions first-class. |
| `tests/e2e/helpers/novaLifecycle.js` | Replay-first helper for Dental lifecycle proof | Hybrid live/replay helper set with live-email coverage | Both | **Adapt** | Existing E2E structure is reusable, but needs live-family policy and trust-banner assertions. |

### 5.2 Behavioral Equivalence Criteria

- `PEQ-001`: Existing product routes remain stable and still render Dental within the same tabs and route structure.
- `PEQ-002`: Dental upload, Ask, Sources, Data, Timeline, and Reports remain reachable through current selectors and navigational patterns.
- `PEQ-003`: Mixed-mode portfolio behavior remains stable while Dental gains live-email and trust-surface behavior.
- `PEQ-004`: Existing deterministic structured-row rendering for Data tab remains unchanged; this scope only changes provenance, citation quality, freshness messaging, and backend service boundaries.

### 5.3 Intentional Divergences

- `DIV-001`: Dental email extraction becomes truly provider-backed in live mode rather than replay/synthesized-only.
- `DIV-002`: Source Detail no longer implies that all displayed citations are exact; it must distinguish exact coordinates from best-available fallback references.
- `DIV-003`: Ask and Reports explicitly state stale/degraded aggregate state rather than hiding fallback semantics inside answer/report copy.
- `DIV-004`: Dental semantic orchestration is intentionally removed from broad helper logic once the phase-3 hardening flag is enabled.

---

## 6. Interface Design Requirements

### 6.1 Screen/View Inventory

**View 1: Portfolio**
- **Purpose:** Continue to show mixed-mode posture across products while Dental gains live semantic trust metadata behind the existing card/read-model surface.
- **Primary Actions:** Open product pages, search, compare status.
- **Data Source:** Existing `GET /api/v1/portfolio`.

**View 2: Product Overview**
- **Purpose:** Show Dental status, narrative, knowledge health, semantic freshness/provenance, and upload entry point.
- **Primary Actions:** Upload artifact, ask question, navigate tabs.
- **Data Source:** Existing `GET /api/v1/products/:productId`.

**View 3: Sources**
- **Purpose:** Show source inventory plus extraction status, exact citations, citation fallback, and warnings.
- **Primary Actions:** Open source detail drawer, inspect provenance, filter sources.
- **Data Source:** Existing `GET /api/v1/products/:productId/sources` and source detail route.

**View 4: Ask**
- **Purpose:** Show evidence-backed answers with semantic freshness/degraded-state context.
- **Primary Actions:** Ask, retry, inspect evidence.
- **Data Source:** Existing `POST /api/v1/products/:productId/ask`.

**View 5: Reports**
- **Purpose:** Show report generation state, report content, and whether the report reflects the latest published or last-known-good semantic state.
- **Primary Actions:** Generate, regenerate, edit, export.
- **Data Source:** Existing report routes.

**View 6: Timeline and Data**
- **Purpose:** Continue rendering projected Dental state without direct UI redesign; these views consume the same runtime projection that semantic publication updates.
- **Primary Actions:** Filter, inspect grouped evidence, switch data datasets.
- **Data Source:** Existing `timeline` and `data` routes.

### 6.2 Information Architecture

- **Primary:** Current status, semantic freshness, degraded-state reason, and source provenance.
- **Secondary:** Source-level exact citations, Ask evidence, report regeneration state.
- **Tertiary:** Operator/debug details such as prompt version, execution mode, and fallback reason codes.
- **Navigation Model:** Preserve existing top navigation and product tab structure.

### 6.3 Layout & Responsive Requirements

- Preserve current desktop-first behavior and the existing unsupported viewport state below 1024px.
- Do not introduce a mobile redesign in this scope.
- Trust-state additions must fit into the current card/header system and side drawer layout rather than creating new pages.

---

## 7. Interaction & Visual Design Specifications

### 7.1 Core Interactions

- **Upload artifact:** Existing modal shell remains. Status copy distinguishes `live extraction`, `replay extraction`, `citation fallback`, `publication failed`, and `state preserved`.
- **Source detail:** Existing drawer remains. Citation blocks must visually distinguish exact line-range citations from best-available fallback references.
- **Ask:** Existing loading/result flow remains. Add a degraded-state banner or inline panel when using last-known-good aggregate or stale semantic state.
- **Reports:** Existing generation/regeneration interactions remain. Add a semantic-state banner that explains whether the report reflects the latest published aggregate.

### 7.2 Input Methods & Controls

- Continue using the existing upload modal inputs, Ask text area, and report buttons.
- No new end-user forms are required.
- Phase-1 live-email enablement is a backend/runtime concern and should not add a new end-user toggle.

### 7.3 Feedback & Confirmation Patterns

- Upload success copy must distinguish live versus replay execution mode when surfaced.
- Failures must state whether the source was stored, whether exact citations were available, and whether product state remained last-known-good.
- Trust-state banners must be informational and non-blocking unless the semantic state is too degraded to support the action.

### 7.4 Micro-interactions

- Reuse existing hover, focus, drawer, panel, and status-badge transitions.
- New trust-state banners should animate consistently with current inline status surfaces, respecting reduced-motion behavior.

### 7.5 Design System & Component Usage

- Reuse existing custom card, tab, modal, side-panel, badge, and knowledge-health panel patterns in `client/src/App.jsx` and `client/src/styles/runtime.css`.
- No new component library or design system is introduced.

### 7.6 Typography Hierarchy

- Continue using `Newsreader` for headings and `Outfit` for body text.
- Trust-state banners and citation labels should inherit the existing body scale and status-label hierarchy.

### 7.7 Color & Visual Semantics

- Preserve existing risk/caution/healthy semantic colors.
- Use a neutral/informational treatment for execution provenance and a cautionary treatment for stale/degraded state.
- Exact citation chips/labels should be visually quieter than error or caution states.

### 7.8 Iconography & Visual Assets

- Reuse current text-badge and inline status icon patterns.
- No new third-party icon dependency is required.

### 7.9 Spacing & Layout Grid

- Preserve current modal, header, card, and drawer spacing conventions.
- Avoid expanding the header beyond the current dense product-view rhythm; freshness/provenance should feel integrated, not bolted on.

---

## 8. Content & Copywriting Requirements

### 8.1 Content Strategy

- **Tone & Voice:** Operational, evidence-backed, explicit about freshness and fallback.
- **Content Principles:** Honest, concise, traceable, non-speculative, and confidence-calibrated.

### 8.2 Required Copy Elements

- **Live extraction success:** "Live AI extraction completed. New evidence is now available across Sources, Ask, and reports."
- **Replay extraction success:** "AI extraction completed in replay mode. New evidence is now available across Sources, Ask, and reports."
- **Exact citation fallback:** "Exact coordinates were unavailable for this source. Showing the best available reference."
- **Ask degraded banner:** "This answer is using the last published product understanding while newer evidence is still being validated."
- **Report degraded banner:** "This report reflects the last published product understanding. Regenerate after the current evidence refresh completes."
- **Publication failure:** "This source was stored, but product understanding was not refreshed. Last known good state remains active."

### 8.3 Localization Considerations

- English-only for this phase.
- Existing date formatting conventions remain unchanged.

---

## 9. Accessibility Requirements

### 9.1 WCAG Compliance

- Maintain current WCAG AA expectations for contrast, visible focus, and keyboard navigation.

### 9.2 Keyboard Navigation

- Upload modal, source detail drawer, Ask input, and report actions must remain fully keyboard accessible after trust-state additions.

### 9.3 Screen Reader Support

- Existing `aria-live` surfaces must announce live/replay completion, degraded-state changes, and source-level failure/preservation states.
- Exact citation versus fallback citation states must be announced with meaningful labels.

### 9.4 Additional Accessibility

- Preserve reduced-motion behavior already present in the app shell.
- Trust-state messaging must not rely on color alone; it must include textual explanation.

---

## 10. States & Scenarios

### 10.1 All UI States

- **Initial / Default:** Dental loads from the latest published aggregate and shows semantic freshness/provenance.
- **Processing:** Upload is queued/running, with stage-level status such as `normalizing`, `live extraction`, `validating`, `publishing`.
- **Completed (Fresh):** New extraction and publication succeed; Overview, Sources, Ask, and Reports reflect fresh state.
- **Completed (Replay):** Semantic refresh succeeds in replay mode; UI clearly marks replay provenance.
- **Partial (Citation Fallback):** Extraction succeeded, but exact citation mapping was partial or unavailable; Source Detail and any downstream surfaces show fallback reference copy.
- **Degraded (Last-Known-Good):** New evidence exists or failed refresh exists, but Ask/Reports/Product Overview are serving the last published aggregate with explicit warning.
- **Error:** Upload or report/Ask refresh failed in a retryable way; UI preserves last-known-good state.
- **Disabled:** Read-only users can view trust surfaces but not trigger mutations.

### 10.2 Permission & Role-Based Views

- **Lead/Editor:** Can upload artifacts, ask questions, generate reports, and see all trust-state messaging.
- **Read:** Sees provenance/freshness/degraded-state messaging but not upload/regeneration actions when current permissions forbid them.
- **Operator/Test Mode:** Internal reset workflows can place Dental into live/replay hybrid modes for verification; this is not a general end-user control.

---

## 11. Backend Module Design

### 11.1 Module Inventory

**Module 1: Semantic Execution Policy Service**
- **File(s):** `server/src/services/semantic/executionPolicy.service.js`
- **Responsibility:** Resolve live/replay/disabled behavior by product, source family, runtime flags, and reset/test mode.
- **Inputs:** `productId`, `sourceType`, `sourceFamily`, runtime config, optional reset/test overrides.
- **Outputs:** `SemanticExecutionDecision`.
- **Dependencies:** `server/src/config/runtime.js`
- **Error handling:** Fail closed when configuration is invalid.
- **Configuration:** Default mode, live family allow-list, CI/test replay enforcement.

**Module 2: Source Normalization Service**
- **File(s):** `server/src/services/semantic/sourceNormalization.service.js`
- **Responsibility:** Normalize Dental email first, and expose a stable coordinate map for exact citation projection.
- **Inputs:** Raw artifact buffer/path, metadata, source type.
- **Outputs:** `NormalizedSourcePayload`.
- **Dependencies:** `mailparser`, existing artifact helpers, filesystem artifact store.
- **Error handling:** Typed normalization errors; no extraction call on failure.

**Module 3: Nova Source Extraction Service**
- **File(s):** `server/src/services/semantic/novaSourceExtraction.service.js`, prompt registry files
- **Responsibility:** Run live or replay extraction according to execution decision, validate JSON, and persist prompt-run metadata.
- **Inputs:** `NormalizedSourcePayload`, execution decision, prompt family/version.
- **Outputs:** `SourceExtractionJson`.
- **Dependencies:** Bedrock text adapter, replay cache, AJV validation.
- **Error handling:** Invalid JSON or provider errors persist controlled failures.

**Module 4: Citation Projection Service**
- **File(s):** `server/src/services/semantic/citationProjection.service.js`
- **Responsibility:** Convert extracted claim references into exact line/coordinate citations when the normalized source exposes stable coordinate maps.
- **Inputs:** Extraction payload, normalization coordinate map.
- **Outputs:** Exact or fallback citation objects plus `citationMode`.
- **Dependencies:** Normalization output structure.
- **Error handling:** Downgrade to explicit fallback mode rather than silently fabricating exact coordinates.

**Module 5: Semantic Publication and Freshness Service**
- **File(s):** `server/src/services/semantic/semanticPublication.service.js`, `server/src/services/semantic/semanticFreshness.service.js`
- **Responsibility:** Publish the latest successful aggregate/read-model projection atomically and compute freshness/degraded-state metadata for readers.
- **Inputs:** Validated extraction set, current aggregate, publication context.
- **Outputs:** Published runtime state plus `SemanticTrustState`.
- **Dependencies:** runtime-state repository, read-model projector.
- **Error handling:** Preserve last-known-good state on failure and mark freshness as degraded.

**Module 6: Semantic Orchestrator**
- **File(s):** `server/src/services/semantic/semanticIngestOrchestrator.service.js`
- **Responsibility:** Coordinate policy decision, normalization, extraction, citation projection, publication, and retrieval refresh from upload/corpus/reset entry points.
- **Inputs:** Product id, source artifact, metadata, execution mode.
- **Outputs:** Job-stage results and final publication status.
- **Dependencies:** Modules 1-5 plus current job system.
- **Error handling:** Typed stage failures with explicit publication-preservation semantics.

### 11.2 New Dependencies

| Dependency | Version/Service | Purpose | Risk/Concern |
| :--- | :--- | :--- | :--- |
| None required for v1 of this follow-on scope | Existing stack only | Reuse `mailparser`, `ajv`, Bedrock SDK, and current DuckDB/runtime infrastructure | Low |

### 11.3 Removed / Deprecated Code

| File/Module | What's Removed or Reduced | Reason | Migration Path |
| :--- | :--- | :--- | :--- |
| semantic helper paths inside `corpusImport.service.js` | Broad semantic assembly responsibilities | Phase 3 requires dedicated services and cleaner ownership | Replace with calls into new semantic services |
| semantic sync helpers inside `mutation.service.js` | In-service semantic publication logic | Too much coupling between routes/jobs/reports and semantic internals | Leave mutation service as coordinator only |

---

## 12. Data Model & Storage

### 12.1 Schema Changes

**`state_source_extractions` additions**
- `execution_mode_effective` (`live` / `replay`)
- `source_family`
- `citation_mode` (`exact` / `fallback` / `mixed`)
- `citation_payload_json`
- `provider_request_id`
- `normalization_version`
- `line_count`
- `warning_codes_json`

**`state_product_aggregates` additions**
- `freshness_status` (`fresh` / `stale` / `degraded` / `last_known_good`)
- `freshness_reason_json`
- `derived_from_live_sources` boolean
- `latest_source_run_at`
- `published_from_run_id`

**`state_prompt_runs` additions**
- `provider`
- `provider_request_id`
- `source_family`
- `input_hash`
- `output_hash`
- `replay_key`
- `citation_mode`

### 12.2 Data Contracts

**Contract: `SemanticExecutionDecision`**
```json
{
  "productId": "dental",
  "sourceType": "email",
  "sourceFamily": "email",
  "executionMode": "live",
  "reason": "feature_flag_enabled_for_family",
  "promptVersion": "2026-04-16-email-v1"
}
```

**Contract: `NormalizedSourcePayload`**
```json
{
  "sourceId": "src-2401",
  "productId": "dental",
  "sourceType": "email",
  "sourceFamily": "email",
  "title": "Dental Vendor Mitigation Confirmed",
  "sourceDate": "2026-04-16",
  "normalizedText": "...",
  "coordinateMap": [
    { "line": 1, "offsetStart": 0, "offsetEnd": 52 },
    { "line": 2, "offsetStart": 53, "offsetEnd": 118 }
  ],
  "normalizationMeta": {
    "format": "eml",
    "from": "vendor@example.com",
    "to": ["lowry@example.com"],
    "subject": "Mitigation confirmed"
  }
}
```

**Contract: `SourceExtractionJson`**
```json
{
  "sourceId": "src-2401",
  "productId": "dental",
  "sourceType": "email",
  "summary": "Vendor confirmed a phased mitigation with staged access.",
  "decisions": [
    {
      "label": "Proceed with staged mitigation on April 18",
      "confidence": "high",
      "citation": {
        "kind": "line_range",
        "start": 11,
        "end": 15,
        "mode": "exact"
      }
    }
  ],
  "warnings": [],
  "confidence": "high"
}
```

**Contract: `SemanticTrustState`**
```json
{
  "executionMode": "live",
  "freshnessStatus": "fresh",
  "isDegraded": false,
  "usesLastKnownGood": false,
  "message": "Live AI extraction completed and the latest product understanding is active.",
  "lastPublishedAt": "2026-04-16T09:48:21.000Z",
  "latestAttemptAt": "2026-04-16T09:48:21.000Z",
  "reasonCodes": []
}
```

### 12.3 Storage Architecture

- **Primary store:** runtime-state DuckDB for extraction records, aggregate snapshots, prompt-run metadata, and trust-state fields.
- **Secondary store:** filesystem/S3 artifact store for raw artifacts, normalized payloads, and raw provider payload references.
- **Retrieval store:** Existing retrieval DuckDB remains unchanged in responsibility; it still stores searchable chunks and embeddings separately from semantic truth.
- **Consistency model:** Publish aggregate plus runtime projection atomically; failed live extraction or publication preserves last-known-good state and marks freshness accordingly.
- **Truth boundary:** Source extraction JSON plus citation projection are the durable semantic truth for this follow-on scope; trust-state metadata explains the freshness of the published aggregate view.

---

## 13. Unified API Contract (Single Source of Truth)

### 13.1 Endpoint Inventory

| UI Action | Method | Path | Purpose | Latency Target |
| :--- | :--- | :--- | :--- | :--- |
| Upload artifact | POST | `/api/v1/products/:productId/sources` | Submit Dental source for hybrid live/replay extraction and publication | `202` within 500ms |
| Poll ingest job | GET | `/api/v1/jobs/:jobId` | Read stage-level semantic progress and publication outcome | P95 < 300ms |
| Load product overview | GET | `/api/v1/products/:productId` | Fetch projected Dental state plus semantic trust metadata | P95 < 500ms |
| Load sources | GET | `/api/v1/products/:productId/sources` | Fetch source inventory and extraction/trust state | P95 < 500ms |
| Load source detail | GET | `/api/v1/products/:productId/sources/:sourceId` | Fetch summary, citations, warnings, and extraction provenance | P95 < 500ms |
| Ask question | POST | `/api/v1/products/:productId/ask` | Generate answer plus semantic freshness/degraded-state metadata | P95 < 4s replay, P95 < 8s live local/dev |
| Generate report | POST | `/api/v1/products/:productId/reports` | Queue report generation using published aggregate and trust state | `202` within 500ms |
| Read report | GET | `/api/v1/products/:productId/reports/:reportId` | Fetch report content plus semantic freshness/regeneration status | P95 < 500ms |
| Test/admin reset | POST | `/api/v1/test/reset` | Reset Dental into replay or hybrid live-email mode for proof runs | P95 < 750ms |

### 13.2 Request / Response Shapes

**`POST /api/v1/products/:productId/sources`**

Request remains existing multipart upload contract.

Response (`202`):
```json
{
  "jobId": "job-1042",
  "sourceId": "src-2401",
  "status": "queued",
  "title": "Dental Vendor Mitigation Confirmed",
  "effectiveExecutionMode": "live",
  "updatedDomains": ["sources", "ask", "reports"]
}
```

**`GET /api/v1/jobs/:jobId`**
```json
{
  "jobId": "job-1042",
  "jobType": "ingest",
  "status": "running",
  "stage": "live_extraction",
  "executionMode": "live",
  "result": {
    "sourceId": "src-2401",
    "title": "Dental Vendor Mitigation Confirmed",
    "updatedDomains": ["sources", "ask", "reports"]
  },
  "warnings": [],
  "errorCode": null,
  "message": null
}
```

**`GET /api/v1/products/:productId`**

All existing product payload fields remain. Additions:
```json
{
  "product": {
    "id": "dental",
    "semanticState": {
      "executionMode": "live",
      "aggregateStatus": "published",
      "freshnessStatus": "fresh",
      "usesLastKnownGood": false,
      "message": "Live AI extraction completed and the latest product understanding is active.",
      "lastPublishedAt": "2026-04-16T09:48:21.000Z",
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
    "summary": "Vendor confirmed a phased mitigation with staged access.",
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
    "executionMode": "live"
  }
}
```

**`POST /api/v1/products/:productId/ask`**
```json
{
  "question": "Did the vendor commit to a recovery step?"
}
```

Response success:
```json
{
  "status": "complete",
  "answerHtml": "<strong>Evidence-backed response:</strong> ...",
  "evidenceStrength": "high",
  "coverage": {
    "isPartial": false,
    "warnings": []
  },
  "semanticState": {
    "freshnessStatus": "fresh",
    "usesLastKnownGood": false,
    "message": "Answer is based on the latest published product understanding."
  },
  "sources": [
    {
      "sourceId": "src-2401",
      "title": "Dental Vendor Mitigation Confirmed",
      "meta": "2026-04-16 - email"
    }
  ]
}
```

**`GET /api/v1/products/:productId/reports/:reportId`**

All existing report fields remain. Additions:
```json
{
  "report": {
    "reportId": "rep-701",
    "semanticState": {
      "freshnessStatus": "degraded",
      "usesLastKnownGood": true,
      "message": "This report reflects the last published product understanding. Regenerate after the current evidence refresh completes."
    }
  }
}
```

**`POST /api/v1/test/reset`**
```json
{
  "productId": "dental",
  "mode": "wave-00",
  "executionMode": "hybrid",
  "featureMode": "live-email-trust-hardening"
}
```

Response success:
```json
{
  "status": "ok",
  "productId": "dental",
  "mode": "wave-00",
  "executionMode": "hybrid",
  "featureMode": "live-email-trust-hardening",
  "sourceFamilyModes": {
    "email": "live",
    "document": "replay",
    "transcript": "replay",
    "spreadsheet": "replay"
  },
  "seededSources": 15
}
```

### 13.3 Error Contract

| Condition | HTTP Status | Error Code | Retryable | FE Behavior | BE Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Upload validation failure | 400 | `VALIDATION_ERROR` | No | Inline upload error | No write |
| Live execution policy disabled | 409 | `SEMANTIC_EXECUTION_DISABLED` | No | Retry in supported mode or contact support | Log config issue |
| Provider unavailable | 503 | `MODEL_UNAVAILABLE` | Yes | Processing error with preserved-state messaging | Persist failed prompt run |
| Extraction invalid | 422 or async failed result | `EXTRACTION_INVALID` | Yes | Source shows failed/partial and old state remains | Persist validation failure |
| Citation projection fallback | 200 / async partial | `CITATION_FALLBACK` | N/A | Source detail shows fallback messaging | Persist warning and fallback mode |
| Aggregate publication failure | async failed/partial | `PUBLICATION_FAILED` | Yes | Overview/Ask/Reports show degraded last-known-good state | Preserve current published aggregate |
| Ask insufficient evidence | 422 | `INSUFFICIENT_EVIDENCE` | No | Existing Ask insufficient-evidence UI | No publication change |
| Unauthorized | 401 | `UNAUTHORIZED` | No | Existing session-expired handling | Log auth failure |
| Forbidden | 403 | `FORBIDDEN` | No | Existing permission handling | Log access attempt |
| Internal error | 500 | `INTERNAL_ERROR` | Yes | Generic retry surface | Log stack trace |

### 13.4 State-API-Backend Mapping Table

| User Action | UI State (Before) | API Call | Backend Processing | API Response | UI State (After) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Uploads Dental email in hybrid mode | Overview idle | `POST /sources` | Execution policy -> normalize email -> live extract -> validate -> citations -> publish | `202` with `effectiveExecutionMode=live` | Processing panel visible |
| Polls job during live extraction | Processing running | `GET /jobs/:jobId` | Read job stage | `running`, `stage=live_extraction` | Processing stage updated |
| Opens source detail after success | Source row visible | `GET /sources/:sourceId` | Read extraction + citation payload | `200` with exact citations | Source drawer shows exact references |
| Asks while aggregate is degraded | Ask input filled | `POST /ask` | Read current published aggregate + trust state | `200` with `usesLastKnownGood=true` | Ask banner warns about degraded state |
| Opens report after failed publication | Reports tab open | `GET /reports/:reportId` | Read report + semantic state | `200` with `freshnessStatus=degraded` | Report banner explains fallback state |

### 13.5 Internal Service Contracts

- `resolveSemanticExecutionPolicy({ productId, sourceType, sourceFamily, overrides }) -> SemanticExecutionDecision`
- `normalizeSourceArtifact(input) -> Promise<NormalizedSourcePayload>`
- `extractSourceWithNova(normalized, executionDecision) -> Promise<SourceExtractionJson>`
- `projectExtractionCitations(extraction, coordinateMap) -> CitationProjectionResult`
- `publishSemanticState({ productId, extractionRecord, currentState }) -> Promise<PublicationResult>`
- `computeSemanticTrustState({ productId, currentState }) -> SemanticTrustState`

---

## 14. Configuration & Feature Flags

### 14.1 Environment Variables

| Variable | Type | Default | Required | Side | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `EIDS_ENABLE_BEDROCK` | boolean | false | Yes for live mode | BE | Enables live Bedrock text calls |
| `BEDROCK_TEXT_MODEL_ID` | string | `amazon.nova-pro-v1:0` | Yes in live mode | BE | Nova text model |
| `EIDS_SEMANTIC_EXECUTION_MODE_DEFAULT` | string | `replay` | Yes | BE | Default source-family execution mode |
| `EIDS_SEMANTIC_LIVE_SOURCE_FAMILIES` | comma-separated string | `email` | No | BE | Source families allowed to run live when feature flag is on |
| `EIDS_PROMPT_REGISTRY_VERSION` | string | current commit/tag | Yes | BE | Prompt registry version binding |
| `EIDS_SEMANTIC_STALE_AFTER_HOURS` | integer | `24` | Yes | BE | Freshness threshold for stale/degraded messaging |
| `EIDS_EVAL_CACHE_DIR` | string | runtime-local path | Yes | BE | Replay cache directory |

### 14.2 Feature Flags

| Flag | Default | Side | Purpose | Removal Criteria |
| :--- | :--- | :--- | :--- | :--- |
| `ENABLE_NOVA_DENTAL_LIVE_EMAIL` | false initially | Both | Enables live Bedrock extraction for Dental email family | Remove after live-email rollout is stable |
| `ENABLE_DENTAL_TRUST_SURFACES` | false initially | Both | Enables freshness/degraded-state UI messaging and exact citation presentation | Remove after rollout is stable |
| `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` | false initially | BE | Switches Dental semantic orchestration to dedicated services | Remove after new service boundaries are the only path |
| `ENABLE_EXTRACTION_REPLAY_MODE` | true in test | BE | Preserves deterministic automated proof path | Keep long-term |

### 14.3 Tunable Parameters

| Parameter | Default | Range | Side | Impact |
| :--- | :--- | :--- | :--- | :--- |
| `LIVE_EXTRACTION_RETRY_LIMIT` | 1 | 0-3 | BE | Retries live Bedrock extraction |
| `CITATION_FALLBACK_THRESHOLD` | 0 | 0-1 | BE | Governs when exact-coordinate projection can safely downgrade |
| `SEMANTIC_STALE_AFTER_HOURS` | 24 | 1-168 | Both | Drives stale/degraded trust-state presentation |
| `ASK_MAX_SOURCES` | 8 | 4-12 | Both | Evidence-packing limit |

---

## 15. Operational Concerns

### 15.1 Performance & Latency

- Upload request acknowledgment: P95 < 500ms.
- Live Dental email extraction terminal completion: P95 < 15s in local/dev.
- Replay Dental email extraction: P95 < 2s.
- Ask: P95 < 4s in replay-backed state, P95 < 8s when current live state is fresh.
- Report generation terminal completion: P95 < 15s in local/dev.

### 15.2 Scalability

- This scope is intentionally Dental-first and email-first for live execution.
- Service boundaries must be designed so later source-family expansion only changes execution policy, prompt registry entries, and normalization adapters.

### 15.3 Observability & Debugging

- Log and persist per run: `productId`, `sourceId`, `sourceFamily`, `executionMode`, `promptVersion`, `modelId`, `providerRequestId`, `latencyMs`, `validationStatus`, `citationMode`, `publicationStatus`, `freshnessStatus`.
- Emit counters for live extraction attempts, live extraction failures, replay hits, citation fallbacks, publication failures, and degraded-state reads.
- Keep prompt-run records queryable for Dental operator debugging.

### 15.4 Security & Compliance

- Maintain existing GovCloud-compatible provider/config constraints.
- Do not expose raw provider payloads directly to the frontend.
- Validate all model outputs before they influence runtime state or citation display.

### 15.5 Failure Modes & Recovery

| Failure Scenario | Detection | Impact (User-Facing) | Impact (System) | Recovery | RTO |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Email normalization failure | parser error | Source marked failed | No live extraction record | Re-upload or parser fix | Immediate |
| Bedrock provider failure | timeout / SDK error | Upload failure with preserved-state messaging | Failed prompt run, no new publication | Retry live extraction | Immediate |
| Extraction invalid JSON | schema failure | Source failed/partial; prior state remains active | No new publication | Prompt/schema fix and retry | Immediate |
| Citation projection partial | exact coordinate resolution failure | Source shows fallback citation note | Extraction persists with `citationMode=fallback` | Inspect coordinate map / normalizer | Immediate |
| Publication failure | publication exception | Ask/Reports/Overview show degraded last-known-good state | New extraction exists, aggregate not published | Retry publication only | Immediate |
| Freshness computation failure | runtime exception | Conservative degraded banner | Publication remains intact | Fix freshness service | Immediate |

### 15.6 Rollback Plan

- Rollback trigger: repeated provider failures, incorrect provenance display, or service-split regressions.
- Frontend rollback: disable trust-surface flags and fall back to existing extraction-first UI surface without freshness/degraded additions.
- Backend rollback: disable live-email and service-split flags, returning Dental to the current replay-backed semantic substrate.
- Data safety: stored source artifacts, extraction records, and prompt runs remain durable; rollback changes which path publishes the runtime state.

---

## 16. Phased Implementation Plan

### 16.1 Phase Overview

| Phase | Name | FE Scope | BE Scope | Stub/Mock Boundary | Integration Checkpoint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Live Dental Email Baseline | Small provenance/status copy additions only where required for live-mode visibility | Introduce execution policy, live Dental email normalization/extraction, prompt-run persistence, and publication on current read-model contracts | FE may use fixture-backed `semanticState.executionMode=live` while BE wires live policy | One Dental email upload runs live end-to-end and publishes state safely |
| 2 | Trust Surfaces and Exact Citations | Add freshness/degraded banners, exact/fallback citation rendering, and report/Ask trust messaging | Add exact citation projection, freshness/degraded-state computation, and enriched read-model responses | FE can use projected fixture responses; BE may replay extraction while validating trust-state logic | Source Detail, Ask, and Reports all show coherent trust-state semantics |
| 3 | Semantic Service Hardening | No major UX change; verify stability under the dedicated service path | Split semantic logic into dedicated services and slim `corpusImport.service.js` / `mutation.service.js` coordinators | No UI stub required; BE can preserve route contracts behind the new flag | Dental flows run through dedicated services with no contract regression |

### 16.2 Phase Details

**Phase 1: Live Dental Email Baseline**
- **Frontend tasks:** Surface live versus replay execution mode in existing processing/header surfaces with minimal contract additions.
- **Backend tasks:** Implement source-family execution policy, normalize `.eml` inputs into coordinate-aware payloads, call live Nova for Dental email, persist provider metadata, and publish on the current runtime path.
- **Integration checkpoint:** Headed and headless proof show a Dental email upload completing through the live path.

**Phase 2: Trust Surfaces and Exact Citations**
- **Frontend tasks:** Add source citation rendering modes, Ask degraded banner, report semantic-state banner, and freshness badge integration into existing UI.
- **Backend tasks:** Implement exact citation projection, trust-state computation, and enriched read-model payloads for product/source/ask/report routes.
- **Integration checkpoint:** Users can distinguish fresh, replay, stale, degraded, and citation-fallback states without reading logs.

**Phase 3: Semantic Service Hardening**
- **Frontend tasks:** Re-verify no route/selector regressions; no new visual scope beyond Phase 2.
- **Backend tasks:** Introduce dedicated semantic services, migrate call sites off broad helper logic, and preserve current contracts/feature flags.
- **Integration checkpoint:** Dental upload, Ask, and Reports behave identically at the UI surface while the backend uses the dedicated services under flag.

### 16.3 Dependency Graph

- Phase 1 blocks Phases 2 and 3 because trust-state messaging must describe a real live boundary.
- Phase 2 depends on Phase 1 publication metadata and coordinate-aware normalization outputs.
- Phase 3 depends on Phase 1 and 2 contracts being stable, because the service split is not allowed to change UI behavior or route shapes.

---

## 17. QA, Acceptance Criteria, and Definition of Done

### 17.1 Global Quality Gates

- **AC-G-001:** When `ENABLE_NOVA_DENTAL_LIVE_EMAIL` is enabled and runtime configuration supports Bedrock, Dental email extraction must run live rather than replay for the email family.
- **AC-G-002:** Effective execution mode must be persisted and surfaced; the system may not silently fall back from live to replay without explicit metadata and UI-visible semantics.
- **AC-G-003:** Exact citation presentation may only claim `exact` when coordinate projection succeeded from normalization output; otherwise the UI and stored metadata must explicitly mark fallback mode.
- **AC-G-004:** Ask and Reports must surface stale/degraded or last-known-good aggregate state instead of silently presenting fallback state as fresh.
- **AC-G-005:** Publication failures must preserve the last-known-good Dental aggregate/read model.
- **AC-G-006:** Existing Dental routes, selectors, and tab navigation must remain stable.
- **AC-G-007:** Mixed-mode portfolio rendering for non-Dental products must not regress.
- **AC-G-008:** Prompt-run metadata for live Dental email extractions must be queryable and traceable to provider/model/prompt version.
- **AC-G-009:** When `ENABLE_DENTAL_SEMANTIC_SERVICE_SPLIT` is enabled, Dental semantic orchestration must execute through dedicated services rather than broad helper logic embedded in `corpusImport.service.js` or `mutation.service.js`.
- **AC-G-010:** Required Playwright proof for this scope must pass in both headed and headless modes.

### 17.2 Frontend Requirement-Level Acceptance Criteria

**Overview and Header Trust State**
- **AC-FE-001:** Dental Overview shows a semantic execution/freshness surface derived from `product.semanticState` without changing the route structure.
- **AC-FE-002:** When a live Dental email refresh succeeds, Overview messaging states that live AI extraction completed and the latest product understanding is active.
- **AC-FE-003:** When Dental is serving last-known-good state, Overview shows degraded or preserved-state messaging instead of appearing fresh.

**Sources and Citation Trust**
- **AC-FE-004:** Sources list and Source Detail show each source's extraction status and effective execution mode.
- **AC-FE-005:** Source Detail shows exact citations with stable labels when `citationMode=exact`.
- **AC-FE-006:** Source Detail shows explicit fallback wording when exact coordinates are unavailable.
- **AC-FE-007:** Citation warnings do not imply the source was ignored; they communicate provenance limitations clearly.

**Ask**
- **AC-FE-008:** Ask answers display normally with citations and now include semantic freshness/degraded-state context.
- **AC-FE-009:** When Ask uses a last-known-good aggregate, the UI shows a degraded banner before or alongside the answer.

**Reports**
- **AC-FE-010:** Reports surface a semantic-state banner describing whether the report reflects the latest published or last-known-good product understanding.
- **AC-FE-011:** Report regeneration notices coexist correctly with semantic trust-state messaging.

**Upload and Error UX**
- **AC-FE-012:** Upload processing states distinguish live extraction, replay extraction, publication failure, and preserved-state outcomes.
- **AC-FE-013:** Upload failures preserve the prior Dental state and explain that the latest product understanding did not publish.

**Accessibility and Consistency**
- **AC-FE-014:** All new trust-state UI additions are keyboard accessible and announced to assistive technologies.
- **AC-FE-015:** Existing layout, typography, and custom design language remain intact.

### 17.3 Backend Requirement-Level Acceptance Criteria

**Execution Policy and Live Extraction**
- **AC-BE-001:** Backend resolves effective execution mode by source family and supports hybrid Dental live-email / replay-rest behavior.
- **AC-BE-002:** Dental email normalization produces a coordinate-aware normalized payload suitable for exact line-range projection.
- **AC-BE-003:** Live Dental email extraction uses the Bedrock adapter path and persists prompt-run metadata including provider request id, model id, prompt version, and latency.
- **AC-BE-004:** Replay mode remains available for automated suites and is explicitly recorded in prompt-run metadata.

**Validation and Citation Projection**
- **AC-BE-005:** Successful extraction records persist `citationMode` and citation payload data.
- **AC-BE-006:** Exact citation projection may downgrade to fallback but may not fabricate exact coordinates.
- **AC-BE-007:** Source detail/read-model responses expose summary, warnings, execution mode, and citation details from persisted semantic state.

**Publication and Trust State**
- **AC-BE-008:** Aggregate publication is atomic: either a new published state and runtime projection are active together, or the prior published state remains active.
- **AC-BE-009:** Publication failures leave the last-known-good aggregate intact and mark semantic freshness as degraded.
- **AC-BE-010:** Freshness/degraded-state computation is available on product, ask, and report read paths.

**Service Hardening**
- **AC-BE-011:** Dedicated semantic services exist for execution policy, normalization, extraction, citation projection, publication, and freshness.
- **AC-BE-012:** `corpusImport.service.js` and `mutation.service.js` act as coordinators only for Dental semantic work when the service-split flag is enabled.
- **AC-BE-013:** Existing read-model route contracts remain stable while the service split is active.

**Observability and Safety**
- **AC-BE-014:** Structured logs and persisted prompt runs are sufficient to trace user-visible trust-state output back to run metadata.
- **AC-BE-015:** Invalid model outputs and provider failures become controlled failures with no partial semantic corruption of published state.

### 17.4 Cross-Cutting Integration Acceptance Criteria

- **AC-INT-001:** Resetting Dental into hybrid live-email mode produces a product state that clearly indicates the current execution policy.
- **AC-INT-002:** Uploading a Dental email in live mode triggers live extraction, validated persistence, publication, and UI refresh without manual backend intervention.
- **AC-INT-003:** If live extraction succeeds but publication fails, Overview, Ask, and Reports remain on last-known-good state and display degraded messaging.
- **AC-INT-004:** Source Detail shows exact citations when available for the uploaded Dental email and fallback wording when exact projection is not available.
- **AC-INT-005:** Ask reflects fresh versus last-known-good state consistently with the current published aggregate metadata.
- **AC-INT-006:** Reports surface semantic-state trust consistently with report regeneration state.
- **AC-INT-007:** The same Playwright workflow set passes in headed and headless modes.

### 17.5 Full-Stack E2E Scenarios

| Scenario ID | Workflow | Proof Type | Seed / Data Requirement | Acceptance Criteria Coverage |
| :--- | :--- | :--- | :--- | :--- |
| `E2E-DENTAL-LIVE-EMAIL-001` | Reset Dental into hybrid mode and upload a Dental email through live extraction | Live Backend-Backed E2E locally, Replay fallback in CI where live Bedrock is unavailable | Hybrid reset plus live-capable Bedrock config or explicit replay fallback | `AC-G-001`, `AC-G-002`, `AC-FE-002`, `AC-BE-001`-`004`, `AC-INT-001`, `AC-INT-002` |
| `E2E-DENTAL-SOURCE-CITATIONS-002` | Open Source Detail and verify exact versus fallback citation rendering | Live Backend-Backed E2E or Replay when using persisted extraction fixture | Hybrid/live upload or seeded extraction fixture | `AC-G-003`, `AC-FE-004`-`007`, `AC-BE-005`-`007`, `AC-INT-004` |
| `E2E-DENTAL-ASK-DEGRADED-003` | Force degraded publication state and verify Ask banner plus answer behavior | Replay-backed failure fixture preferred | Seeded degraded-state fixture | `AC-G-004`, `AC-FE-008`, `AC-FE-009`, `AC-BE-009`, `AC-BE-010`, `AC-INT-003`, `AC-INT-005` |
| `E2E-DENTAL-REPORT-TRUST-004` | Generate/read report and verify semantic-state trust banner plus regeneration notice | Replay-backed E2E or live local verification | Seeded report-capable Dental state | `AC-FE-010`, `AC-FE-011`, `AC-BE-010`, `AC-INT-006` |
| `E2E-DENTAL-PUBLICATION-FAILURE-005` | Upload a Dental email, force publication failure, verify last-known-good preservation | Replay-backed failure fixture preferred | Failure injection/reset mode | `AC-G-005`, `AC-FE-013`, `AC-BE-008`, `AC-BE-009`, `AC-INT-003` |
| `E2E-DENTAL-SERVICE-SPLIT-006` | Run the same upload/ask/report flow with service-split flag on | Live or replay backend-backed E2E | Service-split feature flag enabled | `AC-G-009`, `AC-BE-011`-`013`, `AC-INT-007` |

### 17.6 Definition of Done

The feature is complete only when all of the following are true:

- All `AC-G-*`, `AC-FE-*`, `AC-BE-*`, and `AC-INT-*` items are implemented and mapped to proof.
- Dental email live extraction runs through Bedrock in supported local/dev proof environments and replay fallback is explicit where live proof is unavailable.
- Product Overview, Source Detail, Ask, and Reports all surface semantic freshness/degraded-state and citation trust in the ways described in this document.
- Last-known-good publication semantics are preserved across live extraction, citation projection, and publication failures.
- Dedicated semantic services replace broad helper-based semantic assembly when the service-split flag is enabled.
- Required Playwright workflows pass in both headed and headless modes.
- Implementation documentation, rollout instructions, and operator guidance for hybrid live/replay behavior are checked in.

### 17.7 Usability Testing Plan

- Conduct one operator walkthrough in hybrid live-email mode to confirm trust surfaces align with actual provider-backed execution.
- Conduct one product-manager walkthrough focused on Source Detail and Ask trust messaging.
- Conduct one leadership walkthrough focused on the report semantic-state banner and degraded-state comprehension.

### 17.8 Required Design Deliverables

- Updated API contract and semantic trust-state field definitions checked into the repo.
- Prompt registry documentation for live Dental email extraction.
- Hybrid live/replay rollout and proof guide.
- UI copy inventory for execution provenance, exact citations, and degraded-state messaging.

### 17.9 Playwright Test Scripts

#### PW-001 Hybrid Reset and Live Email Baseline
- **Maps to:** `AC-FE-001`, `AC-FE-002`, `AC-INT-001`, `AC-INT-002`
- **Proof Type:** Live Backend-Backed locally, Replay fallback in CI if live Bedrock is unavailable
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental hybrid mode shows live semantic state after email upload', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'hybrid',
    featureMode: 'live-email-trust-hardening',
  });

  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('extraction-state-badge')).toBeVisible();

  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });

  await expect(page.getByTestId('semantic-freshness-badge')).toContainText(/fresh|live/i);
  await expect(page.getByTestId('overview-current-state')).toBeVisible();
});
```

#### PW-002 Source Detail Exact Citations
- **Maps to:** `AC-FE-004`-`007`, `AC-INT-004`
- **Proof Type:** Live Backend-Backed or Replay-backed with persisted exact citation fixture
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Source detail distinguishes exact citations from fallback references', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'hybrid',
    featureMode: 'live-email-trust-hardening',
  });

  const upload = await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await page.getByTestId('product-tab-sources').click();
  await page.getByTestId(`source-item-${upload.sourceId}`).click();

  await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
  await expect(page.getByTestId('source-detail-citations')).toBeVisible();
  await expect(page.getByTestId('source-detail-citation-mode')).toContainText(/exact|fallback/i);
});
```

#### PW-003 Ask Degraded Banner
- **Maps to:** `AC-FE-008`, `AC-FE-009`, `AC-INT-003`, `AC-INT-005`
- **Proof Type:** Replay-backed failure fixture preferred
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, askAndWait } from './helpers/novaLifecycle.js';

test('Ask shows degraded semantic state when last-known-good aggregate is active', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-02',
    executionMode: 'replay',
    featureMode: 'live-email-trust-hardening',
  });

  await page.goto('/products/dental?tab=overview&testCase=publicationFailure');
  await askAndWait(page, 'What is blocking recovery right now?');

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-degraded-banner')).toBeVisible();
});
```

#### PW-004 Report Semantic Trust
- **Maps to:** `AC-FE-010`, `AC-FE-011`, `AC-INT-006`
- **Proof Type:** Replay-backed E2E or live local verification
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Reports show semantic-state trust and regeneration state together', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-02',
    executionMode: 'replay',
    featureMode: 'live-email-trust-hardening',
  });

  await page.goto('/products/dental?tab=reports');
  await page.getByTestId('generate-report-button').click();

  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('report-semantic-state-banner')).toBeVisible();
});
```

#### PW-005 Publication Failure Preserves Last-Known-Good
- **Maps to:** `AC-FE-013`, `AC-INT-003`
- **Proof Type:** Replay-backed failure fixture preferred
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Publication failure preserves last-known-good semantic state', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-02',
    executionMode: 'replay',
    featureMode: 'live-email-trust-hardening',
  });

  await page.goto('/products/dental?tab=overview');
  const priorStatus = await page.getByTestId('product-status-badge').textContent();

  await uploadNovaArtifact(page, {
    fixtureKey: 'wave03-vendor-mitigation-email',
    testCase: 'publicationFailure',
  });

  await expect(page.getByTestId('semantic-degraded-banner')).toBeVisible();
  await expect(page.getByTestId('product-status-badge')).toContainText(priorStatus || '');
});
```

#### PW-006 Service Split Stability
- **Maps to:** `AC-BE-011`-`013`, `AC-INT-007`
- **Proof Type:** Live or replay backend-backed E2E
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact, askAndWait } from './helpers/novaLifecycle.js';

test('Dental flow remains stable when semantic service split is enabled', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'hybrid',
    featureMode: 'service-split',
  });

  await page.goto('/products/dental?tab=overview');
  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await askAndWait(page, 'Did the vendor confirm the mitigation?');

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await page.getByTestId('product-tab-reports').click();
  await expect(page.getByTestId('report-semantic-state-banner')).toBeVisible();
});
```

---

## 18. Frontend Engineering Handoff (React Implementation Notes)

### 18.1 Route-Level Impact

- Preserve existing routes:
  - `/portfolio`
  - `/products/:productId?tab=overview|timeline|data|sources|reports`
- No new primary route is required.
- Trust-state additions live within current page composition in `client/src/App.jsx`.

### 18.2 Component and State Boundaries

- Preserve current single-app composition style in `client/src/App.jsx`.
- Add minimal projected fields rather than raw prompt payloads:
  - `product.semanticState.freshnessStatus`
  - `product.semanticState.usesLastKnownGood`
  - `product.semanticState.message`
  - `source.executionMode`
  - `source.citationMode`
  - `source.citations`
  - `report.semanticState`
- Do not couple React components directly to prompt names, provider ids, or raw provider payloads.

### 18.3 Data Fetching and Refresh Model

- Reuse the existing `apiGet`, `apiSend`, and `apiUpload` helpers in `client/src/lib/api.js`.
- Existing upload completion behavior should invalidate/refetch product and sources state.
- Ask and Reports continue using current request patterns; only the payload surface grows with trust-state fields.

### 18.4 UI Additions Allowed in v1

- Semantic freshness badge in the product header or knowledge-health area.
- Degraded-state banner in Ask.
- Semantic-state banner in Reports.
- Citation mode indicator and fallback copy in Source Detail.
- No redesign of tabs, cards, navigation, or portfolio layout.

### 18.5 Required `data-testid` Selectors

| Selector | Purpose |
| :--- | :--- |
| `product-page` | Existing route root |
| `product-status-badge` | Existing posture assertion selector |
| `overview-current-state` | Existing overview narrative selector |
| `extraction-state-badge` | Existing execution-mode badge |
| `semantic-freshness-badge` | New product freshness/provenance selector |
| `semantic-degraded-banner` | New overview degraded-state banner |
| `source-detail-drawer` | Existing source drawer container |
| `source-detail-summary` | Existing / prior required summary selector |
| `source-detail-citations` | Existing / prior required citations container |
| `source-detail-citation-mode` | New exact-vs-fallback citation indicator |
| `ask-answer` | Existing Ask result container |
| `ask-degraded-banner` | New Ask degraded-state selector |
| `report-semantic-state-banner` | New report trust-state banner |
| `report-regenerate-notice` | Existing regeneration selector |
| `generate-report-button` | Existing report action selector |

### 18.6 Frontend Test Expectations

- Add component/integration tests for:
  - semantic freshness badge rendering
  - source detail exact versus fallback citation rendering
  - Ask degraded-state banner
  - report semantic-state banner
- Additive Playwright proof is mandatory for the user-visible flows in Section 17.9.

### 18.7 Parallel Development Stub Boundary

- FE may develop against static fixture responses that conform to the enriched product/source/ask/report contracts in Section 13.
- Fixture responses must represent projected runtime state, not raw provider output.
- Before merge, FE work must be re-verified against the integrated backend path.

---

## 19. Backend Engineering Handoff

### 19.1 Primary Module Impact

- `server/src/config/runtime.js`
  - Add source-family execution policy and stale-threshold configuration.
- `server/src/services/domain/mutation.service.js`
  - Remove embedded semantic assembly and delegate to semantic orchestrator/publication services.
- `server/src/services/ingest/corpusImport.service.js`
  - Remove embedded semantic state assembly for Dental under the service-split flag.
- `server/src/services/domain/readModel.service.js`
  - Project trust-state additions into stable route responses.
- `server/src/services/domain/ask.service.js`
  - Consume freshness/degraded-state metadata when building Ask responses.
- `server/src/services/rag/generation.service.js`
  - Respect trust-state context in Ask/report drafting behavior.
- `server/src/services/state/runtimeState.repository.js`
  - Persist the added semantic fields and prompt-run metadata.

### 19.2 New Backend Modules Recommended

- `server/src/services/semantic/executionPolicy.service.js`
- `server/src/services/semantic/sourceNormalization.service.js`
- `server/src/services/semantic/novaSourceExtraction.service.js`
- `server/src/services/semantic/citationProjection.service.js`
- `server/src/services/semantic/semanticPublication.service.js`
- `server/src/services/semantic/semanticFreshness.service.js`
- `server/src/services/semantic/semanticIngestOrchestrator.service.js`

### 19.3 Data and Schema Ownership

- JSON schemas for extraction, citation payloads, and trust-state surfaces must be versioned in-repo.
- Schema validation occurs before persistence and before publication.
- Route payloads remain read-model outputs, not raw semantic service outputs.

### 19.4 Replay and Hybrid Execution Rules

- Replay remains mandatory for automated suites unless a test explicitly declares live local proof.
- Hybrid mode must be source-family scoped and queryable.
- Live/email versus replay/rest behavior must be deterministic from configuration and reset/test mode.

### 19.5 Prompt Iteration and Evaluation Harness

- Extend the current replay/live proof tooling with live-email baseline verification.
- Prompt changes for the live email family are not releasable until they pass exact-citation and trust-state acceptance checks.
- The evaluation harness must store enough metadata to compare live versus replay behavior safely.

### 19.6 Operational Safeguards

- Preserve the current replay-backed semantic path behind flags until live-email and trust surfaces are stable.
- Never allow a failed live extraction or failed publication to overwrite the last published Dental state.
- Keep mixed-mode portfolio compatibility explicit until future product migrations are separately specified.

### 19.7 Backend Test Expectations

- **Unit tests:** execution policy resolution, email normalization coordinate maps, citation projection, freshness-state computation.
- **Integration tests:** live/replay extraction orchestration, runtime-state persistence, publication preservation, read-model enriched payloads.
- **Contract tests:** product/source/ask/report route additions.
- **Playwright tests:** required for the cross-cutting flows in Section 17.9.

### 19.8 TDD Plan (Combined)

**Frontend Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `semantic-header-renders-live-and-degraded-states` | Component / Integration | `AC-FE-001`, `AC-FE-002`, `AC-FE-003`, `AC-FE-015` | Yes |
| `source-detail-renders-exact-vs-fallback-citations` | Component / Integration | `AC-FE-004`, `AC-FE-005`, `AC-FE-006`, `AC-FE-007` | Yes |
| `ask-renders-degraded-banner` | Component / Integration | `AC-FE-008`, `AC-FE-009` | Yes |
| `reports-renders-semantic-state-banner` | Component / Integration | `AC-FE-010`, `AC-FE-011` | Yes |
| `upload-processing-copy-surfaces-live-replay-and-preserved-state` | Component / Integration | `AC-FE-012`, `AC-FE-013`, `AC-FE-014` | Yes |

**Backend Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `execution-policy-resolves-hybrid-email-live-mode` | Unit | `AC-BE-001` | Yes |
| `email-normalization-produces-coordinate-map` | Unit | `AC-BE-002` | Yes |
| `live-email-extraction-persists-prompt-run-metadata` | Integration | `AC-BE-003`, `AC-BE-004`, `AC-BE-014` | Yes |
| `citation-projection-downgrades-to-fallback-without-fabrication` | Unit / Integration | `AC-BE-005`, `AC-BE-006`, `AC-BE-015` | Yes |
| `read-model-exposes-source-and-trust-state-fields` | Contract / Integration | `AC-BE-007`, `AC-BE-010`, `AC-BE-013` | Yes |
| `publication-preserves-last-known-good-on-failure` | Integration | `AC-BE-008`, `AC-BE-009` | Yes |
| `service-split-path-routes-through-dedicated-semantic-services` | Integration | `AC-BE-011`, `AC-BE-012` | Yes |

**Cross-Cutting Test Inventory**

| Test Name | Type | Proof Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- | :--- |
| `dental-live-email-upload.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed locally, Replay fallback in CI | `AC-INT-001`, `AC-INT-002`, `AC-G-010` | Yes |
| `dental-source-citation-trust.spec.js` | Full-Stack E2E Playwright | Live Backend-Backed or Replay fixture | `AC-INT-004`, `AC-G-003` | Yes |
| `dental-ask-degraded.spec.js` | Full-Stack E2E Playwright | Replay-backed failure fixture | `AC-INT-003`, `AC-INT-005`, `AC-G-004` | Yes |
| `dental-report-trust.spec.js` | Full-Stack E2E Playwright | Replay-backed or Live Backend-Backed local | `AC-INT-006` | Yes |
| `dental-publication-failure-preserves-state.spec.js` | Full-Stack E2E Playwright | Replay-backed failure fixture | `AC-G-005`, `AC-INT-003` | Yes |
| `dental-service-split-stability.spec.js` | Full-Stack E2E Playwright | Live or replay backend-backed | `AC-G-009`, `AC-INT-007` | Yes |

**Stub / Mock Inventory**

| Stub/Mock | Side | Purpose | Phase Removed |
| :--- | :--- | :--- | :--- |
| Projected fixture responses for enriched semanticState fields | FE | Allow UI work before backend responses are integrated | Removed by Phase 2 integration checkpoint |
| Replay-backed live-email fixtures | BE | Deterministic CI/E2E proof when live Bedrock is unavailable | Kept for automated suites |

**Test Data**
- Existing Dental corpus waves and EML fixtures under the current doc-pack path.
- Hybrid reset fixtures that declare email family as live and all other families as replay.
- Failure fixtures for publication failure and citation fallback.

---

## 20. Out of Scope (Non-Goals)

- Live Nova rollout for non-email Dental source families.
- Portfolio-wide redesign or new design system adoption.
- Replacing the current Ask/report generation approach wholesale.
- Full portfolio migration of Optima or ESSENCE to live extraction-first trust semantics.
- Perfect exact-coordinate support for every source family where the current normalizer cannot expose stable coordinates.

---

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
- `server/src/services/rag/generation.service.js`
- `server/src/services/ingest/corpusImport.service.js`
- `server/src/services/state/runtimeState.repository.js`
- `shared/artifactTypes.js`
- `tests/e2e/helpers/novaLifecycle.js`
- `playwright.config.js`

### 21.2 Recommended Companion Documents

- Live Dental email prompt registry guide
- Hybrid live/replay rollout guide
- Trust-state copy inventory
- Semantic service-split ADR

### 21.3 Suggested Implementation Order for Execution

1. Add execution policy and live Dental email extraction baseline.
2. Add exact citations and trust-state surfaces to read-model and UI.
3. Split semantic orchestration into dedicated services behind the hardening flag.



