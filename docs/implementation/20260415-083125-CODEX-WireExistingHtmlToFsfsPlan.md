# EIDS Product Knowledge Hub Wiring Plan

## Overview
- Objective: implement the supplied FSFS by wiring the existing `index.html` into a real client/server application without creating a second HTML page.
- Success means:
  - `index.html` remains the single HTML entry point.
  - The current visual structure and interaction model are preserved, but inline mock data and fake handlers are replaced with real frontend state, API calls, async jobs, and role-aware behavior.
  - The implementation follows Spec -> Tests -> Code -> Proof.
  - Every major acceptance area has traceable tests and proof.

## Current State
- The workspace currently contains:
  - `index.html` with inline CSS, inline mock data, inline render functions, and simulated interactions.
  - `EIDS-Product-Knowledge-Hub-Full-Stack-Functional-Spec.md` as the source-of-truth feature spec.
  - No existing React/Vite client scaffold.
  - No existing Express API scaffold.
  - No existing shared schema package.
  - No existing automated test harness.
- The current prototype already covers most target information architecture in static form:
  - top nav
  - portfolio landing
  - product tabs
  - overview / ask / timeline / data / sources / reports surfaces
- The prototype does not yet implement:
  - routing with deep links
  - global search behavior
  - quick-view drawer behavior
  - read-only/editor/leadership permission states
  - upload transcript modal
  - update weekly modal
  - source detail drawer
  - editable report sections
  - unsupported viewport state
  - real API integration
  - async job polling
  - persistence
  - RAG / evidence-backed Ask flow
  - automated proof

## Planning Constraints
- Do not create a new HTML page. Reuse `index.html` as the single HTML entry file.
- Preserve the current page's layout, style tokens, and UX intent.
- Build to the FSFS target shape: `client/`, `server/`, and `shared/` monorepo layout.
- Prefer additive refactors over rewriting the prototype blind.
- Implement the lowest valid test level first, then prove the integrated behavior with Playwright.

## Acceptance Criteria For This Plan
- The plan identifies the target architecture needed to turn `index.html` into the production FE shell.
- The plan defines the order of work across FE, BE, shared contracts, data, and proof.
- The plan maps key FSFS acceptance areas to concrete tests.
- The plan identifies likely files/modules to create or modify.
- The plan keeps `index.html` as the only HTML page entry.

## Definition Of Done For The Future Implementation
- `index.html` is the Vite entry page and mounts the real app into `#app`.
- The client uses real route/query state for portfolio/product tabs/filters/report IDs.
- The server implements the documented REST contracts and async job endpoints.
- Seeded and later live data drive the portfolio, product, timeline, data, sources, Ask, and reports views.
- Role-based UI affordances match backend authorization.
- Transcript upload, weekly update publish, report generation/edit/export, and Ask are fully wired.
- All mapped tests pass locally, including Playwright in headless and headed mode.
- The implementation doc and continuity ledger are updated with proof.

## Delivery Strategy
### Principle 1: Reuse The Existing Page
- Keep root `index.html`.
- Do not create `portfolio.html`, `product.html`, or any alternate standalone page.
- Move the inline CSS and JS out of `index.html` gradually, but preserve the DOM structure and design language already approved in the mockup.

### Principle 2: Promote The Prototype Instead Of Rebuilding It
- Use the current render functions and state model as a feature inventory.
- Replace hardcoded constants with API-fed models.
- Replace `onclick` string handlers with component/event wiring.
- Convert simulated behaviors (`setTimeout`, `alert`, local booleans) into real query/mutation/job flows.

### Principle 3: Contract-First Execution
- Define shared JSON schema/contracts before wiring each surface.
- Use those contracts in both FE mocks and BE handlers.
- Only wire UI surfaces after the contracts and failing tests exist.

## Recommended Target File Layout
### Frontend
- `index.html`
  - Keep as the only HTML entry file.
  - Reduce to shell, font includes, root mount, and bundled asset entry.
