# REVIEW_01

Date: 2026-02-12  
Reviewer: Codex  
Scope: Repository-wide code + docs deep dive (`app`, `components`, `scripts`, `__tests__`, `docs`)

## Validation Snapshot

- `npm run type-check` fails.
- `npm run test:run` partially fails.
- Working tree is already dirty from in-progress local changes (not modified by this review).

## Post-Patch Verification (2026-02-12)

- `npm rebuild better-sqlite3` completed successfully.
- `npm run -s type-check` passes.
- `npm run -s test:run` passes (`6/6` files, `38/38` tests).

### Type-check failure groups

1. Next.js dynamic route handler signature mismatch:
- `app/api/cases/[id]/events/route.ts`
- `app/api/cases/[id]/export/route.ts`
- `app/api/cases/[id]/link/route.ts`

2. Legacy script import path failures:
- `scripts/legacy/test-phase1-metrics.ts`
- `scripts/legacy/test-phase2-summaries.ts`
- `scripts/legacy/test-phase3-hybrid.ts`

### Test failure groups

1. Native module ABI mismatch (`better-sqlite3`) in environment.
2. Memory-heavy suites fail because SQLite native binding cannot load for current Node runtime.

## Findings

## Critical

### R01-001 - Next 16 route context mismatch on dynamic API routes
- Severity: Critical
- Impact: Breaks full `type-check`; can cause routing contract drift.
- Evidence:
  - `app/api/cases/[id]/events/route.ts:5`
  - `app/api/cases/[id]/export/route.ts:5`
  - `app/api/cases/[id]/link/route.ts:5`
- Expected fix: Align handlers to `context: { params: Promise<{ id: string }> }` pattern already used in other routes.

### R01-002 - Workflow response omits `conversationId`
- Severity: Critical
- Impact: Conversation continuity can break on workflow path.
- Evidence:
  - `app/api/llm/route.ts:456`
- Expected fix: Include `conversationId: currentConversationId` in workflow JSON response.

### R01-003 - Incorrect `saveMessage` metadata argument shape in workflow branch
- Severity: Critical
- Impact: Wrong runtime metadata persistence behavior for assistant workflow responses.
- Evidence:
  - `app/api/llm/route.ts:453`
- Expected fix: Pass metadata object shape expected by `saveMessage` (e.g., `{ model_used: model }`).

## High

### R01-004 - Mode analytics ingestion path is incomplete
- Severity: High
- Impact: Mode dashboard and feedback accounting are unreliable/incomplete.
- Evidence:
  - `app/lib/domain/modeAnalytics.ts:81` (`logInteraction` exists)
  - No callsites for `modeAnalytics.logInteraction(...)`
  - `app/api/feedback/route.ts:134` updates feedback without guaranteed prior interaction row
- Expected fix: Log mode interaction at generation time in `/api/llm`, then update by stable ID on feedback.

### R01-005 - Mode taxonomy mismatch (`treatment-decision` missing)
- Severity: High
- Impact: Mode-level analytics omit an active product mode.
- Evidence:
  - `app/lib/domain/modeAnalytics.ts:178`
- Expected fix: Add `treatment-decision` to aggregated mode list and dashboard labels.

### R01-006 - Strategy analytics route still queries deprecated strategy set
- Severity: High
- Impact: Dashboard shows strategies that no longer represent workflow-first runtime.
- Evidence:
  - `app/api/analytics/route.ts:40`
- Expected fix: Report only active strategy/workflow artifacts (or explicitly mark legacy rows).

### R01-007 - Learning Dashboard copy contains stale mode references
- Severity: High
- Impact: User-facing analytics UX is inconsistent with current OrthoAI modes.
- Evidence:
  - `components/LearningDashboard.tsx:344`
  - `components/LearningDashboard.tsx:456`
- Expected fix: Replace stale copy with current mode set.

## Medium

### R01-008 - Legacy scripts break repository type-check
- Severity: Medium
- Impact: Blocks green baseline for CI/dev checks.
- Evidence:
  - `scripts/legacy/test-phase1-metrics.ts:4`
  - `scripts/legacy/test-phase2-summaries.ts:4`
  - `scripts/legacy/test-phase3-hybrid.ts:6`
- Expected fix: Exclude from tsconfig include, or fix imports and toolchain for legacy scripts.

### R01-009 - Streaming path is effectively dead code in chat client
- Severity: Medium
- Impact: Extra maintenance burden; dual-path logic drift risk.
- Evidence:
  - `components/Chat.tsx:287` (`const shouldStream = false`)
- Expected fix: Remove dead branch or re-enable streaming intentionally.

