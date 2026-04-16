# 1. Document Overview

| Attribute | Detail |
| :--- | :--- |
| **Document Title** | Full-Stack Feature Specification: Nova Pro Semantic Extraction and Product State for Dental / DenClass |
| **Status** | Draft |
| **Version** | 1.0 |
| **Date Last Updated** | April 15, 2026 |
| **Technical Lead** | Codex |
| **UX Lead** | Codex |
| **Target Frontend** | AskEIDS React 18 + Vite single-page application |
| **Target Backend** | AskEIDS Node.js + Express service with DuckDB-backed runtime state and DuckDB retrieval store |
| **Source System (if migration)** | Existing AskEIDS deterministic corpus import and artifact ingestion pipeline |
| **Runtime Environment** | React + Node.js in development, AWS GovCloud-compatible Bedrock runtime, filesystem artifact store in local/dev, DuckDB for runtime and retrieval state |
| **Existing UI Library** | No third-party design system detected; custom React views styled by `index.html` theme tokens and `client/src/styles/runtime.css` |
| **Key Dependencies** | `@tanstack/react-query`, `express`, `duckdb`, `multer`, `mammoth`, `mailparser`, `pdf-parse`, AWS Bedrock runtime SDK |

**Assumptions:**
- Dental is the only product migrated to extraction-first behavior in v1; Optima and ESSENCE remain on the legacy deterministic corpus path until later phases.
- Bedrock text generation uses `amazon.nova-pro-v1:0`; embeddings may continue to use `amazon.titan-embed-text-v2:0` for retrieval only.
- Structured CSV/XLSX exports with fixed schemas remain deterministically normalized into rows before any Nova interpretation step.
- Source extraction JSON is the durable semantic source of truth; aggregate product JSON is a recomputable materialization.
- Automated test environments must use replayed model outputs or cached eval artifacts rather than live Nova calls.

**Open Questions (Resolved Pre-Generation):**
- Rollout scope: Dental-first.
- Model execution strategy: live Nova for local prompt/eval iteration, replay outputs for automated tests and E2E.
- Architecture choice: two-stage extraction then aggregation.

---

# 2. Feature Summary & Target End State

## 2.1 Executive Summary
Nova Pro Semantic Extraction and Product State enables AskEIDS to turn corpus documents, decks, transcripts, emails, PDFs, and workbooks into actionable product understanding through validated model-produced JSON. This addresses the current limitation where meaningful product state is largely derived by deterministic semantic parsing, which cannot capture implied decisions, indirect blockers, causal shifts, or nuanced recovery posture. When complete, Dental / DenClass will show status, narrative, timeline, Ask answers, and report inputs that are grounded in Nova-produced extraction and aggregation outputs rather than regexes or hardcoded inference logic.

## 2.2 Concrete Changes Inventory

| # | Layer (FE / BE / Both) | Location (Screen / Service / Module) | Change Type | Description |
|:---|:---|:---|:---|:---|
| 1 | BE | Ingestion pipeline | **Modified** | Add deterministic normalization stage per source family before Nova extraction. |
| 2 | BE | Source extraction service | **New** | Add Nova Pro source-family-specific extraction prompts returning validated JSON. |
| 3 | BE | Product aggregation service | **New** | Add Nova Pro aggregate prompt that produces canonical Dental product-state JSON from extracted source JSON. |
| 4 | BE | Runtime state repository | **Modified** | Persist validated source extraction results, aggregate snapshots, and prompt-run metadata. |
| 5 | BE | Corpus seed/reset flow | **Modified** | Baseline and full Dental seeding derive state from extraction-first pipelines, not deterministic semantic import. |
| 6 | BE | Ask pipeline | **Modified** | Ask grounds responses in validated extraction/aggregate state and retrieval evidence, with Nova used only where specified. |
| 7 | BE | Report generation | **Modified** | Reports consume aggregate product-state inputs and evidence-backed extracted facts. |
| 8 | FE | Existing portfolio/product views | **Modified** | Existing views continue using current routes but display Nova-derived Dental state without contract changes to route structure. |
| 9 | Both | Upload artifact flow | **Modified** | Upload processing becomes extraction-first with re-aggregation and provenance-aware status refresh. |
| 10 | Both | Evaluation toolchain | **New** | Add dedicated corpus eval harness, replay cache, scoring outputs, and prompt-version traceability. |

## 2.3 Target End State Description
When the feature is complete, a Dental user uploads an email, transcript, slide deck, PDF, workbook, or markdown document and the backend first normalizes the file into high-quality text or structured rows, then asks Nova Pro to extract typed semantic JSON. That JSON is validated, persisted, and used to recompute the Dental aggregate state. The UI remains on the same routes and design language, but portfolio posture, current-state narrative, recent signals, timeline, structured data rollups, Ask responses, and reports now reflect the model's extracted understanding. The experience feels trustworthy because every visible semantic claim can be traced back to validated source extraction JSON, provenance metadata, and citations, while failures preserve last-known-good aggregate state rather than degrading the product page into empty or contradictory output.

---

# 3. User Research & Context

## 3.1 Target User Personas

**Persona 1: Portfolio Lead**
- **Role/Context:** Oversees multiple products and briefs leadership.
- **Goals:** Understand why Dental is healthy, at risk, or recovering without re-reading every source.
- **Pain Points:** Current status logic feels brittle and can miss nuance buried in emails, transcripts, or decks.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Weekly to daily

**Persona 2: Product Manager / Evidence Owner**
- **Role/Context:** Uploads artifacts and keeps Dental current.
- **Goals:** Have new documents materially update the app when they contain meaningful new information.
- **Pain Points:** Deterministic logic can miss implied blockers, approvals, decisions, and recovery posture.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Daily

**Persona 3: Leadership Reviewer**
- **Role/Context:** Consumes Ask answers and reports for decisions.
- **Goals:** Trust that status and narratives reflect the actual document corpus.
- **Pain Points:** Hand-written or deterministic summaries hide uncertainty and causality.
- **Technical Proficiency:** Beginner to Intermediate
- **Usage Frequency:** Weekly

## 3.2 User Problem Statement
As a product or leadership user, I struggle to trust the product state shown in AskEIDS because many important decisions, mitigations, and posture changes are expressed indirectly in documents, transcripts, decks, and emails, while the current system mostly relies on deterministic semantic interpretation that cannot reliably understand that nuance.

## 3.3 Success Criteria

**User-Facing:**
- Dental users can upload free-text artifacts and see visible product changes driven by extracted meaning rather than only by structured import deltas.
- Ask answers and reports cite evidence that reflects implied, not only explicitly labeled, meaning in source documents.
- Users can inspect source provenance and confidence without losing trust when a model extraction fails.

**System-Level:**
- Source extraction JSON validates successfully for at least 95% of Dental corpus artifacts in replayed eval runs.
- Aggregate wave checkpoints match curated gold expectations for baseline, operational, escalation, and recovery states.
- Dental upload-to-visible-refresh latency remains within a 202 async pattern with P95 terminal completion below 30s for local/dev workloads.

---

# 4. User Flows & End-to-End Data Flow

## 4.1 Primary User Flow

**Entry Point:** User opens `/products/dental?tab=overview` and selects `Upload Artifact`.

1. **Submit artifact**
   - **User action:** Uploads a supported Dental artifact and submits the modal.
   - **UI response:** Shows queued/running ingest status on the overview page.
   - **API call:** `POST /api/v1/products/dental/sources`
   - **Backend processing:** Persist raw file, normalize content, run Nova extraction, validate output, persist extraction JSON, recompute Dental aggregate state, update runtime projection, refresh retrieval index.
   - **API response:** `202 Accepted` with `jobId`, `sourceId`, and polling URL.
   - **UI state transition:** Overview shows ingest job status and later a refreshed evidence update banner.

2. **Observe updated product state**
   - **User action:** Waits for completion or navigates to Sources/Data/Timeline/Reports.
   - **UI response:** Existing tabs reload and show Dental state derived from fresh aggregate JSON.
   - **API calls:** `GET /api/v1/jobs/:jobId`, existing product/data/source/report routes.
   - **Backend processing:** Read runtime projection built from the latest aggregate snapshot.
   - **API response:** Existing response shapes preserved where possible.
   - **UI state transition:** Sources shows the new source; Overview/Timeline/Data/Reports reflect semantic changes if the extraction changed Dental meaning.

3. **Ask a question**
   - **User action:** Asks a Dental question such as “Why is Dental improving but not fully healthy yet?”
   - **UI response:** Loading state, then answer with citations.
   - **API call:** `POST /api/v1/products/dental/ask`
   - **Backend processing:** Build evidence pack from validated extraction/aggregate state plus retrieval chunks; optionally rewrite final answer with Nova in supported environments.
   - **API response:** `200` with `answerHtml`, `sources`, `coverage`, `evidenceStrength`.
   - **UI state transition:** Ask panel shows evidence-backed response grounded in extracted state.

