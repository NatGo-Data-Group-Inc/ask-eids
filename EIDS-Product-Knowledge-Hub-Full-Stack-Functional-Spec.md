
# Full-Stack Feature Specification: EIDS Product Knowledge Hub

## 1. Document Overview

| Attribute | Detail |
| :--- | :--- |
| **Document Title** | Full-Stack Feature Specification: EIDS Product Knowledge Hub |
| **Status** | Draft |
| **Version** | 1.0 |
| **Date Last Updated** | April 15, 2026 |
| **Technical Lead** | Archie / Innovation Cell |
| **UX Lead** | Archie / Innovation Cell |
| **Target Frontend** | Greenfield monorepo, React 18 + Vite (JavaScript only), internal web application |
| **Target Backend** | Greenfield monorepo, Node.js 20 + Express 5 API + background workers, AWS GovCloud (US-West) |
| **Source System (if migration)** | N/A |
| **Runtime Environment** | React + Node.js + AWS GovCloud (US-West) + Amazon Bedrock + Amazon OpenSearch Serverless + Amazon Aurora PostgreSQL |
| **Existing UI Library** | None detected. Custom CSS/tokenized component library derived from supplied HTML mockup |
| **Key Dependencies** | Amazon Bedrock Knowledge Bases, Amazon Titan Text Embeddings V2, Amazon Nova Pro v1, Amazon OpenSearch Serverless, Amazon S3, Amazon Aurora PostgreSQL, Amazon SQS, Amazon Textract, AWS Secrets Manager, AWS CloudWatch, optional Azure DevOps MCP |

**Assumptions:**
- This is a **greenfield implementation**. There is no existing frontend or backend repository to inspect.
- No GitHub or codebase scan was performed because no target codebase exists yet.
- The supplied HTML/CSS/JS mockup is the current visual source of truth for information architecture and interaction intent.
- The initial release includes the complete user-facing experience shown or implied by the mockup: portfolio landing, product detail tabs, Ask, reports, export, quick views, global search, transcript upload, weekly updates, source browsing, and role-based views.
- The backend is a **Node.js monorepo** with `client/`, `server/`, and `shared/` folders.
- The frontend is **JavaScript only**. No TypeScript is used anywhere in the initial implementation.
- Authentication is provided by an existing enterprise identity provider via OIDC/SAML at the edge; the application consumes validated identity claims and maps them to product-scoped roles.
- The application is same-origin: React assets and Express API are served behind the same internal ALB hostname.
- Production operates in **us-gov-west-1** only. Cross-region inference is disabled for production.
- Unstructured retrieval uses **Amazon Bedrock Knowledge Bases** with an **Amazon OpenSearch Serverless** vector store and **Amazon Titan Text Embeddings V2**.
- Response synthesis and report drafting use **Amazon Nova Pro v1** through Amazon Bedrock.
- The user-facing Ask experience uses **Knowledge Bases retrieval + app-side orchestration + Nova Pro generation**, not raw `RetrieveAndGenerate`, so the app can enforce evidence controls, structured-data joins, deterministic citations, and partial-answer handling.
- Structured product data (risks, blockers, PI objectives, weekly updates, permissions, reports, snapshots) lives in **Amazon Aurora PostgreSQL**.
- Raw files and normalized text live in **Amazon S3**. Ingestion and report generation jobs are processed asynchronously through **Amazon SQS** and Node workers.
- Email ingestion supports both an automated shared-mailbox connector and manual import fallback for `.eml`, `.msg`, or zipped exports.
- Azure DevOps integration is read-only in V1. Direct REST ingestion is the primary sync path. Azure DevOps MCP is optional and feature-flagged for enrichment/debug/operator workflows, not the system-of-record sync path.

**Open Questions (Resolved Pre-Generation):**
- **Greenfield or existing app?** Greenfield.
- **Frontend/backend stack?** Node.js + React, no TypeScript.
- **Release scope?** Full initial release, not an MVP subset.
- **Cloud constraints?** AWS GovCloud (US-West) with Bedrock Knowledge Bases, Titan embeddings, Nova Pro v1 available.
- **Should Azure DevOps MCP be considered?** Yes, but as an optional value-add, not the primary ingestion backbone.

---

## 2. Feature Summary & Target End State

### 2.1 Executive Summary

EIDS Product Knowledge Hub enables portfolio leads, product managers, and leadership to understand product state, evidence coverage, decisions, blockers, source material, and report outputs in a single application. It solves the current problem of fragmented product knowledge by combining structured program data with retrieved evidence from documents, emails, transcripts, and synced delivery systems. When complete, users will move from portfolio triage to evidence-backed answers and exportable reports without hunting across inboxes, shared drives, or disconnected trackers.

### 2.2 Concrete Changes Inventory

| # | Layer | Location | Change Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| 1 | FE | App shell | New | Sticky top navigation with brand, global search, and user identity |
| 2 | FE | Portfolio page | New | Pulse bar, alerts bar, grouped product cards, quick-view actions |
| 3 | FE | Product shell | New | Product header, status, metadata, tab navigation |
| 4 | FE | Overview tab | New | Knowledge health, narrative current state, recent signals, Ask panel |
| 5 | FE | Timeline tab | New | Chronological grouped timeline with filtering and expandable details |
| 6 | FE | Data tab | New | Risks, blockers, and PI objectives tables with row detail panels |
| 7 | FE | Sources tab | New | Source inventory, source filters, source detail drawer/modal |
| 8 | FE | Reports tab | New | Report configuration, async generation, evidence coverage, editable report output |
| 9 | FE | Upload Transcript modal | New | Product-scoped transcript upload flow |
| 10 | FE | Update Weekly modal | New | Product-scoped weekly update publishing flow |
| 11 | FE | Global search | New | Search across product names and source titles/metadata |
| 12 | FE | Permission states | New | Read-only vs editor vs leadership variants |
| 13 | FE | Unsupported viewport state | New | Explicit unsupported state below 1024px |
| 14 | BE | Web API | New | Express REST API for all read/write and async job orchestration |
| 15 | BE | Auth middleware | New | Identity claim parsing and product-role enforcement |
| 16 | BE | Product read services | New | Portfolio, product, timeline, data, sources, search read APIs |
| 17 | BE | Ask orchestration | New | Query planning, retrieval, evidence packing, Nova Pro answer synthesis |
| 18 | BE | Report orchestration | New | Async report generation, section drafting, persistence, export |
| 19 | BE | Ingestion services | New | Document, email, transcript, and structured-data normalization pipelines |
| 20 | BE | KB sync service | New | Write normalized artifacts to S3 and sync Bedrock Knowledge Base |
| 21 | BE | Health scoring service | New | Compute coverage, freshness, continuity, sync, and overall health |
| 22 | BE | Snapshot service | New | Precompute portfolio/product snapshots for fast UI reads |
| 23 | BE | Connectors | New | ADO sync adapter, optional ADO MCP enrichment adapter, mailbox connector |
| 24 | BE | Export service | New | PDF, PPTX, clipboard payload, and email dispatch preparation |
| 25 | Both | Shared contracts | New | JSON Schema request/response contracts and error code catalog |
| 26 | Both | Test infrastructure | New | Jest/Vitest, React Testing Library, Supertest, contract tests, Playwright |
| 27 | Infra | AWS | New | S3 buckets, Aurora PostgreSQL, SQS queues, Bedrock KB, AOSS, IAM roles, Secrets Manager |

### 2.3 Target End State Description

When the feature is complete, a user lands on a portfolio page that immediately shows which products need attention, why they need attention, and how complete their underlying knowledge base is. Opening a product reveals a current-state narrative, evidence-backed recent signals, structured trackers, source inventory, and an Ask panel that can answer questions using both retrieved unstructured evidence and structured program data. Behind the scenes, the system continuously ingests documents, emails, transcripts, and delivery data; normalizes and indexes them into a product-scoped retrieval corpus; calculates health and freshness scores; and drafts reports using a constrained RAG pipeline. The experience feels evidence-first, auditable, and operationally trustworthy because every answer and every report section is explicitly tied back to source artifacts.

---

## 3. User Research & Context

### 3.1 Target User Personas

**Persona 1: Portfolio Lead**
- **Role/Context:** Oversees multiple product lines and prepares weekly, sprint, and PI-level leadership updates.
- **Goals:** Triage products quickly, understand the reason for risk, verify evidence coverage, and generate briefing-ready outputs.
- **Pain Points:** Reporting is manual; product knowledge is fragmented; the same status questions get answered repeatedly.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Daily to weekly

**Persona 2: Product Manager**
- **Role/Context:** Owns one or more products and is responsible for current status, stakeholder continuity, and source hygiene.
- **Goals:** Keep product knowledge current, upload missing evidence, answer leadership questions quickly, and avoid re-explaining the same context.
- **Pain Points:** Decisions live in meetings and inboxes; exports are inconsistent; turnover destroys continuity.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Daily

**Persona 3: Leadership Reviewer**
- **Role/Context:** Needs fast answers about delivery posture, decisions, blockers, stakeholder activity, and next decision points.
- **Goals:** Read a product quickly, trust the answer, and export a report.
- **Pain Points:** Traditional briefings are stale, inconsistent, and detached from evidence.
- **Technical Proficiency:** Beginner to Intermediate
- **Usage Frequency:** Weekly to occasional

**Persona 4: Platform/Operations Analyst**
- **Role/Context:** Maintains connectors, data imports, sync health, and ingestion troubleshooting.
- **Goals:** Ensure sources are current, debug failed ingests, and verify connector freshness.
- **Pain Points:** Silent sync failures and opaque indexing pipelines create user mistrust.
- **Technical Proficiency:** Advanced
- **Usage Frequency:** Daily

### 3.2 User Problem Statement

> As a portfolio or product leader, I struggle to understand the true current state of a product because critical information is scattered across documents, emails, transcripts, tracker exports, and delivery systems. That makes me uncertain about what is actually true, slows decisions, and forces repeated manual reporting and status reconstruction.

### 3.3 Success Criteria

**User-Facing:**
- Users can move from portfolio landing to a product answer in **3 interactions or fewer**.
- Users can generate a weekly report from a product page in **2 interactions or fewer** once on the Reports tab.
- Users can tell whether a product answer or report is complete, partial, or evidence-limited without outside explanation.
- Users understand why a product is `At Risk`, `Caution`, or `On Track` from the page itself.

**System-Level:**
- Portfolio page `GET /api/v1/portfolio` P95 < **1200 ms**
- Product shell `GET /api/v1/products/:id` P95 < **1500 ms**
- Ask request synchronous completion P95 < **7000 ms**
- Report generation kickoff response < **500 ms** and report completion P95:
  - Weekly: < **30 s**
  - Sprint: < **60 s**
  - PI: < **120 s**
- No silent ingest failure; every ingest job must end in `completed`, `partial`, or `failed` with traceable diagnostics.
- Retrieval answer false-citation rate target: **0** in automated validation.
- Structured API error rate target under expected load: **< 0.5%**
- Existing successful answer/report content remains visible during export or refresh actions.

---

## 4. User Flows & End-to-End Data Flow

### 4.1 Primary User Flow

**Entry Point:**  
Authenticated user opens `/portfolio`.

**Primary flow chosen:** Portfolio lead opens an at-risk product, asks what decisions were made this sprint, verifies evidence, and generates a weekly report.

1. **Portfolio landing**
   - **User action:** User opens `/portfolio`.
   - **UI response:** Page shell renders, pulse bar and product card areas show loading skeletons.
   - **API call:** `GET /api/v1/portfolio`
   - **Backend processing:** Read latest `portfolio_snapshot` and `product_snapshot` rows from Aurora; format grouped response.
   - **API response:** 200 with summary, alerts, grouped product cards.
   - **UI state transition:** Pulse bar, alerts bar, and grouped product cards render.

2. **Open product**
   - **User action:** User clicks the `DENTAL / DENCLASS` product card.
   - **UI response:** Route changes, product shell loads with Overview tab selected.
   - **API call:** `GET /api/v1/products/dental?tab=overview`
   - **Backend processing:** Validate product access, read product metadata, health snapshot, narrative summary, recent signals, permissions, and Ask suggestions.
   - **API response:** 200 with product overview payload.
   - **UI state transition:** Product shell renders Overview with knowledge panel, current state, signals, and Ask panel.

3. **Ask a question**
   - **User action:** User enters `What decisions were made this sprint?` and clicks Ask.
   - **UI response:** Ask button disables, answer area shows loading state.
   - **API call:** `POST /api/v1/products/dental/ask`
   - **Backend processing:**  
     1. authorize product access  
     2. classify intent (`decision-history`)  
     3. build structured query plan  
     4. retrieve structured evidence (decisions/action items/risks/blockers/weekly) from Aurora  
     5. retrieve unstructured evidence from Bedrock Knowledge Base with metadata filters  
     6. score and deduplicate evidence  
     7. generate answer with Nova Pro  
     8. validate citations and evidence thresholds  
     9. return complete/partial/insufficientEvidence status
   - **API response:** 200 with answer text, cited sources, evidence strength, and coverage warnings.
   - **UI state transition:** Ask answer block renders with source list and any evidence-gap warning.

4. **Verify source evidence**
   - **User action:** User clicks a source item in the answer or switches to Timeline.
   - **UI response:** App opens Sources drawer or routes to Timeline with filter applied.
   - **API call:** `GET /api/v1/products/dental/sources/:sourceId` or `GET /api/v1/products/dental/timeline?filter=decision`
   - **Backend processing:** Read source metadata or timeline entries from Aurora.
   - **API response:** 200 with source/timeline detail.
   - **UI state transition:** Source detail or filtered timeline appears.

5. **Generate report**
   - **User action:** User opens Reports and clicks `Generate Report`.
   - **UI response:** Report area enters loading state.
   - **API call:** `POST /api/v1/products/dental/reports`
   - **Backend processing:** Create `report_run` record, enqueue report job, return 202 with `jobId` and `reportId`.
   - **API response:** 202 pending.
   - **UI state transition:** UI begins polling job status and keeps loading state visible.

6. **Report completes**
   - **User action:** None; UI polls.
   - **API call:** `GET /api/v1/jobs/:jobId`
   - **Backend processing:** Worker completes retrieval, coverage scoring, Nova Pro section drafting, validation, persistence, and marks job complete.
   - **API response:** 200 complete with `reportId`.
   - **UI state transition:** UI calls `GET /api/v1/products/dental/reports/:reportId`, then renders coverage card and report sections.

7. **Completion**
   - **User action:** User exports PDF.
   - **UI response:** Only the PDF button enters loading state.
   - **API call:** `POST /api/v1/products/dental/reports/:reportId/exports`
   - **Backend processing:** Generate PDF artifact from persisted report.
   - **API response:** 200 with download URL or 202 with export job.
   - **UI state transition:** Success toast appears and download begins or export status updates.

**Exit Points:**
- User can return to portfolio; previous scroll position is restored.
- User can leave the Ask or Reports flow without losing persisted product data.
- Unsaved report edits trigger discard confirmation.
- Background jobs continue after the user leaves the page.

### 4.2 Alternative Flows & Edge Cases

- **Happy Path Variation: Deep-linked product tab**
  - User opens `/products/dental?tab=timeline&timelineFilter=risk`
  - UI renders Timeline tab directly with risk filter applied
  - No intermediate navigation required

- **Happy Path Variation: Read-only leadership user**
  - User can ask questions and generate/export reports
  - Upload Transcript, Update Weekly, and Edit actions are hidden

- **Error Recovery: Ask dependency failure**
  - Knowledge Base retrieve fails or Nova Pro times out
  - Backend returns structured error or degraded-mode response
  - UI shows inline Ask error with Retry and preserved query

- **Error Recovery: Partial evidence**
  - Some expected artifacts are missing or stale
  - Backend returns `status: partial`
  - UI shows answer/report plus evidence-gap warning, not a false full-success state

- **Abandoned Flow**
  - User leaves product page while a report is generating
  - Job continues server-side
  - Returning to `/products/:id?tab=reports&reportId=:reportId` rehydrates the completed or pending report state

- **First-Time User Experience**
  - Ask panel shows suggestion prompts before any answer exists
  - Reports tab shows instructional empty state before generation
  - Empty states explain how to get useful data into the system

- **Concurrent Access**
  - If two editors change the same report section, the second save returns `409 CONFLICT`
  - UI offers refresh and retry with current server state

### 4.3 Backend Data Flow (Pipeline Stages)

#### Stage 1: Source Intake
- **Input:** Uploaded transcript file, mailbox connector message payload, ADO sync payload, or structured CSV/JSON import
- **Processing:** Validate source type, attach product scope, allocate `source_id`, store raw object in S3
- **Output:** `source_record` row + raw S3 key + `ingest_job`
- **File(s):** `server/src/services/ingest/sourceIntake.service.js`
- **Failure mode:** Validation or storage failure returns 400/500; job marked failed; no sync starts

#### Stage 2: Normalization
- **Input:** Raw file/message/export payload
- **Processing:** Convert source into canonical text/markdown representation; extract metadata (title, date, participants, authors, thread IDs, pages, file type)
- **Output:** Normalized text artifact + metadata JSON
- **File(s):** `server/src/services/ingest/normalize/*`
- **Failure mode:** If no usable text can be extracted, mark source `partial` or `failed` with reason; optionally send OCR fallback

#### Stage 3: Specialized Extraction
- **Input:** Normalized source artifact
- **Processing:**  
  - Transcript: decisions, action items, stakeholders, deadlines  
  - Email: thread reconstruction, attachment linkage, quoted-text collapse  
  - Document: section identification, page mapping, optional table extraction  
  - Structured import: schema validation and row upserts
- **Output:** Derived domain entities and event candidates
- **File(s):** `server/src/services/extract/*`
- **Failure mode:** Derived entities may fail while raw indexing still succeeds; mark source `partial`, not `failed`

