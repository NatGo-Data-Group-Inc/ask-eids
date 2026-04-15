# 1. Document Overview

| Attribute | Detail |
| :--- | :--- |
| **Document Title** | UI/UX Requirements: Artifact Upload and Evidence Consumption |
| **Status** | Draft |
| **Version** | 1.0 |
| **Date Last Updated** | April 15, 2026 |
| **UX Lead** | Codex |
| **Target Frontend** | Existing AskEIDS React 18 + Vite internal web application |
| **Existing UI Library** | None detected. Custom tokenized component patterns implemented in React with `runtime.css` |
| **Primary Routes Affected** | `/portfolio`, `/products/:productId?tab=overview|sources|reports|data|timeline` |
| **Assumed Design System** | Reuse existing custom card, modal, drawer, tab, chip, toast, and button patterns already present in the app |

**Assumptions**
- The application remains desktop-only for V1 and continues to show the explicit unsupported viewport state below 1024px.
- Artifact uploads are processed one primary artifact at a time.
- Transcript upload becomes a specialized compatibility path under a generalized artifact upload experience.
- All user-visible product evidence, source previews, Ask citations, search results, and report evidence references must be derived from application-processed artifact content rather than hardcoded HTML content.
- This UXRD defines only the UI-facing contract the frontend requires; parser, storage, and indexing internals remain in the full-stack implementation spec.

---

# 2. Feature Summary & Target End State

## 2.1 Executive Summary
Artifact Upload and Evidence Consumption enables product leads, editors, and leadership users to add real evidence artifacts to AskEIDS and immediately see the application update from those artifacts. This addresses the current UX problem where upload behavior is transcript-only, binary document classes like slide decks and spreadsheets are not treated as first-class evidence in the UI, and users cannot confidently tell how new uploads changed product understanding. When complete, users will be able to upload a supported artifact, track its processing state, verify how it appears in Sources, and see its impact surface through Ask, search, reports, and product trust signals.

## 2.2 Concrete UI/UX Changes

| # | Location (Screen / View / Component) | Change Type | Description (What the User Will See) |
| :--- | :--- | :--- | :--- |
| 1 | Product Overview → Mutation actions | **Modified** | `Upload Transcript` is replaced with a generalized `Upload Artifact` action for supported artifact types. |
| 2 | Product Overview → Upload modal | **Modified** | Transcript-only form becomes a generalized artifact upload modal with file type, source date, optional metadata, validation, and recovery states. |
| 3 | Product Overview → Ingest feedback area | **New** | The page shows visible queued/processing/partial/failed/completed artifact ingest status rather than relying only on a success toast. |
| 4 | Product Overview → Ask panel | **Modified** | Ask shows explicit loading and retry states and can visibly cite newly uploaded artifacts. |
| 5 | Product Overview → Evidence update messaging | **New** | After successful ingest, the page can indicate that recent product understanding was updated from newly processed evidence. |
| 6 | Product Sources tab → Filter chips | **Modified** | Source filters expand to support generalized artifact classes, including slide decks and spreadsheets. |
| 7 | Product Sources tab → Source list | **Modified** | Uploaded artifacts appear with type-aware metadata, processing state, and parser-warning affordances. |
| 8 | Product Sources tab → Source detail drawer | **Modified** | Source detail supports normalized previews for uploaded slide decks, spreadsheets, documents, transcripts, and emails. |
| 9 | Product Reports tab | **Modified** | Report generation and evidence coverage surfaces can reflect newly uploaded artifacts as supporting evidence. |
| 10 | Global search palette | **Modified** | Search results can surface newly uploaded artifacts after processing completes. |
| 11 | Product Data tab | **Modified** | Structured imports can visibly update risks, blockers, PI objectives, and action items, while narrative uploads remain evidence-only. |
| 12 | Permission states | **Modified** | Read-only users do not see upload controls and receive clear evidence-consumption-only behavior. |
| 13 | Async feedback surfaces | **Modified** | New inline error, retry, warning, and partial-processing treatments are introduced for upload and Ask flows. |
| 14 | Accessibility affordances | **Modified** | Modal, tab, async announcement, and focus-management behavior is upgraded to a spec-defined accessible interaction model. |

## 2.3 Target End State Description
When the feature is complete, a user opens a product page and can upload a supported artifact without leaving the product context. The upload flow feels native to the current AskEIDS interface: it uses the same modal language, button styling, and toast behavior already present in the app, but adds clearer validation, processing feedback, and recovery messaging. After an artifact is processed, the Sources tab shows a first-class source entry with a type-aware preview, the Ask panel can cite the artifact where relevant, global search can return it, and reports can include it as evidence. The experience feels trustworthy because users can tell whether the artifact is fully processed, partially extracted, or failed, and because the app distinguishes between narrative evidence that enriches context and structured imports that directly change tables and indicators.

## 2.4 Supported Artifact Types and UI Behavior Matrix

| File Extension | Selectable Source Type(s) | Default Source Type | User Can Change Type? | Evidence-Only vs Structured Import | Preview Behavior | Downstream Impact | Allowed in V1 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `.pptx` | `slide_deck` | `slide_deck` | No | Evidence-only | Slide titles, bullet/body text, and notes excerpt for the first 5 slides | Sources, Ask, search, reports | Yes |
| `.xlsx` | `spreadsheet_attachment`, `risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export` | `spreadsheet_attachment` | Yes, with explicit confirmation for structured types | Evidence-only by default; structured import when explicitly confirmed | Sheet names plus first 10 rows of the selected primary sheet preview | Sources, Ask, search, reports; Data only when confirmed as a structured import | Yes |
| `.csv` | `risk_export`, `blocker_export`, `pi_objectives_export`, `action_item_export`, `ado_export` | No default until user selects | Yes, selection required | Structured import | Header row plus first 10 data rows | Data, Sources, Ask, search, reports | Yes |
| `.pdf` | `document`, `security_summary` | `document` | Yes, within allowed document-like types | Evidence-only | Heading-aware normalized text excerpt | Sources, Ask, search, reports | Yes |
| `.docx` | `document`, `decision_memo`, `release_plan`, `weekly_update`, `transcript` | `document` | Yes, within allowed document-like types | Evidence-only | Heading-aware normalized text excerpt | Sources, Ask, search, reports | Yes |
| `.eml` | `email` | `email` | No | Evidence-only | Subject, from/to, sent date, and cleaned body excerpt | Sources, Ask, search, reports | Yes |
| `.md` | `document`, `weekly_update`, `decision_log`, `transcript` | `document` | Yes, within allowed markdown-like types | Evidence-only | Normalized text excerpt with heading preservation | Sources, Ask, search, reports | Yes |
| `.txt` | `document`, `transcript` | `document` | Yes, within allowed text-like types | Evidence-only | Normalized text excerpt | Sources, Ask, search, reports | Yes |
| `.vtt` | `transcript` | `transcript` | No | Evidence-only | Speaker/time marker excerpt plus extracted summary block | Sources, Ask, search, reports | Yes |
| `.metadata.json` | Companion metadata only | N/A | N/A | N/A | No standalone preview | Improves labeling and validation only | Yes as companion only |

**Artifact Classification Rules**
- Extension-locked types: `.eml` is always `email`; `.vtt` is always `transcript`; `.pptx` is always `slide_deck`.
- Reviewable default types: `.pdf`, `.docx`, `.md`, and `.txt` auto-select a document-like default but require visible user review before submit.
- Structured import gating: `.csv` always requires explicit type selection. `.xlsx` defaults to evidence-only and can become a structured import only after explicit user confirmation.
- Misclassification is not allowed across incompatible families. A user cannot classify a slide deck as a structured import, and cannot classify an email as a transcript.
- If a companion metadata file conflicts with the selected source type or current product scope, submission is blocked and the conflict is surfaced inline.

---

# 3. User Research & Context

## 3.1 Target User Personas

**Persona 1: Portfolio Lead**
- **Role/Context:** Oversees multiple products and prepares recurring leadership updates.
- **Goals:** Add missing evidence quickly, understand what changed, and trust that product status reflects the latest uploaded material.
- **Pain Points:** Status reconstruction is manual; evidence quality is inconsistent; new artifacts are easy to lose in disconnected folders.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Daily to weekly

