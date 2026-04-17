# Stove-Pipe Prevention: Design Patterns for AskEIDS and the Agentic Data Catalog

| Attribute | Detail |
| :--- | :--- |
| Document Title | Stove-Pipe Prevention: Design Patterns for AskEIDS and the Agentic Data Catalog |
| Status | Draft for leadership review — intended to travel with the GovCloud West approval package |
| Version | 1.1 |
| Date | 2026-04-16 |
| Author | Archie Bockhorst |
| Intended Audience | Engineering leadership, architecture review board, GovCloud approval reviewers |
| Scope | Cross-system architecture for AskEIDS (`C:\Projects\AskEIDS`) and the Agentic Data Catalog — NoDocker (`C:\Projects\AgenticDataCatalog-NoDocker`) as both prepare to deploy to AWS GovCloud West |
| Question Answered | What design patterns should we use to make sure we don't build a lot of stove-pipes? |

## TL;DR

These two systems already duplicate five concrete pieces of code and are about to duplicate a sixth — the GovCloud deployment blueprint. The fix is not "a new framework." It is a small set of proven design patterns applied deliberately **before** both apps enter GovCloud West, anchored on a **thin shared platform foundation** that we already have most of in the ADC `shared/` workspace.

Recommendation: make ADC's `shared/` package cross-repo consumable (versioned, owned, released with discipline), migrate AskEIDS to consume it for the layers that genuinely duplicate, and adopt a contract-first API + shared IaC + shared identity substrate across both systems. Keep product-specific concerns — vector store, state repository, LLM task orchestration, UI kit, source/artifact registry — product-local until implementations demonstrably converge. This is a weeks-of-effort investment that prevents years of divergence and a multi-month re-approval cycle if we let the two systems diverge in GovCloud.

On persistence: **Bedrock Knowledge Bases is the production vector-retrieval substrate.** DuckDB retrieval remains useful only for dev/test, where it keeps local development fast, AWS-independent, and cheap. **DuckDB runtime state** on AskEIDS is a separate decision from vector retrieval and should not be conflated with it. ADC stays on SQL Server for its catalog state. This split removes the main infrastructure risk from AskEIDS's GovCloud path and lets us focus the shared-foundation work on the code layers that actually duplicate.

---

## 1. Current Overlap and Divergence Risks

| # | Concern | AskEIDS | ADC | Status |
|---|---|---|---|---|
| 1 | Bedrock text client (Converse API, model allow-list) | `server/src/lib/aws/bedrockText.js` | `services/agent/src/bedrock.js` + `shared/src/bedrockCompliance.js` | Duplicate; ADC already has GovCloud/FIPS compliance enforcement AskEIDS lacks |
| 2 | Titan embedding client | `server/src/lib/aws/titanEmbeddings.js` | `services/agent/src/embeddings.js` | Near-identical — same invoke body, same L2-normalize, same pseudo fallback |
| 3 | AWS FIPS endpoint + client-options builder | `server/src/lib/aws/bedrockCompliance.js` | `shared/src/bedrockCompliance.js` | Two codepaths, same requirement |
| 4 | Structured logging + correlation-id | Ad-hoc JSON `console.*` | `pino` + `shared/src/logger.js` with correlation/user/role mixin, redaction | Missing on AskEIDS — GovCloud cyber will force it |
| 5 | Deployment blueprint (EC2 + nginx + TLS + RDS/DB) | **Zero IaC committed** | `infra/cloudformation/staging2.yaml`, systemd unit templates, STIG assessments, operator runbooks | AskEIDS will build a parallel stack from scratch if we do not intervene |
| 6 | Auth + roles + session | Dev-stub header middleware (`x-eids-role`) | JWT session/service/dev modes, role registry, working login UI | AskEIDS has no production auth story |
| 7 | OpenAPI contracts | None | `openapi/agent.yaml`, `openapi/coordinator.yaml` with shared error envelope | Incompatible error shapes (`{error:{code,...}}` vs `{error_code,...}`) — fix now or migrate both later |
| 8 | Job state machine | DuckDB-backed job state in `server/src/services/state/runtimeState.repository.js` with an in-process worker loop | SQL Server `doc_index_jobs` with `queued|running|succeeded|failed` | Different engines, same contract problem |

That is eight places where two engineers could ship independently and create permanent divergence. Five of them are code we have already written twice; three are capabilities AskEIDS still lacks and will either build from scratch or inherit from ADC.

---

## 2. Recommended Design Patterns

The right framing is not "one big shared kernel." A kernel that absorbs product semantics turns into a cross-product monolith that every team fights. The right framing is **a thin shared platform foundation + a disciplined set of ports for product-local concerns** that can be promoted later if — and only if — the two products' implementations actually converge.

