# Future Strategy (Workflow-First) – Refactor Template

## Purpose
Define the target behavior for the Strategy/Workflow system so it can be refactored into a **workflow-first, no-throttle, highest-value** experience. This document is the guiding template for implementation.

## Guiding Principles
- **Workflow is the product**: The multi-model workflow is the default path for all requests.
- **No artificial throttles**: Remove performance gating and “protective” downgrades that degrade quality.
- **Highest-value output**: Bias toward depth, rigor, and completeness over speed.
- **Simple UX**: Remove strategy toggles and option overload.
- **Always-on feedback loop**: Analytics collection and cleanup run by default with no user toggle.

## Current Model Inventory (Authoritative)
- `biogpt`
- `biomistral-7b-instruct`

**Ensemble/Workflow** uses the models above. There are no other model tiers at this time.

## Target Behavior (Summary)
- Strategy system is **always enabled**.
- A **single, high-level workflow** is the only execution mode.
- The workflow **combines ensemble + chain** internally (no user-visible mode selection).
- Resource constraints are **non-blocking** and **non-throttling** (no downshifts based on CPU/RAM/temperature).
- The system should **not** cap quality or token budgets for performance reasons.
- Analytics data is logged for decisions/outcomes and **old data is cleaned automatically** on every run (no toggles).

## Workflow Design
### Single Combined Workflow (Reference Behavior)
This is the only path. It blends ensemble consensus with chain refinement.

**Stage A: Ensemble Draft**
- Parallel: `biogpt` + `biomistral-7b-instruct`
- Select a consensus draft (weighted or consensus logic).

**Stage B: Chain Refinement**
- Step 1: `biomistral-7b-instruct` (refine)
- Step 2: `biomistral-7b-instruct` (review)

**Stage C: Final Selection**
- If Stage A consensus is strong, prefer its core structure.
- If Stage B introduces higher rigor, prefer its output.
- Final merge policy: **TBD** (default: last/review output with incorporated consensus cues).

## Constraints & Throttles (Policy)
- **Remove** RAM/CPU/battery throttles and downgrade logic.
- **Do not** enforce “safety” caps that reduce output quality or token budgets.
- **Only keep hard technical limits** required for valid requests (e.g., a model’s context window). Any such limit should be treated as a technical constraint, not a performance throttle.

## Analytics & Feedback Policy
- Log `strategy_decisions` and `strategy_outcomes` **for every request**.
- Cleanup is **always-on** (no toggle).
- Cleanup runs **on every boot or every request** (implementation choice).
- Retention window: **90 days**.

## UX / UI Changes
- **Remove Strategy Toggle**.
- **Remove Strategy Selector** (speed/quality/cost/adaptive/balanced).
- **Remove Workflow Mode selector** (no mode choice; always combined workflow).
- Model selector should remain disabled or hidden when workflow is active (if it still exists).

## API / Contract Changes
- `/api/llm` should **always** execute workflow and return workflow metadata.
- `strategyEnabled`, `selectedStrategy`, and related toggles should be deprecated/removed.
- `decisionId` should always be present for feedback tracking.

## Implementation Checklist (Draft)
1. UI: remove strategy toggle and selector.
2. UI: remove workflow mode selector.
3. API: default workflow execution without `strategyEnabled` guard.
4. Strategy manager: remove unused strategies or keep only workflow internally.
5. Context/model catalog: ensure only `biogpt` and `biomistral-7b-instruct` are referenced.
6. Constraints: remove downgrades and throttling logic.
7. Analytics: always log decision/outcome and always cleanup.
8. Docs: update README and workflow docs to match this policy.

## Open Decisions
- Should we keep the concept of “strategy” in code, or rename to “workflow” throughout?
- Are there any acceptable **technical** caps beyond context window (e.g., absolute max tokens to prevent invalid requests)?

## Acceptance Criteria
- Strategy toggle and selector are removed from UI.
- Workflow executes for every request.
- No resource-based downgrades or throttles are applied.
- Analytics logging + cleanup runs automatically with no user config.
- Docs reflect the new workflow-first, no-throttle policy.
