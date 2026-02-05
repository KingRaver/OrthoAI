# User Profile Guide - Optimize Your AI Experience

**Last Updated:** 2026-01-20
**Feature Status:** Phase 2 Complete ✅
**Privacy:** Your profile never leaves your machine. All data stored locally.

---

## What is the Profile Feature?

Your **User Profile** teaches Hacker Reign about your coding preferences, making every conversation more personalized and relevant. When enabled, the AI automatically considers your style, languages, and preferences when generating responses.

### Key Benefits

✅ **Personalized responses** - AI adapts to YOUR coding style
✅ **Context preservation** - Preferences persist across conversations
✅ **Time savings** - No need to repeat preferences in every chat
✅ **Privacy-first** - Profile stored locally, requires explicit consent
✅ **Fully reversible** - Clear profile anytime with one click

---

## How It Works

```
1. Enable Memory consent in LeftToolbar
   ↓
2. Profile section appears (expandable hamburger menu)
   ↓
3. Fill out your preferences (5 structured fields)
   ↓
4. Click Save → Profile embedded into vector database
   ↓
5. AI retrieves your profile during conversations (if consent ON)
   ↓
6. Responses tailored to your style automatically
```

---

## Getting Started

### Step 1: Enable Memory Consent

1. Open the **LeftToolbar** (left side of screen)
2. Find the **🧠 Memory** toggle button
3. Click to enable (turns teal when active)
4. **👤 Profile** section becomes clickable

### Step 2: Expand Profile Section

1. Click **👤 Profile** to expand the hamburger menu
2. Five input fields appear:
   - **Coding Style** - Your programming paradigm
   - **Languages** - Languages you work with
   - **Frameworks** - Frameworks/tools you use
   - **Preferences** - General preferences (testing, docs, etc.)
   - **Notes** - Additional freeform context

### Step 3: Fill Out Your Profile

**Quality over quantity** - Be specific but concise. The AI uses semantic search, so natural language works best.

### Step 4: Save Your Profile

1. Click **💾 Save** button
2. Wait for "Profile saved successfully" in console
3. Profile is now active and embedded
4. Close the profile section if desired

---

## Optimization Guide

### 🎯 Coding Style (Best Practices)

**What to include:**
- Primary paradigm (functional, OOP, procedural, reactive)
- Code organization preferences
- Naming conventions you follow

**Examples:**

✅ **Good:**
```
Functional programming with TypeScript, prefer pure functions and immutability
```

✅ **Better:**
```
Functional-first with hooks, avoid classes, prefer composition over inheritance
```

❌ **Too vague:**
```
I like clean code
```

❌ **Too specific:**
```
Always use exactly 2 spaces for indentation, never tabs, functions must be under 50 lines, variable names must be camelCase with descriptive prefixes...
```

**Tips:**
- Focus on architecture, not syntax details
- Mention philosophy (DRY, SOLID, KISS, etc.) if important
- Keep it to 1-2 sentences

---

### 💻 Languages (Best Practices)

**What to include:**
- Languages you actively use
- Optional: Proficiency level (if relevant)
- Optional: Use cases (e.g., "Python for ML, TypeScript for web")

**Examples:**

✅ **Good:**
```
TypeScript, Python, Rust
```

✅ **Better:**
```
TypeScript (primary), Python (data/ML), Rust (learning)
```

❌ **Too many:**
```
JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust, Ruby, PHP, Kotlin, Swift, Dart
```

**Tips:**
- List 2-5 languages max (AI focuses on most relevant)
- Order by frequency of use
- Mention learning languages separately

---

### 🛠️ Frameworks (Best Practices)

**What to include:**
- Primary frameworks you work with
- Key tools in your stack
- Version preferences (if critical)

**Examples:**

✅ **Good:**
```
Next.js, React, FastAPI
```

✅ **Better:**
```
Next.js 14 (App Router), React 18, FastAPI, Tailwind CSS
```

❌ **Too specific:**
```
Next.js 14.0.3 with Turbopack, React 18.2.0 with concurrent features, FastAPI 0.104.1, Tailwind CSS 3.3.5 with JIT mode
```

**Tips:**
- Focus on frameworks, not libraries
- Include CSS framework if you have strong preferences
- Mention tooling (Vite, Webpack) if relevant

---

### ⚙️ Preferences (Best Practices)

**What to include:**
- Testing preferences
- Documentation style
- Code quality standards
- Development workflow

**Examples:**

✅ **Good:**
```
Comprehensive testing, detailed documentation, type-safe code
```

✅ **Better:**
```
Test-driven development, inline docs with examples, strict TypeScript, prefer explicit over clever
```

❌ **Redundant:**
```
I like good code quality and best practices
```