Each pattern is named, paired with what it buys us, and tied to a first concrete application. None of these require inventing new technology.

### 2.1 Platform Foundation — promote now (thin, stable, GovCloud-critical)

These are the layers where AskEIDS and ADC will provably converge in GovCloud because compliance and operations demand it. Duplicating them is strictly worse than sharing them. This is what goes into the cross-repo-consumable package on day one.

| Pattern | What it buys us | First applied to |
|---|---|---|
| **Cross-repo-consumable platform package** (ADC `shared/` hardened for external consumers) | Single source for Bedrock client, Titan client, AWS FIPS client options, env helpers, pino logger, correlation-id middleware, error envelope, typed error codes | Version ADC `shared/` (already an npm workspace package), add CODEOWNERS + release process, publish via internal registry or git dependency, consume from AskEIDS |
| **Typed Error Envelope (shared schema)** | One error shape everywhere: `{ code, message, correlationId, details? }`. UI error handling ships once. | Reconcile AskEIDS `{error:{code,...}}` and ADC `{error_code,message,correlation_id}` in the shared package now |
| **Contract-First API (OpenAPI 3.1)** | One published spec per service, versioned. Prevents wire-contract drift. Generates client types for the UI. | AskEIDS adopts ADC's pattern; both services use the same shared error envelope schema |
| **Shared Identity Substrate** | One identity substrate, one token-validation pattern, one audit/correlation claim shape. Per-product authorization mappings stay product-local. | Replace AskEIDS dev-stub auth (`server/src/app.js:127`) with the shared token-validation helpers from ADC (`shared/src/auth.js`); each product keeps its own authorization policy |
| **Shared Observability Contract** | One log schema, one metrics namespace (`dha_<app>_<metric>`), one correlation-id header, one CloudWatch log-group naming convention. Cross-system traces become real. | Pino + correlation-id middleware from the shared package on both apps |
| **Shared Deployment Blueprint (IaC as a library)** | One CloudFormation nested-stack library: base VPC + Bedrock VPC endpoints + SSM layout + nginx/Caddy + systemd templates. Both apps instantiate it with app-specific params. | Promote `ADC/infra/cloudformation/staging2.yaml` into a reusable module; AskEIDS consumes it (it has zero IaC committed today) |

### 2.2 Ports for Product-Local Concerns — keep product-local, share only on proven convergence

These are the layers where the two products might look similar but actually serve different domains. Premature consolidation here creates the platform monolith. The pattern is: **define a narrow port in the shared package, keep the implementation product-local, and only promote the adapter when two independent implementations demonstrably agree**.

| Pattern | What it buys us | Starting point |
|---|---|---|
| **Ports & Adapters for domain dependencies** | Product code depends on narrow interfaces (`LlmProvider`, `EmbeddingProvider`, `VectorStore`, `IdentityProvider`, `JobQueue`). Adapters stay product-local at first. Promotion happens only when implementations converge. | Add port definitions to the shared package; each product owns its own adapter |
| **`VectorStore` port (KB for prod, DuckDB for dev/test only)** | Product code calls a small `search` / `upsert` / `delete` surface. The only production adapter in this plan is Bedrock Knowledge Bases. DuckDB remains a dev/test adapter for local cost control and fast offline iteration. | ADC already has `shared/src/vectorStores/knowledgeBases.js` + `faiss.js` + `mock.js`; AskEIDS's `server/src/rag/retrievalProvider.js` has a `'kb'` value that silently aliases to DuckDB — wire in the real KB adapter |
| **`StateRepository` port** | Runtime-state behavior contracts (idempotency, CAS, transactions) are specified against the interface. AskEIDS stays on DuckDB (approved for prod). ADC stays on SQL Server. No re-platform required on either side. | Define the interface once in the shared package; each product keeps its own implementation |
| **`LlmTaskRunner` port (product-local runner, shared primitives)** | Product code registers named tasks (`extraction`, `ask`, `summarize`, `catalog_synthesis`) with a per-task prompt registry. The **runner stays product-local**; only the Bedrock client and guardrail helpers come from the shared package. Prevents two identical Bedrock callers without making one product's task registry govern the other. | Shared package ships the Bedrock wrapper + compliance; each product ships its own task registry |
| **Source/Artifact Registry (shared schema shape, per-product rows)** | Unified schema shape (`{sourceType, family, class, ingestBehavior}`) with per-product definitions. AskEIDS's `SOURCE_TYPE_DEFINITIONS` and ADC's `ARTIFACT_LABELS`/`CLASSIFICATION_OPTIONS` converge on the same **shape**, but keep their own **rows**. | Define the row shape in the shared package; no cross-product taxonomy merge |
| **Shared UI Kit (minimal, opt-in)** | Classification banner, auth header, error toast, loading/empty states, `data-testid` conventions. Keeps UX consistent for DHA leadership reviewers without forcing UI convergence beyond what is actually common. | Start with 3–5 components; promote additional components only when both products independently build them |
| **Domain Events (lightweight, later)** | When catalog artifacts need to feed AskEIDS sources (or vice versa), publish events rather than synchronous API calls. Prevents tight coupling and cross-outage blast radius. | EventBridge or S3-backed append log; defer until a real cross-product data flow appears — do not build speculatively |