**Persona 2: Product Manager / Editor**
- **Role/Context:** Owns one or more products and is responsible for keeping the product page current.
- **Goals:** Upload real artifacts from meetings, email, leadership decks, spreadsheets, and documents; verify the app consumed them correctly; reduce repeated explanation work.
- **Pain Points:** Important project knowledge lives in email attachments, decks, spreadsheets, and decision memos that are not consistently surfaced in one place.
- **Technical Proficiency:** Intermediate
- **Usage Frequency:** Daily

**Persona 3: Leadership Reviewer**
- **Role/Context:** Consumes product pages, Ask answers, and generated reports to make decisions.
- **Goals:** Trust that answers and reports reflect the latest evidence without manually opening every source.
- **Pain Points:** Traditional updates are stale, hand-assembled, and disconnected from actual artifacts.
- **Technical Proficiency:** Beginner to Intermediate
- **Usage Frequency:** Weekly to occasional

**Persona 4: Operations / Knowledge Analyst**
- **Role/Context:** Helps curate artifacts, diagnose ingest issues, and verify evidence quality.
- **Goals:** Detect partial or failed processing, retry safely, and confirm which artifacts materially affect downstream views.
- **Pain Points:** Silent failures and metadata-only placeholders create mistrust and make support difficult.
- **Technical Proficiency:** Advanced
- **Usage Frequency:** Daily

## 3.2 User Problem Statement
As a product or portfolio user, I struggle to add real supporting artifacts and trust that the application actually used them, because the current upload experience is narrow and the app does not clearly show how newly uploaded evidence affects sources, answers, and reporting. That makes me uncertain about what the system really knows, forces manual verification, and weakens confidence in product status.

## 3.3 User Success Criteria
- Users can upload a supported artifact in one modal flow without leaving the product page.
- Users can tell whether processing is queued, running, partial, failed, or complete without opening developer tools or guessing from a toast alone.
- Users can confirm within the UI that a newly uploaded artifact appears in Sources and can be used by Ask or reports where relevant.
- Users understand the difference between an upload that enriches evidence context and a structured import that directly changes Data-tab tables.
- Read-only users can still consume uploaded evidence safely without seeing editing controls they cannot use.

---

# 4. User Flows & Journey Mapping

## 4.1 Primary User Flow

**Entry Point:** Authenticated editor opens `/products/dental?tab=overview` and clicks the upload action in the Overview view.

**Step-by-Step Flow:**
1. **Open Upload Artifact modal:** User clicks `Upload Artifact`; the modal opens, focus moves into the modal title, and the background page is inert.
2. **Provide artifact metadata:** User selects a supported file, confirms or sets source type, enters source date, optionally edits title and supporting metadata, and reviews validation hints.
3. **Submit upload:** User clicks `Upload`; submit enters a busy state, duplicate submits are prevented, and the modal remains visible until the request outcome is known.
4. **Receive queued response:** On success, the modal closes, a success toast appears, and an inline processing indicator appears in the product shell showing that the artifact is queued or processing.
5. **Verify source visibility:** User opens Sources and sees the new source row with type-aware metadata and a processing or completed state.
6. **Consume downstream evidence:** Once processing completes, the user asks a related question or generates a report and sees the new artifact cited or reflected where relevant.
7. **Completion:** The product page continues to feel stable and trustworthy; no part of the page requires a full reload to understand what changed.

**Exit Points:**
- User can cancel the modal before submission with no persisted changes.
- User can leave the product page while processing continues; returning later must rehydrate the current ingest state.
- User can abandon after queued submission; the app must still surface final status when they return to the product.

## 4.2 Alternative Flows & Edge Cases
- **Happy Path Variation: Structured Import**
  - User uploads a structured CSV or spreadsheet import classified as a structured dataset.
  - The product shell shows successful processing and the Data tab visibly reflects updated rows after refresh/invalidation.
- **Happy Path Variation: Narrative Evidence Upload**
  - User uploads a slide deck or decision memo.
  - The source appears in Sources and Ask/search/report can consume it, but Data-tab tables do not change directly.
- **Validation Failure**
  - User submits an unsupported extension, a future date, or missing required fields.
  - The modal stays open, inline field errors appear, prior entries remain intact, and submission is blocked.
- **Partial Processing**
  - The server accepts the upload but returns a partial extraction or warning state.
  - The source still appears, but the UI clearly labels the artifact as partial and indicates what downstream uses may be limited.
- **Server Failure / Timeout**
  - Upload request or follow-on processing fails.
  - The user sees inline error treatment with Retry, their entered values remain, and the app shell remains stable.
- **Read-Only Role**
  - A read-only user opens the same product.
  - Upload controls are hidden, but newly uploaded artifacts remain visible in Sources, Ask, and reports.
- **Abandoned Flow**
  - User closes the tab after upload submission.
  - On return, the page shows the current processing state or final result without relying on stale modal state.

## 4.3 User Flow Diagram
A flow diagram is required for implementation but not required as a separate design artifact for this documentation-only deliverable. The written flows in Sections 4.1 and 4.2 are the source of truth for implementation and Playwright proof.

---
# 5. Interface Design Requirements

## 5.1 Screen/View Inventory

**View 1: Product Overview with Upload Entry**
- **Purpose:** Provide the primary launch point for adding evidence while preserving the current product summary, health, signal, and Ask layout.
- **Key Information Displayed:** Product health, current-state narrative, recent signals, Ask panel, upload/update actions, and any active ingest status summary.
- **Primary Actions:** Open upload modal, publish weekly update, submit Ask query, move to related tabs.
- **Navigation:** Enter from product route with `tab=overview`; exit to other product tabs or back to portfolio.

**View 2: Upload Artifact Modal**
- **Purpose:** Collect artifact file input and the minimum metadata required for deterministic UI behavior.
- **Key Information Displayed:** Accepted file types, current field values, classification guidance, structured-import warning treatment where applicable, inline errors, server error state, busy state, and optional metadata guidance.
- **Primary Actions:** Choose file, select source type, enter metadata, submit upload, cancel.
- **Navigation:** Opens over the current product view; closes on cancel, success, or escape/backdrop only when not busy.

**View 3: Ingest Status Surface**
- **Purpose:** Show what is happening after upload submission without forcing the user to hunt in the Sources tab.
- **Key Information Displayed:** Artifact title, current ingest stage, warning state, retry affordance if applicable, and which downstream areas may update.
- **Primary Actions:** View source, retry failed processing where supported, open Sources tab.
- **Navigation:** Inline as a single card directly below the Overview mutation actions. It shows only the most recent active upload or most recent terminal upload. It persists across product tab switches while status is `queued`, `running`, `partial`, or `failed`. It is not dismissible before a terminal state. After `completed` or `failed`, it may be dismissed manually and the artifact remains available in Sources.

**View 4: Sources Tab**
- **Purpose:** Present the canonical inventory of uploaded evidence.
- **Key Information Displayed:** Source title, type, date, author, processing state, parser warning state, and preview summary.
- **Primary Actions:** Filter by source type, open source detail, open/download raw content where permitted.
- **Navigation:** Enter through `tab=sources`; source detail opens as an overlay drawer.

**View 5: Source Detail Drawer**
- **Purpose:** Let users inspect what the application extracted from a source without leaving context.
- **Key Information Displayed:** Title, date, author, participants, type, normalized preview content, parser warnings, processing state, and source-open/download affordances.
- **Primary Actions:** Close drawer, inspect warnings, and use a source action that is type-dependent:
  - text-like sources may expose `Open Source` to open the full normalized content
  - binary sources must expose `Download Original`
- **Navigation:** Opens from a source row or a deep link with `sourceId` in the query string.

**View 6: Ask Panel with Updated Evidence Feedback**
- **Purpose:** Let users question the current product state and see newly uploaded evidence cited when relevant.
- **Key Information Displayed:** Ask input, disabled/enabled state, loading state, answer block, evidence gap or partial warning, retry CTA on recoverable failure, and cited sources.
- **Primary Actions:** Ask question, retry on failure, open cited sources.
- **Navigation:** Native to Overview; can send users to Sources or Timeline based on evidence links.

**View 7: Reports View with Uploaded Evidence Coverage**
- **Purpose:** Show that generated reports can include newly uploaded evidence and keep evidence coverage transparent.
- **Key Information Displayed:** Coverage percentage, coverage breakdown, warning text, report sections, export actions, and evidence freshness messaging.
- **Primary Actions:** Generate report, edit allowed sections, export, verify evidence coverage.
- **Navigation:** Enter through `tab=reports`; report generation remains async.