## 4.2 Alternative Flows & Edge Cases
- **Normalization fallback:** PDF or DOCX normalization fails primary parser and retries with OCR or fallback document extraction.
- **Schema failure:** Nova returns invalid JSON; the source is marked failed or partial, the prior aggregate remains active, and the UI surfaces recoverable status.
- **Aggregate failure:** One source extraction succeeds but aggregate generation fails; source remains visible, last-known-good product state remains active, and report/Ask show no silent drift.
- **Replay mode:** In automated tests the extraction and aggregation pipeline loads cached model outputs keyed by prompt/model/corpus hash instead of live Nova.
- **Legacy mixed mode:** Portfolio still renders Optima and ESSENCE from legacy state while Dental uses extraction-first state.

## 4.3 Backend Data Flow (Pipeline Stages)

**Stage 1: Source Normalization**
- **Input:** Raw uploaded file or seeded corpus artifact.
- **Processing:** Deterministic extraction of normalized text, slide text, workbook rows, email headers/body, OCR fallback, and fixed-schema structured rows.
- **Output:** `NormalizedSourcePayload`.
- **Failure mode:** Returns explicit normalization failure; no model call occurs.

**Stage 2: Nova Source Extraction**
- **Input:** `NormalizedSourcePayload` plus source-family prompt version and provenance metadata.
- **Processing:** Nova Pro extracts typed semantic JSON for the specific source family.
- **Output:** `SourceExtractionJson`.
- **Failure mode:** Invalid or missing fields cause schema rejection and source failure/partial state.

**Stage 3: Validation and Persistence**
- **Input:** `SourceExtractionJson`.
- **Processing:** JSON-schema validation, provenance stamping, prompt-run metadata persistence.
- **Output:** Durable validated extraction record.
- **Failure mode:** Validation failure keeps the source from influencing aggregate state.

**Stage 4: Product Aggregation**
- **Input:** All validated Dental source extraction JSON plus structured row materializations.
- **Processing:** Nova Pro produces a canonical Dental aggregate state snapshot.
- **Output:** `ProductAggregateJson`.
- **Failure mode:** Preserve last-known-good aggregate state and log failed run metadata.

**Stage 5: Runtime Projection and Index Refresh**
- **Input:** `ProductAggregateJson`, extraction records, normalized content.
- **Processing:** Deterministically project aggregate state into existing `products` and `productData` shapes; rebuild/append retrieval chunks and embeddings.
- **Output:** Updated runtime state and RAG index.
- **Failure mode:** Projection errors block publication of the new aggregate snapshot and preserve last-known-good runtime state.

## 4.4 Flow Diagram
A diagram drawn from this spec should show: existing UI routes on the left; upload, Ask, and report user actions; API requests into Express; normalization services; Nova extraction service; validation boundary; extraction store; Nova aggregation service; runtime projection into runtime-state DuckDB; retrieval chunk indexing into RAG DuckDB; and existing read-model routes feeding Overview, Timeline, Data, Sources, Ask, and Reports. The error path should branch at normalization, extraction validation, aggregation, and projection, each preserving the last-known-good product state.

---

# 5. Parity Matrix (Migration from Legacy Deterministic Semantics)

## 5.1 Module-Level Parity Decisions

| Source Module | Source Behavior | Target Module | Layer | Decision | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `corpusImport.service.js` | Derives semantic meaning from corpus content and metadata | New normalization + extraction + aggregation services, plus slimmed corpus import | BE | **Adapt** | Keep deterministic normalization and seeding orchestration, remove deterministic semantic interpretation. |
| `transcriptExtraction.service.js` | Regex extracts decisions/actions/stakeholders | Nova transcript extraction prompt | BE | **Rewrite** | Regex cannot satisfy implied semantic understanding goals. |
| `artifactUpload.service.js` | Generic preview extraction and structured import parsing | Keep normalization; add source-family extraction dispatch | BE | **Adapt** | Preserve deterministic file handling and structured parsing, add model extraction after normalization. |
| `readModel.service.js` | Reads runtime-projected product state | Same module with extraction-derived state inputs | Both | **Port** | Preserve stable FE contracts and route behavior. |
| `ask.service.js` + `generation.service.js` | Builds evidence pack from current state and retrieval | Extraction-aware Ask grounding with optional Nova answer rewrite | Both | **Adapt** | Keep evidence-pack and validation boundary, change semantic input source. |

## 5.2 Behavioral Equivalence Criteria
- `PEQ-001`: Existing product routes remain stable and render coherent Dental pages after migration without changing route structure.
- `PEQ-002`: Upload, Ask, Sources, Data, Timeline, and Reports remain reachable through current UI tabs and selectors.
- `PEQ-003`: Structured export tables remain exact for fixed-schema rows even after Nova semantic migration.

## 5.3 Intentional Divergences
- `DIV-001`: Transcript, email, and narrative document understanding is intentionally no longer regex-driven.
- `DIV-002`: Dental status, narrative, and recent signals may differ from legacy logic when Nova extraction yields better causal understanding.
- `DIV-003`: Automated tests use replayed model outputs rather than live Bedrock to keep CI deterministic.

---

# 6. Interface Design Requirements

## 6.1 Screen/View Inventory

**View 1: Portfolio**
- **Purpose:** Show comparative product posture, including Dental extraction-first state beside legacy products.
- **Primary Actions:** Open product cards, quick views, search.
- **Data Source:** Existing `GET /api/v1/portfolio`.

**View 2: Product Overview**
- **Purpose:** Show Dental health, narrative, evidence update state, Ask panel, and mutation actions.
- **Primary Actions:** Upload artifact, ask questions, navigate to tabs.
- **Data Source:** Existing `GET /api/v1/products/:productId`.

**View 3: Timeline**
- **Purpose:** Show Nova-derived recent signals and chronology.
- **Primary Actions:** Filter by type, open source-linked entries.
- **Data Source:** Existing `GET /api/v1/products/:productId/timeline`.

**View 4: Data**
- **Purpose:** Show exact structured tables for risks, blockers, and PI objectives.
- **Primary Actions:** Switch subtabs, expand rows.
- **Data Source:** Existing `GET /api/v1/products/:productId/data`.

**View 5: Sources**
- **Purpose:** Show all source records, processing status, and previews.
- **Primary Actions:** Filter sources, open source detail drawer.
- **Data Source:** Existing `GET /api/v1/products/:productId/sources` and source detail route.

**View 6: Reports**
- **Purpose:** Generate and inspect reports backed by aggregate state.
- **Primary Actions:** Generate, regenerate, edit section text, export.
- **Data Source:** Existing report routes.

## 6.2 Information Architecture
- **Primary:** Current posture, narrative, major blockers, evidence confidence.
- **Secondary:** Source inventory and timeline progression.
- **Tertiary:** Report exports, telemetry, and operator/debug details.
- **Navigation Model:** Preserve existing top nav + product tabs.

## 6.3 Layout & Responsive Requirements
- Preserve desktop-first behavior and the existing unsupported viewport state below 1024px.
- No mobile redesign is included in this phase.

---

# 7. Interaction & Visual Design Specifications

## 7.1 Core Interactions
- Upload artifact: unchanged modal shell, but status/result messaging must explicitly mention AI extraction outcomes.
- Ask: loading, retry, and evidence display remain, but answers must reflect extraction-derived state.
- Reports: regeneration notices appear whenever newer validated extraction/aggregate state exists.

## 7.2 Input Methods & Controls
- Continue using existing modal inputs and selectors for upload and Ask.
- No new user-facing forms are required for v1 beyond existing flows.

## 7.3 Feedback & Confirmation Patterns
- Source ingest status must distinguish normalization failure, extraction validation failure, aggregate failure, partial success, and complete success.
- Error copy must state whether the last-known-good product state remains active.

## 7.4 Micro-interactions
- Reuse current hover, focus, pressed, and disabled states.

## 7.5 Design System & Component Usage
- Reuse existing custom card, tab, modal, drawer, badge, toast, and inline status patterns in `client/src/App.jsx` and `client/src/styles/runtime.css`.
- No new design system is introduced.

## 7.6 Typography Hierarchy
- Reuse existing `Newsreader` heading and `Outfit` body hierarchy.

## 7.7 Color & Visual Semantics
- Preserve existing semantic badge colors for risk/caution/healthy.
- Add no new semantic palette beyond extraction-status messaging states.

## 7.8 Iconography & Visual Assets
- Reuse current icon/text badge patterns; no custom icon package is required.

## 7.9 Spacing & Layout Grid
- Preserve the existing card/grid/modal spacing system.

---

# 8. Content & Copywriting Requirements

## 8.1 Content Strategy
- **Tone & Voice:** Operational, evidence-backed, explicit about uncertainty.
- **Content Principles:** Honest, concise, traceable, non-speculative.

## 8.2 Required Copy Elements
- Ingest success: “New evidence is now available across Sources, Ask, and reports.”
- Extraction failure: “We could not validate AI extraction for this source. Your previous product state is still active.”
- Aggregate failure: “This source was stored, but product understanding was not refreshed because aggregation failed. Last known good state remains active.”
- Replay mode operator copy is backend/internal only and not user-facing.

