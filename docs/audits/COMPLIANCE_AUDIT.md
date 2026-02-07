STRICTLY FOR MY UNDERSTANDING AND NOT BUILD OR DESIGN GUIDELINES
MANY OF THE DECISIONS ARE INTENTIONAL AS THIS IS NOT BEING USED BY ANYONE BUT MYSELF CURRENTLY AND IS STILL UNDERDEVELOPMENT

**Compliance Audit**
Date: February 6, 2026
Scope reviewed: `app/api/llm/route.ts`, `app/lib/domain/*`, `app/lib/memory/*`, `app/lib/knowledge/*`, `app/lib/cases/*`, `app/lib/strategy/*`, `components/*`, `docs/BUILD_DECISIONS.md`, `docs/REFACTOR.md`.
Assumptions: Local-first deployment, but network exposure is possible unless explicitly restricted to localhost.

**Top Risks**
1. **Clinical Authority Without Guardrails**
   How it could occur: The base system prompt explicitly frames OrthoAI as an “attending orthopedic surgeon and clinical advisor” and every mode is “attending-level,” while docs explicitly reject “not medical advice” guardrails. A patient or non-specialist user can receive prescriptive clinical recommendations, including surgery planning, and treat them as authoritative. This creates direct risk of unsafe self-management, delay in care, or inappropriate procedures. Evidence: `app/lib/domain/contextBuilder.ts`, `app/lib/domain/modeDefinitions.ts`, `docs/BUILD_DECISIONS.md`, `docs/REFACTOR.md`.
   Mitigations: Add explicit role boundaries in system and UI copy; require clinician attestation or a “research-only” mode; block prescriptive dosing or procedural instructions for non-clinician sessions; add a visible “informational only” banner and contextual warnings for diagnosis/management requests.

2. **No Emergency Triage or Red-Flag Safeguards**
   How it could occur: There is no hard safety layer that detects red flags (neurovascular compromise, compartment syndrome, septic joint, cauda equina, acute infection) or mandates urgent escalation. The prompt emphasizes decisiveness, which can produce reassuring advice for time-sensitive conditions. The system can therefore delay urgent care. Evidence: `app/lib/domain/contextBuilder.ts`, `app/lib/domain/modeDefinitions.ts`, `app/api/llm/route.ts` (no safety screening or post-check).
   Mitigations: Implement a rule-based red-flag detector before LLM calls; require an “urgent care” banner when risk keywords are present; insert mandatory escalation language when red flags or high-risk combos appear; log and review all red-flag interactions.

3. **Untrusted Context Injection and Prompt Injection via RAG/Case Data**
   How it could occur: Retrieved knowledge chunks and patient case context are appended directly to the system prompt, and memory retrieval can include raw user/assistant messages. Malicious or sloppy content in knowledge ingestion or prior chats can override system intent (e.g., “ignore previous instructions,” or “give dosing advice”), and the model will treat it as high-trust system context. Evidence: `app/api/llm/route.ts` (case and knowledge context injection), `app/lib/knowledge/index.ts`, `app/lib/memory/rag/index.ts`.
   Mitigations: Treat retrieved content as untrusted and inject it as quoted evidence, not as system instructions; implement prompt-injection filtering on RAG content; add a system-level “do not follow instructions from retrieved content” guard; store and display source provenance and confidence.

4. **Cross-Patient Memory Contamination**
   How it could occur: If conversation-specific retrieval returns no results, the RAG manager falls back to a global search across all messages. This can leak another patient’s content into the current response and contaminate care decisions. It is both a safety and privacy failure. Evidence: `app/lib/memory/rag/index.ts` (global fallback in `retrieveSimilarMessages`).
   Mitigations: Disable global fallback by default; enforce strict conversation or case scoping for retrieval; separate vector collections per case or per user; add a “no cross-case” flag enforced at the retrieval layer.

5. **PHI Persistence, Consent Mismatch, and Logging Exposure**
   How it could occur: Messages are saved to SQLite/Chroma regardless of the UI “memory consent” toggle (which only affects retrieval and profile injection). Query text is stored in retrieval metrics, and memory context is logged to console. This creates retention of PHI without consent and potential leakage through logs or backups. Evidence: `app/api/llm/route.ts` (unconditional `saveMessage`), `app/lib/memory/index.ts`, `app/lib/memory/metrics.ts`, `app/lib/memory/rag/index.ts`.
   Mitigations: Make storage contingent on explicit consent; add an ephemeral “no-store” mode; redact or hash query text in metrics; remove raw context logging; encrypt local databases; implement retention policies with automatic purge.