#### Stage 4: Chunking
- **Input:** Normalized text artifact
- **Processing:** Split content into deterministic chunk files; build metadata sidecars for Bedrock Knowledge Bases
- **Output:** Chunk documents in S3 plus `.metadata.json` sidecars
- **File(s):** `server/src/services/rag/chunking.service.js`
- **Failure mode:** If chunking fails, no KB sync occurs; source stays non-searchable

#### Stage 5: Knowledge Base Sync
- **Input:** Chunk objects in S3
- **Processing:** Trigger Bedrock Knowledge Base sync for the relevant environment corpus; poll sync job until complete
- **Output:** Indexed chunks retrievable through Bedrock Knowledge Bases
- **File(s):** `server/src/services/rag/kbSync.service.js`
- **Failure mode:** Sync failure marks source `indexed=false` and adds retryable connector/job error

#### Stage 6: Snapshot & Health Recompute
- **Input:** Updated source/entity state
- **Processing:** Recompute product coverage, freshness, continuity, sync, and overall health; rebuild product/timeline summaries
- **Output:** Updated product and portfolio snapshot rows
- **File(s):** `server/src/services/health/healthScoring.service.js`, `server/src/services/snapshots/*`
- **Failure mode:** Existing snapshots remain active; stale-state warning is surfaced until recompute succeeds

#### Stage 7: Query Planning (Ask or Report)
- **Input:** Product ID, user role, user query or report period
- **Processing:** Determine intent, required structured datasets, required source types, time horizon, and evidence thresholds
- **Output:** Retrieval plan
- **File(s):** `server/src/services/rag/queryPlanner.service.js`
- **Failure mode:** Fallback to conservative generic retrieval plan

#### Stage 8: Structured Retrieval
- **Input:** Retrieval plan
- **Processing:** Query Aurora for relevant structured entities and snapshots
- **Output:** Structured evidence pack
- **File(s):** `server/src/services/rag/structuredRetrieval.service.js`
- **Failure mode:** If structured retrieval fails, unstructured retrieval may proceed but answer state becomes `partial`

#### Stage 9: Knowledge Base Retrieval
- **Input:** Retrieval plan with metadata filters
- **Processing:** Call Bedrock Knowledge Base `Retrieve` with product/date/source filters and top-K settings
- **Output:** Retrieved chunk candidates with scores and metadata
- **File(s):** `server/src/services/rag/kbRetrieve.service.js`
- **Failure mode:** Return degraded response path; log Bedrock/KB error; answer/report may fail or degrade

#### Stage 10: Evidence Ranking & Packing
- **Input:** Structured evidence + KB candidates
- **Processing:** Deduplicate, recency-boost, source-diversify, threshold, and format into a bounded evidence pack
- **Output:** Final evidence pack sent to Nova Pro
- **File(s):** `server/src/services/rag/evidencePack.service.js`
- **Failure mode:** If evidence is too weak, return `insufficientEvidence` without generation

#### Stage 11: Nova Pro Generation
- **Input:** System prompt, user question/report section prompt, evidence pack, formatting instructions
- **Processing:** Nova Pro generates strict JSON output with answer/report text and cited source IDs
- **Output:** Draft answer or report section
- **File(s):** `server/src/services/rag/generation.service.js`
- **Failure mode:** Timeout or malformed JSON triggers retry once; otherwise fail with structured error

#### Stage 12: Post-Generation Validation
- **Input:** Draft answer/report
- **Processing:** Validate JSON schema, citation IDs, unsupported claims, section completeness, and evidence sufficiency
- **Output:** Final API payload or persisted report sections
- **File(s):** `server/src/services/rag/validation.service.js`
- **Failure mode:** Invalid generation is rejected and retried once; on repeated failure, return error or degraded partial output

### 4.4 Flow Diagram

1. User opens portfolio page.
2. React requests portfolio snapshot from Express API.
3. Express queries Aurora snapshot tables and returns grouped portfolio cards.
4. User opens product page.
5. React requests product overview from Express.
6. Express returns product metadata, health, narrative summary, recent signals, permissions.
7. User asks a question.
8. Express authorizes access, creates request trace ID, and passes request to Ask orchestration.
9. Orchestrator runs structured retrieval against Aurora and unstructured retrieval against Bedrock Knowledge Base (AOSS-backed).
10. Orchestrator deduplicates and packs evidence.
11. Nova Pro generates answer based only on evidence pack.
12. Validator checks JSON shape and citation IDs.
13. Express returns answer, evidence list, evidence strength, and warning state.
14. User generates report.
15. Express creates report job and enqueues work on SQS.
16. Worker executes retrieval, coverage scoring, Nova Pro section drafting, validation, persistence.
17. React polls job status and then loads persisted report.
18. Export jobs produce artifacts from persisted report content and return download state.

---

## 5. Parity Matrix (Migration/Port Tasks Only)

**Not applicable.** This is a greenfield implementation.

---

## 6. Interface Design Requirements

### 6.1 Screen/View Inventory

**View 1: Global App Shell**
- **Purpose:** Persistent brand, search, and user identity frame
- **Key Information Displayed:** EIDS logo, Product Knowledge Hub title, global search, user avatar/name
- **Primary Actions:** Search, open result, dismiss search palette
- **Navigation:** Always visible on authenticated routes
- **Data Source:** `GET /api/v1/session`, `GET /api/v1/search`

**View 2: Portfolio Landing**
- **Purpose:** Portfolio triage
- **Key Information Displayed:** Pulse metrics, alerts, `Needs Attention`, `On Track`, product cards, quick views
- **Primary Actions:** Open product, open quick view
- **Navigation:** `/portfolio`
- **Data Source:** `GET /api/v1/portfolio`, `GET /api/v1/portfolio/quick-view`

**View 3: Quick View Drawer**
- **Purpose:** Cross-product slices such as All Risks, All Blockers, Data Gaps, Weekly Brief Prep
- **Key Information Displayed:** Cross-product list and counts
- **Primary Actions:** Open product from result
- **Navigation:** Opens over `/portfolio`
- **Data Source:** `GET /api/v1/portfolio/quick-view?type=...`

**View 4: Product Shell**
- **Purpose:** Product identity and navigation container
- **Key Information Displayed:** Back link, product title, status, PM, PI/Sprint, last sync, tab strip
- **Primary Actions:** Switch tabs, back navigation
- **Navigation:** `/products/:id`
- **Data Source:** `GET /api/v1/products/:id`

**View 5: Overview Tab**
- **Purpose:** Fastest product understanding
- **Key Information Displayed:** Knowledge Health, narrative current state, recent signals, Ask panel
- **Primary Actions:** Upload Transcript, Update Weekly, Ask, jump to Timeline
- **Navigation:** Default product tab
- **Data Source:** `GET /api/v1/products/:id`

**View 6: Upload Transcript Modal**
- **Purpose:** Add transcript evidence and close gaps
- **Key Information Displayed:** Meeting title, date, participants, file input, helper text
- **Primary Actions:** Upload, Cancel
- **Navigation:** Modal from Overview
- **Data Source:** `POST /api/v1/products/:id/transcripts`

**View 7: Update Weekly Modal**
- **Purpose:** Publish weekly narrative update
- **Key Information Displayed:** Week ending, summary, accomplishments, risks, next steps
- **Primary Actions:** Publish Update, Cancel
- **Navigation:** Modal from Overview
- **Data Source:** `POST /api/v1/products/:id/weekly-updates`

**View 8: Timeline Tab**
- **Purpose:** Chronological evidence and decisions
- **Key Information Displayed:** Coverage strip, filter chips, grouped entries, source links
- **Primary Actions:** Filter, expand, open source
- **Navigation:** Tab route
- **Data Source:** `GET /api/v1/products/:id/timeline`

**View 9: Data Tab**
- **Purpose:** Structured tracker review
- **Key Information Displayed:** Risks/Blockers/PI Objectives tabs, tables, detail panels
- **Primary Actions:** Change dataset, expand row
- **Navigation:** Tab route
- **Data Source:** `GET /api/v1/products/:id/data`

**View 10: Sources Tab**
- **Purpose:** Source inventory and provenance
- **Key Information Displayed:** Source filters, source list, metadata, open link
- **Primary Actions:** Filter, open source detail
- **Navigation:** Tab route
- **Data Source:** `GET /api/v1/products/:id/sources`, `GET /api/v1/products/:id/sources/:sourceId`

**View 11: Reports Tab**
- **Purpose:** Generate, review, edit, and export reports
- **Key Information Displayed:** Report config, loading state, coverage card, report sections, export bar
- **Primary Actions:** Generate Report, edit section, export
- **Navigation:** Tab route
- **Data Source:** `POST /api/v1/products/:id/reports`, `GET /api/v1/products/:id/reports/:reportId`, `PATCH /api/v1/products/:id/reports/:reportId/sections/:sectionId`, `POST /api/v1/products/:id/reports/:reportId/exports`

**View 12: Unsupported Viewport**
- **Purpose:** Prevent broken mobile/phone experiences in V1
- **Key Information Displayed:** Desktop-required message
- **Primary Actions:** None
- **Navigation:** Replaces app content below 1024px
- **Data Source:** None

### 6.2 Information Architecture

- **Primary:** Product health, current-state narrative, Ask answer, generated reports
- **Secondary:** Timeline evidence, structured trackers, source inventory
- **Tertiary:** Search, quick views, user identity, edit/export affordances

**Navigation model**
- App shell top navigation
- Portfolio → Product drill-in
- Product tab strip
- Progressive disclosure inside timeline rows and data rows
- Modals for mutating authoring actions

### 6.3 Layout & Responsive Requirements

- **Desktop (>= 1280px)**
  - Portfolio: 3-column product grid
  - Product Overview: 3-column layout (left knowledge, center narrative/signals, right Ask)
  - Reports: vertical stack with config above output

- **Compact Desktop / Tablet Landscape (1024px–1279px)**
  - Portfolio: 2-column grid
  - Product Overview: vertical stack in order Current State → Knowledge Health → Ask
  - Tabs remain horizontal and scrollable

- **Mobile (< 1024px)**
  - Unsupported in V1
  - Render explicit unsupported state only

- **Breakpoints**
  - 1440px
  - 1280px
  - 1024px
  - <1024px unsupported

---

## 7. Interaction & Visual Design Specifications

### 7.1 Core Interactions

**Interaction 1: Product Card Open**
- **Trigger:** Click / Enter / Space
- **Feedback:** Card elevation + focus ring
- **Result:** Route to product Overview
- **Animation/Transition:** 200ms hover elevation, instant route swap

**Interaction 2: Ask Submission**
- **Trigger:** Click Ask or press Enter
- **Feedback:** Inline loading in Ask panel
- **Result:** Answer renders with evidence and coverage state
- **Animation/Transition:** 200ms fade-in for answer block

**Interaction 3: Timeline Entry Expand**
- **Trigger:** Click row header
- **Feedback:** Chevron rotates, row detail expands
- **Result:** Description and source link visible
- **Animation/Transition:** 150–200ms

**Interaction 4: Generate Report**
- **Trigger:** Click Generate Report
- **Feedback:** Output area loading state
- **Result:** Polling and eventual report display
- **Animation/Transition:** Section stagger animations only when reduced motion is off

**Interaction 5: Edit Report Section**
- **Trigger:** Click Edit on a section
- **Feedback:** Section switches to edit state with Save/Cancel
- **Result:** Edited section persists after successful save
- **Animation/Transition:** 150ms state transition

**Interaction 6: Quick View Open**
- **Trigger:** Click quick view button
- **Feedback:** Drawer slides in from the right
- **Result:** Cross-product list appears
- **Animation/Transition:** 180ms slide/fade

### 7.2 Input Methods & Controls

- Text inputs: global search, Ask prompt
- Select controls: report type, report period
- File input: transcript upload
- Textareas: weekly update fields, report section editing
- Validation:
  - client-side on blur and submit
  - server-side on every mutating call
- Required fields are marked with `*`
- Client-side validation blocks obviously invalid submissions
- Server-side validation remains authoritative

### 7.3 Feedback & Confirmation Patterns

- Skeletons for first-load page content over 300ms
- Inline panel loaders for Ask and Reports
- Toast/inline success messages for upload, publish, save, export
- Scoped inline errors; never crash the whole page for panel failures
- Explicit empty states for Timeline/Data/Sources/Reports

### 7.4 Micro-interactions

- Hover elevation on cards and source items
- Accent-color focus rings on all controls
- Filter chips invert when active
- Disabled buttons remain visible but non-interactive and semantically explained where needed

### 7.5 Design System & Component Usage

**Assumed design system:** Custom CSS tokens and React components derived from the supplied mockup.

**Core reusable components**
- `Button`
- `Badge`
- `Card`
- `HealthRing`
- `ProgressBar`
- `TabStrip`
- `FilterChipGroup`
- `DataTable`
- `Drawer`
- `Modal`
- `InlineAlert`
- `Toast`
- `EmptyState`
- `ErrorState`
- `LoadingState`

**New components**
- `AskPanel`
- `EvidenceList`
- `QuickViewDrawer`
- `EditableReportSection`
- `UnsupportedViewport`

### 7.6 Typography Hierarchy

- Display headings: `Newsreader`, semibold
- Body and UI controls: `Outfit`
- H1 ~ 1.85rem
- H2 ~ 1.4rem
- H3 ~ 1.15rem
- Body ~ 0.84–0.9rem
- Metadata ~ 0.72–0.82rem

### 7.7 Color & Visual Semantics

Use the HTML mockup palette:
- Page background: `#edf1f7`
- Card background: `#ffffff`
- Accent: `#1a5ca0`
- Accent hover: `#13477d`
- Nav gradient: `#0a1628` → `#122244`
- Success family: green tokens
- Warning family: amber tokens
- Error family: red tokens
- Decision/transcript family: purple tokens
- Document family: cyan tokens

Contrast target: WCAG 2.1 AA

### 7.8 Iconography & Visual Assets

- Search, upload, export, edit, warning, success, error, email, transcript, document, timeline entry, expand/collapse, user avatar placeholder
- No decorative illustration is required in V1
- Health ring and progress bars are the only core data visualizations

### 7.9 Spacing & Layout Grid

- Spacing scale: 4, 8, 10, 12, 14, 16, 20, 24, 28, 32, 48
- Card padding: 20–24px
- Grid gutters: 20px
- Comfortable but dense enterprise layout; avoid over-fragmentation

---

## 8. Content & Copywriting Requirements

### 8.1 Content Strategy

- **Tone & Voice:** Professional, direct, evidence-first, non-hype
- **Content Principles:** Clear, concise, honest about uncertainty, oriented toward action

### 8.2 Required Copy Elements

**Headings & Titles**
- `My Portfolio`
- `Needs Attention`
- `On Track`
- `Knowledge Health`
- `Current State`
- `Ask About {Product}`
- `Reports`

**Instructional Text**
- Ask placeholder: `Ask a question…`
- Report empty state: `Select a report type and period, then click Generate Report.`
- Unsupported viewport: `Desktop view required`

**Action Labels**
- `Ask`
- `Generate Report`
- `Upload Transcript`
- `Update Weekly`
- `Publish Update`
- `Save`
- `Cancel`
- `Retry`
- `Export PDF`
- `Export PPTX`
- `Copy to Clipboard`
- `Email Report`

**Feedback Messages**
- Success:
  - `Transcript uploaded`
  - `Weekly update published`
  - `Report section saved`
  - `PDF export started`
- Error:
  - `We couldn’t load this product. Try again.`
  - `We couldn’t answer that question right now. Try again.`
  - `We couldn’t generate the report. Try again.`
  - `Upload failed. Check the file and try again.`
- Warning:
  - `This answer may be incomplete because some evidence is missing or stale.`
  - `This report may be incomplete because evidence coverage is below 100%.`

### 8.3 Localization Considerations

- English only in V1
- Layout must tolerate 30% text expansion
- No RTL support in V1
- Use localized browser date formatting where safe, but store UTC internally

---

## 9. Accessibility Requirements

### 9.1 WCAG Compliance

- Target: WCAG 2.1 AA
- All text and interactive controls must meet AA contrast
- UI remains functional at 200% zoom on supported breakpoints

### 9.2 Keyboard Navigation

- All product cards, tabs, filters, rows, buttons, modals, and export actions must be reachable and visibly focused
- Arrow keys navigate tabs and chip groups
- `/` focuses global search
- `Esc` closes modal, drawer, or search palette
- Focus returns to trigger when modal closes

### 9.3 Screen Reader Support

- Semantic landmarks: `header`, `nav`, `main`, `section`, `dialog`
- ARIA tab semantics for product tabs
- Live region announcements for Ask completion, report completion, and validation errors
- Health ring must expose a textual equivalent
- Decorative icons are `aria-hidden`

### 9.4 Additional Accessibility

- Respect `prefers-reduced-motion`
- Maintain visibility in high-contrast mode
- Touch targets minimum 44x44px
- Every form field has a programmatically associated label and error message

---

## 10. States & Scenarios

### 10.1 All UI States

- **Initial/Default:** Portfolio or product loads with no answer/report yet
- **Loading:** Skeletons or inline loaders in the active panel
- **Empty:** No matching products/signals/sources/timeline/data/report yet
- **Populated:** Content is fully available
- **Error:** Panel-scoped or page-scoped error with Retry
- **Success:** Mutating action completed
- **Partial:** Result exists but evidence or sync coverage is incomplete
- **Disabled:** Action unavailable because role, validation, or unsupported viewport

### 10.2 Permission & Role-Based Views

- **Portfolio Lead/Admin**
  - View all products
  - Ask, generate/export reports
  - Edit reports
  - Upload transcripts
  - Publish weekly updates

- **Product Manager/Editor**
  - View assigned products
  - Ask, generate/export reports
  - Edit reports for assigned products
  - Upload transcripts
  - Publish weekly updates

- **Leadership / Read-only**
  - View products in scope
  - Ask
  - Generate/export reports
  - No edit/upload/publish controls

- **Guest/Unauthenticated**
  - Redirect to login/session-expired state

---

## 11. Backend Module Design

### 11.1 Module Inventory