## 8.3 Localization Considerations
- English-only for this phase.
- Existing date formatting conventions remain unchanged.

---

# 9. Accessibility Requirements

## 9.1 WCAG Compliance
- Maintain current WCAG AA expectations for contrast, visible focus, and keyboard navigation.

## 9.2 Keyboard Navigation
- Upload modal, source drawer, report actions, and Ask input must remain fully keyboard navigable.

## 9.3 Screen Reader Support
- Existing `aria-live` region must announce extraction completion/failure states.
- Source detail and modal close/open focus management must remain intact.

## 9.4 Additional Accessibility
- Preserve reduced-motion behavior already defined in the app shell.

---
# 10. States & Scenarios

## 10.1 All UI States
- **Initial/Default State:** Dental loads from the latest aggregate snapshot.
- **Loading State:** Existing loading shells remain while routes fetch projected state.
- **Empty State:** Not expected for Dental baseline, but unsupported empty slices still render existing empty panels.
- **Populated State:** Overview, Timeline, Data, Sources, Ask, and Reports reflect extraction-driven Dental state.
- **Error State:** Upload or Ask surfaces show scoped retryable failures without blanking existing product understanding.
- **Partial State:** A source may be stored with warnings while product state remains on last-known-good aggregate.
- **Disabled State:** Read-only users cannot trigger mutation flows.

## 10.2 Permission & Role-Based Views
- **Lead/Editor:** Full upload, Ask, report generation, and report edit behavior for Dental.
- **Read:** Consumption only; Dental remains visible, mutation controls are hidden, reports can be generated/exported only if existing permissions allow.
- **Mixed-mode portfolio:** Portfolio must render Dental extraction-first and non-Dental legacy state side by side without copy conflicts.

---

# 11. Backend Module Design

## 11.1 Module Inventory

**Module 1: Source Normalization Service**
- **File(s):** New service under `server/src/services/ingest/normalize/` plus existing file-specific adapters.
- **Responsibility:** Convert raw files into high-quality normalized text or deterministic structured rows.
- **Inputs:** Raw file buffer/path, source family, metadata.
- **Outputs:** `NormalizedSourcePayload`.
- **Dependencies:** `mammoth`, `mailparser`, `pdf-parse`, Textract/OCR fallback, workbook readers to be added.
- **Error handling:** Fail closed with typed normalization errors.
- **Configuration:** OCR enablement, timeout, parser fallback flags.

**Module 2: Nova Source Extraction Service**
- **File(s):** New service under `server/src/services/extract/` with prompt registry files and schemas.
- **Responsibility:** Run Nova Pro prompts by source family and return validated extraction JSON.
- **Inputs:** `NormalizedSourcePayload`, prompt version, replay/live execution mode.
- **Outputs:** `SourceExtractionJson`.
- **Dependencies:** Bedrock text adapter, schema validator, replay cache.
- **Error handling:** Invalid JSON or schema mismatch becomes explicit extraction failure.
- **Configuration:** Model ID, prompt versions, replay cache toggle.

**Module 3: Product Aggregation Service**
- **File(s):** New service under `server/src/services/aggregate/`.
- **Responsibility:** Build Dental aggregate state from validated source extraction JSON and structured rows.
- **Inputs:** All Dental validated source extractions.
- **Outputs:** `ProductAggregateJson`.
- **Dependencies:** Bedrock text adapter, aggregate schema validator.
- **Error handling:** Preserve last-known-good aggregate on failure.
- **Configuration:** Aggregation prompt version, retry limits.

**Module 4: Extraction Persistence Layer**
- **File(s):** Extend runtime state repository or add dedicated extraction tables in `runtimeState.repository.js`.
- **Responsibility:** Persist extraction JSON, aggregate snapshots, prompt-run metadata, and replay cache references.
- **Inputs:** Validated extraction and aggregate payloads.
- **Outputs:** Durable state rows.
- **Dependencies:** runtime-state DuckDB.
- **Error handling:** Transactional writes; failed projection must not partially publish a new state.

**Module 5: Projection Layer**
- **File(s):** New projection utility or refactor of current corpus import projection helpers.
- **Responsibility:** Convert aggregate JSON into existing `products`, `productData`, and report input shapes used by the read model.
- **Inputs:** `ProductAggregateJson`, source extraction set.
- **Outputs:** Stable runtime state for existing UI routes.
- **Dependencies:** existing read model contracts.
- **Error handling:** Failed projection blocks publication and retains last-known-good state.

**Module 6: Eval Harness**
- **File(s):** New CLI/tooling under `tests/` or `scripts/` plus gold fixtures in repo.
- **Responsibility:** Run extraction/aggregation against the Dental corpus, compare results to gold, and emit scored reports.
- **Inputs:** corpus rows, prompt versions, execution mode.
- **Outputs:** eval report, cached/replayed model outputs.
- **Dependencies:** prompt registry, gold fixtures, replay cache.
- **Error handling:** Hard-fail on schema drift or missing gold mappings.

## 11.2 New Dependencies

| Dependency | Version/Service | Purpose | Risk/Concern |
| :--- | :--- | :--- | :--- |
| JSON schema validator (`ajv` already present) | existing | Validate Nova extraction and aggregate payloads | Low |
| PPTX/XLSX normalization library | TBD at implementation, chosen to match current Node stack | Deterministic extraction for slides and workbooks | Medium: library quality and GovCloud compatibility |
| Replay cache serializer | local utility | Persist live model outputs for deterministic test replay | Low |

## 11.3 Removed/Deprecated Code

| File/Module | What's Removed | Reason | Migration Path |
| :--- | :--- | :--- | :--- |
| `transcriptExtraction.service.js` | Regex semantic extraction for decisions/actions/stakeholders | No longer meets project purpose | Replace with Nova transcript extraction |
| semantic portions of `corpusImport.service.js` | Deterministic semantic derivation for state, signals, and narrative | Must be model-driven | Keep only normalization/seeding orchestration and projection helpers |

---

# 12. Data Model & Storage

## 12.1 Schema Changes

**Runtime State DuckDB Additions**
- `state_source_extractions`
  - `source_id` PK
  - `product_id`
  - `source_type`
  - `schema_version`
  - `prompt_family`
  - `prompt_version`
  - `model_id`
  - `normalized_hash`
  - `payload_json`
  - `validation_status`
  - `confidence`
  - `created_at`
- `state_product_aggregates`
  - `aggregate_id` PK
  - `product_id`
  - `schema_version`
  - `prompt_version`
  - `model_id`
  - `source_set_hash`
  - `aggregate_input_hash`
  - `payload_json`
  - `published` boolean
  - `published_at`
  - `superseded_at`
  - `superseded_by`
  - `last_known_good_aggregate_id`
  - `created_at`
- `state_prompt_runs`
  - `run_id` PK
  - `scope` (`source_extraction` / `aggregation` / `eval`)
  - `target_id`
  - `mode` (`live` / `replay`)
  - `model_id`
  - `prompt_version`
  - `latency_ms`
  - `status`
  - `error_json`
  - `raw_payload_ref`
  - `created_at`

## 12.2 Data Contracts

**Contract: NormalizedSourcePayload**
```json
{
  "sourceId": "src-2001",
  "productId": "dental",
  "sourceType": "transcript",
  "sourceDate": "2026-04-15",
  "title": "Dental Vendor Recovery Call Transcript",
  "normalizedText": "...",
  "structuredRows": [],
  "normalizationMeta": {
    "format": "md",
    "ocrFallbackUsed": false,
    "slideNumbers": null,
    "sheetNames": null
  }
}
```

**Contract: SourceExtractionJson**
```json
{
  "sourceId": "src-2001",
  "productId": "dental",
  "sourceType": "transcript",
  "summary": "Vendor path improved with staged access.",
  "decisions": [
    {
      "label": "Accept staged access beginning 4/18",
      "confidence": "high",
      "citation": { "kind": "line_range", "start": 12, "end": 18 }
    }
  ],
  "actionItems": [],
  "stakeholders": [],
  "risks": [],
  "blockers": [],
  "signals": [],
  "warnings": [],
  "confidence": "high"
}
```

**Contract: ProductAggregateJson**
```json
{
  "productId": "dental",
  "status": "caution",
  "statusLabel": "Managed Caution",
  "health": {
    "overall": 74,
    "coverage": 82,
    "freshness": 88,
    "continuity": 70,
    "sync": 76
  },
  "narrative": {
    "summary": "Dental improved because the vendor provided a phased recovery path.",
    "evidenceGaps": ["Full environment access remains pending 4/25."]
  },
  "timeline": [],
  "recentSignals": [],
  "data": {
    "risks": [],
    "blockers": [],
    "pi": []
  },
  "reports": {
    "executiveSummaryInput": "..."
  }
}
```

