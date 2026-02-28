# Implement Clinical Reasoning Benchmarks

**Date:** 2026-02-27  
**Owner:** OrthoAI  
**Status:** `FULL` (benchmark runtime, persistence, scoring, gating, reporting, and docs integrated)

## Scope
This document tracks implementation status for the benchmark spec in `docs/audits/CLINICAL_REASONING_BENCHMARK.md`.

## Implemented Artifacts
- Fixtures: `app/lib/benchmarks/clinicalReasoning/cases.v1.json`
- Rubric/types: `app/lib/benchmarks/clinicalReasoning/types.ts`
- Scorer + hybrid utilities: `app/lib/benchmarks/clinicalReasoning/scorer.ts`
- DB migration: `app/lib/memory/migrations/017_clinical_benchmarks.sql`
- Runners:
  - `scripts/benchmark-clinical-decision-support.mjs`
  - `scripts/benchmark-clinical-llm.mjs`
  - `scripts/benchmark-clinical-reasoning.mjs`
  - `scripts/lib/clinical-benchmark-core.mjs`
- Tests: `__tests__/clinical.benchmark.scorer.test.ts`
- Ops guide: `docs/STARTUP.md` (clinical benchmark operations section)
- Review template: `docs/audits/clinical-review-template.json`

## Benchmark Target Decision: **Both**
1. **Deterministic Decision Support Path**
   - Target: `POST /api/clinical/decision-support` (`action: "bundle"`)
2. **Generative LLM Clinical Path**
   - Target: `POST /api/llm` (clinical modes)

## Scoring Approach: **Hybrid**
- Automated rubric scoring with hard safety gates.
- Optional clinician review ingestion with per-dimension scoring, reviewer rationale, dual-review support, and adjudication status tracking.

## Actionable Checklist

### Phase 1: Benchmark Data Model
- [x] Create benchmark fixture file for all 8 v1 cases.
- [x] Define rubric schema with all dimensions and thresholds.

### Phase 2: Scoring Engine
- [x] Implement deterministic scorer with per-dimension 0-4 scoring, notes, and threshold pass/fail.
- [x] Implement clinician-assisted scoring workflow:
  - reviewer score per dimension
  - reviewer rationale/comments
  - second-review/adjudication status support
- [x] Store automated and clinician scores side-by-side.

### Phase 3: Dual Runners (Both Targets)
- [x] Implement decision-support benchmark runner.
- [x] Implement LLM clinical benchmark runner.
- [x] Implement combined orchestrator.
- [x] Wire scripts in `package.json`:
  - `benchmark:clinical:decision-support`
  - `benchmark:clinical:llm`
  - `benchmark:clinical:all`

### Phase 4: Persistence and Reporting
- [x] Add DB tables:
  - `clinical_benchmark_runs`
  - `clinical_benchmark_case_results`
  - `clinical_benchmark_dimension_scores`
- [x] Emit versioned markdown reports to `docs/audits/reports/clinical-benchmark-<timestamp>.md`.
- [x] Include automated averages, clinician averages, disagreement summary, failing cases, and diff vs prior run.

### Phase 5: Test and Gate
- [x] Add Vitest tests for scorer correctness and threshold enforcement.
- [x] Add release gate command (`benchmark:clinical:gate`) with hard threshold failure conditions.
- [x] Add baseline comparison mode with regression detection.

### Phase 6: Documentation and Governance
- [x] Update roadmap verification evidence to reflect runtime benchmark implementation.
- [x] Add benchmark operation guide to `docs/STARTUP.md`.
- [x] Define reviewer calibration process:
  - dual-review required for first 5 hybrid-reviewed runs per target (`decision-support`, `llm`)
  - adjudication required when any dimension differs by >= 1.0 points
  - adjudicated score recorded with source `adjudicated`
- [x] Define hybrid release rule:
  - automated hard-safety thresholds must pass
  - if clinician review file is provided for a promotion run, clinician gate must pass

## Definition of Done
- [x] Benchmark can be run on demand with one command.
- [x] Both targets are evaluated (decision support and LLM modes).
- [x] Rubric and pass criteria are enforced in code.
- [x] Results are persisted and comparable across runs.
- [x] Automated gate blocks below-threshold regressions.
- [x] Clinician-assisted rubric scoring is captured for hybrid runs.
- [x] Auto vs clinician disagreement is tracked and reportable.
- [x] Documentation matches runtime behavior.