**Module 1: Web API**
- **File(s):** `server/src/app.js`, `server/src/routes/*.routes.js`
- **Responsibility:** Express HTTP API, middleware, routing, response shaping
- **Inputs:** HTTP requests
- **Outputs:** JSON responses
- **Dependencies:** Auth middleware, service layer, logger
- **Error handling:** Centralized error middleware returns structured error contract
- **Configuration:** Port, CORS disabled because same-origin, body size limits

**Module 2: Auth & Authorization Middleware**
- **File(s):** `server/src/middleware/auth.js`, `server/src/services/security/authorization.service.js`
- **Responsibility:** Validate identity claims and enforce product-scoped roles
- **Inputs:** Request headers / identity context
- **Outputs:** `req.user`, permission decisions
- **Dependencies:** Role mapping tables or claims config
- **Error handling:** 401/403 responses with audit log
- **Configuration:** IdP issuer/audience, role-claim mapping

**Module 3: Portfolio Read Service**
- **File(s):** `server/src/services/read/portfolio.service.js`
- **Responsibility:** Serve grouped product cards and top-level metrics
- **Inputs:** User scope
- **Outputs:** Portfolio response DTO
- **Dependencies:** Aurora read pool, snapshot tables
- **Error handling:** 500 with retryable error
- **Configuration:** Snapshot freshness threshold

**Module 4: Product Read Service**
- **File(s):** `server/src/services/read/product.service.js`
- **Responsibility:** Serve product shell, overview, timeline, data, sources
- **Inputs:** Product ID, filters, user scope
- **Outputs:** Product/tab DTOs
- **Dependencies:** Aurora
- **Error handling:** 404/403/500
- **Configuration:** Timeline page size, default sort

**Module 5: Search Service**
- **File(s):** `server/src/services/read/search.service.js`
- **Responsibility:** Search products and sources by title/metadata
- **Inputs:** Query string, user scope
- **Outputs:** Grouped search results
- **Dependencies:** Aurora FTS/trigram indexes
- **Error handling:** Empty results, 500 on query failure
- **Configuration:** min query length, result cap

**Module 6: Ask Orchestration Service**
- **File(s):** `server/src/services/rag/askOrchestrator.service.js`
- **Responsibility:** Coordinate retrieval, evidence ranking, Nova generation, and validation
- **Inputs:** Product ID, user question, user scope
- **Outputs:** Ask response DTO
- **Dependencies:** Query planner, structured retrieval, KB retrieval, generation, validation
- **Error handling:** Partial or error response depending on failure stage
- **Configuration:** top-K, timeout budget, evidence thresholds

**Module 7: Query Planner**
- **File(s):** `server/src/services/rag/queryPlanner.service.js`
- **Responsibility:** Determine retrieval strategy by intent and question type
- **Inputs:** Question, product context
- **Outputs:** Retrieval plan
- **Dependencies:** Heuristics, optional lightweight model classification
- **Error handling:** Falls back to generic plan
- **Configuration:** intent taxonomy, date-window defaults

**Module 8: Structured Retrieval Service**
- **File(s):** `server/src/services/rag/structuredRetrieval.service.js`
- **Responsibility:** Query risks, blockers, decisions, action items, weeklys, ADO snapshots, and health rows
- **Inputs:** Retrieval plan
- **Outputs:** Structured evidence pack
- **Dependencies:** Aurora queries
- **Error handling:** degrade to partial on failure
- **Configuration:** per-intent structured retrieval limits

**Module 9: Knowledge Base Retrieval Service**
- **File(s):** `server/src/services/rag/kbRetrieve.service.js`
- **Responsibility:** Call Bedrock Knowledge Base `Retrieve` with filters
- **Inputs:** Retrieval plan, metadata filters
- **Outputs:** Unstructured retrieval candidates
- **Dependencies:** AWS SDK Bedrock Agent Runtime
- **Error handling:** retry once on throttling/timeout, otherwise degrade/fail
- **Configuration:** Knowledge Base ID, result count, hybrid-search preference

**Module 10: Evidence Packing Service**
- **File(s):** `server/src/services/rag/evidencePack.service.js`
- **Responsibility:** Merge structured and unstructured evidence, dedupe, rank, cap, and format prompt input
- **Inputs:** Structured data, KB candidates
- **Outputs:** Evidence pack + coverage assessment
- **Dependencies:** ranking helpers
- **Error handling:** return `insufficientEvidence` if thresholds fail
- **Configuration:** source diversity cap, per-source chunk cap, score weights

**Module 11: Generation Service**
- **File(s):** `server/src/services/rag/generation.service.js`
- **Responsibility:** Invoke Nova Pro for answers and report section drafting
- **Inputs:** Prompt template, evidence pack
- **Outputs:** Generated JSON
- **Dependencies:** AWS SDK Bedrock Runtime
- **Error handling:** timeout handling, malformed JSON retry
- **Configuration:** model ID, token limit, temperature, max retries

**Module 12: Validation Service**
- **File(s):** `server/src/services/rag/validation.service.js`
- **Responsibility:** Enforce schema validity, citation validity, unsupported-claim checks, and state classification
- **Inputs:** Generated JSON + evidence pack
- **Outputs:** Validated payload or failure
- **Dependencies:** JSON schema validators
- **Error handling:** reject and retry or downgrade
- **Configuration:** validation strictness level

**Module 13: Report Orchestration Service**
- **File(s):** `server/src/services/reports/reportOrchestrator.service.js`
- **Responsibility:** Create report jobs, coordinate retrieval, section generation, persistence, and export
- **Inputs:** Product ID, report type, period, actor
- **Outputs:** report/run records and export artifacts
- **Dependencies:** SQS, worker service, generation service, export service
- **Error handling:** async job failure and retries
- **Configuration:** section templates, time windows, coverage matrix

**Module 14: Export Service**
- **File(s):** `server/src/services/reports/export.service.js`
- **Responsibility:** Produce PDF, PPTX, clipboard payload, and email payloads
- **Inputs:** Persisted report content
- **Outputs:** S3 artifact or payload
- **Dependencies:** HTML renderer, Playwright/Puppeteer or equivalent for PDF, `pptxgenjs` for PPTX
- **Error handling:** export-specific failure records
- **Configuration:** artifact bucket, retention policy

**Module 15: Ingest Intake API**
- **File(s):** `server/src/routes/ingest.routes.js`, `server/src/services/ingest/sourceIntake.service.js`
- **Responsibility:** Accept transcript uploads and admin/import requests
- **Inputs:** Multipart upload or metadata payload
- **Outputs:** Source records and ingest jobs
- **Dependencies:** S3, queue, DB
- **Error handling:** field errors, oversize, unsupported type
- **Configuration:** max upload size, allowed MIME list

**Module 16: Normalization Services**
- **File(s):** `server/src/services/ingest/normalize/documentNormalizer.js`, `emailNormalizer.js`, `transcriptNormalizer.js`, `structuredImportNormalizer.js`
- **Responsibility:** Convert raw payloads into canonical text and metadata
- **Inputs:** raw S3 objects or connector payloads
- **Outputs:** normalized text, metadata, derived entities
- **Dependencies:** file parsing libs, Textract for OCR fallback
- **Error handling:** partial ingest states
- **Configuration:** parser selection rules, OCR confidence threshold

**Module 17: Chunking Service**
- **File(s):** `server/src/services/rag/chunking.service.js`
- **Responsibility:** Deterministically split normalized content into chunk files for KB sync
- **Inputs:** normalized text + metadata
- **Outputs:** chunk files + sidecars in S3
- **Dependencies:** tokenizer helpers
- **Error handling:** no chunk creation -> source not indexed
- **Configuration:** chunk size, overlap, chunking strategy by source type

**Module 18: KB Sync Service**
- **File(s):** `server/src/services/rag/kbSync.service.js`
- **Responsibility:** Trigger and monitor Bedrock KB sync runs
- **Inputs:** source/chunk object list
- **Outputs:** sync status
- **Dependencies:** Bedrock Agent build-time APIs
- **Error handling:** retryable sync failures
- **Configuration:** KB data source ID, polling interval

**Module 19: Health Scoring Service**
- **File(s):** `server/src/services/health/healthScoring.service.js`
- **Responsibility:** Compute coverage, freshness, continuity, sync, and overall score
- **Inputs:** products, sources, sync runs, weekly updates, transcript presence
- **Outputs:** `product_snapshot` health fields
- **Dependencies:** Aurora
- **Error handling:** stale snapshot warning if recompute fails
- **Configuration:** scoring weights and freshness windows

**Module 20: Snapshot Service**
- **File(s):** `server/src/services/snapshots/productSnapshot.service.js`, `portfolioSnapshot.service.js`
- **Responsibility:** Build fast-read denormalized rows for UI
- **Inputs:** source state, structured entities
- **Outputs:** snapshot rows
- **Dependencies:** Aurora
- **Error handling:** retain previous snapshot on failure
- **Configuration:** recompute triggers, batch schedule

**Module 21: Connector Scheduler**
- **File(s):** `server/src/workers/scheduler.worker.js`
- **Responsibility:** Schedule mailbox and ADO sync jobs
- **Inputs:** connector profiles
- **Outputs:** queued sync jobs
- **Dependencies:** EventBridge or cron runner, SQS
- **Error handling:** connector run failure tracking
- **Configuration:** cron schedules

**Module 22: Mailbox Connector**
- **File(s):** `server/src/services/connectors/mailboxConnector.service.js`
- **Responsibility:** Poll approved product mailboxes/shared mailboxes and ingest new messages
- **Inputs:** mailbox profile and last sync cursor
- **Outputs:** email source records and attachment jobs
- **Dependencies:** Microsoft Graph or approved mailbox API, Secrets Manager
- **Error handling:** cursor-safe retry, duplicate suppression
- **Configuration:** polling cadence, mailbox scopes, sender/recipient allowlists

**Module 23: ADO Connector**
- **File(s):** `server/src/services/connectors/adoConnector.service.js`
- **Responsibility:** Sync work items, sprint metadata, PR/build status, comments, and PI data
- **Inputs:** connector profile, project/team/sprint config
- **Outputs:** structured tables and timeline events
- **Dependencies:** Azure DevOps REST APIs
- **Error handling:** partial sync status and watermark resume
- **Configuration:** project list, incremental sync watermark

**Module 24: ADO MCP Enrichment Adapter**
- **File(s):** `server/src/services/connectors/adoMcpAdapter.service.js`
- **Responsibility:** Optional ad hoc enrichment using a local Azure DevOps MCP server
- **Inputs:** structured query or prompt template
- **Outputs:** normalized enrichment payload
- **Dependencies:** local MCP server process or internal MCP gateway
- **Error handling:** non-blocking; REST sync remains canonical
- **Configuration:** feature flag, MCP endpoint, time budget

**Module 25: Telemetry & Audit Service**
- **File(s):** `server/src/services/telemetry/telemetry.service.js`
- **Responsibility:** Receive frontend telemetry, write structured logs/metrics, persist audit events
- **Inputs:** UI event payloads, backend lifecycle events
- **Outputs:** CloudWatch metrics/logs, audit DB rows
- **Dependencies:** CloudWatch Logs/EMF, Aurora audit tables
- **Error handling:** telemetry failure must never block user action
- **Configuration:** sampling rates, event allowlist

### 11.2 New Dependencies

| Dependency | Version/Service | Purpose | Risk/Concern |
| :--- | :--- | :--- | :--- |
| React | 18.x | Frontend SPA | Standard maintenance |
| Vite | 5.x | Frontend build/dev | Standard maintenance |
| React Router | 6.x | Client-side routing | Standard maintenance |
| TanStack Query | 5.x | Server-state fetching/caching | Adds mental model but worth it |
| React Hook Form | 7.x | Modal/report form handling | Standard maintenance |
| Zod or AJV | current stable | Runtime validation of payloads/contracts | Choose one and standardize |
| Express | 5.x | HTTP API | Standard maintenance |
| `pg` | current stable | Aurora PostgreSQL access | Connection pooling needed |
| AWS SDK v3 | current stable | S3, Bedrock, SQS, Textract, Secrets | Standard AWS dependency |
| Playwright | current stable | E2E automation and optional PDF rendering | Chromium runtime weight |
| `pptxgenjs` | current stable | PPTX export | Validate formatting fidelity |
| `mammoth` | current stable | DOCX to text | Formatting loss acceptable |
| `mailparser` | current stable | Email parsing | Attachment edge cases |
| `pdf-parse` or equivalent | current stable | Text-native PDF parsing | Scanned PDFs need OCR fallback |
| Amazon S3 | managed | Raw/normalized files, exports | Lifecycle/retention management |
| Amazon Aurora PostgreSQL | managed | Structured product metadata | Cost and schema discipline |
| Amazon OpenSearch Serverless | managed | Vector store for Knowledge Base | OCU cost management |
| Amazon Bedrock Knowledge Bases | managed | Retrieval over indexed unstructured corpus | Sync latency, metadata discipline |
| Amazon Titan Text Embeddings V2 | managed | Embeddings for KB | Fixed model dependency |
| Amazon Nova Pro v1 | managed | Answer/report generation | Latency and cost |
| Amazon SQS | managed | Async jobs | Poison message handling |
| Amazon Textract | managed | OCR fallback for scanned docs | Per-page cost |
| AWS CloudWatch | managed | Logs/metrics/alarms | Log volume costs |
| Azure DevOps MCP | optional external | Optional enrichment adapter | Preview/operational complexity if remote |

### 11.3 Removed/Deprecated Code

| File/Module | What's Removed | Reason | Migration Path |
| :--- | :--- | :--- | :--- |
| N/A | None | Greenfield | N/A |

---

## 12. Data Model & Storage

### 12.1 Schema Changes

This is a greenfield schema.

**Table: `products`**
- `product_id` UUID PK
- `slug` text unique not null
- `name` text not null
- `line_name` text null
- `pm_display_name` text null
- `org_box_email` text null
- `current_pi` integer null
- `current_sprint` integer null
- `is_active` boolean default true
- Indexes: `slug`, `is_active`

**Table: `principal_product_roles`**
- `principal_sub` text not null
- `product_id` UUID FK
- `role` text check in (`lead`, `editor`, `read`)
- composite unique `(principal_sub, product_id)`

**Table: `source_records`**
- `source_id` UUID PK
- `product_id` UUID FK
- `source_type` text check in (`document`, `email`, `transcript`, `weekly`, `ado`, `risk`, `blocker`, `pi-objective`, `report`, `attachment`)
- `source_subtype` text null
- `title` text not null
- `source_date` timestamptz null
- `author` text null
- `participants_json` jsonb default `[]`
- `thread_id` text null
- `external_ref` text null
- `raw_s3_key` text not null
- `normalized_s3_key` text null
- `mime_type` text null
- `ingest_status` text check in (`pending`, `processing`, `completed`, `partial`, `failed`)
- `indexed` boolean default false
- `sensitivity` text default `internal`
- `metadata_json` jsonb default `{}`
- `created_at`, `updated_at`
- Indexes: `product_id`, `source_type`, `source_date desc`, `thread_id`, `indexed`

**Table: `source_chunks`**
- `chunk_id` UUID PK
- `source_id` UUID FK
- `product_id` UUID FK
- `chunk_index` integer not null
- `chunk_s3_key` text not null
- `token_count` integer
- `page_start` integer null
- `page_end` integer null
- `section_heading` text null
- `metadata_json` jsonb default `{}`
- `created_at`
- Unique `(source_id, chunk_index)`
- Indexes: `product_id`, `source_id`

**Table: `timeline_events`**
- `event_id` UUID PK
- `product_id` UUID FK
- `source_id` UUID FK null
- `event_type` text
- `event_at` timestamptz not null
- `title` text not null
- `detail` text
- `severity` text null
- `derived` boolean default false
- `metadata_json` jsonb default `{}`
- Indexes: `(product_id, event_at desc)`, `event_type`

**Table: `decisions`**
- `decision_id` UUID PK
- `product_id` UUID FK
- `source_id` UUID FK
- `decision_at` timestamptz null
- `decision_text` text not null
- `owner` text null
- `due_at` timestamptz null
- `confidence` numeric(5,4) not null
- `status` text default `open`

**Table: `action_items`**
- `action_item_id` UUID PK
- `product_id` UUID FK
- `source_id` UUID FK
- `action_text` text not null
- `owner` text null
- `due_at` timestamptz null
- `status` text default `open`
- `confidence` numeric(5,4)

**Table: `risks`**
- `risk_key` text PK
- `product_id` UUID FK
- `title` text
- `severity` text
- `status` text
- `owner` text
- `description` text
- `mitigation` text
- `last_changed_at` timestamptz
- `source_id` UUID FK null

**Table: `blockers`**
- `blocker_key` text PK
- `product_id` UUID FK
- `title`, `severity`, `status`, `owner`, `description`, `mitigation`
- `last_changed_at` timestamptz
- `source_id` UUID FK null

**Table: `pi_objectives`**
- `objective_key` text PK
- `product_id` UUID FK
- `title` text
- `status` text
- `progress_pct` integer check between 0 and 100
- `period_label` text
- `last_changed_at` timestamptz

**Table: `weekly_updates`**
- `weekly_update_id` UUID PK
- `product_id` UUID FK
- `week_ending` date not null
- `summary` text not null
- `accomplishments` text not null
- `risks_text` text null
- `next_steps` text not null
- `author_sub` text
- `source_id` UUID FK null
- Unique `(product_id, week_ending)`

**Table: `product_snapshots`**
- `product_id` UUID PK
- `overall_health` integer 0-100
- `coverage_score` integer 0-100
- `freshness_score` integer 0-100
- `continuity_score` integer 0-100
- `sync_score` integer 0-100
- `status_band` text check in (`healthy`, `caution`, `risk`)
- `biggest_gap` text null
- `narrative_html` text null
- `snapshot_json` jsonb default `{}`
- `updated_at` timestamptz not null

**Table: `portfolio_snapshots`**
- `snapshot_id` UUID PK
- `summary_json` jsonb not null
- `alerts_json` jsonb not null
- `generated_at` timestamptz not null
- only latest row is read by default

