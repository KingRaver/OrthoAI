# Memory Release Checklist (Track E)

This checklist is the release gate for memory feature rollout in OrthoAI.

## 1) SLO Targets (24h canary window)

- `avg latency <= 180ms`
- `p95 latency <= 450ms`
- `p99 latency <= 700ms`

These thresholds apply to:
- `dense_only` (`RAG_HYBRID=false`, `RAG_CHUNKING=false`)
- `hybrid` (`RAG_HYBRID=true`, `RAG_CHUNKING=false`)
- `chunked` (`RAG_HYBRID=true`, `RAG_CHUNKING=true`)

## 2) Benchmark Gate

Run:

```zsh
npm run memory:benchmark:retrieval -- --hours=24 --min-samples=20
```

Pass criteria:
- Script exits `0`
- All three modes have at least `20` samples
- All three modes meet avg/p95/p99 thresholds

## 3) Release Checklist

1. Verify migrations applied:
   - `014_summary_operational_health.sql`
   - `015_message_chunking.sql`
2. Verify FTS integrity:
   - `npm run memory:fts:check`
   - duplicate extra rows must remain `0`
3. Verify summary/profile reliability:
   - `npm run memory:canary:report -- --hours=24`
   - summary success rate target remains `>=99%`
4. Run retrieval benchmark:
   - `npm run memory:benchmark:retrieval -- --hours=24 --min-samples=20`
5. Confirm runtime controls in toolbar:
   - Hybrid toggle
   - Chunking toggle
   - Token budget selector
   - Summary frequency selector
6. Confirm ops visibility endpoint:
   - `GET /api/memory/ops`
   - queue depth + recent failures present

## 4) Rollback Toggles

Apply via `.env.local` (or runtime environment), then restart app:

```env
# Full memory retrieval rollback (dense-only, minimal overhead)
RAG_HYBRID=false
RAG_CHUNKING=false
RAG_TOKEN_BUDGET=800

# Disable summaries if upstream LLM instability appears
RAG_SUMMARY_FREQUENCY=0

# Reduce hot-path analytics overhead
RAG_METRICS_ENABLED=false
RAG_SEARCH_QUERY_LOGGING=false
```

Partial rollback options:
- Disable chunking only: `RAG_CHUNKING=false` (keep hybrid)
- Disable hybrid only: `RAG_HYBRID=false` (dense-only retrieval)
- Keep metrics on but sample:
  - `RAG_METRICS_ENABLED=true`
  - `RAG_METRICS_SAMPLE_RATE=0.25`
  - `RAG_SEARCH_QUERY_LOGGING=true`
  - `RAG_SEARCH_QUERY_SAMPLE_RATE=0.1`

## 5) Post-Rollback Verification

1. Call `GET /api/memory/ops` and confirm control values match expected rollback settings.
2. Re-run:
   - `npm run memory:canary:report -- --hours=1`
3. Confirm latency regression and error rate stabilize before re-enabling features.