## 5.2 Information Architecture
- **Content Hierarchy:**
  - **Primary:** Upload action, artifact status, source visibility, Ask/report trust signals.
  - **Secondary:** Optional metadata, parser warnings, source preview details, affected downstream areas.
  - **Tertiary:** Attachment-specific nuance like participants, parser notes, or partial extraction hints.
- **Content Grouping:**
  - Upload initiation and mutation actions remain grouped in Overview.
  - Process-state and trust feedback stay close to the action that triggered them.
  - Source discovery and verification remain centralized in the Sources tab.
  - Downstream consumption remains in Ask, search, and Reports rather than inventing a new evidence destination.
- **Navigation Model:** Existing top nav + product tab shell remains unchanged; query params continue to persist view selection and deep links.

## 5.4 Preview Behavior Requirements
- **Slide deck preview:** Show slide number, slide title, slide bullet/body text, and notes excerpt when available. Default drawer view shows the first 5 slides with a truncation notice if more content exists.
- **Spreadsheet preview:** Show workbook title, visible sheet names, selected primary sheet, and the first 10 rows of the primary sheet preview. Truncate wide tables after 6 visible columns with a clear truncation indicator.
- **Document preview:** Show heading-aware normalized text excerpt with the first meaningful section boundaries preserved.
- **Email preview:** Show subject, sender, recipients, sent date, and cleaned body excerpt with quoted boilerplate removed when possible.
- **Transcript preview:** Show source metadata, extracted summary/decisions/actions block when available, and a transcript excerpt preserving speaker and time markers.
- **Partial extraction preview:** If extraction is incomplete, the preview must still render the available extracted content and display the warning above the preview body.

## 5.3 Layout & Responsive Requirements
- **Desktop Layout:** Existing desktop card-based layout remains the base. Upload entry lives in the current Overview control area. Modal remains centered. Source detail remains a right-side drawer. Processing summaries appear inline within the Overview content column or immediately below mutation actions.
- **Tablet Considerations:** Not supported in V1 beyond the existing desktop threshold behavior.
- **Mobile Layout:** Out of scope. Viewports below 1024px continue to show the explicit unsupported viewport state.
- **Breakpoints:**
  - `<1024px`: unsupported viewport state
  - `>=1024px`: full feature available

---

# 6. Interaction Design Specifications

## 6.1 Core Interactions

**Interaction 1: Open Upload Artifact Modal**
- **Trigger:** Click `Upload Artifact` button in Overview.
- **Feedback:** Modal animates in using existing modal overlay language; focus lands on the modal heading or first invalid field if opened from an error retry path.
- **Result:** Background is visually dimmed and interaction-disabled.
- **Animation/Transition:** Use existing modal transition behavior; must respect `prefers-reduced-motion`.

**Interaction 2: Select Artifact File**
- **Trigger:** Choose a local file in the file input.
- **Feedback:** Selected file name becomes visible; any previous file-related error clears once the selection is valid.
- **Result:** Source-type assistance and title defaulting can update based on the file.
- **Animation/Transition:** None beyond native input state changes.

**Interaction 3: Submit Upload**
- **Trigger:** Click the modal primary action when validation passes.
- **Feedback:** Submit button becomes busy/disabled, duplicate submission is prevented, and inline pending text appears.
- **Result:** On success, modal closes and ingest status shifts into the product shell; on recoverable failure, modal remains open with errors preserved.
- **Animation/Transition:** No non-essential motion required.

**Interaction 4: Inspect Source Detail**
- **Trigger:** Click a source row in Sources or a source citation from Ask/reporting.
- **Feedback:** Drawer opens from the right and focus moves to the drawer title.
- **Result:** User can inspect normalized preview content and parser warnings without losing surrounding context.
- **Animation/Transition:** Reuse existing side-drawer transition; reduce or remove animation when reduced motion is enabled.

**Interaction 5: Retry Recoverable Failure**
- **Trigger:** Click Retry in upload or Ask error state.
- **Feedback:** Error panel is replaced by the normal loading/busy state, but user-entered values remain.
- **Result:** System reattempts the exact same action payload without forcing data re-entry. For Ask, the question remains in the input, the stale error disappears immediately, and any stale answer is hidden while the retry is in flight.
- **Animation/Transition:** None required.

## 6.2 Input Methods & Controls
- **Form Fields:** file input, select/combobox for source type, date input, text inputs for title and author, tokenized text input or textarea for participants, textarea for notes, optional metadata JSON file input.
- **Validation Rules:**
  - Required validation occurs before submit.
  - File-type and size validation occurs immediately after selection and again on submit.
  - Future dates are blocked.
  - Conflicting metadata file values are surfaced on submit.
  - Structured-import types require an explicit confirmation checkbox before submit.
- **Input Assistance:**
  - Title defaults from the file name if not explicitly edited.
  - Source type follows the classification rules in Section 2.4.
  - Locked source families are auto-selected and not user-editable.
  - Reviewable source families are auto-selected to a safe evidence-first default and must remain user-visible before submit.
  - Structured-import-capable files require the user to explicitly confirm the structured impact before the submit action becomes enabled.
  - Helper text clarifies which uploads directly change structured tables versus evidence-only surfaces.
- **Required vs. Optional Fields:**
  - Required: file, source type unless fully inferred and confirmed, source date.
  - Optional: title override, author, participants, notes, metadata JSON companion file.

## 6.3 Feedback & Confirmation Patterns
- **Loading States:**
  - Modal submit shows inline busy state.
  - Ask panel shows an explicit loading state inside the panel.
  - Report generation keeps the existing report loading surface.
- **Success Confirmation:**
  - Existing toast region remains the lightweight confirmation pattern.
  - Success toast copy must include the artifact title or source type when space allows.
- **Error Messages:**
  - Field errors appear directly under the field.
  - Recoverable server or parsing failures appear in a scoped inline error panel within the modal or panel where the action occurred.
- **Empty States:**
  - Sources empty state must explain supported artifacts and how uploads will appear.
  - Search empty state remains existing style but can include uploaded artifact results when present.

## 6.4 Micro-interactions
- **Hover States:** Reuse current button, chip, and source-row hover treatment.
- **Focus States:** All new controls must follow the existing visible-focus approach and remain keyboard reachable.
- **Active/Pressed States:** Primary and secondary buttons reuse current pressed-state language.
- **Disabled States:** Disabled controls keep the current reduced-opacity treatment but must remain readable and meet contrast requirements.

---

# 7. Visual Design Specifications

## 7.1 Design System & Component Usage
- **Existing Components:** Reuse existing `TopNav`, page shell, tab buttons, modal panel, side drawer, inline error panel, empty panel, toast region, primary/secondary buttons, source rows, and report coverage card patterns.
- **New Components Needed:**
  - `UploadArtifactModal`
  - `ArtifactIngestStatusPanel`
  - `SourceProcessingBadge`
  - `SourceWarningCallout`
  - `EvidenceUpdatedBanner` (if implemented inline rather than folded into existing signal treatment)
- **Component Variations:**
  - Modal requires normal, validation-error, busy, and server-error variants.
  - Source rows require processing, partial, failed, and completed state badges.
  - Ask panel requires loading and retry-capable error variants.

## 7.2 Typography Hierarchy
- **Headings:** Preserve current page-level `h1`, section `h2`, and panel `h3` usage.
- **Body Text:** Reuse current body text scale in cards, drawers, and inline metadata.
- **Microcopy:** Helper and validation text should use the existing small-text pattern already used in forms and metadata lines.
- **Emphasis:** Use weight and semantic color before introducing larger type for warnings or partial states.

## 7.3 Color & Visual Semantics
- **Color Application:** Continue using the current blue accent for actions and neutral structural surfaces for cards/modals/drawers.
- **Semantic Colors:**
  - Success: existing green semantics for completed or healthy states
  - Warning / Partial: existing amber semantics
  - Error / Failed: existing red semantics
  - Neutral / Informational: existing blue and neutral text palette
- **Color Contrast Requirements:** Minimum WCAG AA for all text, controls, badges, and error/warning treatments.

## 7.4 Iconography & Visual Assets
- **Required Icons:**
  - Upload affordance icon (optional if current button language stays text-only)
  - Processing indicator / spinner
  - Warning indicator for partial extraction
  - Retry indicator for failure recovery
  - File-type hint indicators only if they reuse an existing icon set or simple text badge model