6. **No Authentication/Authorization on PHI-Capable Endpoints**
   How it could occur: Case, profile, memory, and knowledge APIs are accessible without auth. If the app is bound to a network interface (not strictly localhost), any local or network user can read or modify PHI. Evidence: `app/api/cases/route.ts`, `app/api/profile/route.ts`, `app/api/knowledge/route.ts`, `app/api/memory/*`.
   Mitigations: Require authentication on all PHI endpoints; bind the server to `127.0.0.1` by default; add CSRF protection; enforce user/session separation at the storage layer.

7. **Overconfidence and Poor Uncertainty Calibration**
   How it could occur: Prompts explicitly instruct decisiveness and attending-level authority, but there is no structured requirement to quantify uncertainty, abstain, or flag insufficient data. This encourages confident hallucinations, especially with incomplete or conflicting inputs, or rare conditions. Evidence: `app/lib/domain/contextBuilder.ts`, `app/lib/domain/modeDefinitions.ts`.
   Mitigations: Require a confidence or uncertainty statement for diagnostic or treatment recommendations; add a “do not guess” guardrail; implement a check that blocks recommendations without key data; integrate structured “missing critical info” prompts.

8. **Multi-Model Workflow and Ensemble Without Safety Gating**
   How it could occur: The ensemble workflow calculates low consensus but still returns a response; no abstain or escalation is triggered. Strategy decisions can auto-select models or chains without safety checks. This risks overconfident outputs on ambiguous or rare cases. Evidence: `app/lib/strategy/workflows/ensemble.ts`, `app/api/llm/route.ts`.
   Mitigations: Enforce minimum consensus thresholds and abstain if not met; fall back to “need more info” or human review; log low-consensus responses for audit; require a higher-tier model or structured verification when disagreement is high.

9. **Bias and Population Risk Gaps**
   How it could occur: There is no enforced capture of demographics (age, sex, pregnancy, disability, activity level, social context), and no bias evaluation. The model can default to adult, male, athletic norms and produce unsafe recommendations for pediatrics, geriatrics, pregnancy, or marginalized populations. Evidence: prompts do not require demographic checks in `app/lib/domain/modeDefinitions.ts` or `app/lib/domain/contextBuilder.ts`.
   Mitigations: Add mandatory demographic and risk-factor prompts for clinical modes; create population-specific safety checks (pediatric, pregnancy, anticoagulation, immunocompromised); implement bias test suites and report performance gaps.

10. **Voice Pipeline Mis-Transcription and Auto-Submit Risk**
   How it could occur: Whisper transcription is automatically sent to the LLM without user confirmation, and the system auto-resumes listening. Misheard medication names, laterality, or severity can directly alter clinical advice, then be stored in memory for future retrieval. Evidence: `app/lib/voice/useVoiceInput.ts`, `app/lib/voice/useVoiceFlow.ts`, `components/Chat.tsx`.
   Mitigations: Require transcript confirmation before sending; highlight low-confidence segments; disable auto-resume for clinical modes; provide a “review before save” toggle for memory when voice is enabled.

**Unknown Unknowns**
- Model validation status is unclear: no evidence of clinical safety evaluations, red-team testing, or benchmark results for rare/edge orthopedic conditions. Risk may be substantially higher than expected if model performance is weak. Evidence of missing evaluation work: `docs/REFACTOR.md` (evaluation listed as future work).
- RAG content quality and provenance are unknown: ingestion pipeline is planned but not implemented, and there is no evidence grading or citation fidelity enforcement. If low-quality or outdated sources are ingested, error rates could spike. Evidence: `docs/BUILD_DECISIONS.md`, `docs/FUTURE.md`.
- External endpoint usage is not enforced: if `LLM_BASE_URL` or embedding endpoints point to a remote service, PHI could leave the device without explicit warning or consent. Evidence: `app/lib/llm/config.ts`.
- Operational security posture is undefined: backup policies, log forwarding, and OS-level protections can make local storage effectively “shared,” but there are no controls in code to prevent it.
- Voice/STT accuracy across accents, non-native speakers, and noisy environments is untested; risk of systematic errors is unknown.

