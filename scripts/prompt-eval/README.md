# Per-Document Extraction Prompt-Iteration Harness (Phase 1)

Iterate the **single generic Nova Pro prompt** in `server/src/services/semantic/novaSourceExtraction.service.js` against one document at a time, against **live commercial Bedrock** (us-east-1 by default), until the extracted JSON matches a hand-crafted expectation.

This is the per-document foundation. Phase 2 — the aggregate-status prompt that consumes accumulated extractions to drive the product status badge — is a separate plan.

## Files

- `run.mjs` — main loop: load doc → normalize → call Nova → validate → assert → persist
- `expected/<ingest-id>.json` — hand-crafted expectation per document (e.g. `expected/ingest-28.json`)
- `runs/` — auto-created; each run persists the model output here for review

## Required environment variables

| Var | Purpose | Example |
|-----|---------|---------|
| `EIDS_ENABLE_BEDROCK` | Must be `"true"` (the `bedrockTextAvailable()` gate) | `true` |
| `EIDS_AWS_REGION` *or* `AWS_REGION` | Region for the Bedrock client | `us-east-1` |
| `BEDROCK_TEXT_MODEL_ID` *or* `BEDROCK_GEN_MODEL_ID` | Optional override; defaults to `amazon.nova-pro-v1:0` | `amazon.nova-pro-v1:0` |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` *or* `AWS_PROFILE` | AWS creds with `bedrock:InvokeModel` for Nova Pro | — |
| `PROMPT_EVAL_VERSION` | Optional label baked into the prompt + replay key | `eval-2` |

**Must NOT be set**: `VITEST`, `NODE_ENV=test` — both short-circuit `bedrockTextAvailable()` to `false` and the harness will exit early with a clear error.

The script does NOT modify your shell env. Set the vars in your terminal before running.

## Run it

```bash
# Verify creds/region work for Bedrock
EIDS_AWS_REGION=us-east-1 aws bedrock list-foundation-models | grep nova-pro

# One run
EIDS_ENABLE_BEDROCK=true \
EIDS_AWS_REGION=us-east-1 \
node scripts/prompt-eval/run.mjs ingest-28

# Stability check (3 consecutive passes — temperature is 0)
for i in 1 2 3; do
  EIDS_ENABLE_BEDROCK=true EIDS_AWS_REGION=us-east-1 \
    node scripts/prompt-eval/run.mjs ingest-28 || break
done
```

## Iteration workflow

The harness imports `EXTRACTION_SYSTEM_PROMPT` and `buildExtractionUserPrompt` directly from `server/src/services/semantic/novaSourceExtraction.service.js`, so editing the production file is the way to iterate — there is no separate copy in the script to drift.

```
loop:
  1. edit  EXTRACTION_SYSTEM_PROMPT in server/src/services/semantic/novaSourceExtraction.service.js
  2. bump  PROMPT_EVAL_VERSION (just relabels the cache key; doesn't change behaviour)
  3. run   node scripts/prompt-eval/run.mjs ingest-28
  4. read  the assertion diff (raw Nova output prints when a check fails)
  5. exit  when 3 consecutive runs pass all assertions
```

When you settle on the prompt, the production file already has the final wording. To force replay caches to invalidate in environments that use them, bump the `EIDS_PROMPT_REGISTRY_VERSION` env var (or update its default in `server/src/config/runtime.js:85`).

## Exit codes

| Code | Meaning |
|------|---------|
| `0`  | All assertions passed |
| `1`  | Schema validation (AJV) failed — Nova returned malformed JSON |
| `2`  | Schema OK but content assertions failed |
| `3`  | Environment / args invalid (no creds, no region, missing expected file, etc.) |
| `4`  | Bedrock SDK error or unhandled exception |

## Cost note

Each run = 1 Bedrock `Converse` call to Nova Pro with ~600 input tokens and up to 900 output tokens. Commercial Nova Pro pricing at the time of writing is ~$0.0008/1k input + $0.0032/1k output → roughly **$0.003 per iteration**. Budget accordingly.

## Adding a new document

1. Pick the manifest row (or any doc).
2. Create `expected/<ingest-id>.json` mirroring the structure of `ingest-28.json`. Update `_meta.manifestPath` (relative to repo root or under `EIDS-Prototype-Document-Pack/`), `_meta.sourceType`, `_meta.sourceFamily`, etc.
3. Hand-craft the `expectedExtraction` block from the document content.
4. Define `assertions` — keep them shape-based (regex / substring / count) rather than byte-equal so small wording variations don't break the run.
5. Run `node scripts/prompt-eval/run.mjs <ingest-id>`.

## Why this script bypasses `executionPolicy.service.js`

Production gating in `server/src/services/semantic/executionPolicy.service.js:39-46` requires `productId === 'dental'` AND `enableNovaDentalLiveEmail` AND several other flags. This harness calls `extractSourceWithNova` directly with `executionMode: 'live'`, so the policy gate is not consulted. That lets us iterate the prompt against **any product** without first widening the production gate. Widening the gate is Phase 2's responsibility.