- **Illustrations/Graphics:** No new illustrations required.
- **Image Specifications:** N/A for this feature.
- **Logo/Branding:** Existing top-nav brand treatment remains unchanged.

## 7.5 Spacing & Layout Grid
- **Spacing Scale:** Continue the existing tokenized spacing rhythm already present in cards, forms, and modals.
- **Grid System:** Reuse current full-width page structure and card layout. No new page-level grid system is introduced.
- **Whitespace Strategy:** Keep ingest status and trust messaging visually close to the action that triggered it while preserving the current breathable, card-based layout.

---

# 8. Content & Copywriting Requirements

## 8.1 Content Strategy
- **Tone & Voice:** Clear, professional, evidence-first, and operationally trustworthy.
- **Content Principles:** Direct, concise, specific, recovery-oriented, and transparent about uncertainty.

## 8.2 Required Copy Elements

**Headings & Titles**
- Main modal title: `Upload Artifact`
- Ingest status panel title: `Artifact Processing`
- Partial warning title: `Processed with limitations`
- Failure title: `We couldn’t process this artifact`

**Instructional Text**
- Modal helper text: `Upload one supported artifact at a time. The application will process it and update evidence-driven views when processing completes.`
- Structured import helper text: `Structured imports can update product tables. Narrative documents, decks, emails, and transcripts enrich evidence and reporting without directly overwriting structured rows.`
- Metadata helper text: `Optional metadata can improve source labeling and traceability.`

**Action Labels**
- Primary CTA: `Upload Artifact`
- Retry CTA: `Retry`
- Secondary close CTA: `Cancel`
- Source detail CTA for text-like sources: `Open Source`
- Source detail CTA for binary sources: `Download Original`
- Structured import confirmation copy: `This upload updates structured product data shown in the Data tab.`
- Sources navigation helper CTA: `View in Sources`

**Feedback Messages**
- Success toast: `Artifact queued for processing` or `Artifact processed` depending on the response state.
- Partial warning: `This artifact was processed, but some content could not be fully extracted. Review the source before relying on it for critical decisions.`
- Failure copy: `We couldn’t process this artifact right now. Your entries are still here. Review the error and try again.`
- Evidence update notice: `New evidence is now available across Sources, Ask, and reports.`

## 8.3 Localization Considerations
- **Character Length Variation:** Modal labels and button rows must tolerate moderate text expansion without clipping.
- **RTL Support:** Not required for this release.
- **Date/Number Formats:** Continue using current locale-aware date display patterns in surfaced metadata and report labels.

---

# 9. Accessibility Requirements

## 9.1 WCAG Compliance
- **Target Level:** WCAG 2.1 AA
- **Color Contrast:** All badges, errors, warnings, helper text, and disabled-state labels must meet AA contrast requirements.
- **Text Resize:** The feature must remain usable at 200% zoom within the supported desktop viewport.

## 9.2 Keyboard Navigation
- **Tab Order:** Upload entry → modal fields in visual order → secondary/primary actions; on return, focus restores to the triggering upload button.
- **Keyboard Shortcuts:** Existing `/` search shortcut remains. Escape closes modal or drawer only when the current action is not busy.
- **Focus Management:**
  - Modal traps focus while open.
  - Drawer traps focus while open.
  - After close, focus returns to the triggering element.
  - On validation failure, focus moves to the first invalid field.

## 9.3 Screen Reader Support
- **ARIA Labels:** File input, metadata file input, retry button, source warning badges, and close controls require descriptive labels.
- **Landmarks:** Existing `nav` and `main` structure remains; modal and drawer need explicit dialog semantics.
- **Announcements:** Upload queued, processing complete, partial extraction, failure, Ask loading, Ask completion, and Ask error states must be announced using an `aria-live` region.
- **Alt Text:** No new imagery is required.

## 9.4 Additional Accessibility Features
- **Motion Preferences:** All newly introduced transitions must respect `prefers-reduced-motion` and reduce non-essential motion.
- **High Contrast Mode:** Badge and error states must remain legible in high contrast settings.
- **Touch Targets:** Controls should maintain at least 44x44px target sizing within the supported desktop interface.
- **Forms:** Every field must have an associated label; inline error messages must be programmatically associated to the field they describe.

---
# 10. States & Scenarios

## 10.1 All UI States
- **Initial / Default State:** Product Overview shows existing evidence surfaces and a visible `Upload Artifact` action for permitted users.
- **Loading State:** Upload submit, Ask submit, and report generation each show local scoped loading indicators rather than page-wide blocking states.
- **Empty State:** Sources empty state explains that uploaded artifacts will appear here after processing and lists supported evidence classes at a high level.
- **Populated State:** Uploaded artifacts appear in Sources with type-aware metadata and current processing or completion state.
- **Error State:** Upload, Ask, and source-preview failures render scoped error panels with retry where applicable; the app shell remains usable.
- **Success State:** Toast success and visible downstream refresh make clear that the artifact is now part of the evidence corpus.
- **Partial State:** Partial extraction or warnings appear with amber treatment and explanatory copy.
- **Disabled State:** Submit buttons are disabled during invalid or busy states; read-only users do not see upload actions.

## 10.2 Permission & Role-Based Views
- **Lead / Editor View:** Can upload artifacts, publish weeklies, edit report sections, and export reports.
- **Standard Read-Only View:** Cannot upload or publish but can view Sources, Ask responses, reports, and exported evidence status.
- **Guest / Unauthenticated View:** Not applicable in the current authenticated internal app; unauthorized states render the existing session-expired treatment.
- **Read-Only View:** Upload action is hidden rather than disabled to reduce false affordance.

---

# 11. QA, Acceptance Criteria, and Definition of Done

## 11.1 Global Quality Gates (Blocking)
- **GQ-001 Zero Console Errors:** The browser console must remain clear of errors and warnings during upload, source inspection, Ask retry, and report workflows.
- **GQ-002 No Unhandled Server Errors:** Upload and Ask failures must render the defined scoped error states and must never crash the shell or leave an empty white screen.
- **GQ-003 Evidence-Derived UI Only:** No newly surfaced artifact titles, preview content, Ask citations, or evidence update messages may be hardcoded into the HTML shell; they must be rendered from application state and server responses.
- **GQ-004 Automated Playwright Coverage:** Every end-to-end observable workflow introduced by this feature must have a Playwright spec and must pass in both headless and headed modes.
- **GQ-005 Trust Transparency:** Partial extraction, failed processing, and evidence-only versus structured-import impact must be visually distinguishable in the UI.

## 11.2 Requirement-Level Acceptance Criteria (Detailed)

**Area: Upload Artifact Entry and Modal**
- `AC-001 [E2E]` Given an editor is on a product Overview view When the page loads Then a visible `Upload Artifact` action appears in the current mutation area and is keyboard reachable.
- `AC-002 [Integration]` Given a read-only user is on the same product Overview view When the page loads Then the upload action is not rendered and no empty upload placeholder remains.
- `AC-003 [E2E]` Given an editor activates `Upload Artifact` When the modal opens Then focus moves into the modal, the background content becomes inert, and the modal displays supported-upload helper copy.
- `AC-004 [Integration]` Given the modal is open When the user submits with any required field missing Then submission is blocked, field-specific errors appear inline below the relevant fields, and focus moves to the first invalid field.
- `AC-005 [Integration]` Given the modal is open When the user selects an unsupported file type or oversize file Then the file field shows inline error copy and the primary action remains disabled or blocked on submit.
- `AC-006 [Integration]` Given the modal contains a future source date When the user submits Then the date field shows the future-date error copy and all other entered values remain intact.
- `AC-007 [E2E]` Given the modal contains valid input When the user submits Then the primary action enters a busy state, duplicate clicks do not trigger duplicate submission, and the modal does not silently disappear before the request resolves.
- `AC-008 [E2E]` Given the server returns a recoverable upload validation or processing error When the modal request resolves Then the modal remains open, the user’s entered values remain present, a scoped inline error panel appears, and a Retry action is available when the failure is retryable.

**Area: Post-Submit Processing Feedback**
- `AC-009 [E2E]` Given the server accepts the upload When the initial request succeeds Then a success toast appears and the product shell shows a visible ingest status surface that includes the uploaded artifact title or type.
- `AC-010 [E2E]` Given an artifact is still queued or processing When the user stays on the product page or navigates between product tabs Then the current processing state remains visible until completion or failure.
- `AC-011 [E2E]` Given an artifact completes with a partial extraction warning When the product shell refreshes Then the upload status and source row use warning treatment and explanatory copy rather than full-success styling.
- `AC-012 [E2E]` Given an artifact finishes successfully When the app refreshes its data Then the ingest status surface indicates completion and offers a clear path to inspect the source in Sources.

