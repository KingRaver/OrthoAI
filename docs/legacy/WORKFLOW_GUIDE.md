# HackerReign Workflow System User Guide

## Overview

The **Workflow System** is HackerReign's advanced multi-model orchestration feature that coordinates multiple AI models to deliver superior responses through two powerful approaches:

- **🔗 Chain**: Sequential refinement where each model improves upon the previous one
- **🗳️ Ensemble**: Parallel voting where multiple models reach consensus

This system integrates with the **Adaptive Learning** framework, learning from your thumbs up/down feedback to continuously improve decision-making.

**Status:** ✅ **Fully Integrated & Ready to Use**

---

## Table of Contents

- [Getting Started](#getting-started)
- [How It Works](#how-it-works)
- [Workflow Modes](#workflow-modes)
- [When to Use Each Mode](#when-to-use-each-mode)
- [Best Practices](#best-practices)
- [Performance & Resources](#performance--resources)
- [Feedback & Learning](#feedback--learning)
- [Real-World Examples](#real-world-examples)
- [Troubleshooting](#troubleshooting)
- [Advanced Tips](#advanced-tips)

---

## Getting Started

### Enabling Workflow Mode

1. **Enable Strategy System**
   - Toggle "⚡ Strategy" in the top navigation bar
   - This activates intelligent model selection

2. **Select Workflow**
   - From the strategy dropdown, choose "🔗 Workflow"
   - A second dropdown appears for workflow mode selection

3. **Choose Your Mode**
   - **🎯 Auto**: System intelligently selects Chain or Ensemble
   - **⛓️ Chain (3B→7B→16B)**: Sequential refinement
   - **🗳️ Ensemble (Voting)**: Parallel consensus

4. **Ask Your Question**
   - Submit your request as normal
   - The system automatically orchestrates multiple models

5. **Provide Feedback**
   - Thumbs up 👍 for helpful responses
   - Thumbs down 👎 for poor responses
   - Your feedback trains the AI to make better decisions

---

## How It Works

### System Architecture

```
Your Question
      ↓
Strategy Analysis
  • Detects theme (security, architecture, code-gen)
  • Calculates complexity (0-100)
  • Checks system resources
      ↓
Workflow Selection
  • Auto: Smart mode selection
  • Chain: 3B → 7B → 16B
  • Ensemble: Parallel voting
      ↓
Multi-Model Execution
      ↓
Unified Response
      ↓
Your Feedback (👍/👎)
      ↓
Continuous Learning
```

### Intelligent Decision Making

The system considers multiple factors:

1. **Complexity Score**: Analyzes your question's difficulty (0-100)
2. **Theme Detection**: Identifies the domain (security, architecture, code-gen, etc.)
3. **System Resources**: Checks available RAM and CPU
4. **Historical Performance**: Learns from past successes and feedback
5. **Parameter Tuning**: Optimizes temperature, tokens, and tool usage

---

## Workflow Modes

### 🎯 Auto Mode (Recommended)

**What It Does:**
- Intelligently chooses between Chain and Ensemble
- Adapts based on your question's characteristics
- Optimizes for quality vs. speed trade-offs

**When It Chooses Chain:**
- Complex code generation tasks
- Documentation requiring multiple perspectives
- Questions with complexity score > 70
- Adequate RAM available (8GB+)

**When It Chooses Ensemble:**
- Security-critical code reviews
- Architecture decisions needing consensus
- Bug detection where confidence matters
- RAM available (12GB+)

**Best For:**
- General use when you're unsure
- Letting AI optimize the approach
- Tasks with unclear requirements

---

### ⛓️ Chain Mode (Sequential Refinement)

**What It Does:**
```
Draft (3B Fast Model)
  ↓ Passes context
Refine (7B Balanced Model)
  ↓ Passes improved version
Review (16B Expert Model)
  ↓ Final polish
Quality Output
```

**How It Works:**
1. **Draft Phase**: 3B model creates initial working version
   - Fast response (~3 seconds)
   - Focuses on core functionality
   - Ignores edge cases for speed

2. **Refine Phase**: 7B model improves the draft
   - Adds error handling
   - Optimizes logic
   - Handles common cases

3. **Review Phase**: 16B model performs expert analysis
   - Security audit
   - Edge case handling
   - Production-ready polish

**Resource Usage:**
- **Time**: 3-4x slower than single model (~20-30 seconds)
- **RAM**: Same as single model (sequential execution)
- **Tokens**: 3-5x more (multiple passes)
- **Quality**: Significantly higher output

**Adaptive Behavior:**
- Skips refinement step if draft quality > 90%
- Reduces to 2 steps for moderate complexity (40-70)
- Full 3 steps for high complexity (70+)

---

### 🗳️ Ensemble Mode (Parallel Voting)

**What It Does:**
```
        ┌─► 7B Model (Weight: 0.5)
Request ├─► 16B Model (Weight: 0.8) ─► Consensus Vote ─► Response
        └─► 3B Model (Weight: 0.3)
```

**How It Works:**
1. **Parallel Execution**: All models analyze simultaneously
   - 7B: Balanced perspective
   - 16B: Expert opinion (highest weight)
   - 3B: Fast analysis

2. **Weighted Voting**: Responses combined based on model expertise
   - Expert models have higher influence
   - Confidence scores calculated
   - Agreement percentage measured

3. **Consensus Building**: Final response represents collective wisdom
   - High confidence: All models agree
   - Medium confidence: Majority agrees
   - Low confidence: Models disagree (uses highest quality response)

**Voting Strategies:**
- **Weighted** (Default): Models weighted by expertise
  - 16B model: 0.8 weight (expert)
  - 7B model: 0.5 weight (balanced)
  - 3B model: 0.3 weight (fast)

- **Consensus**: Requires 70%+ agreement
  - High confidence threshold
  - Best for critical decisions

**Resource Usage:**
- **Time**: Similar to single model (~10-15 seconds, parallel)
- **RAM**: 3x more (all models loaded simultaneously)
- **Tokens**: 3x more (parallel redundancy)
- **Quality**: Multiple perspectives, high confidence

**Adaptive Behavior:**
- Removes 16B model if RAM < 16GB (uses 7B + 3B)
- Falls back to Chain if RAM < 12GB
- Increases consensus threshold for security themes

---

## When to Use Each Mode

### Use Chain Mode For:

✅ **Complex Code Generation**
- Implementing new features
- Refactoring large codebases
- Writing algorithms with edge cases
- Multi-file changes

✅ **Documentation**
- Technical writing requiring clarity + accuracy
- API documentation
- Architecture decision records

✅ **Architecture Design**
- System design proposals
- Database schema design
- Integration patterns

✅ **Learning & Exploration**
- Understanding complex topics
- Exploring multiple approaches
- Educational explanations

❌ **Avoid Chain For:**
- Simple questions (wasteful)
- Time-sensitive requests (too slow)
- Quick lookups or definitions

---

### Use Ensemble Mode For:

✅ **Security Reviews**
- Code security audits
- Vulnerability detection
- Penetration testing analysis
- Authentication/authorization reviews

✅ **Critical Decisions**
- Production deployment strategies
- Breaking changes
- High-stakes bug fixes
- Performance optimization trade-offs

✅ **Bug Detection**
- Finding race conditions
- Identifying memory leaks
- Logic error detection
- False negative prevention

✅ **Architecture Evaluation**
- Design pattern selection
- Technology stack choices
- Scalability assessments

❌ **Avoid Ensemble For:**
- Systems with < 12GB free RAM (will auto-fallback)
- Routine queries (wasteful)
- Non-critical decisions

---

### Use Auto Mode For:

✅ **General Purpose**
- When unsure which mode to use
- Mixed complexity questions
- Exploring new topics
- Learning the system

✅ **Adaptive Learning**
- Let AI learn your preferences
- Optimize based on feedback
- Improve over time

---

## Best Practices

### 1. Provide Clear Context

**Good:**
```
Refactor this authentication system to use JWT instead of sessions.
Handle token refresh, expiration, and secure storage.
Consider security best practices and edge cases.
```

**Bad:**
```
Fix auth
```

**Why It Matters:**
- Clear context helps all models understand intent
- Specific requirements guide refinement steps
- Better context = higher quality output

---

### 2. Use Feedback Consistently

After each response, provide feedback:

**Thumbs Up 👍 When:**
- Response solved your problem completely
- Code works correctly and handles edge cases
- Explanation was clear and helpful
- Security considerations were addressed

**Thumbs Down 👎 When:**
- Response missed key requirements
- Code has bugs or doesn't compile
- Explanation was confusing or incorrect
- Security issues were overlooked

**Why It Matters:**
- System learns your quality standards
- Improves future workflow selection
- Tunes parameters (temperature, tokens, tools)
- Builds pattern recognition for themes

---

### 3. Match Complexity to Workflow

| Task Complexity | Recommended Mode | Expected Time |
|----------------|------------------|---------------|
| Simple (0-30) | Single model (disable workflow) | ~3 seconds |
| Moderate (30-70) | Chain (2 steps) or Auto | ~15 seconds |
| High (70-90) | Chain (3 steps) | ~25 seconds |
| Critical (90+) | Ensemble or Auto | ~15 seconds |

**Pro Tip:** Use Auto mode and let the system learn your preferences over time.

---

### 4. Monitor System Resources

**Before Using Ensemble:**
- Check available RAM (Activity Monitor / Task Manager)
- Need 12GB+ free for full ensemble (3 models)
- System auto-downgrades if insufficient RAM

**Before Using Chain:**
- Check CPU usage (< 75% recommended)
- Workflows disabled during high CPU load
- Sequential execution is less resource-intensive

**Resource-Aware Tips:**
- System automatically adapts to available resources
- Low RAM? Chain mode auto-reduces to 2 steps
- Very low RAM? Falls back to single model
- You can disable RAM constraints: `DISABLE_RAM_CONSTRAINTS=true`

---

### 5. Iterate with Feedback

**Workflow Learning Cycle:**
```
1. Use Workflow (Chain or Ensemble)
2. Review Response Quality
3. Provide Feedback (👍/👎)
4. System Learns Preferences
5. Next Time: Better Mode Selection
```

**What Gets Learned:**
- Theme patterns (security → ensemble, code-gen → chain)
- Parameter tuning (optimal temperature, tokens, tools)
- Quality prediction (expected outcome quality)
- Model preferences (which models work best for what)

---

## Performance & Resources

### Chain Workflow

| Metric | Impact | Notes |
|--------|--------|-------|
| Time | 3-4x slower | ~20-30 seconds total |
| RAM | Same as single | Sequential execution |
| Tokens | 3-5x more | Multiple model passes |
| CPU | Moderate | One model at a time |
| Quality | ⭐⭐⭐⭐⭐ | Significantly higher |

**Optimization:**
- Skips steps dynamically if quality high
- Reduces tokens for lower complexity
- Adjusts temperature per step

---

### Ensemble Workflow

| Metric | Impact | Notes |
|--------|--------|-------|
| Time | Similar | ~10-15 seconds (parallel) |
| RAM | 3x more | All models loaded |
| Tokens | 3x more | Parallel redundancy |
| CPU | High | Multiple models simultaneously |
| Quality | ⭐⭐⭐⭐⭐ | Multiple perspectives |

**Optimization:**
- Removes models if RAM constrained
- Falls back to chain if RAM < 12GB
- Adjusts consensus threshold

---

### Cost-Benefit Analysis

**Chain Workflow:**
- **Cost**: Time (3-4x), Tokens (3-5x)
- **Benefit**: Progressive refinement, expert polish
- **ROI**: High for complex tasks, low for simple queries

**Ensemble Workflow:**
- **Cost**: RAM (3x), Tokens (3x)
- **Benefit**: Confidence, multiple perspectives
- **ROI**: High for critical decisions, low for routine queries

**Single Model (No Workflow):**
- **Cost**: Baseline (1x everything)
- **Benefit**: Fast, efficient
- **ROI**: Best for simple tasks

---

## Feedback & Learning

### How Feedback Works

**Your Action → System Response**

1. **Thumbs Up 👍**
   ```
   Records:
   • Theme pattern successful
   • Parameter settings optimal
   • Model selection correct
   • Quality score: 0.95

   Improves:
   • Similar future requests
   • Theme detection confidence
   • Parameter recommendations
   ```

2. **Thumbs Down 👎**
   ```
   Records:
   • Theme pattern unsuccessful
   • Parameter settings suboptimal
   • Model selection incorrect
   • Quality score: 0.30

   Adjusts:
   • Future mode selection
   • Parameter tuning
   • Workflow configuration
   ```

---

### Learning Systems Integration

Your feedback trains three ML systems:

**1. Pattern Recognition**
- Learns theme associations (security → ensemble)
- Builds model preferences by theme
- Improves confidence scores

**2. Parameter Tuner**
- Optimizes temperature (creativity vs. precision)
- Tunes max tokens (output length)
- Enables/disables tools dynamically

**3. Quality Predictor**
- Predicts expected outcome quality
- Suggests workflow type
- Confidence scoring

---

### Feedback Best Practices

**Be Consistent:**
- Use the same standards across sessions
- Don't give thumbs up to mediocre responses
- Don't give thumbs down to good-enough responses

**Be Specific in Your Mind:**
- Code quality: Does it work? Handle edge cases?
- Explanation quality: Clear? Complete? Accurate?
- Security: Are vulnerabilities addressed?

**Give Feedback Often:**
- Minimum 10-20 interactions for patterns to emerge
- More feedback = better learning
- System improves continuously

---

## Real-World Examples

### Example 1: Complex Feature Implementation (Chain)

**Scenario:** Implementing OAuth2 authentication from scratch

**Request:**
```
Implement OAuth2 authentication with Google provider.
Include token refresh, secure storage, and error handling.
Support both web and mobile redirect URIs.
```

**Mode:** Chain (3B → 7B → 16B)

**Execution:**
1. **Draft (3B, ~3s)**: Basic OAuth flow outline
   - Authorization URL generation
   - Token exchange endpoint
   - Simple token storage

2. **Refine (7B, ~8s)**: Production improvements
   - Token refresh logic
   - PKCE for mobile security
   - Error handling for failed auth

3. **Review (16B, ~15s)**: Expert polish
   - Security audit (CSRF, token leakage)
   - Edge cases (expired tokens, network errors)
   - Rate limiting and retry logic

**Result:** Production-ready OAuth2 implementation in ~26 seconds

**Feedback:** 👍 Thumbs Up
- Complete implementation
- Security best practices followed
- Edge cases handled

---

### Example 2: Security Vulnerability Detection (Ensemble)

**Scenario:** Review payment processing code for security issues

**Request:**
```
Review this Stripe payment processing code for:
- Race conditions
- SQL injection
- Authentication bypass
- PCI compliance issues
```

**Mode:** Ensemble (7B + 16B + 3B parallel)

**Execution:**
1. **Parallel Analysis (~12s)**:
   - **7B Model** (weight 0.5): Identifies SQL injection in order query
   - **16B Model** (weight 0.8): Finds race condition in payment status update
   - **3B Model** (weight 0.3): Notes missing input validation on amount

2. **Weighted Voting:**
   - Race condition: 0.8 (16B expert opinion, high priority)
   - SQL injection: 0.5 + 0.3 = 0.8 (7B + 3B agree, high priority)
   - Input validation: 0.3 + 0.5 = 0.8 (3B + 7B agree, high priority)

3. **Consensus Response:**
   ```
   CRITICAL ISSUES FOUND (3):

   1. Race Condition (Confidence: 95%)
      - Payment status update not atomic
      - Recommendation: Use database transactions

   2. SQL Injection Risk (Confidence: 90%)
      - Order query concatenates user input
      - Recommendation: Use parameterized queries

   3. Input Validation Missing (Confidence: 85%)
      - Payment amount not validated
      - Recommendation: Add server-side validation
   ```

**Result:** Comprehensive security analysis with high confidence in ~12 seconds

**Feedback:** 👍 Thumbs Up
- All critical issues identified
- Clear recommendations
- Multiple perspectives valuable

---

### Example 3: Intelligent Auto Selection

**Scenario:** Mixed complexity database schema design

**Request:**
```
Design a database schema for a multi-tenant SaaS application.
Support 10,000+ tenants with data isolation and shared infrastructure.
```

**Mode:** Auto (system chooses Chain)

**Why Chain Was Selected:**
- High complexity score: 82/100
- Theme: architecture design (benefits from progressive refinement)
- Available RAM: 16GB (sufficient for 3-step chain)
- Historical data: Architecture questions + positive feedback = Chain

**Execution:** 3-step Chain (3B → 7B → 16B)

**Result:** Comprehensive schema with tenant isolation, shared tables, and scaling considerations

**Feedback:** 👍 Thumbs Up
- System learns: architecture + high complexity = Chain mode

---

## Troubleshooting

### Issue: Workflow Not Executing

**Symptoms:**
- Selected Workflow strategy but getting single model response
- No workflow metadata in response

**Causes:**
- Strategy toggle not enabled
- Workflow mode not selected
- System resource constraints triggered fallback

**Solutions:**
1. Verify Strategy toggle is ON (⚡ should be highlighted)
2. Confirm Workflow is selected in dropdown
3. Check workflow mode is set (Auto/Chain/Ensemble)
4. Review console logs for resource warnings

---

### Issue: Slow Response Times

**Symptoms:**
- Chain workflows taking > 45 seconds
- System feels sluggish

**Causes:**
- High complexity triggering all 3 chain steps
- Low available RAM causing swapping
- High CPU usage (> 85%)

**Solutions:**
1. **Reduce Complexity:**
   - Break request into smaller chunks
   - Be more specific to reduce scope

2. **Free Resources:**
   - Close unused applications
   - Wait for CPU usage to drop

3. **Use Faster Modes:**
   - Try single model for simple tasks
   - Use Auto mode for optimization

4. **Disable Resource Constraints:**
   ```bash
   DISABLE_RAM_CONSTRAINTS=true
   ```

---

### Issue: RAM Warnings / Downgrades

**Symptoms:**
- Console shows "Insufficient RAM for ensemble"
- Ensemble automatically switches to Chain
- Chain reduces from 3 steps to 2

**Causes:**
- Available RAM < 12GB (Ensemble)
- Available RAM < 8GB (3-step Chain)
- Other applications consuming memory

**Solutions:**
1. **Check Available RAM:**
   - macOS: Activity Monitor → Memory tab
   - Windows: Task Manager → Performance → Memory
   - Linux: `free -h`

2. **Free Memory:**
   - Close browser tabs
   - Quit unused applications
   - Restart system if needed

3. **Use Appropriate Mode:**
   - Low RAM (< 8GB): Use single model
   - Medium RAM (8-12GB): Use Chain
   - High RAM (12GB+): Use Ensemble

4. **Override Constraints (Advanced):**
   ```bash
   DISABLE_RAM_CONSTRAINTS=true
   ```
   ⚠️ **Warning:** May cause system instability

---

### Issue: Low Quality Responses

**Symptoms:**
- Workflow response doesn't meet expectations
- Missing key requirements
- Incorrect or incomplete solutions

**Causes:**
- Unclear request
- Wrong workflow mode for task
- System hasn't learned your preferences yet

**Solutions:**
1. **Provide Better Context:**
   - Be specific about requirements
   - Include relevant code/context
   - Specify constraints and edge cases

2. **Use Appropriate Mode:**
   - Complex generation → Chain
   - Critical decisions → Ensemble
   - Unsure → Auto

3. **Give Feedback:**
   - 👎 Thumbs Down on poor responses
   - System learns and improves
   - Try again with clearer request

4. **Check Complexity:**
   - Simple tasks don't need workflows
   - Consider disabling workflow for quick queries

---

## Advanced Tips

### 1. Theme Detection Optimization

**Help the system understand your request:**

**Good:**
```
[SECURITY REVIEW] Audit this authentication middleware for vulnerabilities.
Check for: injection attacks, auth bypass, session fixation.
```

**Why It Works:**
- Clear theme identifier → triggers ensemble
- Specific requirements → optimizes parameters
- Critical context → increases confidence threshold

---

### 2. Complexity Scoring Insights

The system calculates complexity based on:

- **Code Analysis**: Lines, functions, classes, cyclomatic complexity
- **Content Analysis**: Technical keywords, sentence depth
- **Context Analysis**: Conversation depth, multi-domain requests

**Influence Complexity:**
- More specific = higher complexity = better workflow selection
- Simple questions = lower complexity = faster response
- Context-rich requests = more accurate mode selection

---

### 3. Custom Workflow Preferences

**Train the system for your use case:**

1. **Consistent Feedback:**
   - Always use workflows for architecture → System learns
   - Never use workflows for simple queries → System learns
   - Mixed feedback → System adapts to your patterns

2. **Pattern Building:**
   - Security questions + Ensemble + 👍 = Future security → Ensemble
   - Code generation + Chain + 👍 = Future code-gen → Chain

3. **Parameter Learning:**
   - High temperature + 👍 = Creative responses preferred
   - Low temperature + 👍 = Precise responses preferred

---

### 4. Performance Optimization

**Get the most out of workflows:**

1. **Pre-warm Models (Advanced):**
   ```bash
   # Load all models into memory
   ollama run llama3.2:3b-instruct-q5_K_M ""
   ollama run qwen2.5-coder:7b-instruct-q5_K_M ""
   ollama run deepseek-coder-v2:16b-instruct-q4_K_M ""
   ```

2. **Resource Monitoring:**
   - Keep Activity Monitor / Task Manager open
   - Watch RAM usage during workflows
   - Identify bottlenecks

3. **Strategic Mode Use:**
   - Morning: Use Ensemble (fresh system resources)
   - During work: Use Chain (balanced approach)
   - Low resources: Disable workflows

---

### 5. Experimentation

**Try different modes and learn:**

- Same question, different modes → Compare results
- Note which mode works best for your tasks
- Build intuition for mode selection
- Provide feedback to reinforce learning

---

## Summary

### Quick Decision Guide

**Should I use Workflow mode?**

```
Is the task complex or critical?
│
├─ YES ─→ Enable Strategy + Select Workflow
│         │
│         ├─ Security/Critical? ─→ Ensemble (or Auto)
│         ├─ Complex Generation? ─→ Chain (or Auto)
│         └─ Unsure? ─→ Auto
│
└─ NO ─→ Use single model (faster)
```

---

### Key Takeaways

1. **Workflow = Quality**: Multiple models produce better results
2. **Auto Mode**: Let AI choose for you (recommended)
3. **Feedback Matters**: 👍/👎 trains the system
4. **Resources**: Chain = time, Ensemble = RAM
5. **Learning Curve**: System improves with use (10-20 sessions)

---

### Support & Resources

**Documentation:**
- [Strategy System README](../app/lib/strategy/README.md) - Architecture overview
- [Adaptive Learning](../app/lib/learning/README.md) - ML system details
- [RAM Configuration](RAM.md) - Resource management

**Configuration Files:**
- [types.ts](../app/lib/strategy/types.ts) - Workflow type definitions
- [workflowStrategy.ts](../app/lib/strategy/implementations/workflowStrategy.ts) - Implementation
- [orchestrator.ts](../app/lib/strategy/orchestrator.ts) - Workflow coordinator

**Community:**
- GitHub Issues: Report bugs or suggest features
- Feedback: Use thumbs up/down in the app

---

**Last Updated:** January 12, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready

©2026 | Vivid Visions | HackerReign™