- `client/src/main.jsx`
- `client/src/App.jsx`
- `client/src/routes/PortfolioRoute.jsx`
- `client/src/routes/ProductRoute.jsx`
- `client/src/components/shell/TopNav.jsx`
- `client/src/components/portfolio/PulseBar.jsx`
- `client/src/components/portfolio/AlertsBar.jsx`
- `client/src/components/portfolio/ProductCard.jsx`
- `client/src/components/portfolio/QuickViewDrawer.jsx`
- `client/src/components/product/ProductHeader.jsx`
- `client/src/components/product/ProductTabs.jsx`
- `client/src/components/overview/KnowledgeHealthPanel.jsx`
- `client/src/components/overview/CurrentStateCard.jsx`
- `client/src/components/overview/AskPanel.jsx`
- `client/src/components/timeline/TimelineView.jsx`
- `client/src/components/data/DataView.jsx`
- `client/src/components/sources/SourcesView.jsx`
- `client/src/components/reports/ReportsView.jsx`
- `client/src/components/reports/EditableReportSection.jsx`
- `client/src/components/modals/UploadTranscriptModal.jsx`
- `client/src/components/modals/UpdateWeeklyModal.jsx`
- `client/src/components/common/UnsupportedViewport.jsx`
- `client/src/components/common/SourceDetailDrawer.jsx`
- `client/src/components/common/SearchPalette.jsx`
- `client/src/lib/api.js`
- `client/src/lib/queryKeys.js`
- `client/src/lib/routerState.js`
- `client/src/styles/tokens.css`
- `client/src/styles/app.css`
- `client/src/test/*`

### Backend
- `server/src/app.js`
- `server/src/routes/session.routes.js`
- `server/src/routes/portfolio.routes.js`
- `server/src/routes/search.routes.js`
- `server/src/routes/products.routes.js`
- `server/src/routes/jobs.routes.js`
- `server/src/routes/telemetry.routes.js`
- `server/src/routes/connectors.routes.js`
- `server/src/middleware/auth.js`
- `server/src/middleware/errorHandler.js`
- `server/src/services/read/portfolio.service.js`
- `server/src/services/read/product.service.js`
- `server/src/services/read/search.service.js`
- `server/src/services/rag/askOrchestrator.service.js`
- `server/src/services/rag/queryPlanner.service.js`
- `server/src/services/rag/structuredRetrieval.service.js`
- `server/src/services/rag/kbRetrieve.service.js`
- `server/src/services/rag/evidencePack.service.js`
- `server/src/services/rag/generation.service.js`
- `server/src/services/rag/validation.service.js`
- `server/src/services/ingest/sourceIntake.service.js`
- `server/src/services/ingest/normalize/*`
- `server/src/services/rag/chunking.service.js`
- `server/src/services/rag/kbSync.service.js`
- `server/src/services/health/healthScoring.service.js`
- `server/src/services/reports/reportOrchestrator.service.js`
- `server/src/services/reports/export.service.js`
- `server/src/workers/*`
- `server/test/*`

### Shared
- `shared/contracts/*.schema.json`
- `shared/contracts/index.js`
- `shared/fixtures/*`
- `shared/constants/*`

## Workstreams
### Workstream A: Bootstrap The Monorepo Around The Existing Page
- Create `client/`, `server/`, and `shared/`.
- Keep `index.html` at repo root as the client entry file.
- Add Vite config that uses the existing root `index.html`.
- Extract the current inline CSS into `client/src/styles/tokens.css` and `client/src/styles/app.css`.
- Extract the current inline JS into React components and route state, without changing the visual structure.

### Workstream B: Shared Contracts And Seed Data
- Define JSON schema for:
  - session
  - portfolio
  - quick view
  - product overview
  - timeline
  - data sets
  - sources
  - Ask
  - report lifecycle
  - jobs
  - errors
- Create seed fixtures that mirror the current mock data already in `index.html` so the first wiring step preserves the prototype's content.

### Workstream C: Backend Read APIs First
- Implement seeded `GET` endpoints first:
  - `/api/v1/session`
  - `/api/v1/portfolio`
  - `/api/v1/portfolio/quick-view`
  - `/api/v1/search`
  - `/api/v1/products/:productId`
  - `/api/v1/products/:productId/timeline`
  - `/api/v1/products/:productId/data`
  - `/api/v1/products/:productId/sources`
  - `/api/v1/products/:productId/sources/:sourceId`
- Back these with in-memory fixtures first, then Aurora.
- This gives the frontend something real to wire against before mutations/RAG.

### Workstream D: Frontend Read Wiring
- Replace hardcoded `PRODUCTS`, `DENTAL_TIMELINE`, `DENTAL_RISKS`, etc. with query-driven state.
- Replace manual view booleans with router state and query params.
- Add test IDs from the FSFS.
- Implement panel-scoped loading, empty, partial, and error states.
- Implement unsupported viewport behavior below 1024px.

### Workstream E: Mutations And Async Jobs
- Add upload transcript modal.
- Add update weekly modal.
- Add report generation kickoff + polling.
- Add report section editing with conflict handling.
- Add export actions with per-button busy states.

### Workstream F: Ask / RAG / Evidence Flow
- Wire Ask input to `POST /api/v1/products/:productId/ask`.
- Render answer states from real API payloads:
  - success
  - partial
  - insufficient evidence
  - recoverable error