## 12.3 Storage Architecture
- **Primary store:** runtime-state DuckDB for extraction records, aggregate snapshots, and projected UI state.
- **Secondary store:** filesystem/S3 artifact store for raw source artifacts, normalized artifacts, and large raw prompt/output payloads referenced by `state_prompt_runs.raw_payload_ref`.
- **Retrieval store:** `prototype-rag.duckdb` for chunk text plus embeddings.
- **Consistency model:** read-after-write for published aggregate snapshots; last-known-good snapshot retained when extraction or aggregation fails.
- **Truth boundary:** fixed-schema structured rows remain deterministic row truth; aggregate state may interpret those rows for narrative, posture, and causality, but Nova does not invent or rewrite exact structured rows in v1.

---

# 13. Unified API Contract (Single Source of Truth)

## 13.1 Endpoint Inventory

| UI Action | Method | Path | Purpose | Latency Target |
| :--- | :--- | :--- | :--- | :--- |
| Upload artifact | POST | `/api/v1/products/:productId/sources` | Submit source for normalization, extraction, and aggregate refresh | 202 within 500ms |
| Poll ingest job | GET | `/api/v1/jobs/:jobId` | Read async extraction/aggregation status | P95 < 300ms |
| Load product overview | GET | `/api/v1/products/:productId` | Fetch projected aggregate-backed Dental state | P95 < 500ms |
| Load timeline | GET | `/api/v1/products/:productId/timeline` | Fetch projected timeline groups | P95 < 500ms |
| Load data tab | GET | `/api/v1/products/:productId/data?dataset=` | Fetch projected structured tables | P95 < 500ms |
| Load sources | GET | `/api/v1/products/:productId/sources` | Fetch source inventory and processing state | P95 < 500ms |
| Ask question | POST | `/api/v1/products/:productId/ask` | Generate evidence-backed answer from extracted/aggregate state | P95 < 4s local replay, async fallback not required in v1 |
| Generate report | POST | `/api/v1/products/:productId/reports` | Create report from aggregate state | 202 within 500ms |
| Read report | GET | `/api/v1/products/:productId/reports/:reportId` | Fetch report sections and regeneration status | P95 < 500ms |
| Test/admin reset (internal only) | POST | `/api/v1/test/reset` | Reset seeded Dental state and execution mode for eval/E2E | P95 < 750ms |

## 13.2 Request/Response Shapes

**`POST /api/v1/products/:productId/sources`**
- **Request:** multipart form with `file`, optional `metadataFile`, `sourceType`, `sourceDate`, `title`, optional author/participants/notes.
- **Response (202):**
```json
{
  "jobId": "job-901",
  "sourceId": "src-2001",
  "status": "queued",
  "title": "Dental Vendor Recovery Call Transcript",
  "updatedDomains": ["sources", "ask", "reports", "data"]
}
```

**`GET /api/v1/jobs/:jobId`**
```json
{
  "jobId": "job-901",
  "jobType": "ingest",
  "status": "running",
  "stage": "aggregation",
  "result": {
    "sourceId": "src-2001",
    "title": "Dental Vendor Recovery Call Transcript",
    "updatedDomains": ["sources", "ask", "reports"]
  },
  "warnings": [],
  "errorCode": null,
  "message": null
}
```

**`POST /api/v1/products/:productId/ask`**
```json
{
  "question": "Why is Dental improving but not fully healthy yet?"
}
```
Response success:
```json
{
  "status": "partial",
  "answerHtml": "<strong>Evidence-backed response:</strong> ...",
  "evidenceStrength": "high",
  "coverage": {
    "isPartial": true,
    "warnings": ["Full environment access is still pending."]
  },
  "sources": [
    {
      "sourceId": "src-2001",
      "title": "Dental Vendor Recovery Call Transcript",
      "meta": "2026-04-15 · transcript"
    }
  ]
}
```

**`POST /api/v1/test/reset` (internal contract; non-production)**
```json
{
  "productId": "dental",
  "mode": "wave-00",
  "executionMode": "replay",
  "featureMode": "extraction-first"
}
```
Response success:
```json
{
  "status": "ok",
  "productId": "dental",
  "mode": "wave-00",
  "executionMode": "replay",
  "featureMode": "extraction-first",
  "seededSources": 15
}
```

## 13.3 Error Contract

| Condition | HTTP Status | Error Code | Retryable | FE Behavior | BE Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Upload validation failure | 400 | `VALIDATION_ERROR` | No | Inline error in upload modal | Log warning; no write |
| Extraction schema failure | 422 or 500 via async job result | `EXTRACTION_INVALID` | Yes | Source status shows failed/partial; last-known-good state remains | Persist failed prompt run and validation detail |
| Aggregate generation failure | async job failed/partial | `AGGREGATION_FAILED` | Yes | UI shows source stored but product state unchanged | Preserve previous aggregate snapshot |
| Unauthorized | 401 | `UNAUTHORIZED` | No | Session expired state | Log auth failure |
| Forbidden | 403 | `FORBIDDEN` | No | Permission banner / hidden controls | Log access attempt |
| Not found | 404 | `NOT_FOUND` | No | Not found view | Log miss |
| Model unavailable | 503 | `KB_UNAVAILABLE` or `MODEL_UNAVAILABLE` | Yes | Retry state in Ask/upload status | Log provider outage and replay mode if active |
| Internal error | 500 | `INTERNAL_ERROR` | Yes | Error state + retry | Log stack trace |

## 13.4 State–API–Backend Mapping Table

| User Action | UI State (Before) | API Call | Backend Processing | API Response | UI State (After) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Uploads transcript | Upload modal open | `POST /sources` | Normalize -> Nova extract -> validate -> aggregate -> project -> index | `202` + `jobId` | Ingest status panel visible |
| Polls job after success | Status panel running | `GET /jobs/:jobId` | Read job state | `completed` | Sources row appears; overview refreshes |
| Polls job after aggregate failure | Status panel running | `GET /jobs/:jobId` | Read failed aggregate job | `failed` or `partial` | Source visible, warning shown, old narrative still visible |
| Asks question | Ask input filled | `POST /ask` | Retrieve extraction-backed evidence, answer generation | `200` | Ask answer + citations visible |
| Generates report | Reports tab open | `POST /reports` | Build report from aggregate state | `202` | Report loading state then sections |

## 13.5 Internal Service Contracts
- `normalizeSource(input) -> Promise<NormalizedSourcePayload>`
- `extractSourceWithNova(normalized, executionMode) -> Promise<SourceExtractionJson>`
- `aggregateProductStateWithNova(productId, sourceExtractions, executionMode) -> Promise<ProductAggregateJson>`
- `projectAggregateToRuntimeState(productAggregate, sourceExtractions, currentState) -> RuntimeProjection`
- `runDentalCorpusEval(config) -> EvalReport`
- `resetDentalLifecycleState({ productId, mode, executionMode, featureMode }) -> ResetResult`

---

# 14. Configuration & Feature Flags

## 14.1 Environment Variables

| Variable | Type | Default | Required | Side | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `EIDS_ENABLE_BEDROCK` | boolean | false | Yes for live model mode | BE | Enables live Bedrock text calls |
| `BEDROCK_TEXT_MODEL_ID` | string | `amazon.nova-pro-v1:0` | Yes in live mode | BE | Nova model selection |
| `BEDROCK_EMBED_MODEL_ID` | string | `amazon.titan-embed-text-v2:0` | No | BE | Retrieval embedding model |
| `EIDS_EXTRACTION_EXECUTION_MODE` | string | `live` in dev, `replay` in tests | Yes | BE | Chooses live vs replay extraction |
| `EIDS_AGGREGATION_EXECUTION_MODE` | string | `live` in dev, `replay` in tests | Yes | BE | Chooses live vs replay aggregation |
| `EIDS_PROMPT_REGISTRY_VERSION` | string | current commit/tag | Yes | BE | Binds prompt bundle version |
| `EIDS_EVAL_CACHE_DIR` | string | runtime-local path | Yes | BE | Stores replayed model outputs |

## 14.2 Feature Flags

| Flag | Default | Side | Purpose | Removal Criteria |
| :--- | :--- | :--- | :--- | :--- |
| `ENABLE_NOVA_DENTAL_EXTRACTION` | false initially | Both | Gates Dental extraction-first runtime path | Remove after Dental migration is stable |
| `ENABLE_NOVA_DENTAL_AGGREGATION` | false initially | Both | Gates Dental aggregate-driven runtime projection | Remove after stable rollout |
| `ENABLE_EXTRACTION_REPLAY_MODE` | true in test | BE | Forces replayed outputs in tests/E2E | Keep long-term |

## 14.3 Tunable Parameters

| Parameter | Default | Range | Side | Impact |
| :--- | :--- | :--- | :--- | :--- |
| `EXTRACTION_RETRY_LIMIT` | 1 | 0–3 | BE | Retries live Nova extraction |
| `AGGREGATION_RETRY_LIMIT` | 1 | 0–3 | BE | Retries aggregate generation |
| `MAX_EXTRACTION_SOURCE_SET` | 64 | 16–200 | BE | Aggregate input bounding |
| `ASK_MAX_SOURCES` | 8 | 4–12 | Both | Evidence packing |