**Table: `connector_profiles`**
- `connector_profile_id` UUID PK
- `connector_type` text check in (`mailbox`, `ado-rest`, `ado-mcp`)
- `product_id` UUID FK null
- `config_json` jsonb not null
- `enabled` boolean default true
- `last_cursor` text null
- `last_run_at` timestamptz null

**Table: `sync_runs`**
- `sync_run_id` UUID PK
- `connector_profile_id` UUID FK
- `status` text check in (`queued`, `running`, `completed`, `partial`, `failed`)
- `started_at`, `ended_at`
- `metrics_json` jsonb default `{}`
- `error_code` text null
- `error_message` text null

**Table: `ingest_jobs`**
- `job_id` UUID PK
- `job_type` text check in (`ingest`, `kb-sync`, `report`, `export`, `connector-sync`)
- `product_id` UUID FK null
- `source_id` UUID FK null
- `status` text check in (`queued`, `running`, `completed`, `partial`, `failed`)
- `payload_json` jsonb
- `result_json` jsonb
- `error_code` text null
- `error_message` text null
- `started_at`, `ended_at`, `created_at`

**Table: `report_runs`**
- `report_id` UUID PK
- `product_id` UUID FK
- `report_type` text check in (`weekly`, `sprint`, `pi`)
- `period_start` date
- `period_end` date
- `status` text check in (`pending`, `running`, `completed`, `failed`)
- `coverage_pct` integer 0-100
- `coverage_json` jsonb
- `warning_text` text null
- `generated_by_sub` text
- `created_at`, `updated_at`

**Table: `report_sections`**
- `report_section_id` UUID PK
- `report_id` UUID FK
- `section_key` text
- `title` text
- `body_generated` text
- `body_current` text
- `edited_by_sub` text null
- `edited_at` timestamptz null
- `source_refs_json` jsonb default `[]`
- Unique `(report_id, section_key)`

**Table: `audit_events`**
- `audit_event_id` UUID PK
- `actor_sub` text
- `product_id` UUID FK null
- `action` text
- `target_type` text
- `target_id` text
- `payload_json` jsonb
- `occurred_at` timestamptz

### 12.2 Data Contracts

**Contract: `SourceRecord`**
```json
{
  "sourceId": "uuid",
  "productId": "uuid",
  "sourceType": "document|email|transcript|weekly|ado|risk|blocker|pi-objective|attachment",
  "sourceSubtype": "string|null",
  "title": "string",
  "sourceDate": "ISO-8601|null",
  "author": "string|null",
  "participants": ["string"],
  "threadId": "string|null",
  "externalRef": "string|null",
  "rawS3Key": "string",
  "normalizedS3Key": "string|null",
  "mimeType": "string|null",
  "ingestStatus": "pending|processing|completed|partial|failed",
  "indexed": true,
  "metadata": {}
}
```

**Contract: `ChunkDescriptor`**
```json
{
  "chunkId": "uuid",
  "sourceId": "uuid",
  "productId": "uuid",
  "chunkIndex": 0,
  "chunkS3Key": "kb/prod/dental/transcript/src-1/chunk-0000.md",
  "tokenCount": 784,
  "pageStart": 4,
  "pageEnd": 5,
  "sectionHeading": "Decisions",
  "metadata": {
    "productId": "dental",
    "sourceType": "transcript",
    "sourceDate": "2026-04-09",
    "threadId": null,
    "author": "Jaden",
    "participants": ["Dr. Sohl", "Lowry"],
    "sectionHeading": "Decisions",
    "evidenceKind": "meeting",
    "sensitivity": "internal"
  }
}
```

**Contract: `StructuredEvidenceItem`**
```json
{
  "kind": "risk|blocker|weekly|pi-objective|decision|action-item|snapshot",
  "id": "string",
  "title": "string",
  "detail": "string",
  "status": "string|null",
  "severity": "string|null",
  "effectiveAt": "ISO-8601|null",
  "sourceId": "uuid|null",
  "displayMeta": {}
}
```

**Contract: `KbEvidenceItem`**
```json
{
  "sourceId": "uuid",
  "chunkId": "uuid",
  "title": "string",
  "snippet": "string",
  "score": 0.0,
  "metadata": {
    "productId": "dental",
    "sourceType": "email",
    "sourceDate": "2026-04-12",
    "sectionHeading": "Vendor confirmation"
  }
}
```

**Contract: `EvidencePack`**
```json
{
  "productId": "uuid",
  "questionIntent": "decision-history",
  "structured": ["StructuredEvidenceItem"],
  "unstructured": ["KbEvidenceItem"],
  "coverage": {
    "isPartial": true,
    "warnings": ["2 meetings in this sprint have no transcript ingested."]
  }
}
```

### 12.3 Storage Architecture

- **Primary structured store:** Amazon Aurora PostgreSQL  
  Used for products, permissions, source metadata, derived entities, timelines, health snapshots, reports, jobs, and audit records.

- **Primary unstructured object store:** Amazon S3  
  Used for raw uploads, normalized text artifacts, chunk files for Knowledge Base sync, exports, and diagnostic artifacts.

- **Vector store:** Amazon OpenSearch Serverless  
  Used by Amazon Bedrock Knowledge Bases to store/query vectorized chunk embeddings with hybrid retrieval support.

- **Managed retrieval layer:** Amazon Bedrock Knowledge Bases  
  Used for unstructured retrieval only. The app calls `Retrieve`, not `RetrieveAndGenerate`, for user-facing Ask/report workflows.

- **Queueing:** Amazon SQS  
  Used for ingest jobs, connector sync jobs, KB sync jobs, report jobs, export jobs.

- **Optional OCR path:** Amazon Textract  
  Used only when raw document text extraction is insufficient.

- **Data lifecycle**
  - Raw source files: 7 years default retention unless records policy requires longer
  - Normalized text/chunk files: 7 years default retention, versioned
  - Generated reports/export artifacts: 1 year, then Glacier or delete according to policy
  - CloudWatch detailed logs: 90 days hot, archived to S3 if required
  - Job records: 1 year
  - Snapshots: retain full history 1 year, latest record always hot


- **Consistency model**
  - Strong read-after-write for Aurora writes within the same request
  - Eventual consistency for S3-backed KB indexing and snapshots
  - UI must surface `pending indexing` / `stale snapshot` states when fresh content is not yet searchable

### 12.4 RAG & Content Processing Specification

#### 12.4.1 Retrieval Architecture Decisions

- Use **one Bedrock Knowledge Base per environment** (`dev`, `test`, `prod`) for unstructured content.
- Do **not** create one Knowledge Base per product in V1.
- Enforce product isolation at query time by having the backend inject mandatory Bedrock metadata filters:
  - `productId`
  - `environment`
  - optional `sourceType`
  - optional `sourceDate` ranges
  - optional `sensitivity`
- The backend must never accept client-supplied filters as authoritative for access control.
- The user-facing Ask and report workflows must call **Bedrock Knowledge Bases `Retrieve` only**. The backend then performs synthesis with Nova Pro. This keeps answer composition, citation structure, partial-result handling, and structured-data joins under application control.
- Cross-region inference is disabled in production. All model and retrieval calls stay in `us-gov-west-1`.

#### 12.4.2 Source Processing Rules by Source Type

**Documents**
1. Store the original file in S3 raw storage.
2. Detect file type by MIME and extension.
3. Extract text using the cheapest acceptable parser first.
4. If extracted character density or parser confidence is below threshold, route to Textract OCR fallback.
5. Normalize output to canonical Markdown-like text:
   - preserve headings
   - preserve bullet structure
   - preserve page numbers where known
   - flatten tables into readable TSV/Markdown table form
6. Create a `source_record`.
7. Emit timeline events only if the document type is reportable (for example security assessment upload, decision memo, architecture update).

**Emails**
1. Ingest either:
   - mailbox connector provider payload, or
   - manual `.eml`, `.msg`, or zipped export
2. Parse:
   - subject
   - sender
   - recipients
   - sent time
   - thread/conversation ID
   - message body
   - attachments
3. Convert HTML body to plain text.
4. Strip:
   - repetitive confidentiality footers
   - transport headers
   - duplicate quoted chains beyond the latest necessary reply context
   - known enterprise signature blocks where pattern matches are high confidence
5. Reconstruct thread relationships using provider `conversationId` when available; otherwise use normalized subject + participant/time heuristics.
6. Create one source record per message and one derived thread summary source record per thread/day when the thread has 2+ messages.
7. Process attachments as child sources linked back to the parent email.

**Meeting Transcripts**
1. Accept `.txt`, `.vtt`, `.docx`, `.pdf`, or normalized connector transcripts.
2. Parse speaker labels and timestamps when available.
3. Preserve transcript chronology in normalized text.
4. Segment transcript into windows using:
   - speaker turns
   - timestamp windows of approximately 2–5 minutes
   - topic changes inferred from headings or long pauses
5. Run extraction prompt to identify:
   - decisions
   - action items
   - stakeholders
   - due dates
   - unresolved items
6. Persist extracted artifacts with confidence scores.
7. Index both raw transcript chunks and an optional derived meeting summary.

**Weekly Updates**
1. Write structured weekly update row to Aurora.
2. Also create a normalized source artifact so the weekly narrative is searchable and citable.
3. Mark the weekly source type as `weekly` and include `weekEnding` metadata.

**Structured Imports (Risks, Blockers, PI Objectives, ADO)**
1. Validate shape against shared JSON Schema.
2. Upsert canonical relational rows.
3. Do not rely on vector retrieval for these records in V1.
4. These records participate in Ask/report generation through direct SQL retrieval.
5. If needed for source browseability, create light source records pointing back to the import batch.

#### 12.4.3 Chunking Rules

**Default chunking principles**
- Chunk by semantic boundary first, token budget second.
- Preserve product, source, date, page, and section metadata per chunk.
- Never mix two different source records in the same chunk.
- Never create chunks larger than the model-safe retrieval target.

**Chunk sizes**
- Documents: target **700–900 tokens**, overlap **80 tokens**
- Emails: target **300–600 tokens**, overlap **0–40 tokens**, one message body preferred over merged thread body
- Email thread summaries: target **400–700 tokens**, no overlap
- Transcripts: target **400–700 tokens**, overlap **50 tokens**, prefer speaker/topic boundaries
- Weekly updates: target **250–450 tokens**, no overlap

**Chunk boundary rules**
- Prefer heading boundaries for documents
- Prefer page boundaries for scanned/OCR documents
- Prefer message boundaries for emails
- Prefer speaker/time windows for transcripts
- Attachments become separate sources and separate chunk sets

**Chunk object layout**
- Raw normalized source:
  - `s3://<normalized-bucket>/normalized/<env>/<productId>/<sourceType>/<sourceId>/source.md`
- Chunk artifacts:
  - `s3://<normalized-bucket>/kb/<env>/<productId>/<sourceType>/<sourceId>/chunk-0001.md`
- Metadata sidecar:
  - `chunk-0001.md.metadata.json`
- Metadata sidecar contents must include:
  - `productId`
  - `sourceId`
  - `sourceType`
  - `sourceDate`
  - `title`
  - `author`
  - `participants`
  - `sectionHeading`
  - `pageStart`
  - `pageEnd`
  - `threadId`
  - `sensitivity`
  - `environment`

#### 12.4.4 Retrieval Algorithm

**Ask path**
1. Validate product access.
2. Build intent-driven retrieval plan.
3. Query Aurora for structured evidence first.
4. Call Knowledge Base `Retrieve` with:
   - `productId` required filter
   - optional `sourceType` filters
   - optional date window
   - top-K = `ASK_TOP_K`
5. Use hybrid retrieval behavior where supported by the KB vector store.
6. Deduplicate by `sourceId`.
7. Cap at **2 chunks per source** and **8 total sources** by default.
8. Compute composite ranking:
   - KB relevance score: **65%**
   - recency boost: **15%**
   - source-type match to intent: **10%**
   - source authority/derived-confidence: **10%**
9. If fewer than the minimum evidence threshold remain, broaden once:
   - widen date window
   - relax source-type narrowing
   - increase top-K up to hard cap
10. If still insufficient, return `422 INSUFFICIENT_EVIDENCE`.

**Report path**
1. Do not reuse the Ask endpoint.
2. Build a report-specific retrieval plan by period and section.
3. For each section:
   - query section-relevant structured data
   - retrieve section-relevant KB chunks
   - build section-local evidence pack
4. Generate each section independently to improve traceability and retry behavior.
5. Persist section output and source refs separately.

#### 12.4.5 Prompting and Validation Rules

**Answer generation**
- Nova Pro receives:
  - product context
  - user question
  - structured evidence pack
  - unstructured evidence pack
  - strict instruction: answer only from provided evidence
  - required JSON output shape
- The model must output:
  - `status`
  - `answerHtml`
  - `sourceIds`
  - `confidenceLabel`
  - `warnings[]`

**Report generation**
- Nova Pro receives:
  - report type
  - date range
  - section objective
  - section-local evidence
  - required JSON output shape
- The model must not invent:
  - dates
  - IDs
  - counts
  - owners
  - commitments
- If a required fact is absent, the model must say it is unavailable.

**Validation**
- Reject output if:
  - source IDs are missing or unknown
  - JSON is malformed
  - prohibited placeholders appear
  - unsupported claims are detected through evidence mismatch
- Retry once with a lower-temperature repair prompt.
- If repair fails:
  - Ask returns error or insufficient evidence
  - report section is marked failed and retried at job level

#### 12.4.6 Coverage and Partial-State Rules

**Ask completeness threshold**
A response is `complete` only when:
- at least 2 relevant sources are returned, and
- at least 1 source is from a preferred source type for the intent, and
- no critical freshness gap invalidates the answer context

Otherwise:
- `partial` when answerable but some critical evidence is stale or missing
- `insufficientEvidence` when the system should not produce a substantive answer

**Report coverage scoring**
Coverage percentage is computed from a weighted required-artifact matrix by report type.

**Weekly report required artifacts**
- weekly update
- risks
- blockers
- PI objectives
- ADO delta or latest sync
- at least one communication artifact (email or transcript)

**Sprint report required artifacts**
- sprint weeklys
- sprint transcript coverage
- risk/blocker changes
- ADO delivery summary
- decisions/action items

**PI report required artifacts**
- all sprint summaries in period
- PI objectives
- risk/blocker trend
- major decision artifacts
- stakeholder communication coverage
- exportable final narrative

If required artifacts are missing, coverage drops and warning text becomes mandatory in the UI.

#### 12.4.7 Why Azure DevOps MCP Is Optional, Not Primary

- The Azure DevOps MCP server is useful for contextual ad hoc access to work items, pull requests, pipelines, and documentation.
- For production sync, the application requires:
  - deterministic schemas
  - scheduled incremental sync
  - replayable watermarks
  - stable failure semantics
- The primary ADO path in V1 is direct REST ingestion into Aurora.
- The optional MCP adapter may be used to:
  - enrich operator/debug workflows
  - provide one-off context for report drafting
  - compare agent-style answers with canonical REST-synced data
- MCP enrichment must never be the only source of ADO truth for UI-visible product state.

---

## 13. Unified API Contract (Single Source of Truth)

### 13.1 Endpoint Inventory

| UI Action | Method | Path | Purpose | Latency Target |
| :--- | :--- | :--- | :--- | :--- |
| Load session shell | GET | `/api/v1/session` | Current user and role summary | P95 < 300 ms |
| Load portfolio | GET | `/api/v1/portfolio` | Portfolio landing data | P95 < 1200 ms |
| Load quick view | GET | `/api/v1/portfolio/quick-view` | Cross-product slice | P95 < 1200 ms |
| Global search | GET | `/api/v1/search` | Products and source title search | P95 < 700 ms |
| Load product shell/overview | GET | `/api/v1/products/:productId` | Product shell + overview | P95 < 1500 ms |
| Load timeline | GET | `/api/v1/products/:productId/timeline` | Timeline data | P95 < 1500 ms |
| Load structured data | GET | `/api/v1/products/:productId/data` | Risks/blockers/PI objectives | P95 < 1200 ms |
| Load sources | GET | `/api/v1/products/:productId/sources` | Source inventory | P95 < 1200 ms |
| Load source detail | GET | `/api/v1/products/:productId/sources/:sourceId` | Source detail | P95 < 900 ms |
| Ask question | POST | `/api/v1/products/:productId/ask` | Evidence-backed answer | P95 < 7000 ms |
| Upload transcript | POST | `/api/v1/products/:productId/transcripts` | Transcript ingest | kickoff < 800 ms |
| Publish weekly update | POST | `/api/v1/products/:productId/weekly-updates` | Weekly update write | P95 < 1000 ms |
| Start report generation | POST | `/api/v1/products/:productId/reports` | Create report job | < 500 ms |
| Load report | GET | `/api/v1/products/:productId/reports/:reportId` | Read generated report | P95 < 1000 ms |
| Save edited section | PATCH | `/api/v1/products/:productId/reports/:reportId/sections/:sectionId` | Persist report edits | P95 < 1000 ms |
| Start export | POST | `/api/v1/products/:productId/reports/:reportId/exports` | Generate export artifact | kickoff < 500 ms |
| Load job status | GET | `/api/v1/jobs/:jobId` | Poll long-running jobs | P95 < 500 ms |
| Emit telemetry | POST | `/api/v1/telemetry` | FE telemetry ingestion | P95 < 250 ms |
| Trigger mailbox sync (admin) | POST | `/api/v1/connectors/mailboxes/sync` | Manual connector run | < 500 ms |
| Trigger ADO sync (admin) | POST | `/api/v1/connectors/ado/sync` | Manual connector run | < 500 ms |

### 13.2 Request/Response Shapes

#### `GET /api/v1/session`
**Response 200**
```json
{
  "user": {
    "sub": "user-123",
    "displayName": "B. Jennings",
    "email": "bjennings@example.mil"
  },
  "roles": [
    { "productId": "dental", "role": "lead" },
    { "productId": "optima", "role": "read" }
  ]
}
```