- Ensure the answer UI is driven entirely by returned evidence/citation data, not hardcoded text.

### Workstream G: Proof, Hardening, And Connector Prep
- Add Playwright coverage for the user-visible flows named in the FSFS.
- Add API contract tests and service integration tests.
- Add seeded fixtures for role variants and failure modes.
- Only after proof is stable, proceed to Aurora/S3/SQS/Bedrock integration slices.

## Phase Plan
### Phase 1 - Foundation And Read-Only Skeleton
#### Goal
- Turn `index.html` into the mounted shell of a real app and prove portfolio/product overview from seeded API data.

#### Steps
1. Scaffold Vite client and Express server.
2. Keep `index.html` as the sole entry HTML.
3. Extract existing styles and shell layout.
4. Add shared fixture data copied from the current mock constants.
5. Implement session, portfolio, and product overview APIs.
6. Wire portfolio and overview surfaces to those APIs.

#### Tests To Write First
- FE component/integration:
  - portfolio renders grouped cards
  - product card navigation opens overview
  - unsupported viewport renders below 1024px
- BE contract:
  - `/api/v1/session`
  - `/api/v1/portfolio`
  - `/api/v1/products/:productId`
- E2E:
  - portfolio to product happy path

#### Exit Proof
- Real client renders the same overall page structure currently shown in `index.html`, but from API responses instead of inline constants.

### Phase 2 - Complete The Read Experience
#### Goal
- Wire timeline, data, sources, search, and quick views.

#### Steps
1. Build query-param routing for tabs and filters.
2. Implement timeline, data, sources, search, and quick-view APIs.
3. Add quick-view drawer and source detail drawer.
4. Add keyboard search palette behavior.
5. Add permission-aware shell behavior.

#### Tests To Write First
- FE:
  - search palette open/keyboard navigation
  - timeline filter behavior
  - single data detail panel behavior
  - source filter/detail behavior
- BE:
  - search min-length validation and scoped results
  - timeline/data/sources contracts
- E2E:
  - deep-linked tab/filter routes
  - quick view drawer to product navigation

#### Exit Proof
- Every read-only tab in the current prototype is backed by live endpoints and deep-linkable URL state.

### Phase 3 - Mutations And Report Lifecycle
#### Goal
- Replace the fake report generation and add real authoring workflows.

#### Steps
1. Implement upload transcript modal and transcript kickoff endpoint.
2. Implement weekly update modal and publish endpoint.
3. Implement report job kickoff, polling, and report read endpoint.
4. Implement editable report sections and conflict handling.
5. Implement export kickoff and per-button busy states.

#### Tests To Write First
- FE:
  - transcript modal validation
  - weekly modal validation
  - report generation loading state
  - report edit save/cancel/conflict
  - per-export-button busy state
- BE:
  - transcript upload creates source/job
  - weekly publish persists row
  - report job returns `202`
  - section patch preserves generated body
  - export job tracking
- E2E:
  - upload transcript queued
  - report generate -> edit -> reload -> export
  - read-only permissions hide mutation controls

#### Exit Proof
- The reports tab no longer uses `setTimeout`; it is fully driven by persisted report/job state.

### Phase 4 - Ask And Evidence Honesty
#### Goal
- Replace the hardcoded Ask answer with real evidence-backed results.

#### Steps
1. Implement Ask endpoint contract with seeded response fixtures first.
2. Wire Ask UI to loading/partial/error/success API states.
3. Add evidence source clicks to source detail or filtered timeline.
4. Add request trace metadata and telemetry.
5. Then replace seeded Ask orchestration with real retrieval/generation services.

#### Tests To Write First
- FE:
  - Ask button disabled for short input
  - Ask prevents duplicate submits
  - Ask partial warning and retry states
- BE:
  - Ask success contract
  - partial when evidence is incomplete
  - 422 insufficient evidence
  - KB filter application guard
- E2E:
  - Ask success with partial warning
  - Ask KB failure handling

#### Exit Proof
- The Ask panel is fully API-driven and cannot present a hardcoded answer as if it were real evidence.

### Phase 5 - Data Plane And Production Hardening
#### Goal
- Replace seeded backend data with real persistence, jobs, and retrieval infrastructure.

#### Steps
1. Add Aurora schema/migrations.
2. Add S3 raw/normalized storage.
3. Add SQS job queues and workers.
4. Add normalization/chunking/KB sync.
5. Add health snapshot recompute.
6. Add report generation and export workers.
7. Add mailbox/ADO sync later, after core manual workflows are proven.

#### Tests To Write First
- BE:
  - migration/schema tests
  - chunking writes sidecars
  - KB sync failure marks source unindexed
  - snapshot recompute deterministic behavior
  - report worker persistence