**Area: Sources Inventory and Detail**
- `AC-013 [E2E]` Given a newly uploaded artifact has been accepted When the user opens the Sources tab Then the artifact appears as a source row without requiring a full browser reload.
- `AC-014 [E2E]` Given the artifact is a slide deck or spreadsheet When it appears in Sources Then the row displays a type-aware badge or label that distinguishes it from transcripts, weeklies, emails, and ADO records.
- `AC-015 [E2E]` Given the user opens a source detail drawer for an uploaded artifact When the drawer renders Then it shows title, date, author, preview content, and any parser warning or partial-processing notice.
- `AC-016 [Integration]` Given the source detail drawer is open When the user closes it via close button, Escape, or backdrop as allowed Then focus returns to the source row or triggering control.
- `AC-017 [E2E]` Given the artifact has parser warnings or partial extraction When the user opens source detail Then the warning is visible inside the drawer and does not require reading raw source content to understand the limitation.

**Area: Ask and Search Consumption**
- `AC-018 [E2E]` Given the user submits a valid Ask question When the request is pending Then the Ask panel shows an explicit loading state and the submit action is disabled.
- `AC-019 [E2E]` Given the Ask request succeeds after a relevant artifact upload When the answer renders Then the answer includes at least one visible source citation or evidence reference tied to uploaded content when relevant.
- `AC-020 [E2E]` Given the Ask request fails with a recoverable server or dependency error When the failure renders Then the Ask panel preserves the user’s question, shows scoped error copy, and displays a Retry action.
- `AC-021 [E2E]` Given a newly uploaded artifact has finished processing When the user searches from the top nav Then the search palette can surface that artifact by title or metadata where relevant.

**Area: Data and Report Impact**
- `AC-022 [E2E]` Given the user uploads a narrative artifact such as a transcript, memo, email, slide deck, or non-structured document When processing completes Then Sources, Ask, and report evidence can reflect the artifact without directly overwriting Data-tab tables.
- `AC-023 [E2E]` Given the user uploads a structured import classified as a structured dataset When processing completes Then the appropriate Data-tab dataset visibly updates after invalidation or refresh.
- `AC-024 [E2E]` Given a newly uploaded artifact is relevant to the current report period When a previously generated report is open Then the current report body remains unchanged and the UI displays `New evidence is available. Regenerate to include it.`; when the user explicitly regenerates the report Then the evidence coverage surface and regenerated report output can reflect the new artifact.
- `AC-025 [Integration]` Given the app communicates downstream impact When the artifact is evidence-only versus structured-import Then the UI copy makes the distinction explicit so the user understands why some views changed and others did not.

**Area: Accessibility and Recovery**
- `AC-026 [Integration]` Given the modal or drawer is open When the user navigates by keyboard Then focus order remains logical, visible, and trapped within the active overlay until it closes.
- `AC-027 [Integration]` Given an async upload or Ask state changes When the status changes to queued, failed, partial, or completed Then the change is announced in an `aria-live` region.
- `AC-028 [E2E]` Given the app is viewed below 1024px When the user attempts to access affected routes Then the existing unsupported viewport state remains the only available experience and no partial upload UI leaks into that state.

## 11.3 E2E Scenario Specifications

**Scenario 1: Primary Artifact Upload Happy Path**
- **Given** an editor is on a product Overview view
- **When** they upload a supported artifact with valid metadata
- **Then** the app shows queued/processing feedback, the artifact appears in Sources, and the shell remains stable.

**Scenario 2: Upload Validation Failure**
- **Given** the upload modal is open
- **When** the user submits unsupported or incomplete input
- **Then** inline validation errors appear, submission is blocked, and entered values remain.

**Scenario 3: Recoverable Upload Failure and Retry**
- **Given** the server returns a recoverable upload or processing failure
- **When** the modal resolves
- **Then** the modal stays open, a scoped error panel with Retry appears, and reattempting does not require re-entering metadata.

**Scenario 4: Partial Artifact Processing**
- **Given** an artifact is accepted but only partially processed
- **When** the page refreshes its state
- **Then** the product and source surfaces show warning treatment and explain that extraction was limited.

**Scenario 5: Uploaded Artifact Drives Ask and Search**
- **Given** a relevant artifact has finished processing
- **When** the user searches or asks a related question
- **Then** the artifact can appear in search results and Ask citations.

**Scenario 6: Structured Import Updates Data Tab**
- **Given** a structured import is uploaded successfully
- **When** the user opens the relevant dataset in Data
- **Then** the updated structured rows appear and the change is visually attributable to the import.

**Scenario 7: Narrative Upload Does Not Mutate Structured Data**
- **Given** a narrative artifact is uploaded successfully
- **When** processing completes and the user checks the Data tab
- **Then** Sources, Ask, and report evidence can reflect the artifact while structured tables remain unchanged.

**Scenario 8: Existing Report Requires Explicit Regeneration**
- **Given** a previously generated report is open
- **When** a relevant new artifact completes processing
- **Then** the current report remains visible, a regenerate notice appears, and the report only changes after the user explicitly regenerates it.

**Scenario 9: Read-Only Consumption**
- **Given** a read-only user opens the same product
- **When** they navigate Overview, Sources, Ask, and Reports
- **Then** upload controls remain hidden while the uploaded evidence remains consumable.

**Scenario 10: Unsupported Viewport**
- **Given** the browser width is below 1024px
- **When** the user navigates to portfolio or product routes
- **Then** the unsupported viewport experience remains intact.

## 11.4 Definition of Done (DoD) Checklist (Blocking)
- [ ] All `AC-001` through `AC-028` are implemented and verified.
- [ ] The upload modal, ingest status, source detail, Ask loading/retry, and downstream evidence updates exist in the UI exactly as specified.
- [ ] Every end-to-end observable workflow in Sections 4 and 10 has Playwright coverage or an explicit non-applicable rationale.
- [ ] Every `AC-###` item appears in the AC traceability table in Section 13.6.
- [ ] Keyboard navigation, focus management, and `aria-live` announcements work for modal, drawer, upload status, and Ask states.
- [ ] The same Playwright suite passes in headless and headed modes.
- [ ] No console errors or warnings occur during primary, validation, error, partial, and permission flows.
- [ ] No user-visible evidence text introduced by this feature is hardcoded into the HTML shell.
- [ ] Design deliverables not required for this delivery are explicitly marked as not required.

**AC Coverage Summary**

| Coverage Type | Count | Percentage |
| :--- | :--- | :--- |
| Unit test | 0 | 0% |
| Integration test (primary level) | 11 | 39% |
| E2E (primary level) | 17 | 61% |
| Manual (with justification) | 0 | 0% |
| **Total AC items** | **28** | **100%** |

## 11.5 Usability Testing Plan
- **Test Scenarios:**
  - Upload a narrative artifact and verify source visibility.
  - Upload a structured import and verify Data tab impact.
  - Recover from validation failure.
  - Recover from a server failure using Retry.
  - Verify Ask/search/report consumption after upload.
- **Success Metrics:**
  - Task completion rate: 95%+
  - Time on task for upload initiation and submission: under 90 seconds for a prepared artifact
  - Error recovery completion: 90%+
  - User trust/confidence feedback: 4/5 or higher in internal validation sessions

## 11.6 Required Design Deliverables
- [ ] User flow diagrams — Not Required for this delivery; written flows are the source of truth.
- [ ] Low-fidelity wireframes for all screens/states — Not Required for this delivery; existing app pattern reuse is sufficient.
- [ ] High-fidelity mockups — Not Required for this delivery; this UXRD is codebase-aligned and implementation-ready.
- [ ] Interactive prototype — Not Required for this delivery.
- [x] Component specifications for engineering
- [x] Finalized copy document (contained in this UXRD)
- [x] Accessibility annotation document (contained in this UXRD)
- [x] Design QA checklist for implementation (contained in Sections 11 and 13)

---
# 11.7 Playwright Test Scripts (Required)