---

## 3. GovCloud-Specific Guardrails

These are operational guardrails that sit alongside the code patterns above. Doing them once across both systems is cheaper than doing them twice per system. Specific wording below is directional — concrete compliance details should be confirmed with cyber and compliance reviewers before commit.

- **Prefer a shared approved network pattern for Bedrock access** (e.g., one PrivateLink / VPC endpoint set both apps peer into, subject to cyber review), rather than each app standing up its own.
- **Consistent Secrets Manager / Parameter Store naming** (e.g., `/dha/platform/*` shared, `/dha/<app>/*` app-scoped). Audit-friendly and IAM-policy-friendly.
- **Shared CloudTrail + GuardDuty baseline.** One baseline, both apps inherit.
- **Prefer shared IAM permission-boundary patterns** so one app cannot quietly gain broader permissions than the other. Concrete boundary definitions likely trigger additional cyber review and change-control; the pattern (one set of boundaries, shared across apps) is the part to lock in now.
- **Shared STIG-hardened AMI + patching cadence.** ADC already has STIG/SRG assessment work done under `DockerMigration/CyberHardening/` — do not discard it.
- **Prefer shared FIPS endpoint configuration in the platform foundation.** ADC's `bedrockCompliance.js` already encodes this; consolidating it in the shared package and removing the AskEIDS duplicate avoids two divergent FIPS behaviors. Specific region/endpoint requirements for GovCloud West should be confirmed with cyber/compliance before commit.
- **One CloudWatch log-group convention** so SIEM / incident-response can correlate across apps without custom parsers.

---

## 4. Sequencing (what to do and in what order)

### Weeks 1–2 — before either system moves further into GovCloud

1. **Make ADC `shared/` cross-repo consumable.** It is already an npm workspace package (`C:\Projects\AgenticDataCatalog-NoDocker\shared\package.json`) used by ADC services. The work is to version it, add CODEOWNERS, define a release process, and publish it so AskEIDS can depend on it safely (internal npm registry or a disciplined git dependency — choice depends on our approved publishing story). Working name for the external-facing package: `@dha/platform-foundation`.
2. **Reconcile the error envelope.** One shape, now. This is the single cheapest high-leverage fix on the list.
3. **Migrate AskEIDS's duplicates to consume the shared package.** `server/src/lib/aws/bedrockText.js`, `server/src/lib/aws/titanEmbeddings.js`, and `server/src/lib/aws/bedrockCompliance.js` are near-identical to their ADC counterparts. Delete the duplicates after migration.

### Weeks 3–4