---

# 15. Operational Concerns

## 15.1 Performance & Latency
- Upload request acknowledgement: P95 < 500ms.
- Replay extraction: P95 < 2s per source in local automation.
- Live extraction: P95 < 12s per source in development environments.
- Ask: P95 < 4s in replay mode; P95 < 8s in live local mode.
- Report generation: P95 terminal completion < 15s in replay mode.

## 15.2 Scalability
- v1 is scoped to Dental-first and local/dev scale, but design must avoid coupling prompt outputs directly to React components.
- Extraction and aggregation should be queueable and replayable to allow later batch backfills and portfolio expansion.

## 15.3 Observability & Debugging
- Log per run: `productId`, `sourceId`, `promptFamily`, `promptVersion`, `modelId`, `executionMode`, `latencyMs`, `status`, `validationStatus`, `aggregatePublished`.
- Emit counters for normalization failures, extraction schema failures, aggregate failures, replay hits, and replay misses.
- Make prompt-run records queryable for Dental debugging.

## 15.4 Security & Compliance
- Maintain GovCloud-compatible model and region constraints already enforced by runtime config.
- Persist raw model outputs only in controlled backend stores, never expose them directly to the frontend.
- Validate and sanitize all model outputs before they influence runtime state.

## 15.5 Failure Modes & Recovery

| Failure Scenario | Detection | Impact (User-Facing) | Impact (System) | Recovery | RTO |
| :--- | :--- | :--- | :--- | :--- | :--- |
| DOC/PDF normalization failure | parser/OCR error | Source marked failed with retry guidance | No new extraction record | Re-upload or parser fix | Immediate |
| Nova extraction invalid JSON | schema validation fail | Source stored with failed/partial state | No new aggregate influence | Retry with same normalized payload after prompt change | Immediate |
| Aggregate generation failure | schema validation or provider error | Old product state remains visible | New extraction exists, aggregate not published | Retry aggregation only | Immediate |
| Replay cache miss in test | missing replay artifact | Test setup failure | No deterministic automation | Precompute cache before suite | Same run |
| Projection failure | runtime projection exception | UI continues showing old state | Aggregate not published | Fix projector and republish snapshot | Immediate |

## 15.6 Rollback Plan
- Rollback trigger: invalid aggregate publication, severe Ask/report regressions, repeated extraction failures.
- Frontend rollback: feature flags disable Dental extraction-first rendering while preserving existing UI routes.
- Backend rollback: disable extraction/aggregation feature flags and fall back to legacy Dental deterministic path until fixed.
- Data safety: preserve prior aggregate snapshot and extraction records; rollback does not delete stored source artifacts.

---

# 16. Phased Implementation Plan

## 16.1 Phase Overview

| Phase | Name | FE Scope | BE Scope | Stub/Mock Boundary | Integration Checkpoint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Normalization + Schemas | Minimal UI changes; no new user flow | Add normalization pipeline, schema registry, storage tables | FE unchanged; BE can stub model outputs | Can normalize all Dental source families deterministically |
| 2 | Source Extraction + Replay | Surface richer status copy only if needed | Implement Nova extraction, replay cache, validation, persistence | FE still reads legacy Dental state; BE uses replay/live switching | Gold extraction fixtures pass for Dental corpus |
| 3 | Aggregation + Projection | Existing routes start reading Dental extraction-first state | Implement aggregation, projection, last-known-good publication | FE consumes stable projected state | Dental baseline/operational/escalation/recovery checkpoints render from aggregate snapshots |
| 4 | Ask + Reports Integration | No new routes; existing Ask/Reports reflect extraction-first state | Rewire Ask/report inputs to extraction/aggregate state | FE no longer requires legacy Dental semantics | Ask and reports pass gold/UI checks |
| 5 | Upload/Seed/Reset + E2E | Existing UI fully exercises extraction-first Dental | Switch upload and reset flows to extraction-first; replay-backed E2E | FE and BE integrated | Headed/headless lifecycle E2E passes with replay outputs |

## 16.2 Phase Details

**Phase 1: Normalization + Schemas**
- **Frontend tasks:** No structural UI changes; preserve existing selectors and states.
- **Backend tasks:** Add source-family normalization adapters for DOCX/PDF/PPTX/XLSX/EML/MD/TXT/VTT; define JSON schemas for source extractions and aggregate state; extend runtime persistence.
- **Stub/mock boundary:** No FE mocks required; BE may store placeholder replay outputs.
- **Integration checkpoint:** A CLI or test can normalize every Dental source family and validate target schemas exist.

**Phase 2: Source Extraction + Replay**
- **Frontend tasks:** Optional operator/debug surfaces only if needed; user-facing routes remain stable.
- **Backend tasks:** Implement prompt registry, live Nova extraction path, replay cache, schema validation, prompt-run logging, Dental gold extraction fixtures.
- **Integration checkpoint:** Eval harness passes source-level extraction for Dental corpus against gold thresholds.

**Phase 3: Aggregation + Projection**
- **Frontend tasks:** Confirm existing views tolerate Dental state coming from aggregate snapshots.
- **Backend tasks:** Implement aggregate prompt, validation, projection into current `products` and `productData`, and last-known-good publication semantics.
- **Integration checkpoint:** Baseline and wave checkpoint snapshots produce expected portfolio and product views for Dental.

**Phase 4: Ask + Reports Integration**
- **Frontend tasks:** Reuse existing Ask and Reports UI, ensuring copy handles extraction/aggregate failures gracefully.
- **Backend tasks:** Rewire Ask evidence pack and report builder to consume extraction/aggregate state; preserve retrieval indexing for search/citations.
- **Integration checkpoint:** Ask/report outputs match gold concepts and citation expectations.

**Phase 5: Upload/Seed/Reset + E2E**
- **Frontend tasks:** Reuse current lifecycle routes and selectors; ensure ingest states surface extraction-first failure modes clearly.
- **Backend tasks:** Switch Dental reset and upload flows to extraction-first; finalize replay-backed lifecycle E2E path.
- **Integration checkpoint:** One replay-backed headed lifecycle spec passes end to end for Dental.

## 16.3 Dependency Graph
- Phase 1 blocks all later phases.
- Phase 2 depends on Phase 1 schemas and normalization outputs.
- Phase 3 depends on validated source extraction outputs.
- Phase 4 depends on stable projection because Ask/Reports consume projected state and extraction records.
- Phase 5 depends on Phases 2–4 and the replay cache being complete.

---
# 17. QA, Acceptance Criteria, and Definition of Done

## 17.1 Global Quality Gates

These quality gates apply to the entire feature and must be satisfied before Dental extraction-first behavior is considered releasable.

- **AC-G-001**: Dental semantic interpretation must be produced from validated Nova Pro extraction and aggregation outputs, not regex or deterministic semantic parsing.
- **AC-G-002**: Deterministic logic may remain only for format normalization, OCR fallback, fixed-schema structured export parsing, validation, persistence, retrieval indexing, and runtime projection.
- **AC-G-003**: Every Dental source family used in the corpus (`email`, `transcript`, `weekly_update`, `decision_memo`, `decision_log`, `release_plan`, `security_summary`, `slide_deck`, `spreadsheet_attachment`, `risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`, baseline narrative docs) must have a documented normalization path and a schema-validated extraction path.
- **AC-G-004**: Source extraction JSON must be persisted as the durable semantic truth for Dental. Product aggregate JSON must be persisted as a recomputable materialization with prompt version and execution metadata.
- **AC-G-005**: On extraction or aggregation failure, the backend must retain and serve the last-known-good Dental aggregate state instead of blanking or corrupting product UI state.
- **AC-G-006**: Replay mode must exist and be used for automated Playwright, integration, and CI runs unless a test explicitly declares live-model proof and accepts the latency/cost profile.
- **AC-G-007**: The same Playwright workflow set required by this spec must pass in both headed and headless execution modes.
- **AC-G-008**: Every user-visible failure state introduced by extraction-first behavior must surface actionable operator guidance in the UI and a traceable backend prompt-run record.
- **AC-G-009**: Dental baseline, wave-01, wave-02, and wave-03 checkpoints must be reproducible from corpus-backed extraction/aggregation outputs in reset or backfill workflows.
- **AC-G-010**: No existing non-Dental product route may regress due to Dental-first rollout; mixed-mode portfolio rendering must remain stable.
- **AC-G-011**: Dental source extraction evaluation must meet gold semantic-accuracy thresholds, not just JSON validity: source-field pass rate >= 95% on required fields, document-level pass rate >= 90%, and zero critical misclassifications on source type, decision presence, blocker presence, or stakeholder extraction.
- **AC-G-012**: Dental wave-checkpoint aggregation must meet gold checkpoint accuracy thresholds: baseline/operational/escalation/recovery checkpoint pass rate >= 90% on required fields and zero critical mismatches on product status posture, top blockers, top risks, and recovery-vs-escalation directionality.
- **AC-G-013**: Dental gold Ask questions and report concept checks must meet evaluation thresholds before rollout: >= 90% concept coverage and >= 95% citation/source-family correctness for the curated Dental benchmark set.
- **AC-G-014**: When extraction-first Dental flags are enabled, no transitional projection helper may act as a hidden semantic fallback; helpers may only project validated extraction or aggregate state into runtime/UI shape.