**Tips:**
- Be specific about testing (TDD, unit, integration, E2E)
- Mention if you prefer comments, JSDoc, or self-documenting code
- Include error handling philosophy if important

---

### 📝 Notes (Best Practices)

**What to include:**
- Anything that doesn't fit above
- Project context
- Learning goals
- Unique constraints or requirements

**Examples:**

✅ **Good:**
```
Working on offline-first app with Ollama. Prefer local models over cloud APIs. Learning RAG patterns.
```

✅ **Better:**
```
Building privacy-focused coding assistant. Optimize for M4 Max performance. Interested in vector databases and semantic search. Avoid cloud dependencies.
```

❌ **Personal info:**
```
My name is John, I work at Acme Corp, my email is john@example.com
```

**Tips:**
- This is your "catch-all" field - use it!
- Great place for project-specific context
- Mention constraints (offline, performance, privacy)
- Avoid personal identifying information

---

## Example Complete Profiles

### Example 1: Web Developer (Full-Stack)

```
Coding Style: Functional programming with TypeScript, prefer pure functions

Languages: TypeScript, Python

Frameworks: Next.js 14, React, FastAPI, Tailwind CSS

Preferences: Testing with Jest/Vitest, inline JSDoc, type-safe APIs

Notes: Building SaaS apps. Focus on performance and accessibility.
Prefer server components over client when possible.
```

**Why it works:**
- Clear paradigm (functional)
- Focused stack (web-first)
- Specific preferences (type safety, testing)
- Project context (SaaS, performance)

---

### Example 2: ML/Data Engineer

```
Coding Style: Object-oriented Python, modular architecture

Languages: Python (primary), SQL, TypeScript (dashboards)

Frameworks: PyTorch, FastAPI, Pandas, Plotly

Preferences: Jupyter notebooks for exploration, pytest for testing,
detailed docstrings

Notes: Working on ML pipelines and model deployment. Prefer scikit-learn
API patterns. Focus on reproducibility and experiment tracking.
```

**Why it works:**
- Domain-specific (ML/data)
- Tooling matches use case
- Workflow preferences clear
- Context helps AI understand project type

---

### Example 3: Systems Programmer

```
Coding Style: Performance-first, explicit over implicit

Languages: Rust, C, TypeScript

Frameworks: Tokio, axum, Actix

Preferences: Zero-cost abstractions, comprehensive error handling,
benchmarking critical paths

Notes: Building high-performance services. Optimize for latency and
throughput. Avoid allocations in hot paths.
```

**Why it works:**
- Performance focus clear
- Low-level languages
- Specific optimization goals
- Constraints well-defined

---

## Privacy & Consent

### What Gets Stored

**Stored locally in SQLite:**
- Profile text (exactly what you type)
- Content hash (for change detection)
- Embedding status (success/failed)
- Timestamps

**Stored in ChromaDB (vector database):**
- Semantic embedding of your profile
- Used for similarity search during retrieval

**NOT stored:**
- Your conversations (stored separately)
- Any data outside the profile fields
- Personal identifying information (unless you add it)

### How It's Used

1. **During chat:** When you ask a question, AI searches memory
2. **Retrieval:** Top-K relevant memories retrieved (messages, summaries, **profile**)
3. **Context building:** Profile added to system prompt if consent=ON
4. **Response:** AI generates response considering your profile

**Key point:** Profile ONLY used when **🧠 Memory** is ON. Toggle off anytime to disable.

---

## Managing Your Profile

### Updating Your Profile

1. Expand **👤 Profile** section
2. Edit any field
3. Click **💾 Save**
4. New embedding automatically generated
5. Old embedding replaced

**Note:** Profile updates are immediate. Next conversation uses new preferences.

### Clearing Your Profile

1. Expand **👤 Profile** section
2. Click **🗑️** (trash icon)
3. Confirm deletion
4. Profile removed from database AND vector store

**Warning:** This action cannot be undone. You'll need to recreate your profile from scratch.

### Disabling Profile (Temporarily)

1. Toggle **🧠 Memory** to OFF
2. Profile still exists in database
3. Profile NOT used in retrieval
4. Re-enable anytime to resume using profile

**Use case:** Quick test without profile influence, or privacy-sensitive conversation.

---

## Advanced Tips

### 🚀 Optimization Strategies

**1. Start Minimal, Iterate**
- Begin with just Coding Style + Languages
- Use app for a few conversations
- Add more detail based on what AI misses

**2. Test Your Profile**
- After saving, ask: "What do you know about my coding preferences?"
- AI should reflect your profile accurately
- Refine if AI interpretation is off