4. AskEIDS adopts OpenAPI 3.1 for its routes (mirrors ADC's `openapi/agent.yaml` and `openapi/coordinator.yaml`).
5. AskEIDS replaces its dev-stub auth (`server/src/app.js:127`) with the shared package's token-validation helpers; product-local authorization policy stays product-local.
6. AskEIDS adds pino + correlation-id middleware from the shared package; retires ad-hoc `console.*` logging.
7. **Wire the Bedrock Knowledge Bases adapter into AskEIDS's `VectorStore` port.** `server/src/rag/retrievalProvider.js` currently accepts `'kb'` as a provider value but silently aliases to the DuckDB prototype store. Hook ADC's `shared/src/vectorStores/knowledgeBases.js` (or equivalent) through the shared package so prod retrieval hits KB and dev/test retrieval stays on DuckDB.

### Before GovCloud launch — both apps

8. Extract `infra/cloudformation/staging2.yaml` into reusable nested stacks (base VPC + endpoints + IAM boundary pattern + nginx/systemd templates). Both apps instantiate the same base.
9. Shared approved network pattern for Bedrock (subject to cyber review). Both apps peer in.
10. Shared SSM parameter layout + Secrets Manager layout + CloudTrail/CloudWatch conventions applied to both apps.

### Ongoing

11. Minimal shared UI kit (classification banner, auth UI, error rendering) consumed by both frontends. Start with 3–5 components; promote additional components only after both products independently build them.
12. ADR (architecture decision record) repo referenced by both projects; every shared-package change lands with an ADR.
13. When cross-system data sharing becomes real (catalog artifacts → AskEIDS sources, or usage telemetry either direction), introduce domain events via EventBridge. Do **not** let the apps call each other's HTTP APIs synchronously in production, and do **not** build event infrastructure speculatively before a real cross-product flow exists.

---

## 5. Persistence and Retrieval (what lives where in prod)

Persistence is two distinct concerns, and they take different prod substrates. Treating them separately is how we keep the `StateRepository` port narrow and avoid smuggling vector semantics into state-management contracts.

### 5.1 Runtime state

Runtime state is product-local business state — extractions, aggregates, prompt runs, job queue, read-model projections.

- **AskEIDS runtime state** uses DuckDB (`runtime-state.duckdb`). DuckDB is approved for production, so no re-platforming is required. The existing job state machine in `server/src/services/state/runtimeState.repository.js` and the in-process worker loop continue to serve production, assuming the deployment topology stays within DuckDB-compatible concurrency boundaries.
- **ADC runtime state** uses SQL Server. It already has the schema (`shared/src/schemas/agent-schema-sqlserver.sql`), CloudFormation RDS provisioning, and migration story.
- The `StateRepository` port in the shared package defines behavior contracts (idempotency, CAS, transaction boundaries) against the interface, not the engine. Neither product re-platforms.
- **Optional future lever:** DuckDB is the approved lightweight store for any *new* service in this portfolio. That keeps new workloads from dragging in RDS. Worth formalizing if more DHA products are coming.

### 5.2 Vector retrieval

Vector retrieval is the substrate that answers semantic queries over uploaded documents. This is where the prod decision differs from runtime state.

- **Prod vector retrieval uses Bedrock Knowledge Bases.** In this plan, KB is the only supported production retrieval substrate. It handles ingestion, chunking, embedding, and similarity search as a managed service. Both products call KB through the shared `VectorStore` port.
- **DuckDB retrieval is dev/test only.** AskEIDS's `server/src/rag/prototypeDuckDbStore.js` remains valuable for local development, test harnesses, and cost control, but this memo does not treat DuckDB as the concurrent/shared production vector store.
- Swapping between them is a config change because `VectorStore` is a port, not a direct dependency on either implementation.
- ADC already has a KB adapter at `shared/src/vectorStores/knowledgeBases.js`. AskEIDS's `server/src/rag/retrievalProvider.js` accepts `'kb'` as a provider value but currently aliases to the DuckDB store — wiring the real adapter is a Week 3–4 sequencing item (§4, item 7).

### 5.3 Implication for in-flight specs

**Follow-on reconciliation required against FSFS v2.2** (`PRD/20260416-104117-CODEX-DentalSemanticIntegrityCorrectionsFSFS.md`). That specification currently anchors multiple acceptance criteria and the Module 7 design on DuckDB `rag_chunks` as the retrieval substrate (AC-G-015, AC-G-016, AC-BE-014 through AC-BE-018, AC-BE-022, AC-INT-008, AC-INT-012, plus the Playwright scripts). Under Knowledge Bases:

- Module 7 collapses from "chunk → Titan → persist `rag_chunks` rows" to "push the validated source to the KB data source and trigger a sync."
- Titan embedding and chunking become KB's responsibility; AskEIDS stops calling Titan directly for retrieval ingest.
- `rag_chunks` becomes a dev-only artifact; the production retrieval path goes through `bedrock-agent-runtime:Retrieve`.
- The trust-first boundaries of FSFS v2.2 — extraction validation, aggregate validation, monotonic publish CAS, idempotency, Option 2 publication-decoupling, Ask precedence — survive unchanged. The mechanics of Module 7 do not.

This is a separate session of work and is not part of this memo's scope. Call it out explicitly when we schedule the FSFS v2.3 pass.

---

## 6. The Single Most Important Thing

If we do only one thing from this list, it should be **make ADC's `shared/` cross-repo consumable — versioned, owned, released with discipline — and have AskEIDS depend on it for the thin platform foundation, before either system deploys to GovCloud West.**

Once two GovCloud-approved binaries diverge on the platform foundation layers (Bedrock client, FIPS configuration, identity substrate, logging, error envelope, IaC), reconciling them is likely to trigger additional review/change-control and may require re-approval activity for both. The cost of doing this now is weeks. The cost of doing it after GovCloud is months plus a compliance re-review. That single sequencing decision is the difference between a clean shared platform and a permanent stove-pipe.

Product-local concerns — vector store, state repository, LLM task registry, UI, source/artifact taxonomy — do **not** need to converge on day one, and forcing them to will create a different kind of stove-pipe (the "platform that owns every product's semantics"). Keep them local behind shared ports until real convergence appears.

---

## Appendix A — Reference file paths

### AskEIDS
- `C:\Projects\AskEIDS\server\src\lib\aws\bedrockText.js`
- `C:\Projects\AskEIDS\server\src\lib\aws\titanEmbeddings.js`
- `C:\Projects\AskEIDS\server\src\lib\aws\bedrockCompliance.js`
- `C:\Projects\AskEIDS\server\src\config\runtime.js` (default region `us-gov-west-1`, points at ADC for credential discovery)
- `C:\Projects\AskEIDS\server\src\config\env.js`
- `C:\Projects\AskEIDS\server\src\app.js` (mock auth lives here today)
- `C:\Projects\AskEIDS\shared\artifactTypes.js`
- `C:\Projects\AskEIDS\server\src\rag\prototypeDuckDbStore.js`

### Agentic Data Catalog (NoDocker)
- `C:\Projects\AgenticDataCatalog-NoDocker\shared\src\bedrockCompliance.js`
- `C:\Projects\AgenticDataCatalog-NoDocker\shared\src\vectorStore.js` + `shared\src\vectorStores\{faiss,knowledgeBases,mock}.js`
- `C:\Projects\AgenticDataCatalog-NoDocker\shared\src\auth.js`, `shared\src\roles.js`, `shared\src\logger.js`, `shared\src\env.js`, `shared\src\docsArtifactGovernance.js`
- `C:\Projects\AgenticDataCatalog-NoDocker\services\agent\src\bedrock.js`, `services\agent\src\embeddings.js`, `services\agent\src\config.js`, `services\agent\src\rag.js`
- `C:\Projects\AgenticDataCatalog-NoDocker\services\agent\src\middleware\auth.js`
- `C:\Projects\AgenticDataCatalog-NoDocker\shared\src\schemas\agent-schema-sqlserver.sql`
- `C:\Projects\AgenticDataCatalog-NoDocker\openapi\agent.yaml`, `openapi\coordinator.yaml`
- `C:\Projects\AgenticDataCatalog-NoDocker\infra\cloudformation\staging2.yaml`
- `C:\Projects\AgenticDataCatalog-NoDocker\DockerMigration\20260303-144658-CODEX-01-Target-Architecture.md`
- `C:\Projects\AgenticDataCatalog-NoDocker\DockerMigration\CyberHardening\` (STIG/SRG assessments already completed)
- `C:\Projects\AgenticDataCatalog-NoDocker\.env.aws.example`

---

## Appendix B — Glossary

- **Stove-pipe:** a system built in isolation that duplicates capabilities available elsewhere and does not integrate cleanly with its peers. The primary risk in deploying two AWS GovCloud products without a shared foundation.
- **Platform foundation (thin):** the minimal cross-cutting layer two products agree to share because compliance, security, and operations demand it. In this memo: Bedrock client + FIPS configuration, identity token validation, structured logging + correlation, error envelope, environment helpers, IaC primitives. Deliberately narrower than a traditional "Shared Kernel."
- **Shared Kernel (DDD):** a Domain-Driven Design pattern where two bounded contexts agree to share a specific subset of the domain model and supporting code, versioned and owned jointly. This memo recommends applying it only to the thin platform foundation, not to product-local domains.
- **Ports & Adapters (Hexagonal Architecture):** product code depends on abstract interfaces (ports); concrete implementations (adapters) are swappable and live outside the core domain. In this memo: vector store, state repository, LLM provider, identity provider, job queue — each a port, adapter stays product-local until proven convergent.
- **Cross-repo consumable package:** a package designed to be a dependency of repositories other than the one it lives in. Implies versioning, documented release cadence, CODEOWNERS, a supported publishing mechanism (internal registry or disciplined git dependency), and semver discipline. Distinct from an npm workspace package used only inside its own repo.
- **Contract-First API:** service interfaces are defined by a machine-readable specification (OpenAPI, JSON Schema) before code is written; implementations and clients are generated or validated against the spec.
- **ADR (Architecture Decision Record):** a short, dated, numbered document that captures a single architectural decision, its context, and its consequences. Kept in the repo and referenced when the decision is revisited.
- **Bedrock Knowledge Bases (KB):** the managed AWS Bedrock service that ingests documents, chunks and embeds them, and answers retrieval queries. The production vector-retrieval substrate for both AskEIDS and ADC in this plan.