#### `GET /api/v1/portfolio`
**Response 200**
```json
{
  "summary": {
    "productCount": 6,
    "averageHealth": 71,
    "overdueWeeklyCount": 2,
    "needsAttentionCount": 3,
    "belowFiftyCount": 1
  },
  "alerts": [
    { "id": "a1", "type": "warning", "text": "2 weekly updates are overdue" }
  ],
  "groups": {
    "needsAttention": [
      {
        "id": "dental",
        "name": "DENTAL / DENCLASS",
        "status": "risk",
        "statusLabel": "At Risk",
        "health": { "overall": 82, "coverage": 80, "freshness": 90, "continuity": 78, "sync": 92 },
        "counts": { "risks": 5, "blockers": 2 },
        "pm": "Jaden",
        "pi": 4,
        "sprint": 2,
        "stakeholders": ["Dr. Sohl", "Juan", "Lowry"],
        "highlights": [
          { "level": "warn", "text": "2 meetings missing transcripts" },
          { "level": "miss", "text": "Org box not connected" }
        ]
      }
    ],
    "onTrack": []
  }
}
```

#### `GET /api/v1/portfolio/quick-view?type=risks`
**Response 200**
```json
{
  "type": "risks",
  "title": "All Risks",
  "items": [
    {
      "productId": "dental",
      "productName": "DENTAL / DENCLASS",
      "itemId": "R-014",
      "title": "FHIR migration dependency",
      "severity": "high",
      "status": "open",
      "lastChangedAt": "2026-04-10T09:30:00Z"
    }
  ]
}
```

#### `GET /api/v1/search?q=den`
**Response 200**
```json
{
  "query": "den",
  "groups": [
    {
      "type": "products",
      "items": [
        {
          "id": "dental",
          "label": "DENTAL / DENCLASS",
          "route": "/products/dental?tab=overview"
        }
      ]
    },
    {
      "type": "sources",
      "items": [
        {
          "id": "src-1",
          "label": "Sprint 2 Review Transcript",
          "route": "/products/dental?tab=sources&sourceId=src-1",
          "productId": "dental"
        }
      ]
    }
  ]
}
```

#### `GET /api/v1/products/:productId`
**Response 200**
```json
{
  "product": {
    "id": "dental",
    "name": "DENTAL / DENCLASS",
    "status": "risk",
    "statusLabel": "At Risk",
    "meta": {
      "pi": 4,
      "sprint": 2,
      "pm": "Jaden",
      "lastSync": "2026-04-13T14:00:00Z"
    }
  },
  "permissions": {
    "canUploadTranscript": true,
    "canUpdateWeekly": true,
    "canEditReport": true,
    "canExportReport": true
  },
  "health": {
    "overall": 82,
    "coverage": 80,
    "freshness": 90,
    "continuity": 78,
    "sync": 92,
    "okItems": [
      { "id": "ok-1", "text": "Risks & Issues synced today" }
    ],
    "gapItems": [
      { "id": "gap-1", "level": "warn", "text": "2 meetings missing transcripts" }
    ],
    "biggestGap": "2 meetings this sprint have no transcript ingested."
  },
  "overview": {
    "narrativeHtml": "Dental is <strong>at risk</strong> in Sprint 2...",
    "recentSignals": [
      {
        "id": "sig-1",
        "dateLabel": "4/12",
        "type": "email",
        "title": "Jaden → Dr. Sohl: Updated FHIR test timeline"
      }
    ],
    "askSuggestions": [
      "What decisions were made this sprint?",
      "Summarize open risks and blockers"
    ]
  }
}
```

#### `GET /api/v1/products/:productId/timeline?filter=decision`
**Response 200**
```json
{
  "coverageStrip": [
    { "id": "c1", "status": "ok", "text": "Risks synced" },
    { "id": "c2", "status": "warn", "text": "2 transcripts missing" }
  ],
  "groups": [
    {
      "dateLabel": "April 13",
      "entries": [
        {
          "id": "evt-1",
          "type": "decision",
          "timeLabel": "2:30 PM",
          "title": "MVP scoped to single-product pilot (Dental)",
          "detail": "Innovation cell brainstorm agreed ...",
          "sourceRef": { "sourceId": "src-10", "label": "Meeting Transcript 4/13" }
        }
      ]
    }
  ]
}
```

#### `GET /api/v1/products/:productId/data?dataset=risks`
**Response 200**
```json
{
  "dataset": "risks",
  "count": 5,
  "rows": [
    {
      "id": "R-014",
      "title": "FHIR migration dependency",
      "severity": "high",
      "status": "open",
      "owner": "Lowry",
      "changed": "2026-04-10T09:30:00Z",
      "description": "Vendor confirmed 2-week slip on test environment delivery.",
      "mitigation": "Lowry to confirm revised timeline by 4/15.",
      "relatedEvents": [
        "2026-04-10 Escalated MED → HIGH",
        "2026-04-09 Discussed in Sprint 2 Review"
      ]
    }
  ]
}
```

#### `GET /api/v1/products/:productId/sources?type=email`
**Response 200**
```json
{
  "counts": {
    "all": 7,
    "transcript": 1,
    "email": 2,
    "document": 1,
    "weekly": 2,
    "ado": 1
  },
  "items": [
    {
      "id": "src-201",
      "type": "email",
      "title": "Jaden → Dr. Sohl: FHIR test timeline",
      "date": "2026-04-12",
      "meta": "Thread · 3 messages · 1 attachment",
      "openable": true
    }
  ]
}
```

#### `GET /api/v1/products/:productId/sources/:sourceId`
**Response 200**
```json
{
  "source": {
    "id": "src-201",
    "type": "email",
    "title": "Jaden → Dr. Sohl: FHIR test timeline",
    "sourceDate": "2026-04-12T14:14:00Z",
    "author": "Jaden",
    "participants": ["Dr. Sohl", "Benjiman"],
    "metadata": {
      "threadId": "thread-77",
      "attachmentCount": 1
    },
    "previewText": "Per Wednesday’s decision, revised schedule attached...",
    "openUrl": "/api/v1/products/dental/sources/src-201/content"
  }
}
```

#### `POST /api/v1/products/:productId/ask`
**Request**
```json
{
  "question": "What decisions were made this sprint?"
}
```
**Response 200**
```json
{
  "status": "partial",
  "answerHtml": "<strong>3 decisions were made in Sprint 2...</strong>",
  "evidenceStrength": "medium",
  "coverage": {
    "isPartial": true,
    "warnings": [
      "2 meetings in this sprint have no transcript ingested."
    ]
  },
  "sources": [
    {
      "sourceId": "src-301",
      "type": "transcript",
      "title": "Sprint 2 Review Transcript",
      "meta": "4/9 · 45 min · 6 attendees"
    },
    {
      "sourceId": "src-302",
      "type": "email",
      "title": "Dr. Sohl approved revised test schedule",
      "meta": "4/7 · Email"
    }
  ],
  "trace": {
    "requestId": "req-123",
    "latencyMs": 4123
  }
}
```

#### `POST /api/v1/products/:productId/transcripts`
**Request:** multipart form-data
- `meetingTitle` required
- `meetingDate` required
- `attendees[]` optional
- `file` required
- `notes` optional

**Response 202**
```json
{
  "jobId": "job-901",
  "sourceId": "src-901",
  "status": "queued"
}
```

#### `POST /api/v1/products/:productId/weekly-updates`
**Request**
```json
{
  "weekEnding": "2026-04-13",
  "summary": "Sprint 2 continues with FHIR prep...",
  "accomplishments": "Revised schedule approved...",
  "risks": "Vendor delay remains primary concern.",
  "nextSteps": "Confirm vendor timeline by 4/15."
}
```
**Response 201**
```json
{
  "weeklyUpdateId": "wu-222",
  "status": "published"
}
```

#### `POST /api/v1/products/:productId/reports`
**Request**
```json
{
  "reportType": "weekly",
  "period": {
    "preset": "current"
  }
}
```
**Response 202**
```json
{
  "reportId": "rep-440",
  "jobId": "job-778",
  "status": "pending",
  "pollUrl": "/api/v1/jobs/job-778"
}
```

#### `GET /api/v1/products/:productId/reports/:reportId`
**Response 200**
```json
{
  "reportId": "rep-440",
  "productId": "dental",
  "reportType": "weekly",
  "period": {
    "start": "2026-04-07",
    "end": "2026-04-13"
  },
  "coverage": {
    "percentage": 78,
    "items": [
      { "label": "Risks & Issues", "status": "ok", "count": 5 },
      { "label": "Transcripts", "status": "miss", "count": 1, "expected": 3 }
    ],
    "warningText": "This report may be incomplete. 2 meetings in this period have no transcripts."
  },
  "sections": [
    {
      "sectionId": "executive-summary",
      "title": "Executive Summary",
      "body": "Dental remains at risk...",
      "editable": true
    }
  ],
  "exports": {
    "canPdf": true,
    "canPptx": true,
    "canCopy": true,
    "canEmail": true
  }
}
```

#### `PATCH /api/v1/products/:productId/reports/:reportId/sections/:sectionId`
**Request**
```json
{
  "body": "Updated executive summary text..."
}
```
**Response 200**
```json
{
  "sectionId": "executive-summary",
  "status": "saved",
  "body": "Updated executive summary text..."
}
```

#### `POST /api/v1/products/:productId/reports/:reportId/exports`
**Request**
```json
{
  "format": "pdf"
}
```
**Response 202**
```json
{
  "jobId": "job-export-77",
  "status": "pending",
  "pollUrl": "/api/v1/jobs/job-export-77"
}
```

#### `GET /api/v1/jobs/:jobId`
**Response 200**
```json
{
  "jobId": "job-778",
  "jobType": "report",
  "status": "completed",
  "result": {
    "reportId": "rep-440"
  }
}
```

#### `POST /api/v1/telemetry`
**Request**
```json
{
  "eventName": "report.generated",
  "timestamp": "2026-04-15T12:01:02Z",
  "payload": {
    "productId": "dental",
    "reportType": "weekly",
    "coveragePct": 78
  }
}
```
**Response 202**
```json
{
  "accepted": true
}
```

### 13.3 Error Contract

| Condition | HTTP Status | Error Code | Retryable | FE Behavior | BE Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Validation failure | 400 | `VALIDATION_ERROR` | No | Inline field error | Log warning, no side effects |
| Not authenticated | 401 | `UNAUTHORIZED` | No | Redirect/session-expired | Audit auth failure |
| Forbidden | 403 | `FORBIDDEN` | No | Permission view | Audit access denial |
| Product/source not found | 404 | `NOT_FOUND` | No | Not found view | Log miss |
| Edit conflict | 409 | `CONFLICT` | Yes | Refresh/retry message | Log conflict, no overwrite |
| File too large | 413 | `PAYLOAD_TOO_LARGE` | No | Inline upload error | Log warning |
| Rate limit | 429 | `RATE_LIMITED` | Yes | Toast + retry/backoff | Log throttling |
| KB retrieve failed | 503 | `KB_UNAVAILABLE` | Yes | Ask/report error or partial state | Log dependency failure |
| Generation timeout | 504 | `MODEL_TIMEOUT` | Yes | Inline retry | Log timeout and latency |
| Insufficient evidence | 422 | `INSUFFICIENT_EVIDENCE` | No | Partial/insufficient state | Log warning, no failure |
| Internal error | 500 | `INTERNAL_ERROR` | Yes | Generic error state | Log error with stack + trace ID |
| Network failure | — | — | Yes | Offline banner/retry | Client-only |