## 17.2 Frontend Requirement-Level Acceptance Criteria

### Overview, Status, and Evidence Health
- **AC-FE-001**: When Dental is served from extraction-first state, the portfolio and Dental overview routes render without any contract changes required from the browser beyond the agreed API responses in Section 13.
- **AC-FE-002**: The Dental overview page shows extraction-first status, narrative, and evidence-health messaging sourced from projected aggregate state rather than legacy deterministic copy.
- **AC-FE-003**: When a newer aggregate snapshot is available after upload or reset, the overview page refreshes to the newer state without requiring manual hard refresh.
- **AC-FE-004**: If Dental extraction or aggregation is in progress, the UI displays a visible progress or pending state that distinguishes `processing`, `partial`, `completed`, and `failed` outcomes.
- **AC-FE-005**: If Dental extraction fails for a newly uploaded source, the UI preserves prior product state and displays a source-level failure indicator with retry or support guidance.

### Sources and Source Detail
- **AC-FE-006**: The Sources tab lists newly uploaded Dental artifacts using the returned `sourceId`, title, date, source type, and extraction status from projected backend state.
- **AC-FE-007**: Opening the source detail drawer shows extraction-backed summary, key entities or warnings, and citations/preview references appropriate to the source family.
- **AC-FE-008**: Source detail must show best-available citation coordinates when present: line range for text/email/transcript, slide number for deck, page/section for PDF/DOCX, and sheet/row range for spreadsheet/CSV.
- **AC-FE-009**: If extraction confidence is degraded or warnings are present, the source drawer surfaces those warnings without implying the source was ignored.

### Data, Timeline, and Search
- **AC-FE-010**: The Data tab continues to render risks, blockers, and PI objectives for Dental after the extraction-first migration, with rows sourced from projected runtime state influenced by validated extraction and deterministic structured parsing where applicable.
- **AC-FE-011**: The Timeline view renders Dental recent signals and grouped events from aggregate-driven state and continues to support existing filter controls.
- **AC-FE-012**: Search results continue to surface Dental sources by title and indexed text after extraction-first migration; search UX remains unchanged except for richer extraction-backed snippets where available.

### Ask and Reports
- **AC-FE-013**: Ask answers display normally on Dental when extraction-first mode is active, and cited evidence reflects extracted sources and retrieval-backed supporting evidence.
- **AC-FE-014**: Report generation on Dental continues to show loading, success, regeneration, and export states while consuming aggregate-driven report inputs.
- **AC-FE-015**: If Ask or report generation is degraded because Dental aggregate state is stale or failed, the UI shows an explicit degraded-state message rather than silently fabricating confidence.

### UX Consistency and Accessibility
- **AC-FE-016**: Existing navigation, layout, typography, and card patterns are preserved; new extraction-first indicators use the current visual system and data-testid conventions.
- **AC-FE-017**: All new states and controls introduced for extraction-first Dental are keyboard accessible and announced appropriately to assistive technology.
- **AC-FE-018**: Existing read-only views continue to hide editing controls even when extraction status or operator diagnostics are shown.

## 17.3 Backend Requirement-Level Acceptance Criteria

### Normalization and Persistence
- **AC-BE-001**: The backend can normalize every Dental corpus artifact family into a canonical normalized payload containing extracted text, structural coordinates, and metadata suitable for Nova prompting.
- **AC-BE-002**: Known structured exports (`risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export`, equivalent workbook/tabular families) continue to be parsed deterministically into row sets before semantic aggregation.
- **AC-BE-002a**: Deterministically parsed structured rows remain the exact row truth for Dental Data-tab rendering in v1; aggregate state may summarize or interpret them but may not invent, mutate, or replace those exact rows.
- **AC-BE-003**: Every normalized Dental source produces either a schema-valid source extraction JSON record or a persisted failure record with validation/provider diagnostics.
- **AC-BE-004**: Persisted source extraction records include prompt family, prompt version, model id, execution mode, latency, validation status, and normalized citation coordinates.

### Nova Extraction and Aggregation
- **AC-BE-005**: Live extraction mode calls `amazon.nova-pro-v1:0` through the existing Bedrock adapter path or its authorized replacement, using the prompt registry version declared in runtime config.
- **AC-BE-006**: Replay extraction mode bypasses live provider calls and returns a validated cached extraction artifact keyed by source hash, prompt version, and model id.
- **AC-BE-007**: Aggregate generation consumes validated source extraction JSON plus deterministic structured row data and outputs schema-valid Dental aggregate JSON.
- **AC-BE-008**: Aggregate publication is atomic: either a new aggregate snapshot and projected runtime state publish together, or the prior snapshot remains active.
- **AC-BE-009**: Aggregate failures must not delete or overwrite the last-known-good Dental product projection.

### Projection, Retrieval, Ask, and Reports
- **AC-BE-010**: Projected runtime state for Dental updates `products`, `productData`, and any dependent report/read models from the aggregate snapshot without exposing prompt-shaped JSON directly to the frontend.
- **AC-BE-011**: Retrieval indexing continues to persist searchable chunks and embeddings separately from semantic extraction records; Titan or pseudo-embedding execution remains retrieval-only.
- **AC-BE-012**: Ask service composes evidence from extraction records, projected aggregate state, and retrieval results without reintroducing deterministic semantic parsing.
- **AC-BE-013**: Report generation derives its structured section inputs from the published Dental aggregate snapshot and linked evidence.
- **AC-BE-014**: Reset/seed flows can rebuild Dental baseline and later wave states from extraction/aggregation outputs in both live and replay execution modes.

### Observability and Safety
- **AC-BE-015**: Every extraction and aggregation run emits structured logs and persisted run metadata sufficient to trace a UI-visible Dental state back to prompt version and source set.
- **AC-BE-016**: Invalid model JSON is rejected by schema validation and surfaced as a controlled extraction/aggregation error, not silently coerced into partial semantic state.
- **AC-BE-017**: Mixed-mode portfolio rendering remains supported while Dental is extraction-first and Optima/ESSENCE remain legacy-derived.
- **AC-BE-018**: Any transitional helper that derives product state or uploaded source shape must operate only as a projection utility in Dental extraction-first mode and must not reintroduce deterministic semantic interpretation.

## 17.4 Cross-Cutting Integration Acceptance Criteria

- **AC-INT-001**: Resetting Dental to `wave-00-baseline` in replay mode produces a product state whose overview, sources, and Ask/report readiness reflect extraction-first baseline outputs rather than deterministic corpus derivation.
- **AC-INT-002**: Uploading a Dental free-text source (email, transcript, narrative doc, deck, PDF) triggers normalization, validated extraction persistence, aggregate recomputation, projection publication, and a visible UI refresh without manual backend intervention.
- **AC-INT-003**: Uploading a Dental structured source triggers deterministic row parsing plus aggregate recomputation such that the Data tab and the aggregate-driven overview/report state both update coherently.
- **AC-INT-004**: A failed extraction for a new Dental upload leaves prior UI state intact while surfacing source-level failure indicators and backend diagnostics.
- **AC-INT-005**: Ask answers generated after a new Dental upload cite the newly extracted source when relevant and reflect aggregate state changes when the question is about posture, decisions, blockers, or recovery.
- **AC-INT-006**: Report regeneration after new Dental evidence uses the updated aggregate snapshot and surfaces a regeneration-required state before the new report is published.
- **AC-INT-007**: The replay-backed lifecycle workflow that starts from baseline and uploads wave-01, wave-02, and wave-03 Dental artifacts passes in both headed and headless modes.

## 17.5 Full-Stack E2E Scenarios