**3. Project-Specific Profiles**
- Create different profiles for different projects
- Use Notes field for project context
- Clear and recreate when switching contexts

**4. Periodic Review**
- Review profile every few weeks
- Update as your stack evolves
- Remove outdated preferences

### ⚡ Performance Considerations

**Profile size:**
- Recommended: 200-500 characters total
- Maximum: ~2000 characters (hard limit: 8192 tokens)
- Larger profiles = slower embedding + retrieval

**Embedding time:**
- Small profile (200 chars): ~100-200ms
- Large profile (1000 chars): ~300-500ms
- Embedding happens async (doesn't block UI)

**Retrieval impact:**
- Profile always retrieved if consent ON
- Counts as 1 of top-K results
- If top-K=5, you get 4 messages + 1 profile

---

## Troubleshooting

### Profile Not Loading

**Symptoms:** Click expand, but fields empty or show "Loading..." forever

**Fixes:**
1. Check console for errors (F12 → Console)
2. Verify Memory consent is ON
3. Refresh page and try again
4. Check if ChromaDB is running: `curl http://localhost:8000/api/v1/heartbeat`

---

### Profile Not Used in Responses

**Symptoms:** AI doesn't seem to know your preferences

**Fixes:**
1. Verify **🧠 Memory** is ON (teal color)
2. Check embedding status in console after save
3. Wait 2-3 seconds after save before chatting (embedding may be processing)
4. Try asking: "What coding style do I prefer?" to test retrieval

---

### Save Button Not Working

**Symptoms:** Click Save, nothing happens or error

**Fixes:**
1. Check console for API errors
2. Verify all required services running (Ollama, ChromaDB)
3. Try clearing profile and re-entering
4. Check disk space (.data directory needs write access)

---

### Profile Cleared Accidentally

**Symptoms:** Profile gone, can't recover

**Fix:**
- No automated backup exists (by design, for privacy)
- **Best practice:** Keep a copy in a local text file for easy restoration
- Recreate from memory or notes

---

## FAQ

### Q: Can I have multiple profiles?

**A:** Not currently. Phase 2 supports a single user profile. You can manually swap profiles by:
1. Copy current profile to a text file
2. Clear profile
3. Create new profile
4. Swap back when needed

**Future:** Phase 5 may add profile management (TBD).

---

### Q: Does the AI always use my profile?

**A:** Only when **🧠 Memory** consent is ON. Toggle provides instant control.

---

### Q: How often should I update my profile?

**A:** Update when:
- You adopt a new framework/language
- Your coding style evolves
- You switch projects with different requirements
- AI responses don't match your preferences

**Recommendation:** Review monthly, update as needed.

---

### Q: Can the AI modify my profile?

**A:** No. The AI can only READ your profile during retrieval. Only YOU can modify via the UI.

---

### Q: What happens if I forget to save?

**A:** Changes only take effect after clicking **💾 Save**. If you close profile section without saving, edits are lost. There's no auto-save.

---

### Q: Can I export my profile?

**A:** Not built-in currently. Workarounds:
1. Copy/paste text from each field to external file
2. Query database directly: `sqlite3 .data/hackerreign.db "SELECT profile FROM user_profile;"`

---

### Q: Is my profile sent to the cloud?

**A:** No. Everything runs locally:
- Profile stored in local SQLite
- Embeddings in local ChromaDB
- Ollama runs on your machine
- Zero cloud API calls

---

## Best Practices Summary

✅ **DO:**
- Be specific and concise
- Focus on preferences that affect code generation
- Update as your stack evolves
- Test profile by asking AI about your preferences
- Keep a backup copy in a text file

❌ **DON'T:**
- Include personal identifying information
- List every tool you've ever used
- Write a novel (keep it under 500 chars)
- Forget to click Save after editing
- Leave outdated preferences

---

## Related Documentation

- **[CONTEXT.md](CONTEXT.md)** - Technical specification of memory system
- **[TOOLBAR.md](TOOLBAR.md)** - LeftToolbar user guide (all features)
- **[IMPLEMENT_CONTEXT.md](IMPLEMENT_CONTEXT.md)** - Implementation roadmap (technical)
- **[PHASE1_COMPLETE.md](PHASE1_COMPLETE.md)** - Phase 1 completion report

---

## Support & Feedback

**Found a bug?** Check console (F12) for errors and report with details.

**Feature request?** Profile management is evolving. Future phases may add:
- Multiple profiles (per-project)
- Profile templates
- Import/export functionality
- Profile versioning

**Privacy concerns?** All data is local. No telemetry, no cloud sync. You have full control.

---

**Last Updated:** 2026-01-20
**Phase:** 2 (Summaries + Profile)
**Status:** Production-ready ✅