- E2E:
  - upload transcript -> later searchable
  - report generation from persisted data

#### Exit Proof
- Manual workflows and read views operate on durable storage and async infrastructure, with logs and job IDs.

## Traceability Matrix
| Area | Acceptance Focus | First Test File | Proof Layer |
| --- | --- | --- | --- |
| App shell | top nav, search, identity | `client/src/test/app-shell.test.jsx` | component + e2e |
| Portfolio | grouped cards, ordering, navigation | `client/src/test/portfolio.test.jsx` | integration + e2e |
| Product overview | health, narrative, signals, permissions | `client/src/test/product-overview.test.jsx` | integration + e2e |
| Timeline | filters, expansion, deep links | `client/src/test/timeline.test.jsx` | integration + e2e |
| Data | subtabs, single expanded detail | `client/src/test/data-view.test.jsx` | integration + e2e |
| Sources | filters, source detail drawer | `client/src/test/sources-view.test.jsx` | integration + e2e |
| Ask | validation, loading, partial/error/success | `client/src/test/ask-panel.test.jsx` | integration + e2e |
| Reports | generation, edit, export | `client/src/test/reports-view.test.jsx` | integration + e2e |
| Session/auth | 401/403 rules | `server/test/auth.contract.test.js` | integration/contract |
| Read APIs | portfolio/product/timeline/data/sources/search | `server/test/read.contract.test.js` | contract |
| Mutation APIs | transcript/weekly/report/export | `server/test/mutations.contract.test.js` | contract/integration |
| Ask orchestration | partial/error/evidence rules | `server/test/ask.integration.test.js` | integration |
| Async jobs | jobs/report/export/ingest status | `server/test/jobs.integration.test.js` | integration |

## Implementation Checklist
- [ ] Create `client/`, `server/`, and `shared/` scaffolds.
- [ ] Keep `index.html` as the sole HTML entry point and reduce it to shell responsibilities.
- [ ] Extract current tokens and styles from `index.html`.
- [ ] Port current prototype sections into React components without changing the information architecture.
- [ ] Define shared JSON schema contracts for all read and mutation endpoints.
- [ ] Add seed fixtures matching the current prototype content.
- [ ] Implement read APIs and wire portfolio/product overview.
- [ ] Implement tab/filter URL state and read-only surfaces.
- [ ] Implement transcript upload and weekly update flows.
- [ ] Implement report generation, polling, edit, and export.
- [ ] Implement Ask API wiring with honest evidence states.
- [ ] Add backend persistence/jobs/infrastructure slices.
- [ ] Add Playwright and contract/integration proof for each surfaced feature.
- [ ] Update this document and the continuity ledger with proof as implementation proceeds.

## Key Risks And Mitigations
### Risk 1: Rebuilding The Page Instead Of Reusing It
- Mitigation: treat `index.html` as the source shell and copy its structure/component boundaries directly before changing behavior.

### Risk 2: Wiring The UI Before Contracts Exist
- Mitigation: shared contracts and failing tests come first for each surface.

### Risk 3: Ask/Report Becoming Fake-Real Hybrid States
- Mitigation: remove hardcoded success text early; use explicit seeded API responses until the real backend exists.

### Risk 4: Async Jobs Without User-Visible Honesty
- Mitigation: every mutation and report/export action must show pending, partial, failed, and completed states tied to `jobId`.

### Risk 5: Over-scoping Connectors Too Early
- Mitigation: manual upload + weekly + seeded read APIs first, then persistence, then connectors.

## Recommended Build Order
1. Foundation: client/server/shared scaffolds plus keep `index.html` as entry.
2. Seeded read APIs and read-only UI wiring.
3. URL state, quick views, search, sources, and permissions.
4. Report lifecycle and authoring workflows.
5. Ask lifecycle and evidence states.
6. Durable storage, jobs, RAG, and connectors.

## Proof Strategy
- Lowest valid level first:
  - unit tests for pure mapping/state/helpers
  - integration/contract tests for API responses and mutations
  - Playwright for user-visible flows
- Required early Playwright set:
  - portfolio-to-product
  - ask-partial
  - upload-transcript
  - report-generate-edit-export
  - read-only-permissions
  - kb-failure
  - unsupported-viewport
- Same Playwright suite must pass headless and headed before the implementation is considered done.

## Immediate Recommendation
- Start with a narrow but structural slice:
  - scaffold client/server/shared
  - keep `index.html`
  - wire `/api/v1/session`, `/api/v1/portfolio`, and `/api/v1/products/:productId`
  - port portfolio + overview to real query-driven state
- That slice gives the highest leverage because it proves the page can be promoted from mockup to application without violating the "no new page" constraint.