| Scenario ID | Workflow | Proof Type | Seed / Data Requirement | Acceptance Criteria Coverage |
| :--- | :--- | :--- | :--- | :--- |
| `E2E-DENTAL-BASELINE-001` | Reset Dental to baseline extraction-first state and verify overview/sources/render | Live Backend-Backed E2E in dev, Replay in CI | Dental baseline replay cache or live model access | `AC-G-001`, `AC-G-009`, `AC-FE-001`–`005`, `AC-INT-001` |
| `E2E-DENTAL-UPLOAD-EMAIL-002` | Upload Dental email, wait for extraction, verify Sources and overview refresh | Live Backend-Backed E2E in dev, Replay in CI | Baseline Dental state + replay/live extraction fixture | `AC-FE-006`–`009`, `AC-BE-001`–`006`, `AC-INT-002` |
| `E2E-DENTAL-UPLOAD-TRANSCRIPT-003` | Upload Dental transcript and verify Ask cites it for decision/blocker questions | Live Backend-Backed E2E in dev, Replay in CI | Baseline or wave-specific state + transcript fixture | `AC-FE-013`, `AC-BE-005`, `AC-BE-012`, `AC-INT-002`, `AC-INT-005` |
| `E2E-DENTAL-STRUCTURED-004` | Upload/update structured risks or blockers export and verify Data tab plus aggregate posture refresh | Live Backend-Backed E2E in dev, Replay in CI | Dental replay/live structured fixture | `AC-FE-010`, `AC-BE-002`, `AC-BE-007`, `AC-INT-003` |
| `E2E-DENTAL-REPORT-005` | Generate/regenerate Dental report after new evidence and verify regeneration semantics | Live Backend-Backed E2E in dev, Replay in CI | Existing report or report-capable Dental state | `AC-FE-014`, `AC-FE-015`, `AC-BE-013`, `AC-INT-006` |
| `E2E-DENTAL-FAILURE-006` | Force extraction failure and verify last-known-good state persists with clear UI failure messaging | Browser-Only Simulated only if provider failure injection unavailable; otherwise Live/Replay | Failure injection path or test-only replay failure payload | `AC-FE-005`, `AC-FE-015`, `AC-BE-009`, `AC-BE-016`, `AC-INT-004` |
| `E2E-DENTAL-LIFECYCLE-007` | Full baseline → wave-01 → wave-02 → wave-03 Dental lifecycle walkthrough | Replay in automated suites, optionally Live in manual dev runs | Complete Dental replay cache and corpus fixtures | `AC-G-006`, `AC-G-007`, `AC-INT-007`, plus checkpoint FE/BE coverage |

## 17.6 Definition of Done

The feature is complete only when all of the following are true:

- All `AC-G-*`, `AC-FE-*`, `AC-BE-*`, and `AC-INT-*` items are implemented and mapped to automated proof.
- Dental baseline and wave checkpoints can be rebuilt from extraction/aggregation outputs without deterministic semantic parsing.
- Replay mode artifacts exist for the full Dental corpus and are versioned by prompt version, model id, and source hash.
- The runtime can operate in mixed mode without regressions to Optima or ESSENCE.
- The required Playwright workflows pass in both headed and headless execution modes.
- Implementation documentation, replay generation instructions, and operator recovery guidance are written and checked in.
- No legacy deterministic semantic path remains active for Dental when extraction-first feature flags are enabled.

## 17.7 Usability Testing Plan

- Conduct one operator walkthrough using replay mode and the full Dental lifecycle script to confirm extraction-first failures and pending states are understandable without backend log access.
- Conduct one product-manager walkthrough focused on Ask/report trust: verify users can distinguish extracted evidence, aggregate posture, and degraded states.
- Conduct one leadership-demo rehearsal to confirm the extraction-first Dental story reads as evidence-backed rather than file-storage-driven.

## 17.8 Required Design Deliverables

- Updated API contract and JSON schemas checked into the backend repository.
- Replay cache generation guide for the Dental corpus.
- Prompt registry documentation covering source-family prompts and aggregate prompts.
- UI copy inventory for extraction pending/partial/failed/degraded states.

## 17.9 Playwright Test Scripts

The following scripts are required additions or updates. They are intentionally written as implementation-ready stubs using existing route and selector conventions from this repo.

Selector policy for this section:
- When the current app already exposes a selector, the stub uses the current selector name from `client/src/App.jsx`.
- When the selector does not exist today but is necessary for stable proof of extraction-first behavior, the selector is a required implementation addition and is marked as such in Section 18.5.

### PW-001 Baseline Extraction-First Reset
- **Maps to:** `AC-FE-001`, `AC-FE-002`, `AC-INT-001`
- **Proof Type:** Replay in CI, Live Backend-Backed E2E in local verification when configured
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Dental baseline renders from extraction-first state', async ({ page, request }) => {
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-00', executionMode: 'replay' });
  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('product-page')).toBeVisible();
  await expect(page.getByTestId('knowledge-health-panel')).toBeVisible();
  await expect(page.getByTestId('extraction-state-badge')).toContainText(/replay|live/i);
  await expect(page.getByTestId('overview-current-state')).toBeVisible(); // required selector addition
});
```

### PW-002 Upload Email and Verify Source Detail
- **Maps to:** `AC-FE-006`, `AC-FE-007`, `AC-FE-009`, `AC-INT-002`
- **Proof Type:** Replay in CI, Live Backend-Backed E2E locally
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Uploading a Dental email produces extraction-backed source detail', async ({ page, request }) => {
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-00', executionMode: 'replay' });
  await page.goto('/products/dental?tab=overview');
  await uploadNovaArtifact(page, { fixtureKey: 'wave01-vendor-delay-email' });
  await expect(page.getByTestId('artifact-processing-complete')).toBeVisible();
  await page.getByTestId('product-tab-sources').click();
  await page.getByTestId('source-item-nova-wave01-vendor-delay-email').click();
  await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
  await expect(page.getByTestId('source-detail-summary')).toBeVisible();
  await expect(page.getByTestId('source-detail-citations')).toContainText(/line|paragraph/i);
});
```

### PW-003 Upload Transcript and Verify Ask
- **Maps to:** `AC-FE-013`, `AC-BE-012`, `AC-INT-005`
- **Proof Type:** Replay in CI, Live Backend-Backed E2E locally
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact, askAndWait } from './helpers/novaLifecycle.js';

test('Dental Ask cites extracted transcript evidence after upload', async ({ page, request }) => {
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-01', executionMode: 'replay' });
  await page.goto('/products/dental?tab=overview');
  await uploadNovaArtifact(page, { fixtureKey: 'wave02-leadership-sync-transcript' });
  await askAndWait(page, 'What decisions are driving the release-plan change?');
  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-source-0')).toContainText('Dental Leadership Sync Transcript');
});
```

### PW-004 Upload Structured Export and Verify Data + Overview
- **Maps to:** `AC-FE-010`, `AC-BE-002`, `AC-INT-003`
- **Proof Type:** Replay in CI, Live Backend-Backed E2E locally
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Structured blockers update Data tab and aggregate posture', async ({ page, request }) => {
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-01', executionMode: 'replay' });
  await page.goto('/products/dental?tab=overview');
  await uploadNovaArtifact(page, { fixtureKey: 'wave02-blockers-export' });
  await page.getByTestId('product-tab-data').click();
  await expect(page.getByTestId('data-row-B-003')).toBeVisible();
  await page.getByTestId('product-tab-overview').click();
  await expect(page.getByTestId('product-status-badge')).toContainText(/risk|caution/i); // required selector addition
});
```

### PW-005 Report Regeneration After New Evidence
- **Maps to:** `AC-FE-014`, `AC-FE-015`, `AC-INT-006`
- **Proof Type:** Replay in CI, Live Backend-Backed E2E locally
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental reports regenerate from updated aggregate state', async ({ page, request }) => {
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-02', executionMode: 'replay' });
  await page.goto('/products/dental?tab=reports');
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email', navigateBackToReports: true });
  await expect(page.getByTestId('report-regenerate-notice')).toBeVisible();
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toContainText(/recovery|mitigation|caution/i);
});
```

### PW-006 Extraction Failure Preserves Last-Known-Good State
- **Maps to:** `AC-FE-005`, `AC-BE-009`, `AC-BE-016`, `AC-INT-004`
- **Proof Type:** Replay-backed failure fixture preferred; Browser-Only Simulated only if no backend failure injection exists
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Failed extraction preserves prior Dental state', async ({ page, request }) => {
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-02', executionMode: 'replay' });
  await page.goto('/products/dental?tab=overview');
  const priorStatus = await page.getByTestId('product-status-badge').textContent(); // required selector addition
  await uploadNovaArtifact(page, { fixtureKey: 'forced-invalid-extraction-email' });
  await expect(page.getByTestId('artifact-processing-error')).toBeVisible();
  await expect(page.getByTestId('product-status-badge')).toContainText(priorStatus || '');
  await expect(page.getByTestId('source-item-forced-invalid-extraction-email')).toBeVisible();
});
```

### PW-007 Full Dental Lifecycle Replay Walkthrough
- **Maps to:** `AC-G-006`, `AC-G-007`, `AC-INT-007`
- **Proof Type:** Replay in automation; optional Live local walkthrough once prompts are stable
- **Execution Modes:** Must pass headed and headless

```javascript
import { test, expect } from '@playwright/test';
import { runDentalNovaLifecycle } from './helpers/novaLifecycle.js';

test('Dental lifecycle remains coherent across all waves', async ({ page, request }) => {
  await runDentalNovaLifecycle({ page, request, executionMode: 'replay' });
  await expect(page.getByTestId('product-status-badge')).toContainText(/caution/i); // required selector addition
  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByText('Dental Leadership Readout Deck')).toBeVisible();
  await page.getByTestId('product-tab-reports').click();
  await expect(page.getByTestId('report-section-executive-summary')).toContainText(/recovery|managed caution/i);
});
```