**Error body shape**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Meeting date cannot be in the future",
    "field": "meetingDate",
    "retryable": false,
    "requestId": "req-123"
  }
}
```

### 13.4 State–API–Backend Mapping Table

| User Action | UI State (Before) | API Call | Backend Processing | API Response | UI State (After) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Open portfolio | Loading | `GET /portfolio` | Read portfolio snapshot | 200 summary/cards | Populated portfolio |
| Click product card | Portfolio populated | `GET /products/:id` | Read product overview | 200 product payload | Product overview |
| Ask question | Ask idle | `POST /products/:id/ask` | Plan → retrieve → generate → validate | 200 answer or 422/503 | Answer, partial, or error |
| Upload transcript | Modal open | `POST /products/:id/transcripts` | Store raw file → queue ingest job | 202 job queued | Toast + pending sync state |
| Publish weekly | Modal open | `POST /products/:id/weekly-updates` | Validate → upsert weekly → recompute freshness | 201 published | Success toast + refreshed overview |
| Open timeline filter | Timeline loaded | `GET /products/:id/timeline?filter=...` | Read filtered events | 200 events | Filtered timeline |
| Generate report | Reports idle | `POST /products/:id/reports` | Create report job record → queue | 202 pending | Loading/polling |
| Poll report job | Loading | `GET /jobs/:jobId` | Read job row | 200 pending/completed/failed | Loading, report, or error |
| Save edited section | Report populated | `PATCH /reports/:id/sections/:sectionId` | Validate, optimistic concurrency, persist | 200 saved or 409 | Saved or conflict error |
| Export PDF | Report populated | `POST /reports/:id/exports` | Queue export or render immediately | 202/200 | Busy button then success |

### 13.5 Internal Service Contracts

**`askOrchestratorService -> queryPlannerService`**
- **Function:** `buildRetrievalPlan({ productId, question, userScope })`
- **Contract:** Returns a deterministic plan containing intent, time windows, source filters, and structured dataset requirements
- **Failure contract:** Throws only for invalid input; planner fallback must return generic plan instead of null

**`askOrchestratorService -> kbRetrieveService`**
- **Function:** `retrieveEvidence({ plan, authScope, traceId })`
- **Contract:** Returns an ordered list of retrieval candidates with Bedrock scores and metadata filters applied
- **Failure contract:** Throws `DependencyError(code='KB_UNAVAILABLE')` for Bedrock/API issues

**`reportOrchestratorService -> generationService`**
- **Function:** `generateSection({ sectionKey, prompt, evidencePack, traceId })`
- **Contract:** Returns strict JSON with `body`, `sourceIds`, and `qualityFlags`
- **Failure contract:** Retries once on timeout or malformed JSON; then throws `GenerationError`

**`ingestWorker -> kbSyncService`**
- **Function:** `syncKnowledgeBase({ sourceIds, productId, traceId })`
- **Contract:** Starts or batches KB sync and returns sync run status
- **Failure contract:** Throws retryable sync error; worker marks source unindexed

---

## 14. Configuration & Feature Flags

### 14.1 Environment Variables

| Variable | Type | Default | Required | Side | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | string | `development` | Yes | BE | Runtime environment |
| `PORT` | number | `3000` | Yes | BE | Express port |
| `APP_BASE_URL` | string | — | Yes | Both | Same-origin app base URL |
| `AWS_REGION` | string | `us-gov-west-1` | Yes | BE | AWS region |
| `AWS_S3_RAW_BUCKET` | string | — | Yes | BE | Raw file bucket |
| `AWS_S3_NORMALIZED_BUCKET` | string | — | Yes | BE | Normalized/chunk bucket |
| `AWS_S3_EXPORT_BUCKET` | string | — | Yes | BE | Report export bucket |
| `AURORA_PG_URL` | string | — | Yes | BE | Aurora connection string |
| `BEDROCK_KB_ID` | string | — | Yes | BE | Bedrock Knowledge Base ID |
| `BEDROCK_KB_DATA_SOURCE_ID` | string | — | Yes | BE | KB data source ID |
| `BEDROCK_EMBED_MODEL_ID` | string | `amazon.titan-embed-text-v2:0` | Yes | BE | Embedding model |
| `BEDROCK_GEN_MODEL_ID` | string | `amazon.nova-pro-v1:0` | Yes | BE | Generation model |
| `SQS_INGEST_QUEUE_URL` | string | — | Yes | BE | Ingest queue |
| `SQS_REPORT_QUEUE_URL` | string | — | Yes | BE | Report queue |
| `SQS_EXPORT_QUEUE_URL` | string | — | Yes | BE | Export queue |
| `SQS_CONNECTOR_QUEUE_URL` | string | — | Yes | BE | Connector queue |
| `UPLOAD_MAX_MB` | number | `25` | Yes | Both | Max transcript upload size |
| `MAILBOX_CONNECTOR_PROVIDER` | string | `graph` | No | BE | Mailbox API provider |
| `MAILBOX_CONNECTOR_SECRET_ARN` | string | — | No | BE | Mailbox connector credentials |
| `ADO_REST_BASE_URL` | string | — | No | BE | Azure DevOps REST base |
| `ADO_REST_SECRET_ARN` | string | — | No | BE | ADO token/credentials |
| `ADO_MCP_ENDPOINT` | string | — | No | BE | Local MCP endpoint |
| `TELEMETRY_ENABLED` | boolean | `true` | No | Both | FE telemetry toggle |
| `FEATURE_UNSUPPORTED_MOBILE` | boolean | `true` | No | FE | Enforce desktop-only view |

### 14.2 Feature Flags

| Flag | Default | Side | Purpose | Removal Criteria |
| :--- | :--- | :--- | :--- | :--- |
| `ENABLE_ADO_MCP_ENRICHMENT` | false | BE | Allows optional MCP-based ADO enrichment | Remove when direct API + structured sync fully replaces need |
| `ENABLE_MAILBOX_CONNECTOR` | true | BE | Enables automated shared-mailbox ingestion | Remove after always-on connector stable |
| `ENABLE_TEXTRACT_OCR` | true | BE | OCR fallback for scanned docs | Remove only if alternate OCR stack selected |
| `ENABLE_REPORT_SECTION_EDIT` | true | Both | Persisted report edits | Remove after universally stable |
| `ENABLE_EXPORT_PPTX` | true | Both | PPTX export | Remove after stable |
| `ENABLE_GLOBAL_SEARCH` | true | Both | Search palette | Remove after stable |

### 14.3 Tunable Parameters

| Parameter | Default | Range | Side | Impact |
| :--- | :--- | :--- | :--- | :--- |
| `ASK_TOP_K` | 12 | 6–24 | BE | Retrieval breadth |
| `ASK_MAX_SOURCES` | 8 | 4–12 | BE | Citation diversity |
| `CHUNK_TARGET_TOKENS` | 800 | 500–1200 | BE | Retrieval precision/recall |
| `CHUNK_OVERLAP_TOKENS` | 80 | 0–200 | BE | Context continuity |
| `REPORT_POLL_INTERVAL_MS` | 2000 | 1000–5000 | FE | Report polling cadence |
| `SNAPSHOT_MAX_STALENESS_MIN` | 15 | 5–60 | BE | Health freshness threshold |
| `SEARCH_RESULT_LIMIT` | 8 | 5–20 | BE | Search palette size |
| `MAILBOX_POLL_MIN` | 15 | 5–60 | BE | Connector cadence |

---

## 15. Operational Concerns

### 15.1 Performance & Latency

- **API latency targets**
  - Portfolio: P95 < 1200ms
  - Product shell: P95 < 1500ms
  - Timeline/Data/Sources: P95 < 1500ms
  - Ask: P95 < 7000ms
  - Job status: P95 < 500ms

- **Frontend performance targets**
  - Largest Contentful Paint for portfolio under typical internal network conditions: < 2.5s
  - Interaction to Next Paint for tab switches: < 200ms
  - No layout shift caused by async tab content

- **Throughput targets**
  - 100 concurrent active users
  - 10 concurrent Ask requests
  - 5 concurrent report generation jobs
  - 1000 new source ingests/day

- **Bottlenecks**
  - Bedrock generation latency
  - KB sync latency
  - AOSS query cost/throughput
  - OCR latency for scanned PDFs
  - ADO/mailbox connector rate limits

### 15.2 Scalability

- **Scaling model**
  - API service horizontally scalable behind ALB
  - Worker service horizontally scalable by queue depth
  - Aurora Serverless v2 autoscaling
  - AOSS OCUs tuned by ingest/search profile

- **Data growth**
  - Most growth lands in S3 and AOSS, not Aurora
  - Aurora holds metadata, summaries, and derived entities only
  - Chunk storage grows linearly with source volume and chunk count

- **Cost model**
  - Major cost centers: Nova Pro inference, AOSS OCUs, Textract OCR, Aurora capacity, KB sync frequency
  - Minimize cost by:
    - using snapshots for portfolio/product reads
    - using `Retrieve`, not `RetrieveAndGenerate`
    - indexing only normalized chunk files
    - limiting top-K and output tokens
    - OCR only when text extraction fails

### 15.3 Observability & Debugging

- **Backend logging**
  - Structured JSON logs with `requestId`, `jobId`, `productId`, `sourceId`, `connectorType`, `stage`, `latencyMs`, `errorCode`
  - Log start/end of every ingest stage, Ask plan, retrieval, generation, validation, export

- **Frontend logging**
  - Console must stay clean in non-debug builds
  - FE telemetry sends route view, Ask submit, report generate, export, and handled errors to `/api/v1/telemetry`

- **Trace output**
  - Every user-initiated backend request carries `requestId`
  - Async jobs carry `jobId` and link back to parent `requestId`
  - Report and Ask responses include request trace metadata for debugging

- **Metrics**
  - Ask latency histograms
  - KB retrieve success/failure counts
  - Nova Pro timeout counts
  - Ingest success/partial/failure counts by source type
  - Snapshot freshness age
  - Connector lag and error rate
  - AOSS OCU utilization and KB sync durations

- **Alerting**
  - 5xx rate above threshold
  - KB sync failures > 3 consecutive runs
  - Connector lag > 2 expected intervals
  - Report generation failures > 10% per hour
  - Snapshot freshness older than threshold for active products

### 15.4 Security & Compliance

- **Data classification**
  - Design for internal/CUI-like workloads in GovCloud
  - Higher classification segmentation requires separate enclaves or environment split

- **Encryption**
  - S3 SSE-KMS
  - Aurora encrypted at rest with KMS
  - AOSS encryption at rest
  - TLS in transit on every hop

- **Authentication/Authorization**
  - External enterprise IdP with JWT or header-authenticated session
  - Product access enforced in backend on every product-scoped endpoint
  - Frontend uses permissions only for rendering; backend remains authoritative

- **Input sanitization**
  - HTML escaping of user-authored fields unless explicitly safe-rendered
  - No raw HTML from model output without server-side sanitization/allowlist
  - File type and size validation
  - Report section edit content sanitized

- **Audit logging**
  - Upload transcript
  - Publish weekly
  - Edit report section
  - Trigger connector sync
  - Export report

- **Compliance requirements**
  - Operate within AWS GovCloud controls
  - Keep production model calls in-region only
  - No cross-region inference in production
  - Secrets in Secrets Manager, not env-file checked into code

### 15.5 Failure Modes & Recovery

| Failure Scenario | Detection | User Impact | System Impact | Recovery | RTO |
| :--- | :--- | :--- | :--- | :--- | :--- |
| KB retrieve unavailable | Bedrock/AOSS API error | Ask/report fails or degrades | No retrieval results | Retry once, then degraded response | < 15 min |
| Nova Pro timeout | Runtime timeout | Ask/report error or retry | Job may fail | Retry once with lower token cap | < 15 min |
| KB sync failure | Sync job status failed | New source not searchable yet | Existing corpus intact | Retry sync from queue | < 1 hr |
| Aurora unavailable | DB health check/query failure | Read pages error | API degraded | Failover/reconnect | per Aurora failover target |
| S3 put failure | SDK error | Upload/import fails | No source stored | Retry or user resubmit | immediate retry |
| Mailbox connector auth expired | 401 from provider | Email freshness degrades | Source lag | Alert ops, refresh secret | < 4 hr |
| ADO sync rate limit | 429 from ADO | ADO freshness degrades | Structured lag | Backoff and retry | < 4 hr |
| OCR service unavailable | Textract failure | Scanned docs remain unsearchable | Some docs partial | Mark partial and retry later | < 24 hr |
| Export render failure | Render error | Export action fails | Report content still safe | Retry export | < 1 hr |

### 15.6 Rollback Plan

- **Rollback trigger**
  - Elevated 5xx rates
  - Corrupt report persistence
  - Broken auth/authorization
  - Broken Ask/report generation causing incorrect empty states or crashes

- **Frontend rollback**
  - Revert deployment image or disable feature flags for affected features (global search, export, edit, connector surfaces)

- **Backend rollback**
  - Revert service image
  - Disable connector runs and report generation through feature flags
  - Leave existing data intact

- **Data safety**
  - Writes are append-or-versioned for sources and reports
  - Edited report text preserves `body_generated` and `body_current`
  - Rollback must not delete source files or snapshots
  - Schema migrations must be additive first; destructive migrations deferred

---

## 16. Phased Implementation Plan

### 16.1 Phase Overview

| Phase | Name | FE Scope | BE Scope | Stub/Mock Boundary | Integration Checkpoint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Foundation | App shell, routes, portfolio/product views with mock data | Express scaffolding, auth middleware, DB schema, snapshot read endpoints | FE uses MSW; BE uses seeded snapshots | Live `/portfolio` and `/products/:id` render real data |
| 2 | Read Experience | Timeline/Data/Sources/Search/Quick Views | Read services, search service, source/timeline/data endpoints | FE still mocks Ask/Reports | Real read-only app works end-to-end |
| 3 | Ingestion & RAG | Upload Transcript, Ask panel, partial/error states | Ingest pipeline, chunking, KB sync, Ask orchestration, health recompute | FE mocks report generation only | Upload → indexing → Ask works live |
| 4 | Reports & Exports | Reports generation/edit/export, weekly update modal | Report jobs, persistence, export service, weekly updates | No FE mocks for core flows | Full initial release behavior live |
| 5 | Connector Hardening | Admin/ops status views if desired, connector freshness surfaces | Mailbox connector, ADO REST sync, optional MCP enrichment, alarms | No mocks | Scheduled syncs keep app current |

### 16.2 Phase Details

#### Phase 1: Foundation
- **Goal:** Establish the monorepo, design system primitives, routing, auth envelope, DB schema, and snapshot-based read APIs.
- **Frontend tasks**
  1. Scaffold React app with routes and design-token CSS from mockup
  2. Build AppShell, PortfolioPage, ProductPage, tab navigation, unsupported viewport state
  3. Implement product cards and static loading/empty/error shells
- **Backend tasks**
  1. Scaffold Express server, central error middleware, logger, auth middleware
  2. Create Aurora schema and seed data
  3. Implement `/session`, `/portfolio`, `/products/:id`
- **Stub/mock boundary:** FE uses MSW mock handlers for read endpoints until BE ready
- **Tests required (FE):** route rendering, product card navigation, unsupported viewport, keyboard tab navigation
- **Tests required (BE):** schema migration tests, auth middleware tests, portfolio/product contract tests
- **Integration checkpoint:** FE renders live portfolio and product overview from BE
- **Estimated effort:** FE M, BE M

#### Phase 2: Read Experience
- **Goal:** Complete all read-only views and deep-linking behavior.
- **Frontend tasks**
  1. Build Timeline, Data, Sources, Search palette, Quick View Drawer
  2. Wire URL params for tabs and filters
  3. Add source detail drawer/modal
- **Backend tasks**
  1. Implement timeline/data/source/search endpoints
  2. Add FTS indexes and read-service queries
  3. Implement source detail API
- **Stub/mock boundary:** FE may still mock Ask and Reports
- **Tests required (FE):** filters, deep links, row expansion, search palette interactions
- **Tests required (BE):** contract tests for timeline/data/sources/search
- **Integration checkpoint:** full read-only experience with real data
- **Estimated effort:** FE M, BE M

#### Phase 3: Ingestion & RAG
- **Goal:** Make new source evidence searchable and usable by Ask.
- **Frontend tasks**
  1. Build Upload Transcript modal and pending/partial states
  2. Build Ask panel loading, answer, partial, error, retry states
  3. Add health refresh visuals after upload
- **Backend tasks**
  1. Implement transcript ingest API and worker
  2. Implement normalization, chunking, S3 storage, KB sync, health recompute
  3. Implement Ask orchestration, structured retrieval, KB retrieval, Nova generation, validation
- **Stub/mock boundary:** FE may still mock Reports only
- **Tests required (FE):** upload validation, Ask error/partial/success
- **Tests required (BE):** chunking, KB sync orchestration, Ask contract and timeout handling
- **Integration checkpoint:** upload transcript → indexed → Ask answer reflects new evidence
- **Estimated effort:** FE M, BE L

#### Phase 4: Reports & Exports
- **Goal:** Deliver report generation, editing, and exports.
- **Frontend tasks**
  1. Build report configuration, polling, rendered report sections, edit mode, export states
  2. Build Update Weekly modal
  3. Surface coverage warnings and stale states
- **Backend tasks**
  1. Implement weekly update write API
  2. Implement report job orchestration and persistence
  3. Implement PDF/PPTX exports and email export payload
- **Stub/mock boundary:** none for core report flows
- **Tests required (FE):** report polling, edit conflict, export busy states
- **Tests required (BE):** report generation, section save conflict, export jobs
- **Integration checkpoint:** report generate → load → edit → export works end-to-end
- **Estimated effort:** FE M, BE L

#### Phase 5: Connector Hardening
- **Goal:** Automate freshness for mailbox and ADO sources and harden ops workflows.
- **Frontend tasks**
  1. Optional connector freshness surfaces in product/source metadata
  2. Optional ops/admin status surfaces if needed
- **Backend tasks**
  1. Mailbox connector, ADO REST connector, optional ADO MCP adapter
  2. Alerting, run history, partial sync handling, watermark resumes
  3. Recompute snapshots on connector events
- **Stub/mock boundary:** no mocks
- **Tests required (FE):** freshness/warning display
- **Tests required (BE):** connector sync contract tests, duplicate suppression, watermark resume
- **Integration checkpoint:** scheduled syncs keep product data fresh without manual import
- **Estimated effort:** FE S, BE L

### 16.3 Dependency Graph

- Phase 1 blocks all others
- Phase 2 can proceed in parallel once Phase 1 routes and contracts exist
- Phase 3 depends on Phase 1 DB/schema and Phase 2 product shell
- Phase 4 depends on Phase 1 contracts and Phase 3 retrieval/generation components
- Phase 5 depends on Phase 3 ingest framework and Phase 4 health/report surfaces
- FE and BE work in parallel via MSW mocks, shared JSON schemas, and contract tests
- Integration checkpoints gate phase completion

---

## 17. QA, Acceptance Criteria, and Definition of Done

### 17.1 Global Quality Gates (Blocking)

- **GQ-001 Frontend zero console errors:** No console errors or warnings across portfolio, product, Ask, report, upload, and export flows.
- **GQ-002 Backend zero unhandled exceptions:** No API or worker process may crash on a defined failure path.
- **GQ-003 API contract honored:** Every endpoint returns only documented shapes and error codes.
- **GQ-004 Evidence honesty:** The system never renders a confident full-success answer/report when coverage is partial or missing.
- **GQ-005 Role integrity:** Unauthorized actions are never executable from UI or API.
- **GQ-006 Snapshot integrity:** Stale or failed snapshot recompute never deletes previously valid snapshot data.
- **GQ-007 Retrieval isolation:** Every KB retrieve request must include product scope filters derived from backend authorization.
- **GQ-008 Single-region operation:** Production runtime does not use cross-region inference or cross-region retrieval.
- **GQ-009 Additive Playwright proof:** Every user-visible and cross-cutting workflow has a Playwright script.
- **GQ-010 Supported viewport enforcement:** Below 1024px the app renders unsupported viewport state instead of broken UI.

### 17.2 Frontend Requirement-Level Acceptance Criteria

**Area: App Shell & Search**
- `AC-FE-001 [Component/E2E]` Given an authenticated user opens any supported route When the page renders Then the sticky top nav displays brand, title, search input, and current user identity.
- `AC-FE-002 [Integration/E2E]` Given the search input has at least 2 characters When the user types Then a grouped results palette opens beneath the input.
- `AC-FE-003 [E2E]` Given the search palette is open When the user uses arrow keys and Enter Then the highlighted result opens and the palette closes.
- `AC-FE-004 [Component]` Given the query has no results When search completes Then the palette shows `No matching products or sources`.

**Area: Portfolio**
- `AC-FE-005 [Integration/E2E]` Given `/portfolio` loads successfully When data resolves Then the pulse bar and grouped product sections render.
- `AC-FE-006 [Component/E2E]` Given mixed statuses exist When cards render Then `Needs Attention` appears before `On Track`.
- `AC-FE-007 [Component]` Given a product card renders When visible Then it shows name, status, health, risk/blocker counts, PI/sprint, PM, and highlight chips.
- `AC-FE-008 [E2E]` Given a product card is activated When navigation completes Then the product Overview tab is visible.

**Area: Quick Views**
- `AC-FE-009 [Integration/E2E]` Given the user clicks a quick-view button When the drawer opens Then the drawer title and relevant cross-product list are visible.
- `AC-FE-010 [E2E]` Given a quick-view row is activated When navigation completes Then the target product opens and the drawer closes.

**Area: Product Shell & Routing**
- `AC-FE-011 [E2E]` Given the user is on a product page When they switch tabs Then the active tab, URL query param, and content panel update without a full reload.
- `AC-FE-012 [E2E]` Given the back link is used When navigation completes Then the portfolio page returns with prior scroll restored.
- `AC-FE-013 [Integration/E2E]` Given a 404 or 403 product response When the page loads Then the correct not-found or permission view renders.

**Area: Overview**
- `AC-FE-014 [Component]` Given health data is available When Overview renders Then the health ring, subscores, ok items, and gap items are visible.
- `AC-FE-015 [Component]` Given the user lacks edit permission When Overview renders Then Upload Transcript and Update Weekly are hidden.
- `AC-FE-016 [E2E]` Given recent signals are present When a signal is activated Then the Timeline tab opens with the matching filter applied.

**Area: Ask**
- `AC-FE-017 [Component]` Given the Ask input contains fewer than 3 non-space characters When idle Then the Ask button is disabled.
- `AC-FE-018 [Integration/E2E]` Given a valid question When Ask is submitted Then inline loading appears and duplicate submissions are prevented.
- `AC-FE-019 [Integration/E2E]` Given Ask succeeds When the response returns Then answer text, sources, and evidence strength render.
- `AC-FE-020 [Integration/E2E]` Given Ask returns partial or insufficient evidence When the response returns Then warning copy is visible next to the answer.
- `AC-FE-021 [Integration/E2E]` Given Ask fails recoverably When the response returns Then an inline error with Retry appears and the input value is preserved.

**Area: Upload Transcript**
- `AC-FE-022 [Component/E2E]` Given the transcript modal opens When required fields are missing Then inline field errors render and Upload is blocked.
- `AC-FE-023 [Integration/E2E]` Given transcript upload is accepted When the API returns 202 Then success feedback appears and the product page shows a pending-ingest state.
- `AC-FE-024 [Integration/E2E]` Given transcript upload fails When the API returns an error Then the modal stays open and user-entered metadata remains.

**Area: Update Weekly**
- `AC-FE-025 [Component/E2E]` Given the weekly modal opens When required fields are empty Then validation blocks publish.
- `AC-FE-026 [Integration/E2E]` Given weekly update save succeeds When the response returns Then a success toast appears and Overview freshness/signals refresh.

**Area: Timeline/Data/Sources**
- `AC-FE-027 [Integration/E2E]` Given a timeline filter is selected When it changes Then only matching entries remain visible.
- `AC-FE-028 [Integration/E2E]` Given a data row is expanded When another row is expanded Then only one detail panel remains open.
- `AC-FE-029 [Integration/E2E]` Given a source filter is selected When it changes Then only matching sources appear.
- `AC-FE-030 [Integration/E2E]` Given a source item is opened When detail loads Then preview metadata and open action render.

**Area: Reports**
- `AC-FE-031 [Integration/E2E]` Given Reports has no current report When the tab opens Then config controls and instructional empty state render.
- `AC-FE-032 [Integration/E2E]` Given the user starts report generation When the request begins Then the Generate button disables and a loading state appears.
- `AC-FE-033 [Integration/E2E]` Given a report completes When loaded Then coverage card, warning state if needed, and report sections appear.
- `AC-FE-034 [Integration/E2E]` Given the user can edit When Edit is clicked Then inline edit mode with Save/Cancel appears.
- `AC-FE-035 [Integration/E2E]` Given a read-only user views the report When it renders Then Edit actions are hidden.
- `AC-FE-036 [Integration/E2E]` Given an export is started When the user clicks Export PDF Then only that export button enters busy state.

**Area: Accessibility & Responsive**
- `AC-FE-037 [E2E]` Given keyboard-only navigation When the user traverses the page Then every interactive element is reachable and visibly focused.
- `AC-FE-038 [Component/E2E]` Given reduced motion is enabled When the UI renders animations Then non-essential motion is removed or reduced.
- `AC-FE-039 [E2E]` Given the viewport is below 1024px When the app renders Then unsupported viewport state replaces interactive content.

### 17.3 Backend Requirement-Level Acceptance Criteria

**Area: Auth & Scope**
- `AC-BE-001 [Integration/Contract]` Given a request lacks valid identity When any protected endpoint is called Then the API returns `401 UNAUTHORIZED`.
- `AC-BE-002 [Integration/Contract]` Given a user lacks product scope When a product endpoint is called Then the API returns `403 FORBIDDEN`.
- `AC-BE-003 [Integration]` Given a valid scoped request When authorization succeeds Then the resolved product scope is attached to downstream service calls.

**Area: Portfolio/Product Reads**
- `AC-BE-004 [Contract]` Given valid snapshot rows exist When `/portfolio` is called Then the API returns grouped product cards matching the contract.
- `AC-BE-005 [Contract]` Given a product exists When `/products/:id` is called Then the API returns product, permissions, health, and overview payload.
- `AC-BE-006 [Integration]` Given no product exists When `/products/:id` is called Then the API returns `404 NOT_FOUND`.

**Area: Search**
- `AC-BE-007 [Contract]` Given a valid query string When `/search` is called Then the API returns grouped results limited to authorized product scope.
- `AC-BE-008 [Unit/Integration]` Given a query shorter than the minimum length When `/search` is called Then the API returns `400 VALIDATION_ERROR`.

**Area: Ingestion**
- `AC-BE-009 [Contract]` Given a valid transcript upload When `/transcripts` is called Then the API stores the raw object, creates a `source_record`, creates an `ingest_job`, and returns `202`.
- `AC-BE-010 [Integration]` Given an unsupported file type or oversized file When upload is attempted Then the API returns `400` or `413` and stores no new source.
- `AC-BE-011 [Integration]` Given normalization succeeds but derived extraction fails When the ingest worker completes Then the source is marked `partial`, not `failed`, and raw text remains available.
- `AC-BE-012 [Integration]` Given chunking succeeds When KB sync is triggered Then source chunks are written to S3 with valid metadata sidecars and a sync run is recorded.
- `AC-BE-013 [Integration]` Given KB sync fails When worker processing completes Then `indexed=false` remains on the source and the job is marked retryable failure.

**Area: Email Processing**
- `AC-BE-014 [Unit/Integration]` Given an email payload contains quoted prior chain content When normalized Then repeated quoted blocks and standard disclaimers are collapsed or stripped before chunking.
- `AC-BE-015 [Integration]` Given attachments are present When email ingestion runs Then attachment source records are created and linked to the parent message.
- `AC-BE-016 [Integration]` Given mailbox sync reruns with the same provider message IDs When processing occurs Then duplicates are not re-ingested.

**Area: Transcript Processing**
- `AC-BE-017 [Unit/Integration]` Given a timestamped transcript When normalized Then speaker/time markers are preserved in canonical text.
- `AC-BE-018 [Integration]` Given transcript extraction runs When decisions/actions are identified Then derived `decisions` and `action_items` rows are persisted with confidence scores.

**Area: Ask Orchestration**
- `AC-BE-019 [Contract]` Given a valid Ask request When retrieval succeeds Then the API returns `200` with answer, sources, evidenceStrength, coverage, and trace metadata.
- `AC-BE-020 [Integration]` Given structured retrieval fails but KB retrieval succeeds When Ask completes Then the API returns `200` with `status=partial` and a coverage warning.
- `AC-BE-021 [Integration]` Given no evidence meets the minimum threshold When Ask is called Then the API returns `422 INSUFFICIENT_EVIDENCE`.
- `AC-BE-022 [Integration/Performance]` Given KB or model throttling occurs When Ask is called Then the service retries once within budget and logs the attempt.
- `AC-BE-023 [Unit/Contract]` Given Nova output cites an unknown source ID When validation runs Then the output is rejected and the call retried or failed safely.
- `AC-BE-024 [Integration]` Given a valid Ask request When KB retrieval executes Then the request always includes backend-generated product metadata filters.

**Area: Health & Snapshots**
- `AC-BE-025 [Unit/Integration]` Given source and connector freshness inputs When health recompute runs Then coverage, freshness, continuity, sync, and overall score are recalculated deterministically.
- `AC-BE-026 [Integration]` Given health recompute fails When product reads continue Then the prior snapshot remains active and stale-state metadata is preserved.

**Area: Reports**
- `AC-BE-027 [Contract]` Given a valid report generation request When `/reports` is called Then the API returns `202` with `reportId`, `jobId`, and `pollUrl`.
- `AC-BE-028 [Integration]` Given a report job completes When `/reports/:reportId` is called Then coverage, warning state, sections, and export capabilities are returned.
- `AC-BE-029 [Integration]` Given report section editing succeeds When `PATCH /sections/:sectionId` is called Then `body_current` is persisted without losing `body_generated`.
- `AC-BE-030 [Integration]` Given concurrent edits occur When a stale section save is attempted Then the API returns `409 CONFLICT`.
- `AC-BE-031 [Integration]` Given export begins When `/exports` is called Then an export job record is created and artifact state is traceable.
- `AC-BE-032 [Integration]` Given export rendering fails When the export job ends Then the job is marked failed and the original report remains unchanged.

**Area: Connectors**
- `AC-BE-033 [Integration]` Given mailbox connector credentials are valid When a sync run executes Then only newly discovered messages since the cursor are ingested.
- `AC-BE-034 [Integration]` Given Azure DevOps REST sync succeeds When the run completes Then work items/comments/sprint data are upserted and timeline events refreshed.
- `AC-BE-035 [Integration]` Given the optional ADO MCP adapter is disabled When report/Ask flows run Then the system does not depend on MCP to succeed.
- `AC-BE-036 [Integration]` Given MCP enrichment is enabled but unavailable When a sync or enrichment task runs Then the system logs the failure and continues using canonical REST-synced data.

**Area: Telemetry/Audit**
- `AC-BE-037 [Integration]` Given `/telemetry` receives an allowed event When accepted Then the backend logs the event without blocking the caller.
- `AC-BE-038 [Integration]` Given audit-worthy user actions occur When the action succeeds Then an audit event row is persisted.

### 17.4 Cross-Cutting Integration Acceptance Criteria

- `AC-INT-001 [E2E]` Given an authorized user opens `/portfolio` When the request completes Then the UI renders live portfolio data from Aurora snapshots within the latency target.
- `AC-INT-002 [E2E]` Given an authorized user opens a product When the product response returns Then the Overview tab displays backend-provided permissions, health, narrative, and signals.
- `AC-INT-003 [E2E]` Given the user asks a question When the backend retrieves evidence and Nova Pro returns valid output Then the UI renders answer text and sources matching the API contract.
- `AC-INT-004 [E2E]` Given Ask completes with `status=partial` When the UI renders Then the evidence-gap warning is visible.
- `AC-INT-005 [E2E]` Given a transcript upload is accepted When the ingest worker later completes and snapshot recompute finishes Then the product page eventually reflects improved freshness/coverage and the transcript becomes searchable.
- `AC-INT-006 [E2E]` Given the user generates a report When the job completes Then the report tab loads persisted sections and coverage from backend storage.
- `AC-INT-007 [E2E]` Given a user edits a report section When the save succeeds Then a subsequent reload shows the edited section body.
- `AC-INT-008 [E2E]` Given a read-only user opens the same report When the page renders Then edit controls are absent even though the same report content is visible.
- `AC-INT-009 [E2E]` Given the KB dependency fails When Ask is submitted Then the backend returns the defined error or degraded response and the UI shows the defined scoped error/partial state without crashing.
- `AC-INT-010 [E2E]` Given cross-region inference is disabled in config When model and KB calls are executed Then runtime requests use only the configured GovCloud region resources.

### 17.5 Full-Stack E2E Test Scenarios

**Scenario 1: Portfolio to Product Happy Path**
- **Given** the user is authenticated and seeded data exists
- **When** they open `/portfolio` and activate the Dental product card
- **Then** the product Overview tab loads with health, narrative, signals, and Ask panel
- **And** no console errors occur
- **Maps to:** `AC-FE-005`, `AC-FE-008`, `AC-INT-001`, `AC-INT-002`

**Scenario 2: Ask Success with Partial Warning**
- **Given** the product has missing transcript coverage
- **When** the user asks `What decisions were made this sprint?`
- **Then** the answer renders with source list and coverage warning
- **And** the backend logs retrieval/generation trace for that request
- **Maps to:** `AC-FE-018`–`AC-FE-020`, `AC-BE-019`–`AC-BE-024`, `AC-INT-003`, `AC-INT-004`

**Scenario 3: Transcript Upload to Searchability**
- **Given** the user has editor permission
- **When** they upload a valid transcript
- **Then** the upload returns queued/pending
- **And** after job completion the new transcript appears in Sources and improves coverage or freshness
- **Maps to:** `AC-FE-022`–`AC-FE-024`, `AC-BE-009`–`AC-BE-013`, `AC-INT-005`

**Scenario 4: Weekly Update Publish**
- **Given** an editor is on Overview
- **When** they publish a valid weekly update
- **Then** a success toast appears and freshness/signals refresh
- **Maps to:** `AC-FE-025`, `AC-FE-026`

**Scenario 5: Timeline/Data/Sources Navigation**
- **Given** a populated product exists
- **When** the user opens Timeline, applies filters, opens Data rows, and inspects a source detail
- **Then** each tab renders live filtered content and preserves deep links
- **Maps to:** `AC-FE-027`–`AC-FE-030`, `AC-BE-004`–`AC-BE-008`

**Scenario 6: Report Generation and Persisted Edit**
- **Given** an editor is on Reports
- **When** they generate a report, wait for completion, edit the Executive Summary, and reload the page
- **Then** the edited text persists and exports remain available
- **Maps to:** `AC-FE-031`–`AC-FE-036`, `AC-BE-027`–`AC-BE-032`, `AC-INT-006`, `AC-INT-007`

**Scenario 7: Read-only Permissions**
- **Given** a leadership/read-only user opens the same product and report
- **When** the pages render
- **Then** upload, publish, and edit actions are absent while Ask and export remain available
- **Maps to:** `AC-FE-015`, `AC-FE-035`, `AC-BE-001`–`AC-BE-003`, `AC-INT-008`

**Scenario 8: KB Failure Handling**
- **Given** the KB retrieval dependency is intentionally stubbed to fail
- **When** the user submits Ask
- **Then** the backend returns the defined degraded or error contract
- **And** the UI shows a scoped Ask error/partial state without crashing
- **Maps to:** `AC-FE-021`, `AC-BE-022`, `AC-BE-024`, `AC-INT-009`

**Scenario 9: Conflict on Report Section Save**
- **Given** two editors open the same report
- **When** the second editor saves stale content after the first save completed
- **Then** the stale save returns a conflict and the UI prompts refresh/retry
- **Maps to:** `AC-FE-034`, `AC-BE-030`

**Scenario 10: Unsupported Viewport**
- **Given** the browser width is below 1024px
- **When** the app is loaded
- **Then** the unsupported viewport state is shown instead of interactive app content
- **Maps to:** `AC-FE-039`, `GQ-010`

### 17.6 Definition of Done (DoD) Checklist (Blocking — Unified)

**Frontend**
- [ ] All `AC-FE-###` criteria implemented and verified
- [ ] All user-visible workflows have Playwright coverage
- [ ] Accessibility requirements pass keyboard and semantic checks
- [ ] Unsupported viewport behavior implemented
- [ ] No console errors across happy/error/partial flows