```js
// E2E: Scenario 1 — Primary Artifact Upload Happy Path
// Workflow: Upload supported artifact and verify source visibility
// Validates: AC-001, AC-003, AC-007, AC-009, AC-010, AC-012, AC-013
import { test, expect } from '@playwright/test';

test('artifact upload happy path', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await expect(page.getByTestId('upload-artifact-modal')).toBeVisible();
  await page.getByTestId('artifact-file-input').setInputFiles('tests/fixtures/dental-recovery-deck.pptx');
  await page.getByTestId('artifact-source-type-select').selectOption('slide_deck');
  await page.getByTestId('artifact-date-input').fill('2026-04-16');
  await page.getByTestId('artifact-title-input').fill('Dental Leadership Readout Deck');
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('toast-success')).toContainText('Artifact queued');
  await expect(page.getByTestId('artifact-processing-status')).toBeVisible();
  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId('source-item-src-uploaded-deck')).toBeVisible();
});
```

```js
// E2E: Scenario 2 — Upload Validation Failure
// Workflow: Block unsupported or incomplete submissions
// Validates: AC-004, AC-005, AC-006
import { test, expect } from '@playwright/test';

test('artifact upload validation failures', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-submit').click();
  await expect(page.getByTestId('artifact-title-error')).toBeVisible();
  await expect(page.getByTestId('artifact-date-error')).toBeVisible();

  await page.getByTestId('artifact-file-input').setInputFiles({
    name: 'unsupported.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('bad-file'),
  });
  await page.getByTestId('artifact-submit').click();
  await expect(page.getByTestId('artifact-file-error')).toContainText('File type not supported');
});
```

```js
// E2E: Scenario 3 — Recoverable Upload Failure and Retry
// Workflow: Preserve entries and retry a failed upload
// Validates: AC-008
import { test, expect } from '@playwright/test';

test('artifact upload shows retryable scoped error', async ({ page }) => {
  await page.goto('/products/dental?tab=overview&testCase=artifactUploadFailure');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles('tests/fixtures/dental-recovery-deck.pptx');
  await page.getByTestId('artifact-source-type-select').selectOption('slide_deck');
  await page.getByTestId('artifact-date-input').fill('2026-04-16');
  await page.getByTestId('artifact-title-input').fill('Retryable Upload Artifact');
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('artifact-inline-error')).toBeVisible();
  await expect(page.getByTestId('artifact-retry-button')).toBeVisible();
  await expect(page.getByTestId('artifact-title-input')).toHaveValue('Retryable Upload Artifact');
});
```

```js
// E2E: Scenario 4 — Partial Artifact Processing
// Workflow: Surface limited extraction clearly
// Validates: AC-011, AC-017
import { test, expect } from '@playwright/test';

test('partial artifact processing surfaces warnings', async ({ page }) => {
  await page.goto('/products/dental?tab=overview&testCase=artifactPartial');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles('tests/fixtures/dental-recovery-deck.pptx');
  await page.getByTestId('artifact-source-type-select').selectOption('slide_deck');
  await page.getByTestId('artifact-date-input').fill('2026-04-16');
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('artifact-processing-warning')).toBeVisible();
  await page.getByTestId('product-tab-sources').click();
  await page.getByTestId('source-item-src-uploaded-deck').click();
  await expect(page.getByTestId('source-parser-warning')).toBeVisible();
});
```

```js
// E2E: Scenario 5 — Uploaded Artifact Drives Ask and Search
// Workflow: Search for and ask about newly uploaded evidence
// Validates: AC-018, AC-019, AC-020, AC-021
import { test, expect } from '@playwright/test';

test('uploaded artifact appears in search and ask', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles('tests/fixtures/dental-recovery-deck.pptx');
  await page.getByTestId('artifact-source-type-select').selectOption('slide_deck');
  await page.getByTestId('artifact-date-input').fill('2026-04-16');
  await page.getByTestId('artifact-title-input').fill('Dental Leadership Readout Deck');
  await page.getByTestId('artifact-submit').click();

  await page.getByTestId('topnav-search-input').fill('Leadership Readout');
  await expect(page.getByTestId('search-result-source-src-uploaded-deck')).toBeVisible();

  await page.getByTestId('product-tab-overview').click();
  await page.getByTestId('ask-input').fill('What changed in the leadership readout deck?');
  await page.getByTestId('ask-submit').click();
  await expect(page.getByTestId('ask-loading')).toBeVisible();
  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-source-0')).toBeVisible();
});
```

```js
// E2E: Scenario 6 — Structured Import Updates Data Tab
// Workflow: Upload a structured import and verify Data-tab impact
// Validates: AC-023, AC-025
import { test, expect } from '@playwright/test';

test('structured import updates data tab', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles('tests/fixtures/dental-risks-import.csv');
  await page.getByTestId('artifact-source-type-select').selectOption('risk_export');
  await page.getByTestId('artifact-date-input').fill('2026-04-16');
  await page.getByTestId('artifact-submit').click();

  await page.getByTestId('product-tab-data').click();
  await page.getByTestId('data-subtab-risks').click();
  await expect(page.getByTestId('data-import-impact-badge')).toBeVisible();
  await expect(page.getByTestId('data-row-R-IMP-001')).toBeVisible();
});
```

```js
// E2E: Scenario 7 — Narrative Upload Does Not Mutate Structured Data
// Workflow: Confirm evidence-only uploads do not overwrite Data-tab rows
// Validates: AC-022
import { test, expect } from '@playwright/test';

test('narrative upload does not mutate structured tables', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles('tests/fixtures/dental-recovery-deck.pptx');
  await page.getByTestId('artifact-source-type-select').selectOption('slide_deck');
  await page.getByTestId('artifact-date-input').fill('2026-04-16');
  await page.getByTestId('artifact-submit').click();

  await page.getByTestId('product-tab-data').click();
  await page.getByTestId('data-subtab-risks').click();
  await expect(page.getByTestId('data-import-impact-badge')).toHaveCount(0);
});
```

```js
// E2E: Scenario 8 — Existing Report Requires Explicit Regeneration
// Workflow: Preserve current report body until the user regenerates
// Validates: AC-024
import { test, expect } from '@playwright/test';

test('existing report requires explicit regeneration after new evidence', async ({ page }) => {
  await page.goto('/products/dental?tab=reports&reportId=rep-seeded');
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible();

  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles('tests/fixtures/dental-recovery-deck.pptx');
  await page.getByTestId('artifact-source-type-select').selectOption('slide_deck');
  await page.getByTestId('artifact-date-input').fill('2026-04-16');
  await page.getByTestId('artifact-submit').click();

  await page.goto('/products/dental?tab=reports&reportId=rep-seeded');
  await expect(page.getByTestId('report-regenerate-notice')).toBeVisible();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible();
});
```

```js
// E2E: Scenario 9 — Read-Only Consumption
// Workflow: Confirm upload controls are hidden while evidence remains visible
// Validates: AC-002
import { test, expect } from '@playwright/test';

test('read only user can consume but not upload evidence', async ({ page }) => {
  await page.goto('/products/dental?tab=overview&asRole=read');
  await expect(page.getByTestId('upload-artifact-button')).toHaveCount(0);
  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId('sources-view')).toBeVisible();
  await page.getByTestId('product-tab-reports').click();
  await expect(page.getByTestId('reports-view')).toBeVisible();
});
```

```js
// E2E: Scenario 10 — Unsupported Viewport
// Workflow: Preserve desktop-only guardrails
// Validates: AC-028
import { test, expect } from '@playwright/test';

test('unsupported viewport remains authoritative', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('unsupported-viewport')).toBeVisible();
  await expect(page.getByTestId('upload-artifact-modal')).toHaveCount(0);
});
```

**Verification Workflow**
1. Run the same Playwright spec set in headless mode using the repo-standard command.
2. Run the same spec set in headed mode using `--headed` and the `/playwright-interactive` workflow for visual verification.
3. Capture screenshots for visual QA claims involving modal states, partial warnings, and source preview surfaces.
4. Do not consider the feature complete until both modes pass with the same selectors and assertions.

---
# 12. Out of Scope (UI/UX Non-Goals)
- Mobile or phone-optimized upload flows below 1024px.
- A separate artifact-management admin console.
- Multi-file bulk upload in a single modal session.
- Real-time collaborative editing of source metadata.
- A brand-new navigation model or a redesigned product shell.
- Dark mode.

---

# 13. Engineering Handoff (React Implementation Notes)