---

# 18. Frontend Engineering Handoff (React Implementation Notes)

## 18.1 Route-Level Impact
- Existing routes remain authoritative:
  - `/portfolio`
  - `/products/:productId?tab=overview|timeline|data|sources|reports`
- No new primary end-user route is required for v1.
- Optional operator-only diagnostics may be added later behind a feature flag, but they are not required for release.

## 18.2 Component and State Boundaries
- Preserve the existing single-application composition in `client/src/App.jsx` and its current view decomposition.
- Add minimal new view-model fields rather than prompt-shaped nested payloads.
- Frontend should consume projected fields such as:
  - `product.semanticState.executionMode`
  - `product.semanticState.aggregateVersion`
  - `product.semanticState.aggregateStatus`
  - `source.extractionStatus`
  - `source.summary`
  - `source.citations`
  - `source.warnings`
- Do not couple React components directly to backend prompt registry names or raw model payloads.

## 18.3 Data Fetching and Refresh Model
- Reuse the existing API client and mutation patterns already present in `client/src/lib/api.js`.
- Dental upload completion should trigger a product refresh and a sources refresh using the existing route-level fetch conventions.
- Ask and Reports should continue using their existing request patterns, but UI copy must reflect new degraded-state semantics when aggregate freshness is poor.

## 18.4 UI Additions Allowed in v1
- Extraction state badge in Dental product header or source detail context.
- Source-level extraction warning and citation blocks in the source drawer.
- Report/Ask degraded-state messaging when aggregate freshness or validation state requires it.
- No large redesign of portfolio or product layouts in this effort.

## 18.5 Required `data-testid` Selectors

| Selector | Purpose |
| :--- | :--- |
| `product-page` | Existing route root |
| `product-status-badge` | Required addition for stable product-level posture assertions on the Dental page |
| `overview-current-state` | Required addition for stable overview narrative assertions |
| `knowledge-health-panel` | Existing knowledge panel |
| `extraction-state-badge` | New execution-mode / aggregate-status badge |
| `artifact-processing-complete` | Existing terminal ingest success state |
| `artifact-processing-error` | New or existing terminal ingest error state |
| `product-tab-overview` | Existing tab selector |
| `product-tab-data` | Existing tab selector |
| `product-tab-sources` | Existing tab selector |
| `product-tab-reports` | Existing tab selector |
| `source-detail-drawer` | Existing source drawer container |
| `source-detail-summary` | Required addition for extraction-backed source summary |
| `source-detail-citations` | Required addition for stable citation assertions |
| `source-detail-warnings` | Required addition for extraction warning assertions |
| `ask-answer` | Existing Ask result container |
| `ask-evidence-source-0` | Existing Ask evidence item selector family |
| `report-regenerate-notice` | Existing regeneration-required state |
| `report-regenerate-button` | Existing regeneration action |

## 18.6 Frontend Test Expectations
- Add or update component/integration tests around:
  - source drawer rendering of summary/citations/warnings
  - degraded Ask/report states
  - extraction status badge rendering
- Additive Playwright proof is mandatory for all user-visible flows in Section 17.9.
- Headed verification should be done against the real app using replay-backed backend state by default.

## 18.7 Parallel Development Stub Boundary
- Frontend may develop against static fixture responses that conform to the unified API contract in Section 13.
- These fixtures must represent projected runtime state, not raw Nova prompt outputs.
- Before merge, fixture-backed FE work must be re-verified against the integrated replay-backed backend.

---

# 19. Backend Engineering Handoff

## 19.1 Primary Module Impact
- `server/src/services/ingest/artifactUpload.service.js`
  - Convert from primarily preview/index behavior to normalization + extraction orchestration entry point.
- `server/src/services/ingest/corpusImport.service.js`
  - Replace deterministic Dental semantic derivation with extraction-first seed/backfill workflows.
- `server/src/services/domain/mutation.service.js`
  - Publish new aggregate snapshots and projection updates atomically.
- `server/src/services/domain/readModel.service.js`
  - Continue to shape UI responses from projected runtime state, not raw prompt payloads.
- `server/src/services/domain/ask.service.js`
  - Consume extraction/aggregate state and retrieval evidence without legacy semantic fallbacks.
- `server/src/services/rag/generation.service.js`
  - Generate Ask/report prose from extraction/aggregate-backed evidence packs.
- `server/src/rag/prototypeDuckDbStore.js`
  - Preserve retrieval responsibilities; do not turn it into the semantic source of truth.
- `server/src/config/runtime.js` and Bedrock adapters
  - Add extraction/aggregation execution-mode and prompt-version configuration.

## 19.2 New Backend Modules Recommended
- `server/src/services/extraction/sourceNormalization.service.js`
- `server/src/services/extraction/novaSourceExtraction.service.js`
- `server/src/services/extraction/productAggregation.service.js`
- `server/src/services/extraction/extractionRepository.service.js` or equivalent runtime repository additions
- `server/src/services/extraction/replayCache.service.js`
- `server/src/services/extraction/promptRegistry/` with versioned prompt family definitions
- `server/test/extraction/` and `server/test/aggregation/` suites
- `tests/e2e/helpers/novaLifecycle.js`

## 19.3 Data and Schema Ownership
- JSON schemas for normalized source payload, source extraction, and aggregate output must be versioned in-repo.
- Schema validation must occur before persistence/publication.
- Aggregate publication should write both the aggregate record and the projected runtime state update within one logical transaction boundary or fail safely.

## 19.4 Replay Cache Rules
- Replay artifacts are required for automated suites.
- Cache key minimums:
  - `productId`
  - `sourceId` or source hash
  - `promptFamily`
  - `promptVersion`
  - `modelId`
  - normalized content hash
- Cache misses in automated test mode should fail fast with actionable setup messaging.

## 19.5 Prompt Iteration and Evaluation Harness
- Build the evaluation harness before switching production Dental flows.
- Required harness capabilities:
  - single-document extraction eval
  - wave checkpoint aggregate eval
  - full Dental corpus eval
  - diff against curated gold JSON and gold UI expectations
  - prompt-versioned result persistence
- Prompt changes are not releasable until gold thresholds and downstream UI acceptance checks pass.

## 19.6 Operational Safeguards
- Preserve legacy Dental semantic path behind a flag until replay-backed extraction-first parity is achieved.
- Publish last-known-good aggregate snapshot on failure.
- Never allow raw invalid model JSON to reach the runtime read model.
- Keep mixed-mode compatibility explicit until Optima/ESSENCE migration is separately specified.
- Any transitional helper that shapes uploaded source records or derives Dental runtime state must be projection-only once extraction-first flags are enabled; it may not remain as a hidden semantic fallback.

## 19.7 Backend Test Expectations
- Unit tests:
  - normalization adapters
  - schema validation
  - projection utilities
  - replay cache lookup behavior
- Integration tests:
  - extraction persistence and aggregate publication
  - reset/backfill workflows
  - Ask/report composition from extraction-first state
- Contract tests:
  - API responses for Dental routes under extraction-first mode
- Playwright tests:
  - required for all user-visible/cross-cutting flows from Section 17.9

---

# 20. Out of Scope (Non-Goals)

- Full migration of Optima or ESSENCE to extraction-first semantics.
- Portfolio-wide redesign or a new frontend design system.
- Replacing Titan retrieval with Nova-based vector or reasoning infrastructure.
- Eliminating deterministic parsing for known structured exports and file normalization.
- Building a generalized admin prompt-authoring UI in v1.
- Guaranteeing exact span citations for every source family on day one beyond best-available coordinates.
- Requiring live Nova execution in CI or in standard automated E2E runs.

---

# 21. Appendix

## 21.1 Referenced Code Areas
- `client/src/App.jsx`
- `client/src/lib/api.js`
- `server/src/app.js`
- `server/src/config/runtime.js`
- `server/src/services/domain/mutation.service.js`
- `server/src/services/domain/readModel.service.js`
- `server/src/services/domain/ask.service.js`
- `server/src/services/ingest/artifactUpload.service.js`
- `server/src/services/ingest/corpusImport.service.js`
- `server/src/services/extract/transcriptExtraction.service.js`
- `server/src/services/rag/generation.service.js`
- `server/src/rag/prototypeDuckDbStore.js`
- `shared/artifactTypes.js`
- `tests/e2e/`

## 21.2 Recommended Companion Documents
- Dental extraction gold dataset specification
- Prompt registry authoring guide
- Replay cache generation and refresh guide
- Dental lifecycle replay test runbook

## 21.3 Suggested Implementation Order for Execution
1. Build normalization adapters and schema registry.
2. Build replay-backed source extraction and evaluation harness.
3. Build aggregate generation and projection with last-known-good publication.
4. Switch Dental reset/backfill to extraction-first state.
5. Switch Dental upload, Ask, and Reports to extraction-first flows.
6. Finalize replay-backed headed/headless lifecycle verification.
