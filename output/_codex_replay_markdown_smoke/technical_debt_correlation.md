# Technical Debt Correlation

## Prompt
Correlate repeated operational failures (retry loops, dead coordinators, stale transfers, proxy restarts) to synthetic cost waste.

## Response
# Technical Debt Correlation

## Top debt signals
- missed_shutdown_hook: 3 anomaly examples
- orphaned_storage_cleanup_gap: 2 anomaly examples

## Interpretation
Repeated operational gaps align with measurable synthetic waste drivers in the dataset summary.

## Metadata
- prompt_slug: technical_debt_correlation
- model: gpt-4o
- mode: local
- generated_at: 2026-04-10T13:24:57Z