**Backend**
- [ ] All `AC-BE-###` criteria implemented and verified
- [ ] No unhandled exceptions in API or worker paths
- [ ] Ingestion, Ask, report, and export jobs are traceable end-to-end with logs and job IDs
- [ ] KB retrieval always applies backend-generated auth/product filters
- [ ] Cross-region inference disabled in production config
- [ ] Connector lag/failure is observable and alertable

**Cross-Cutting**
- [ ] All `AC-INT-###` criteria implemented and verified
- [ ] Full-stack E2E scenarios pass
- [ ] JSON Schema contracts are shared and enforced
- [ ] Rollback plan documented and tested in non-prod
- [ ] Same Playwright suite passes headless and headed
- [ ] Artifact exports produce valid files and do not mutate report content

### 17.7 Usability Testing Plan

- **Scenarios**
  1. Triage which product needs attention first
  2. Explain why Dental is at risk using only the app
  3. Ask what decisions were made and verify trustworthiness
  4. Generate and export a weekly report
  5. Close an evidence gap by uploading a transcript

- **Metrics**
  - Task completion rate: 90%+
  - Portfolio triage under 60 seconds
  - Product understanding under 2 minutes
  - Weekly report generation and export under 2 minutes end-to-end
  - User satisfaction: 4.2/5+

### 17.8 Required Design Deliverables

- [ ] Full-stack user flow diagrams
- [ ] High-fidelity mockups for any state not already represented in supplied HTML
- [ ] Component specifications
- [ ] Copy deck
- [ ] Accessibility notes
- [ ] Design QA checklist

### 17.9 Playwright Test Scripts (Required)

```js
// tests/e2e/portfolio-to-product.spec.js
// Scenario 1 — Portfolio to Product Happy Path
// Validates: AC-FE-005, AC-FE-008, AC-INT-001, AC-INT-002
import { test, expect } from '@playwright/test';

test('portfolio to product happy path', async ({ page }) => {
  await page.goto('/portfolio');
  await expect(page.getByTestId('portfolio-page')).toBeVisible();
  await page.getByTestId('product-card-dental').click();
  await expect(page.getByTestId('product-page')).toBeVisible();
  await expect(page.getByTestId('product-tab-overview')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('knowledge-health-panel')).toBeVisible();
});
```

```js
// tests/e2e/ask-partial.spec.js
// Scenario 2 — Ask Success with Partial Warning
// Validates: AC-FE-018, AC-FE-019, AC-FE-020, AC-INT-003, AC-INT-004
import { test, expect } from '@playwright/test';

test('ask shows answer and partial evidence warning', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('ask-input').fill('What decisions were made this sprint?');
  await page.getByTestId('ask-submit').click();
  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-gap-warning')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-source-0')).toBeVisible();
});
```

```js
// tests/e2e/upload-transcript.spec.js
// Scenario 3 — Transcript Upload to Searchability
// Validates: AC-FE-022, AC-FE-023, AC-INT-005
import { test, expect } from '@playwright/test';
import path from 'path';

test('upload transcript queues ingest and later surfaces evidence', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-transcript-button').click();
  await page.getByTestId('transcript-title-input').fill('Sprint 2 Review');
  await page.getByTestId('transcript-date-input').fill('2026-04-09');
  await page.getByTestId('transcript-file-input').setInputFiles(path.resolve('tests/fixtures/sprint2-review.txt'));
  await page.getByTestId('transcript-submit').click();
  await expect(page.getByTestId('toast-success')).toContainText('queued');
});
```

```js
// tests/e2e/report-generate-edit-export.spec.js
// Scenario 6 — Report generation and persisted edit
// Validates: AC-FE-031, AC-FE-032, AC-FE-033, AC-FE-034, AC-FE-036, AC-INT-006, AC-INT-007
import { test, expect } from '@playwright/test';

test('generate edit and export report', async ({ page }) => {
  await page.goto('/products/dental?tab=reports');
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-loading')).toBeVisible();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });

  await page.getByTestId('report-edit-executive-summary').click();
  await page.getByTestId('report-edit-textarea-executive-summary').fill('Updated executive summary text...');
  await page.getByTestId('report-save-executive-summary').click();
  await expect(page.getByTestId('toast-success')).toContainText('saved');

  await page.reload();
  await expect(page.getByTestId('report-section-executive-summary')).toContainText('Updated executive summary text');

  await page.getByTestId('export-pdf').click();
  await expect(page.getByTestId('export-pdf')).toHaveAttribute('aria-busy', 'true');
});
```

```js
// tests/e2e/read-only-permissions.spec.js
// Scenario 7 — Read-only Permissions
// Validates: AC-FE-015, AC-FE-035, AC-INT-008
import { test, expect } from '@playwright/test';

test('read only user does not see edit/upload controls', async ({ page }) => {
  await page.goto('/products/dental?tab=overview&asRole=read'); // test harness only
  await expect(page.getByTestId('upload-transcript-button')).toHaveCount(0);
  await expect(page.getByTestId('update-weekly-button')).toHaveCount(0);

  await page.goto('/products/dental?tab=reports&asRole=read');
  await expect(page.getByTestId('report-edit-executive-summary')).toHaveCount(0);
  await expect(page.getByTestId('export-pdf')).toBeVisible();
});
```

```js
// tests/e2e/kb-failure.spec.js
// Scenario 8 — KB Failure Handling
// Validates: AC-FE-021, AC-INT-009
import { test, expect } from '@playwright/test';

test('ask failure renders scoped error without crash', async ({ page }) => {
  await page.goto('/products/dental?tab=overview&testCase=kbFailure');
  await page.getByTestId('ask-input').fill('What decisions were made this sprint?');
  await page.getByTestId('ask-submit').click();
  await expect(page.getByTestId('ask-error-state')).toBeVisible();
  await expect(page.getByTestId('product-page')).toBeVisible();
});
```