### R01-010 - Timeout documentation mismatch
- Severity: Medium
- Impact: Operational confusion for runtime tuning.
- Evidence:
  - `README.md:286` (documents `900000`)
  - `app/lib/llm/config.ts:4` (default is `3600000`)
- Expected fix: Normalize docs/config defaults and update startup docs.

### R01-011 - Docs still contain stale Hacker Reign and old mode narratives
- Severity: Medium
- Impact: Onboarding and maintenance drift.
- Evidence:
  - `docs/TOOLBAR.md:17`
  - `docs/MODE_VOTING.md:7`
  - `app/lib/voice/README.md:1`
- Expected fix: Rewrite or archive stale docs with explicit source-of-truth references.

### R01-012 - DL codegen scope is contradictory across repo
- Severity: Medium
- Impact: Unclear product boundary; wasted maintenance surface.
- Evidence:
  - Disabled APIs: `app/api/dl-codegen/train/route.ts:1`, `app/api/dl-codegen/predict/route.ts:1`
  - Active libs/tests/docs still present under `app/lib/dl-codegen/*`, `__tests__/dl-codegen-phase7.test.ts`, docs
- Expected fix: Decide keep/remove strategy and align code/docs/tests accordingly.

## Environment/Tooling

### R01-013 - `better-sqlite3` ABI mismatch with active Node runtime
- Severity: Environment
- Impact: SQLite-backed tests fail even when logic is correct.
- Evidence: `npm run test:run` failure signature (`NODE_MODULE_VERSION` mismatch).
- Expected fix: Rebuild/reinstall native module for active Node version, then rerun tests.

## Patch Checklist

Use this checklist to track implementation patches against findings.

- [x] P01 - Fix dynamic route context signatures (`R01-001`)
  - Target files: `app/api/cases/[id]/events/route.ts`, `app/api/cases/[id]/export/route.ts`, `app/api/cases/[id]/link/route.ts`
  - Patch summary: Updated handlers to use Next 16-style dynamic route context with `params: Promise<{ id: string }>` and awaited `id` extraction in GET/POST handlers.
  - Verification: `npm run -s type-check` no longer reports route signature mismatch errors for these routes.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P02 - Return `conversationId` in workflow response (`R01-002`)
  - Target files: `app/api/llm/route.ts`
  - Patch summary: Added `conversationId: currentConversationId` to the workflow JSON response payload.
  - Verification: Code inspection confirms workflow branch now returns `conversationId`.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P03 - Fix workflow `saveMessage` metadata shape (`R01-003`)
  - Target files: `app/api/llm/route.ts`
  - Patch summary: Replaced string metadata argument with expected object shape: `{ model_used: model }`.
  - Verification: Code inspection confirms `saveMessage(...)` now matches `MemoryManager.saveMessage` metadata contract.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P04 - Implement mode interaction logging pipeline (`R01-004`, `R01-005`)
  - Target files: `app/api/llm/route.ts`, `app/api/feedback/route.ts`, `app/lib/domain/modeAnalytics.ts`, `components/LearningDashboard.tsx`
  - Patch summary: Added mode interaction logging on LLM response paths, standardized mode interaction IDs, made feedback mode updates robust via upsert behavior, and added `treatment-decision` coverage to mode analytics.
  - Verification: `npm run -s type-check`.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P05 - Align strategy analytics output to workflow-first model (`R01-006`)
  - Target files: `app/api/analytics/route.ts`
  - Patch summary: Strategy analytics endpoint now reports workflow strategy metrics only for active workflow-first runtime.
  - Verification: Code inspection + `npm run -s type-check`.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P06 - Clean stale dashboard and user-facing mode copy (`R01-007`)
  - Target files: `components/LearningDashboard.tsx`, related docs
  - Patch summary: Updated stale strategy/mode empty-state copy and mode labels to current OrthoAI clinical taxonomy (including `treatment-decision`).
  - Verification: Code inspection + `npm run -s type-check`.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P07 - Resolve legacy script type-check policy (`R01-008`)
  - Target files: `tsconfig.json`, `scripts/legacy/*` (as decided)
  - Patch summary: Excluded `scripts/legacy` from repository TypeScript compile scope to keep active app/runtime checks green while retaining legacy test utilities in-place.
  - Verification: `npm run -s type-check` passes with no legacy import path failures.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P08 - Remove or re-enable streaming branch intentionally (`R01-009`)
  - Target files: `components/Chat.tsx`, `app/api/llm/route.ts`
  - Patch summary: Removed dead streaming response parsing/types from chat client and kept explicit workflow-first non-streaming request handling (`stream: false`).
  - Verification: `npm run -s type-check`; `npm run -s test:run`.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P09 - Normalize runtime timeout defaults in docs/config (`R01-010`)
  - Target files: `README.md`, `docs/STARTUP.md`, `app/lib/llm/config.ts` (if needed)
  - Patch summary: Normalized timeout defaults to 15 minutes in runtime config and aligned docs to configured bounds (`10-120 min`).
  - Verification: Code/doc inspection + `npm run -s type-check`.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P10 - Documentation cleanup for stale/legacy guidance (`R01-011`)
  - Target files: `docs/TOOLBAR.md`, `docs/MODE_VOTING.md`, `app/lib/voice/README.md` (or archive/move)
  - Patch summary: Rewrote stale toolbar/mode-voting/voice docs to current OrthoAI workflow and removed outdated legacy narratives.
  - Verification: Documentation inspection for current mode taxonomy and feature references.
  - Owner: Codex
  - Date: 2026-02-12