## 13.1 Route & Navigation Contract
- **Routes / URLs:**
  - `/portfolio`
  - `/products/:productId?tab=overview`
  - `/products/:productId?tab=sources`
  - `/products/:productId?tab=sources&sourceFilter=<type>`
  - `/products/:productId?tab=sources&sourceId=<sourceId>`
  - `/products/:productId?tab=reports&reportId=<reportId>`
- **Entry Points:**
  - Upload entry originates from Product Overview only.
  - Search palette and Ask source citations can deep-link into Sources detail.
- **Exit Points:**
  - Modal cancel returns to Overview with focus restored to the upload trigger.
  - Drawer close returns to the triggering source row or citation.
  - Successful upload does not navigate away from the current tab.
- **Scroll & Focus Behavior:**
  - No route change is required for modal open/close.
  - Product tab changes continue using existing query-param behavior.
  - Focus restoration is required after modal and drawer close.

## 13.2 Component Breakdown (React)
- **Page Components:**
  - `ProductPage`
  - `OverviewView`
  - `SourcesView`
  - `ReportsView`
- **Reusable Components:**
  - `TopNav`
  - `SearchPalette`
  - `ToastRegion`
  - existing modal shell pattern
  - existing side drawer pattern
  - existing inline error panel
  - existing empty state panel
- **New Components:**
  - `UploadArtifactModal`
  - `ArtifactIngestStatusPanel`
  - `SourceProcessingBadge`
  - `SourceWarningCallout`
  - `AskPanelErrorState` enhancement with Retry
  - `AskPanelLoadingState` enhancement

## 13.3 UI State Model (Frontend)
- **Local / UI State:**
  - upload modal open/close
  - upload form draft values
  - selected file and optional metadata file
  - current upload error state
  - Ask input
  - Ask retryable error state
  - source drawer open source ID
  - transient evidence-updated banner visibility if implemented
- **Persistence:**
  - `tab`, `sourceFilter`, and `sourceId` remain URL-driven.
  - Upload draft values do not persist across page refresh.
  - Ingest processing state is server-driven and must rehydrate via product/source data after refresh.
- **Loading / Error State Rules:**
  - Upload submit uses local busy state in the modal.
  - Processing state after accept is server-state driven.
  - Ask uses panel-scoped loading and error states.
  - Sources and Reports continue using their existing scoped loading behavior.
  - If a relevant new artifact completes while a generated report is already open, the current report body remains visible and a regenerate notice is shown instead of silently refreshing the report body.

## 13.4 Forms, Validation, and Error Copy
- **Field List:**
  - `file` required
  - `sourceType` required unless the UI has already inferred and visibly confirmed it according to Section 2.4
  - `sourceDate` required
  - `title` optional
  - `author` optional
  - `participants` optional
  - `notes` optional
  - `metadataFile` optional
  - `structuredImpactConfirmed` required only for structured-import types
- **Inline Errors:**
  - `Choose an artifact file`
  - `File type not supported`
  - `File exceeds the allowed size limit`
  - `Choose a source date`
  - `Source date cannot be in the future`
  - `Choose a source type`
  - `Metadata file conflicts with the selected product or source type`
  - `Confirm that this upload updates structured product data`
- **Submission Rules:**
  - Primary action is enabled only when required inputs are valid and no busy state is active.
  - On success, modal closes and toast + ingest status surface appear.
  - On recoverable failure, modal stays open, values persist, and retry is available.
  - For locked source families, the source type control is read-only.
  - For reviewable source families, the source type control remains editable only within the allowed set for that extension.

## 13.5 Test Selectors (Required)
- `upload-artifact-button`
- `upload-artifact-modal`
- `artifact-modal-title`
- `artifact-file-input`
- `artifact-file-error`
- `artifact-source-type-select`
- `artifact-source-type-error`
- `artifact-date-input`
- `artifact-date-error`
- `artifact-title-input`
- `artifact-title-error`
- `artifact-author-input`
- `artifact-participants-input`
- `artifact-notes-input`
- `artifact-metadata-file-input`
- `artifact-submit`
- `artifact-cancel`
- `artifact-inline-error`
- `artifact-retry-button`
- `artifact-processing-status`
- `artifact-processing-warning`
- `artifact-processing-complete`
- `artifact-processing-failed`
- `evidence-updated-banner`
- `source-filter-slide-deck`
- `source-filter-spreadsheet`
- `source-item-{sourceId}`
- `source-parser-warning`
- `source-preview-content`
- `ask-loading`
- `ask-retry`
- `data-import-impact-badge`
- `data-row-{rowId}`
- `search-result-source-{sourceId}`
- `report-regenerate-notice`
- `report-regenerate-button`
- `structured-impact-confirmation`
- `source-download-original`
- `source-open-source`

## 13.6 TDD Plan (Required)

**Test Inventory**
- **Integration / component tests**
  - upload modal validation and field persistence
  - modal focus trap and restoration
  - ingest status panel rendering by server state
  - source row and source drawer warning treatment
  - Ask panel loading + retry behavior
  - downstream impact messaging for evidence-only vs structured imports
- **Playwright E2E tests**
  - artifact upload happy path
  - validation failure
  - recoverable upload failure and retry
  - partial artifact processing
  - uploaded artifact drives Ask and search
  - structured import updates Data tab
  - narrative upload does not mutate structured data
  - existing report requires explicit regeneration
  - read-only consumption
  - unsupported viewport continuity

**Write-First Guidance**
- Write modal validation and Ask retry lower-level tests first.
- Then write Playwright happy-path and validation specs.
- Add partial/failure/structured-import E2E coverage before implementing final UI polish.

**AC Traceability**

| AC ID | Test Name | Test Type |
| :--- | :--- | :--- |
| AC-001 | `upload_entry_renders_for_editor` | Integration |
| AC-001 | `artifact-upload-happy-path.spec.js` | E2E |
| AC-002 | `upload_entry_hidden_for_read_only` | Integration |
| AC-002 | `artifact-upload-read-only.spec.js` | E2E |
| AC-003 | `upload_modal_focus_and_helper_copy` | Integration |
| AC-003 | `artifact-upload-happy-path.spec.js` | E2E |
| AC-004 | `upload_modal_required_field_validation` | Integration |
| AC-004 | `artifact-upload-validation.spec.js` | E2E |
| AC-005 | `upload_modal_file_validation` | Integration |
| AC-005 | `artifact-upload-validation.spec.js` | E2E |
| AC-006 | `upload_modal_future_date_validation` | Integration |
| AC-006 | `artifact-upload-validation.spec.js` | E2E |
| AC-007 | `upload_submit_busy_state` | Integration |
| AC-007 | `artifact-upload-happy-path.spec.js` | E2E |
| AC-008 | `upload_modal_retryable_failure_state` | Integration |
| AC-008 | `artifact-upload-failure-retry.spec.js` | E2E |
| AC-009 | `ingest_status_surface_renders_after_accept` | Integration |
| AC-009 | `artifact-upload-happy-path.spec.js` | E2E |
| AC-010 | `ingest_status_persists_across_tab_navigation` | Integration |
| AC-010 | `artifact-upload-happy-path.spec.js` | E2E |
| AC-011 | `partial_processing_warning_treatment` | Integration |
| AC-011 | `artifact-upload-partial.spec.js` | E2E |
| AC-012 | `completed_ingest_shows_sources_cta` | Integration |
| AC-012 | `artifact-upload-happy-path.spec.js` | E2E |
| AC-013 | `sources_list_updates_after_upload` | Integration |
| AC-013 | `artifact-upload-happy-path.spec.js` | E2E |
| AC-014 | `source_row_uses_type_aware_badges` | Integration |
| AC-014 | `artifact-upload-source-detail.spec.js` | E2E |
| AC-015 | `source_detail_renders_normalized_preview` | Integration |
| AC-015 | `artifact-upload-source-detail.spec.js` | E2E |
| AC-016 | `source_detail_focus_restoration` | Integration |
| AC-016 | `artifact-upload-source-detail.spec.js` | E2E |
| AC-017 | `source_detail_shows_parser_warning` | Integration |
| AC-017 | `artifact-upload-partial.spec.js` | E2E |
| AC-018 | `ask_loading_state_renders` | Integration |
| AC-018 | `artifact-upload-search-and-ask.spec.js` | E2E |
| AC-019 | `ask_answer_shows_uploaded_source_citation` | Integration |
| AC-019 | `artifact-upload-search-and-ask.spec.js` | E2E |
| AC-020 | `ask_retryable_error_state_preserves_query` | Integration |
| AC-020 | `artifact-upload-search-and-ask.spec.js` | E2E |
| AC-021 | `search_palette_surfaces_uploaded_artifact` | Integration |
| AC-021 | `artifact-upload-search-and-ask.spec.js` | E2E |
| AC-022 | `narrative_artifact_does_not_overwrite_data_tables_copy` | Integration |
| AC-022 | `artifact-upload-evidence-only-impact.spec.js` | E2E |
| AC-023 | `structured_import_updates_visible_dataset` | Integration |
| AC-023 | `artifact-upload-structured-data-impact.spec.js` | E2E |
| AC-024 | `report_coverage_reflects_new_evidence` | Integration |
| AC-024 | `artifact-upload-report-regenerate.spec.js` | E2E |
| AC-025 | `downstream_impact_copy_distinguishes_import_types` | Integration |
| AC-025 | `artifact-upload-structured-data-impact.spec.js` | E2E |
| AC-026 | `overlay_focus_trap_and_keyboard_order` | Integration |
| AC-026 | `artifact-upload-source-detail.spec.js` | E2E |
| AC-027 | `aria_live_announces_async_status_changes` | Integration |
| AC-027 | `artifact-upload-partial.spec.js` | E2E |
| AC-028 | `unsupported_viewport_state_persists` | Integration |
| AC-028 | `artifact-upload-unsupported-viewport.spec.js` | E2E |