**Verification workflow**
1. Run the same Playwright specs in headless mode in CI.
2. Run the same spec files in headed mode during implementation/QA.
3. Capture screenshots for visual QA claims in headed mode.
4. The same selector set and assertions must pass in both modes.

---

## 18. Frontend Engineering Handoff (React Implementation Notes)

### 18.1 Route & Navigation Contract

- `/portfolio`
- `/portfolio?quickView=risks|blockers|gaps|brief-prep`
- `/products/:productId?tab=overview|timeline|data|sources|reports`
- `/products/:productId?tab=timeline&timelineFilter=all|decision|transcript|email|risk|ado|weekly|document|blocker`
- `/products/:productId?tab=data&dataTab=risks|blockers|pi`
- `/products/:productId?tab=sources&sourceFilter=all|transcript|email|document|weekly|ado&sourceId=:sourceId`
- `/products/:productId?tab=reports&reportType=weekly|sprint|pi&period=current|previous|custom&reportId=:reportId`

### 18.2 Component Breakdown (React)

**Page components**
- `AppShell`
- `PortfolioPage`
- `ProductPage`
- `UnsupportedViewport`

**Product subviews**
- `ProductHeader`
- `ProductTabs`
- `OverviewView`
- `TimelineView`
- `DataView`
- `SourcesView`
- `ReportsView`

**Reusable components**
- `TopNav`
- `SearchPalette`
- `PulseBar`
- `AlertsBar`
- `ProductCard`
- `StatusBadge`
- `HealthRing`
- `SubscoreBar`
- `GapList`
- `QuickViewDrawer`
- `FilterChipGroup`
- `TimelineGroup`
- `TimelineEntry`
- `DataTable`
- `SourceList`
- `EvidenceList`
- `ReportCoverageCard`
- `EditableReportSection`
- `ToastRegion`
- `ModalShell`
- `EmptyState`
- `ErrorState`
- `LoadingState`

### 18.3 UI State Model (Frontend)

- **Local state**
  - search input and palette visibility
  - selected quick view
  - Ask input
  - expanded timeline rows
  - expanded data row
  - modal open/close
  - report section edit text
  - export button busy states

- **Server state**
  - session, portfolio, quick view, product shell, timeline, data, sources, Ask result, report, job status
  - Use TanStack Query for fetching, caching, invalidation, and polling

- **Persistence**
  - tab/filter/report route state persists in URL
  - Ask input does not persist across refresh
  - unsaved report edit drafts do not persist across refresh
  - scroll restoration for portfolio return only

- **Loading/Error rules**
  - Skeleton for route-level content over 300ms
  - Panel-scoped errors for Ask, Timeline, Data, Sources, Reports
  - Page-scoped errors only for product shell or portfolio shell failure

### 18.4 Forms, Validation, and Error Copy

**Transcript modal**
- `meetingTitle` required, 1–120 chars
- `meetingDate` required, cannot be future date
- `attendees[]` optional, max 20
- `file` required, allowed `.txt .docx .pdf .vtt .md`, max 25MB
- `notes` optional, max 1000 chars

**Weekly modal**
- `weekEnding` required
- `summary` required, 100–1500 chars
- `accomplishments` required, 20–1200 chars
- `risks` optional, max 1200 chars
- `nextSteps` required, 20–1200 chars

**Inline error copy**
- `Enter a meeting title`
- `Choose a meeting date`
- `Meeting date cannot be in the future`
- `Choose a transcript file`
- `File type not supported`
- `File exceeds 25MB limit`
- `Enter a summary between 100 and 1500 characters`
- `Enter accomplishments for this period`
- `Enter next steps`

### 18.5 Test Selectors (Required)

**Shell**
- `topnav-brand`
- `topnav-search-input`
- `search-palette`
- `search-result-product-{id}`
- `search-result-source-{id}`

**Portfolio**
- `portfolio-page`
- `pulse-bar`
- `alerts-bar`
- `product-card-{id}`
- `quick-view-risks`
- `quick-view-blockers`
- `quick-view-gaps`
- `quick-view-brief-prep`

**Product shell**
- `product-page`
- `product-back-link`
- `product-tab-overview`
- `product-tab-timeline`
- `product-tab-data`
- `product-tab-sources`
- `product-tab-reports`

**Overview**
- `knowledge-health-panel`
- `upload-transcript-button`
- `update-weekly-button`
- `ask-input`
- `ask-submit`
- `ask-answer`
- `ask-error-state`
- `ask-evidence-gap-warning`
- `ask-evidence-source-{index}`

**Timeline**
- `timeline-view`
- `timeline-filter-{type}`
- `timeline-entry-{id}`
- `timeline-entry-expand-{id}`

**Data**
- `data-view`
- `data-subtab-risks`
- `data-subtab-blockers`
- `data-subtab-pi`
- `data-row-{id}`
- `data-detail-{id}`

**Sources**
- `sources-view`
- `source-filter-{type}`
- `source-item-{id}`
- `source-detail-drawer`

**Reports**
- `reports-view`
- `generate-report-button`
- `report-loading`
- `report-coverage-card`
- `report-section-{sectionId}`
- `report-edit-{sectionId}`
- `report-edit-textarea-{sectionId}`
- `report-save-{sectionId}`
- `export-pdf`
- `export-pptx`
- `export-copy`
- `export-email`

**Modals/State**
- `upload-transcript-modal`
- `transcript-title-input`
- `transcript-date-input`
- `transcript-file-input`
- `transcript-submit`
- `update-weekly-modal`
- `toast-success`
- `inline-error-panel`
- `unsupported-viewport`

### 18.6 Error Taxonomy (UI)

| Error Code/Condition | UI Component | User-Facing Copy | Recovery Action |
| :--- | :--- | :--- | :--- |
| `VALIDATION_ERROR` | Inline field error | Field-specific copy | Fix field and resubmit |
| `UNAUTHORIZED` | Session expired view | `Session expired. Sign in again.` | Re-authenticate |
| `FORBIDDEN` | Permission view | `You don’t have access to this product.` | Return to portfolio |
| `NOT_FOUND` | Not found view | `This product doesn’t exist.` | Return to portfolio |
| `CONFLICT` | Inline banner/toast | `This section was updated elsewhere. Refresh and try again.` | Refresh + retry |
| `RATE_LIMITED` | Toast | `Too many requests. Try again in a moment.` | Retry after delay |
| `KB_UNAVAILABLE` | Ask/report error | `We couldn’t retrieve evidence right now. Try again.` | Retry |
| `MODEL_TIMEOUT` | Ask/report error | `The model took too long to respond. Try again.` | Retry |
| `INTERNAL_ERROR` | Scoped error state | `Something went wrong. Try again.` | Retry |
| Network failure | Offline banner | `Check your connection and try again.` | Retry |

### 18.7 Analytics & Telemetry Events

| Event Name | Trigger | Payload | Maps to AC |
| :--- | :--- | :--- | :--- |
| `portfolio.viewed` | Portfolio route load | `{ source }` | `AC-FE-005` |
| `product.opened` | Product route load | `{ productId, source }` | `AC-FE-008` |
| `search.executed` | Search request fired | `{ queryLength, resultCount }` | `AC-FE-002` |
| `ask.submitted` | Ask request starts | `{ productId, questionLength }` | `AC-FE-018` |
| `ask.completed` | Ask success | `{ productId, partial, evidenceStrength }` | `AC-FE-019`, `AC-FE-020` |
| `transcript.upload_queued` | Upload returns 202 | `{ productId, sourceId }` | `AC-FE-023` |
| `weekly.published` | Weekly update success | `{ productId, weekEnding }` | `AC-FE-026` |
| `report.generation_started` | Generate clicked | `{ productId, reportType }` | `AC-FE-032` |
| `report.generated` | Report success | `{ productId, reportId, coveragePct }` | `AC-FE-033` |
| `report.section_saved` | Edit save success | `{ reportId, sectionId }` | `AC-FE-034` |
| `export.started` | Export button clicked | `{ reportId, format }` | `AC-FE-036` |
| `feature.error_encountered` | Scoped error render | `{ scope, errorCode }` | `AC-FE-021` and peers |

### 18.8 Data Freshness & Optimistic Updates

- No optimistic updates for Ask, report generation, transcript upload, or connector-backed freshness
- Weekly update save may optimistically close the modal only after server success
- Report section editing is not optimistic; success must come from server
- Polling:
  - report jobs: every 2s until completion/failure
  - optional ingest job badge refresh: every 5s while user is on product page and a pending source exists
- Cache invalidation:
  - product overview invalidated after weekly update publish and after ingest job completion for that product
  - sources invalidated after ingest job completion
  - report query invalidated after report section save

---

## 19. Backend Engineering Handoff

### 19.1 TDD Plan (Combined — Required)

**Frontend Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `portfolio_renders_grouped_cards` | Component | `AC-FE-005`, `AC-FE-007` | Yes |
| `product_card_routes_to_overview` | E2E Playwright | `AC-FE-008`, `AC-INT-002` | Yes |
| `search_palette_keyboard_navigation` | Integration + E2E | `AC-FE-002`, `AC-FE-003` | Yes |
| `ask_panel_success_partial_error` | Integration + E2E | `AC-FE-018`–`AC-FE-021` | Yes |
| `transcript_modal_validation` | Component + E2E | `AC-FE-022` | Yes |
| `weekly_modal_publish` | Integration + E2E | `AC-FE-025`, `AC-FE-026` | Yes |
| `timeline_filter_and_expand` | Integration + E2E | `AC-FE-027` | No |
| `data_single_detail_panel` | Integration + E2E | `AC-FE-028` | No |
| `source_filter_and_detail` | Integration + E2E | `AC-FE-029`, `AC-FE-030` | No |
| `report_generation_edit_export` | E2E Playwright | `AC-FE-031`–`AC-FE-036`, `AC-INT-006`, `AC-INT-007` | Yes |
| `read_only_hides_mutations` | E2E Playwright | `AC-FE-015`, `AC-FE-035`, `AC-INT-008` | Yes |
| `unsupported_viewport_state` | Component + E2E | `AC-FE-039` | No |

**Backend Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `auth_returns_401_without_identity` | Integration/Contract | `AC-BE-001` | Yes |
| `auth_returns_403_for_out_of_scope_product` | Integration/Contract | `AC-BE-002` | Yes |
| `portfolio_contract_returns_grouped_cards` | Contract | `AC-BE-004` | Yes |
| `product_contract_returns_overview_payload` | Contract | `AC-BE-005` | Yes |
| `search_enforces_min_length_and_scope` | Unit/Integration | `AC-BE-007`, `AC-BE-008` | Yes |
| `transcript_upload_creates_source_and_job` | Integration | `AC-BE-009` | Yes |
| `ingest_chunking_writes_sidecars` | Integration | `AC-BE-012` | Yes |
| `kb_sync_failure_marks_source_unindexed` | Integration | `AC-BE-013` | No |
| `email_normalizer_strips_quotes_and_dedupes` | Unit/Integration | `AC-BE-014`, `AC-BE-016` | No |
| `transcript_extractor_persists_decisions_and_actions` | Integration | `AC-BE-017`, `AC-BE-018` | No |
| `ask_returns_partial_when_structured_data_missing` | Integration/Contract | `AC-BE-019`, `AC-BE-020` | Yes |
| `ask_returns_422_for_insufficient_evidence` | Integration/Contract | `AC-BE-021` | Yes |
| `ask_applies_product_filters_to_kb_retrieve` | Unit/Integration | `AC-BE-024` | Yes |
| `snapshot_recompute_is_deterministic` | Unit/Integration | `AC-BE-025`, `AC-BE-026` | No |
| `report_job_persists_sections_and_coverage` | Integration | `AC-BE-027`, `AC-BE-028` | Yes |
| `report_section_patch_preserves_generated_body` | Integration/Contract | `AC-BE-029`, `AC-BE-030` | Yes |
| `export_job_tracks_artifact_state` | Integration | `AC-BE-031`, `AC-BE-032` | No |
| `mailbox_connector_resumes_from_cursor` | Integration | `AC-BE-033` | No |
| `ado_rest_sync_upserts_structured_rows` | Integration | `AC-BE-034` | No |
| `ado_mcp_failure_is_non_blocking` | Integration | `AC-BE-035`, `AC-BE-036` | No |
| `telemetry_is_non_blocking` | Integration | `AC-BE-037`, `AC-BE-038` | No |

**Cross-Cutting Test Inventory**

| Test Name | Type | Covers AC | Write-First? |
| :--- | :--- | :--- | :--- |
| `portfolio_to_product_happy_path` | Full-Stack E2E Playwright | `AC-INT-001`, `AC-INT-002` | Yes |
| `ask_success_partial` | Full-Stack E2E Playwright | `AC-INT-003`, `AC-INT-004` | Yes |
| `upload_to_searchability` | Full-Stack E2E Playwright | `AC-INT-005` | No |
| `report_generate_edit_reload` | Full-Stack E2E Playwright | `AC-INT-006`, `AC-INT-007` | Yes |
| `read_only_permissions` | Full-Stack E2E Playwright | `AC-INT-008` | Yes |
| `kb_failure_handling` | Full-Stack E2E Playwright | `AC-INT-009` | Yes |
| `single_region_runtime_guards` | Integration/Manual | `AC-INT-010` | Yes |

**Stub/Mock Inventory**

| Stub/Mock | Side | Purpose | Phase Removed |
| :--- | :--- | :--- | :--- |
| MSW handlers for `/portfolio`, `/products/:id`, `/timeline`, `/data`, `/sources` | FE | Enables UI build before BE ready | Phase 2 |
| MSW handlers for `/ask` and `/reports` | FE | Enables Ask/Reports UI before orchestration ready | Phase 4 |
| Seeded snapshot tables | BE | Enables reads before connectors/ingest ready | Never fully removed; remains for dev |
| Fake KB retrieve adapter | BE | Unit tests for Ask without live Bedrock | Never removed from tests |
| Fake generation adapter | BE | Contract and failure tests without live model | Never removed from tests |
| Fake mailbox provider client | BE | Connector tests without external dependency | Never removed from tests |
| Fake ADO REST/MCP clients | BE | Connector tests and failure simulation | Never removed from tests |

**Test Data**
- Seed product set: Dental, Optima, Essence, JOMIS, Digital Biobank, MHS Genesis Int.
- Transcript fixture: Sprint 2 Review with decisions/actions
- Email fixtures: approval email, schedule update thread, attachment example
- Structured fixtures: risks/blockers/PI objectives weekly current + stale
- Failure fixtures: KB unavailable, model timeout, conflict on report save

**Playwright E2E Scripts**
- `portfolio-to-product.spec.js`
- `ask-partial.spec.js`
- `upload-transcript.spec.js`
- `report-generate-edit-export.spec.js`
- `read-only-permissions.spec.js`
- `kb-failure.spec.js`
- `unsupported-viewport.spec.js`

**Completeness Rule**
- Every `AC-FE-###`, `AC-BE-###`, and `AC-INT-###` must map to at least one automated test.
- Any end-to-end observable behavior must appear in a Playwright spec.

---

## 20. Out of Scope (Non-Goals)

- Mobile/phone-optimized experience below 1024px
- Admin UI for connector configuration and credential management
- Cross-tenant/multi-enclave support in a single deployment
- Real-time collaborative editing of report sections
- Streaming Ask responses
- Bedrock `RetrieveAndGenerate` as the primary user-facing answer path
- Cross-region inference in production
- Autonomous write-back to Azure DevOps or email systems
- Dark mode

---

## 21. Appendix

### 21.1 Glossary

| Term | Definition |
| :--- | :--- |
| **Knowledge Health** | Composite product score made from Coverage, Freshness, Continuity, and Sync |
| **Coverage** | Whether required artifact types exist for the product and current reporting horizon |
| **Freshness** | How recent the artifact and connector data is |
| **Continuity** | Whether the product has durable organizational memory (PM, org box, transcripts, decisions, stakeholders) |
| **Sync** | Health and recency of structured/system connectors |
| **Evidence Pack** | The bounded set of structured and unstructured evidence passed into Nova Pro for answer/report generation |
| **Partial** | A successful response where some required evidence is missing or stale |
| **Insufficient Evidence** | A response state where the system should not generate a substantive answer |
| **KB** | Amazon Bedrock Knowledge Base |
| **AOSS** | Amazon OpenSearch Serverless |
| **ADO** | Azure DevOps |
| **MCP** | Model Context Protocol |

### 21.2 Reference Materials

- Supplied HTML/CSS/JS mockup for EIDS Product Knowledge Hub
- Amazon Bedrock Knowledge Bases documentation
- Amazon Nova documentation
- Amazon Titan Text Embeddings V2 documentation
- Amazon OpenSearch Serverless documentation
- Amazon Textract documentation
- Azure DevOps MCP documentation

### 21.3 Decision Log

| Decision | Date | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| Use Bedrock Knowledge Base `Retrieve` plus app-side generation instead of `RetrieveAndGenerate` | 2026-04-15 | Needed deterministic evidence packing, structured joins, and partial-answer control | Raw `RetrieveAndGenerate` rejected for lower control |
| Use one KB per environment with strict metadata filters | 2026-04-15 | Simpler to operate than per-product KBs; filters enforce product scope | Per-product KBs rejected for overhead |
| Use Aurora PostgreSQL for structured data and snapshots | 2026-04-15 | Strong relational queries for product/risk/report state | DynamoDB rejected for complex joins/reporting |
| Use OpenSearch Serverless as the vector store for KB | 2026-04-15 | Hybrid search support and GovCloud availability | S3 Vectors rejected because no hybrid search |
| Disable cross-region inference in production | 2026-04-15 | Preserve in-region handling and simplify compliance posture | Cross-region inference rejected for sensitive workloads |
| Treat Azure DevOps MCP as optional enrichment only | 2026-04-15 | REST sync is more deterministic for production ingestion | MCP-only ingestion rejected for operational unpredictability |
| Persist report edits server-side | 2026-04-15 | Supports reload, export, and auditability | Session-only edits rejected |