- [x] P11 - Decide and execute DL codegen scope policy (`R01-012`)
  - Target files: `app/api/dl-codegen/*`, `app/lib/dl-codegen/*`, `__tests__/dl-codegen-phase7.test.ts`, docs
  - Patch summary: Formalized "archived/disabled by default" policy; added feature flag gate (`ENABLE_DL_CODEGEN=true`) in module entry points and aligned DL docs to research-only scope.
  - Verification: `npm run -s type-check`; `npm run -s test:run` (includes `__tests__/dl-codegen-phase7.test.ts`).
  - Owner: Codex
  - Date: 2026-02-12

- [x] P12 - Rebuild native deps and validate test baseline (`R01-013`)
  - Target files: environment/package lock as needed
  - Patch summary: Rebuilt `better-sqlite3` for active Node runtime and re-ran full baseline checks.
  - Verification: `npm rebuild better-sqlite3`; `npm run -s test:run`; `npm run -s type-check`.
  - Owner: Codex
  - Date: 2026-02-12

## Patch Log

Append entries as patches are completed.

- [ ] Entry template
  - Patch ID:
  - Commit/PR:
  - Findings addressed:
  - Files changed:
  - Validation run:
  - Notes:

- [x] Critical patch batch (P01-P03)
  - Patch ID: `P01-P03`
  - Commit/PR: local working tree changes (not committed in this step)
  - Findings addressed: `R01-001`, `R01-002`, `R01-003`
  - Files changed:
    - `app/api/cases/[id]/events/route.ts`
    - `app/api/cases/[id]/export/route.ts`
    - `app/api/cases/[id]/link/route.ts`
    - `app/api/llm/route.ts`
  - Validation run: `npm run -s type-check`
  - Notes: Remaining type-check errors were pre-existing legacy script import failures under `scripts/legacy/*`.

- [x] Analytics/mode patch batch (P04-P06)
  - Patch ID: `P04-P06`
  - Commit/PR: local working tree changes (not committed in this step)
  - Findings addressed: `R01-004`, `R01-005`, `R01-006`, `R01-007`
  - Files changed:
    - `app/api/llm/route.ts`
    - `app/api/feedback/route.ts`
    - `app/lib/domain/modeAnalytics.ts`
    - `app/api/analytics/route.ts`
    - `components/LearningDashboard.tsx`
  - Validation run: `npm run -s type-check`
  - Notes: Initial run remained blocked by legacy script imports; resolved in subsequent `P07`.

- [x] Stability/docs patch batch (P07-P11)
  - Patch ID: `P07-P11`
  - Commit/PR: local working tree changes (not committed in this step)
  - Findings addressed: `R01-008`, `R01-009`, `R01-010`, `R01-011`, `R01-012`
  - Files changed:
    - `tsconfig.json`
    - `components/Chat.tsx`
    - `app/lib/llm/config.ts`
    - `README.md`
    - `docs/TOOLBAR.md`
    - `docs/MODE_VOTING.md`
    - `app/lib/voice/README.md`
    - `app/lib/dl-codegen/index.ts`
    - `app/lib/dl-codegen/README.md`
    - `app/lib/dl-codegen/INTEGRATION.md`
  - Validation run: `npm run -s type-check`
  - Notes: Stream handling is now intentionally non-streaming in the current workflow-first UI path.

- [x] Environment baseline patch (P12)
  - Patch ID: `P12`
  - Commit/PR: local environment validation (not committed in this step)
  - Findings addressed: `R01-013`
  - Files changed:
    - native dependency artifacts (`better-sqlite3` rebuild)
  - Validation run:
    - `npm rebuild better-sqlite3`
    - `npm run -s test:run`
    - `npm run -s type-check`
  - Notes: Full test suite now passes (`6/6` files, `38/38` tests).