## 13.7 UI–API Contract (Notional)

**Endpoint Inventory**

| UI Action | Method | Path (notional) | Purpose |
| :--- | :--- | :--- | :--- |
| Load product overview | GET | `/api/v1/products/:productId` | Fetch product shell, permissions, health, overview content, and pending ingest counts |
| Upload artifact | POST | `/api/v1/products/:productId/sources` | Submit one artifact and its metadata for processing |
| Upload transcript compatibility path | POST | `/api/v1/products/:productId/transcripts` | Legacy-compatible transcript upload entry point |
| Poll job status | GET | `/api/v1/jobs/:jobId` | Fetch queued/running/partial/failed/completed job state |
| Load source list | GET | `/api/v1/products/:productId/sources?type=<filter>` | Fetch filtered source inventory |
| Load source detail | GET | `/api/v1/products/:productId/sources/:sourceId` | Fetch source detail drawer payload |
| Submit Ask | POST | `/api/v1/products/:productId/ask` | Fetch answer, citations, warnings, and error states |
| Generate report | POST | `/api/v1/products/:productId/reports` | Start async report generation |
| Load report | GET | `/api/v1/products/:productId/reports/:reportId` | Fetch report body and evidence coverage |

**`POST /api/v1/products/:productId/sources`**
- **UI sends:** multipart form data with `file`, `sourceType`, `sourceDate`, optional `title`, `author`, `participants`, `notes`, optional `metadataFile`
- **UI needs from success response:**
```json
{
  "jobId": "job-123",
  "sourceId": "src-123",
  "status": "queued",
  "title": "Dental Leadership Readout Deck",
  "updatedDomains": ["sources", "ask", "reports"]
}
```
- **UI needs from error response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File type not supported",
    "field": "file",
    "retryable": false
  }
}
```

**`GET /api/v1/jobs/:jobId`**
- **UI needs from response:**
```json
{
  "jobId": "job-123",
  "jobType": "ingest",
  "status": "queued|running|partial|failed|completed",
  "stage": "queued|normalizing|extracting|indexing|recomputing",
  "message": "Optional status message",
  "warnings": ["Optional warning"],
  "result": {
    "sourceId": "src-123",
    "updatedDomains": ["sources", "ask", "reports"]
  }
}
```

**`GET /api/v1/products/:productId/sources/:sourceId`**
- **UI needs from response:**
```json
{
  "source": {
    "id": "src-123",
    "type": "slide_deck",
    "title": "Dental Leadership Readout Deck",
    "sourceDate": "2026-04-16T12:00:00.000Z",
    "author": "Benjiman Jennings",
    "participants": ["Robin Holt"],
    "previewText": "Normalized preview text",
    "processingStatus": "completed",
    "warningText": null,
    "openUrl": "/api/v1/products/dental/sources/src-123/content"
  }
}
```

**State ↔ API Mapping**

| API Response | UI State | UI Behavior |
| :--- | :--- | :--- |
| `202 { status: queued }` | Queued | Close modal, show toast, show ingest status surface |
| `200/202 job running` | Processing | Show progress/status text and keep source row marked as processing |
| `200 job partial` | Partial | Show warning treatment and explanatory copy |
| `200 job completed` | Success | Show completed state and downstream refresh |
| `400 + field` | Validation Error | Show inline field error |
| `401/403` | Unauthorized / Forbidden | Render existing session-expired or permission treatment |
| `500/503` | Server Error | Show scoped error panel with Retry if retryable |
| Network timeout | Timeout / Offline | Show scoped failure and preserve entered values |

## 13.8 Error Taxonomy

| Error Code / Condition | UI Component | User-Facing Copy | Recovery Action |
| :--- | :--- | :--- | :--- |
| `VALIDATION_ERROR` | Inline field error | Field-specific copy from Section 13.4 | Fix field and resubmit |
| `PAYLOAD_TOO_LARGE` | Inline field error | `File exceeds the allowed size limit` | Choose a smaller file |
| `UNAUTHORIZED` | Session-expired view | `Session expired. Sign in again.` | Re-authenticate |
| `FORBIDDEN` | Permission treatment | `You don’t have access to upload artifacts for this product.` | Return to evidence consumption only |
| `NOT_FOUND` | Source or product not found view | `This source or product no longer exists.` | Return to product |
| `KB_UNAVAILABLE` / dependency error | Ask error state | `We couldn’t retrieve evidence right now. Try again.` | Retry |
| `MODEL_TIMEOUT` | Ask error state | `The model took too long to respond. Try again.` | Retry |
| `INTERNAL_ERROR` | Upload or Ask error panel | `Something went wrong. Try again.` | Retry |
| Partial extraction | Warning callout | `Processed with limitations. Review the source before relying on it for critical decisions.` | View source detail |
| Network failure | Scoped error panel | `Check your connection and try again.` | Retry |

## 13.9 Analytics & Telemetry Events

| Event Name | Trigger | Payload | Maps to AC |
| :--- | :--- | :--- | :--- |
| `artifact_upload.opened` | Upload modal opened | `{ productId }` | AC-003 |
| `artifact_upload.submitted` | Upload submitted | `{ productId, sourceType, fileExtension }` | AC-007 |
| `artifact_upload.accepted` | Initial upload request succeeded | `{ productId, sourceId, jobId }` | AC-009 |
| `artifact_upload.completed` | Ingest completed | `{ productId, sourceId, updatedDomains }` | AC-012 |
| `artifact_upload.partial` | Ingest completed with warning | `{ productId, sourceId, warningCount }` | AC-011 |
| `artifact_upload.failed` | Ingest failed | `{ productId, errorCode }` | AC-008 |
| `source_detail.viewed` | Drawer opened | `{ productId, sourceId, sourceType }` | AC-015 |
| `ask.submitted` | Ask request started | `{ productId, questionLength }` | AC-018 |
| `ask.retry_clicked` | Retry pressed | `{ productId, priorErrorCode }` | AC-020 |
| `artifact_search.result_opened` | Search result opened | `{ productId, sourceId }` | AC-021 |
| `structured_import.applied` | Structured import changes data surfaces | `{ productId, sourceType }` | AC-023 |

## 13.10 Data Freshness & Optimistic Updates
- **Optimistic updates:** No optimistic rendering for upload completion, Ask results, or report evidence updates.
- **Rollback on failure:** Modal remains the source of truth for user-entered upload values until the server accepts the request.
- **Polling / realtime:** Job polling is required for ingest status after a queued response. Poll every 2 seconds, stop on `completed`, `partial`, or `failed`, and surface a timeout treatment if no terminal state is reached after 2 minutes. If the user leaves and returns while an ingest job is still non-terminal, the page must rehydrate the current job state and resume polling. Existing report polling remains unchanged.
- **Cache invalidation:** Product, Sources, Ask-relevant evidence surfaces, and report evidence coverage must invalidate or refresh after successful ingest completion. Structured imports must additionally invalidate the relevant Data-tab dataset.
- **Active report behavior:** A completed upload does not silently mutate an already-rendered report. Instead, the UI shows a regenerate notice and requires explicit user action to incorporate the new evidence into report body content.

---
