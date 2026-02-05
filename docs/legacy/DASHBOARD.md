# 📊 Learning Dashboard Guide

## Overview

The **Learning Dashboard** is your window into how Hacker Reign learns and evolves based on your feedback. Every thumbs up 👍 or thumbs down 👎 you give shapes the system's behavior, and the dashboard shows you exactly what's working and what's not.

## Accessing the Dashboard

**Click the "🐺 Hacker Reign" logo** in the top-left corner of the main chat page to access the Learning Dashboard at any time.

Alternatively, navigate directly to: `http://localhost:3000/analytics`

---

## Dashboard Tabs

The dashboard has **4 main tabs**, each showing different aspects of the learning system:

### 1. 📚 **Theme Patterns**

Shows how the system recognizes conversation themes and adapts to them.

**What You See:**
- **Theme Name**: Detected conversation types (e.g., "code review", "debugging", "architecture")
- **Occurrences**: How many times this theme appeared
- **Best Model**: Which AI model performs best for this theme
- **Avg Quality**: Quality score (0-100%) based on user feedback

**How It Learns:**
- Analyzes your questions to detect patterns
- Tracks which models get positive feedback for each theme
- Automatically selects the best-performing model for recognized themes

**Example:**
```
debugging
42 occurrences • Best model: Qwen 2.5
Quality: 87%
```
This means: "For debugging questions, Qwen 2.5 works best with 87% satisfaction"

---

### 2. ⚙️ **Parameter Tuning**

Shows how the system optimizes AI parameters (temperature, token limits) for different themes.

**What You See:**
- **Theme**: The conversation type
- **Optimal Temperature**: Best creativity setting (0.0-1.0)
  - Lower = More focused/deterministic
  - Higher = More creative/varied
- **Avg Quality**: How well this configuration performs
- **Sample Size**: Number of interactions used for tuning

**How It Learns:**
- Runs experiments with different temperature settings
- Tracks which settings get positive feedback
- Converges on optimal parameters for each theme

**Example:**
```
code-review
Optimal Temperature: 0.42
Avg Quality: 91%
15 samples
```
This means: "For code reviews, temperature 0.42 produces the best results"

---

### 3. 🎯 **Quality Prediction**

Shows per-model performance across all uses.

**What You See:**
- **Model Name**: The AI model (Llama 3.2, Qwen 2.5, etc.)
- **Avg Quality**: Overall quality score (0-100%)
- **Success Rate**: Percentage of successful responses
- **Sample Count**: Number of predictions made
- **Quality Bar**: Visual representation of performance

**How It Learns:**
- Tracks every model's performance
- Predicts which model will work best for future tasks
- Helps strategies make informed model selection

**Example:**
```
DeepSeek 16B
Avg Quality: 94%
Success Rate: 96%
127 predictions
```
This means: "DeepSeek 16B is highly reliable with 94% user satisfaction"

---

### 4. 🚀 **Strategy Performance** ⭐ MOST IMPORTANT

This is where you see **how each strategy learns from your feedback**.

**What You See Per Strategy:**

#### **Core Metrics (Top Row)**
- **Quality %**: Technical quality of responses (0-100%)
- **Success %**: How often the strategy succeeds without errors
- **Satisfaction %**: User happiness based on 👍/👎 votes

#### **User Feedback Section** (Shown when feedback exists)
Three columns showing:
- **👍 Helpful**: Count of positive votes (green)
- **👎 Not Helpful**: Count of negative votes (red)
- **No Feedback**: Responses without votes (gray)

#### **Satisfaction Trend Chart** (Last 10 Responses)
Visual mini-chart showing feedback over time:
- **Green bars**: Positive feedback (👍)
- **Red bars**: Negative feedback (👎)
- **Gray bars**: Neutral/no feedback
- **Left side**: Older responses
- **Right side**: Recent responses

**How to Read the Trend:**
- Mostly green? Strategy is working well!
- Mostly red? Strategy needs to adapt
- Green → Red: Strategy is degrading
- Red → Green: Strategy is learning and improving!

---

## Strategy-by-Strategy Learning

### 🚀 **Speed Strategy**
**Goal:** Fastest responses possible

**What It Learns:**
- Is speed enough, or do users need better quality?
- When should it upgrade from 3B to 7B model?

**How It Adapts:**
- If satisfaction < 60% after 5+ interactions
  - Upgrades to Qwen 7B for complex tasks (score > 60)
  - Increases token limit from 3000 → 5000
- Shows adaptation status in reasoning text

**Example Reasoning:**
```
Speed-first strategy. Using qwen2.5-coder:7b (adapted from
feedback - users need more power) with minimal tokens.
Satisfaction: 45%
```

**Dashboard Impact:**
You'll see satisfaction trend improve as it adapts!

---

### 💎 **Quality Strategy**
**Goal:** Highest quality responses, always uses best model

**What It Learns:**
- Is the output too creative or too focused?
- What temperature produces best results?

**How It Adapts:**
- If satisfaction < 70% after 5+ interactions:
  - Lowers temperature to 0.4 (more focused)
- If satisfaction > 85%:
  - Keeps temperature at 0.6 (creative)
- Default: 0.5 (balanced)

**Example Reasoning:**
```
Quality-first strategy. Using best model (deepseek-v2:16b)
with full capabilities. Temperature tuned to 0.4 based on
12 interactions (satisfaction: 65%)
```

**Dashboard Impact:**
Watch quality % improve as temperature gets tuned!

---

### ⚖️ **Complexity Strategy** (Balanced)
**Goal:** Match model size to task complexity

**What It Learns:**
- Are complexity thresholds accurate?
- Should it use bigger models sooner?

**How It Adapts:**
- If satisfaction < 60% after 5+ interactions:
  - Lowers simple threshold: 30 → 20
  - Lowers complex threshold: 70 → 60
  - Result: Uses better models earlier

**Standard Thresholds:**
- Score < 30: Llama 3B (fast)
- Score 30-70: Qwen 7B (balanced)
- Score > 70: DeepSeek 16B (expert)

**Adapted Thresholds (when learning):**
- Score < 20: Llama 3B (fast)
- Score 20-60: Qwen 7B (balanced)
- Score > 60: DeepSeek 16B (expert)

**Example Reasoning:**
```
Moderate complexity (score: 45). Using balanced coder model.
[Learning: 8 decisions, 52% satisfaction, thresholds: 20/60]
```

**Dashboard Impact:**
Satisfaction improves as thresholds adjust!

---

### 💰 **Cost Strategy**
**Goal:** Minimize resource usage while maintaining quality

**What It Learns:**
- Is the cost/quality trade-off acceptable?
- When should it allow bigger models?

**How It Adapts:**
- If satisfaction < 65% after 5+ interactions:
  - Allows 7B → 16B upgrade for very complex tasks (score > 80)
  - Increases token limits by 1000-4000
- Tries to stay efficient but prioritizes satisfaction

**Example Reasoning:**
```
Cost-optimized. Selected deepseek-v2:16b (complexity: 85).
[Adapted: satisfaction 48% - allowing more resources]
```

**Dashboard Impact:**
Watch satisfaction rise as cost strategy becomes more generous!

---

### 🧠 **Adaptive Strategy**
**Goal:** ML-driven optimization using all learning systems

**What It Learns:**
- Theme patterns (what type of question is this?)
- Parameter tuning (best temperature/tokens)
- Quality predictions (which model works best?)
- Historical performance (what worked before?)

**How It Adapts:**
- Uses pattern recognition to detect themes
- Applies learned parameters for that theme
- Selects model based on quality predictions
- Continuously refines all decisions

**Example Reasoning:**
```
Adaptive strategy with ML. Detected theme: code-review
(confidence: 0.89). Using deepseek-v2:16b based on pattern:
code-review works best with this model (0.92 quality from
15 samples).
```

**Dashboard Impact:**
Most sophisticated learner - all tabs feed into its decisions!

---

### 🔄 **Workflow Strategy**
**Goal:** Multi-model collaboration (chains & ensembles)

**What It Learns:**
- Should it use model chains or ensemble voting?
- Which models work best together?
- Are workflows worth the extra cost?

**How It Adapts:**
- Tracks chain success rates
- Monitors ensemble consensus quality
- Adjusts workflow configs based on feedback

**Example Reasoning:**
```
Workflow strategy: ensemble voting with 3 models.
Consensus: 0.87 confidence. Models: [llama3.2, qwen2.5,
deepseek-v2].
```

**Dashboard Impact:**
Shows whether multi-model approaches beat single models!

---

## Complete Feedback Loop

### How Your Votes Create Learning

```
1. You ask a question
   ↓
2. Strategy checks past performance in database
   ↓
3. Strategy adapts behavior based on satisfaction
   ↓
4. AI generates response with adapted settings
   ↓
5. You vote 👍 Helpful or 👎 Not Helpful
   ↓
6. Vote stored in strategy_outcomes table
   - quality_score = 0.95 (positive) or 0.3 (negative)
   - user_feedback = 'positive' or 'negative'
   ↓
7. updateFromFeedback() called on strategy
   ↓
8. 4 learning systems updated:
   - Strategy analytics (satisfaction %)
   - Pattern recognition (theme detection)
   - Parameter tuning (temperature/tokens)
   - Quality prediction (model performance)
   ↓
9. Dashboard refreshes with new data
   ↓
10. Next interaction: Process repeats with learned knowledge
```

**Key Point:** Every vote makes the system smarter! After just 5-10 votes per strategy, you'll see meaningful adaptations.

---

## Reading the Dashboard

### **Good Signs** ✅
- **Satisfaction trending upward** (red → gray → green)
- **More 👍 than 👎** in feedback breakdown
- **Quality % above 80%**
- **Success rate above 90%**

### **Warning Signs** ⚠️
- **Satisfaction trending downward** (green → gray → red)
- **More 👎 than 👍** in feedback breakdown
- **Quality % below 60%**
- **Many responses with "No Feedback"** (vote more!)

### **Learning in Progress** 🔄
- **Satisfaction oscillating** (strategy is experimenting)
- **Recent bars different from older bars** (adaptation happening)
- **Reasoning shows "adapted from feedback"** (strategy learned!)

---

## Dashboard Scenarios

### **Scenario 1: Speed Strategy Adapting**

**Initial State:**
```
Speed Strategy
Satisfaction: 45%
Feedback: 1 👍, 7 👎, 2 neutral
Trend: [Red, Red, Red, Red, Red, Gray, Red, Red]
```

**What's Happening:**
- Users are unhappy with speed-quality trade-off
- Strategy detects satisfaction < 60%
- Triggers adaptation: upgrade to 7B for complex tasks

**After 5 More Interactions:**
```
Speed Strategy
Satisfaction: 73%
Feedback: 6 👍, 3 👎, 6 neutral
Trend: [Red, Red, Gray, Green, Green, Green, Gray, Green]
```

**Result:** Strategy learned and improved! ✅

---

### **Scenario 2: Quality Strategy Tuning**

**Initial State:**
```
Quality Strategy
Satisfaction: 62%
Feedback: 5 👍, 3 👎, 4 neutral
Temperature: 0.6 (creative)
```

**What's Happening:**
- Satisfaction < 70%
- Responses may be too verbose/creative
- Strategy adapts: lowers temperature to 0.4

**After Tuning:**
```
Quality Strategy
Satisfaction: 88%
Feedback: 12 👍, 2 👎, 2 neutral
Temperature: 0.4 (focused)
```

**Result:** More focused responses = happier users! ✅

---

### **Scenario 3: Complexity Strategy Threshold Shift**

**Initial State:**
```
Complexity Strategy (Balanced)
Satisfaction: 55%
Thresholds: 30/70 (standard)
Many simple tasks getting underpowered models
```

**What's Happening:**
- Satisfaction < 60%
- Strategy adapts: lowers thresholds to 20/60
- Now uses better models earlier

**After Threshold Adjustment:**
```
Complexity Strategy (Balanced)
Satisfaction: 82%
Thresholds: 20/60 (adapted)
Tasks get appropriate model power
```

**Result:** Better model matching = better results! ✅

---

## Tips for Effective Learning

### 1. **Vote Consistently**
- Vote on EVERY response (or most of them)
- Honest feedback = better learning
- "No Feedback" responses don't teach the system

### 2. **Give Strategies Time**
- Need 5-10 votes before adaptation kicks in
- Early votes have highest impact
- Watch satisfaction trend, not single votes

### 3. **Use the Dashboard**
- Check after every 5-10 interactions
- Click "🔄 Refresh Data" button to update
- Compare strategies to find your favorite

### 4. **Experiment with Strategies**
- Try all 6 strategies with similar tasks
- See which one adapts best to your needs
- Dashboard shows objective performance data

### 5. **Understand the Trade-offs**
- Speed Strategy: Fast but may lack depth
- Quality Strategy: Thorough but uses more resources
- Complexity Strategy: Balanced, adapts to task
- Cost Strategy: Efficient, allows upgrades when needed
- Adaptive Strategy: Most sophisticated, uses all learning
- Workflow Strategy: Multi-model, highest quality potential

---

## Database Schema

### Where Your Votes Live

**strategy_decisions table:**
```sql
- id (decision ID)
- strategy_name ('speed', 'quality', etc.)
- selected_model (which AI was used)
- reasoning (why this decision?)
- confidence (0-1)
- complexity_score (0-100)
- created_at (timestamp)
```

**strategy_outcomes table:**
```sql
- id (outcome ID)
- decision_id (links to decision) -- FOREIGN KEY to strategy_decisions
- response_quality (0.3=bad, 0.95=good)
- response_time_ms (milliseconds)
- tokens_used (how many tokens)
- error_occurred (boolean)
- user_feedback ('positive', 'negative', 'neutral')
- created_at (timestamp)
```

**mode_interactions table:**
```sql
- id (interaction ID) -- Unique: mode_1234...
- mode ('auto', 'learning', 'code-review', 'expert')
- model_used (which AI was used)
- response_quality (0.3=bad, 0.95=good)
- response_time_ms (milliseconds)
- tokens_used (how many tokens)
- user_feedback ('positive', 'negative', 'neutral')
- created_at (timestamp)
```

**Key Design Decision:**
- **Strategy votes** go to `strategy_analytics.db` with `decision_` prefix IDs
- **Mode votes** go to `mode_analytics.db` with `mode_` prefix IDs
- Both systems are **independent** - no foreign key relationships between them
- This prevents conflicts when voting without Strategy enabled

**Query for Satisfaction:**
```sql
AVG(CASE
  WHEN user_feedback = 'positive' THEN 1
  WHEN user_feedback = 'negative' THEN 0
  ELSE 0.5
END) as satisfaction
```

This converts:
- 👍 Positive → 1.0 (100%)
- 👎 Negative → 0.0 (0%)
- No vote → 0.5 (50%)

Then averages them for overall satisfaction percentage.

---

## Technical Implementation

### Strategy Learning Flow

Each strategy has an `updateFromFeedback()` method:

```typescript
async updateFromFeedback(
  decisionId: string,
  feedback: 'positive' | 'negative' | 'neutral',
  qualityScore?: number
): Promise<void> {
  // 1. Calculate quality score from feedback
  const quality = feedback === 'positive' ? 0.9
                : feedback === 'negative' ? 0.4
                : 0.7;

  // 2. Log to database
  await this.analytics.logOutcome(decisionId, {
    responseQuality: quality,
    userFeedback: feedback,
    errorOccurred: feedback === 'negative',
    // ... other metrics
  });

  // 3. Console log for debugging
  console.log(`[Strategy] Feedback: ${feedback}`);
}
```

### Strategy Decision Flow

Each strategy's `decide()` method:

```typescript
async decide(context: StrategyContext): Promise<StrategyDecision> {
  // 1. Check past performance
  const perf = await this.analytics.getStrategyPerformance('speed');

  // 2. Decide if adaptation needed
  const needsAdaptation = perf.userSatisfaction < 0.6
                       && perf.totalDecisions > 5;

  // 3. Adapt behavior
  const model = needsAdaptation
    ? this.selectModelBySize('7B')
    : this.selectModelBySize('3B');

  // 4. Return decision with reasoning
  return {
    selectedModel: model,
    reasoning: `Satisfaction: ${perf.userSatisfaction}.
                ${needsAdaptation ? 'Adapted!' : 'Standard.'}`,
    // ... other parameters
  };
}
```

### Analytics Tracker

Provides aggregated metrics:

```typescript
async getStrategyPerformance(name: string): Promise<Metrics> {
  // Query database for aggregated stats
  return {
    totalDecisions: 42,
    averageQuality: 0.87,
    userSatisfaction: 0.85,  // ← Your votes!
    successRate: 0.94,
    // ...
  };
}

async getFeedbackBreakdown(name: string): Promise<Breakdown> {
  // Count positive/negative/neutral votes
  // Get last 10 for trend chart
  return {
    positive: 25,
    negative: 8,
    neutral: 9,
    satisfactionTrend: [0.5, 0.5, 1.0, 1.0, 0.5, ...],
  };
}
```

---

## FAQ

### Q: How many votes before I see changes?
**A:** Strategies start adapting after 5 votes, but need 10+ for stable behavior. The more you vote, the smarter the system gets!

### Q: Does manual model selection learn?
**A:** No. When you manually select a model (Strategy toggle OFF), votes are stored but don't influence next selection. Enable a strategy to get learning!

### Q: Can I reset the learning data?
**A:** Delete `data/strategy_analytics.db` to wipe all learning data and start fresh. (Note: This removes ALL history)

### Q: Which strategy is best?
**A:** Depends on your needs! Use dashboard to compare:
- **Most votes?** Look at feedback counts
- **Highest satisfaction?** Check satisfaction %
- **Most reliable?** Look at success rate
- **Best trend?** Check the mini-chart

### Q: Why does satisfaction fluctuate?
**A:** Early stages show experimentation. After 20+ votes, it stabilizes as the strategy learns your preferences.

### Q: What if satisfaction stays low?
**A:** Try a different strategy! Each has different strengths:
- Complexity → Best all-rounder
- Adaptive → Most sophisticated learning
- Quality → Best when you need thoroughness
- Speed → Best for quick tasks
- Cost → Best for efficiency
- Workflow → Best for critical tasks (uses multiple models)

### Q: How often should I check the dashboard?
**A:** After every 5-10 interactions, or whenever you're curious about performance. Click "🐺 Hacker Reign" logo to access instantly!

### Q: I got a "FOREIGN KEY constraint failed" error when voting?
**A:** This was a bug that's now fixed! The error occurred when voting in Auto mode without Strategy enabled. The system tried to insert into `strategy_outcomes` table with a `decisionId` that didn't exist in `strategy_decisions` table.

**The Fix:**
- Mode interactions now get separate IDs (`mode_...`) stored in `mode_analytics.db`
- Strategy decisions get IDs (`decision_...`) stored in `strategy_analytics.db`
- Feedback API checks the ID prefix to route votes correctly
- No more foreign key conflicts!

---

## Voting Flow Architecture

### How Votes Route to the Right Database

```typescript
// In app/api/feedback/route.ts

// Check if this is a strategy decision or mode interaction
const hasValidDecisionId = decisionId &&
                            decisionId !== 'undefined' &&
                            decisionId !== 'null' &&
                            decisionId.startsWith('decision_'); // Strategy prefix

if (hasValidDecisionId) {
  // Route to strategy_analytics.db
  await strategyManager.logOutcome(decisionId, {
    responseQuality: qualityScore,
    userFeedback: feedback,
    // ... other metrics
  });
} else {
  // This is a mode interaction (or no tracking)
  console.log(`No strategy decision - mode ${mode} without strategy`);
}

// Mode votes always go to mode_analytics.db (separate)
if (mode) {
  await modeAnalytics.updateFeedback(decisionId, feedback);
}
```

### ID Prefixes

| Type | ID Format | Example | Database |
|------|-----------|---------|----------|
| Strategy Decision | `decision_{timestamp}_{random}` | `decision_1768481491978_abc123` | `strategy_analytics.db` |
| Mode Interaction | `mode_{timestamp}_{random}` | `mode_1768481491978_xyz789` | `mode_analytics.db` |

### Why This Matters

**Before the fix:**
```
User votes in Auto mode (no strategy)
  ↓
decisionId = undefined
  ↓
Feedback API tries to insert into strategy_outcomes
  ↓
❌ FOREIGN KEY constraint failed (undefined not in strategy_decisions)
```

**After the fix:**
```
User votes in Auto mode (no strategy)
  ↓
decisionId = mode_1768481491978_xyz789
  ↓
Feedback API checks: !decisionId.startsWith('decision_')
  ↓
Skips strategy logging, updates mode_analytics.db
  ↓
✅ Vote recorded successfully!
```

---

## Summary

The Learning Dashboard transforms your feedback into system intelligence. Every 👍 and 👎 you give:

✅ Shapes strategy behavior
✅ Improves model selection
✅ Tunes parameters (temperature, tokens)
✅ Recognizes patterns in your questions
✅ Predicts future quality
✅ Appears in real-time on the dashboard

**Your votes matter.** The system learns from YOU and adapts to YOUR preferences. The dashboard shows you exactly how well it's working.

**Click "🐺 Hacker Reign" in the top-left corner to access your Learning Dashboard now!**

---

## Related Documentation

- [INFO_FLOW.md](./INFO_FLOW.md) - System architecture and data flow
- [OUTLINE.md](./OUTLINE.md) - Project structure and goals
- [STRUCTURE.md](./STRUCTURE.md) - Codebase organization
- [README.md](./README.md) - Getting started guide

---

**Built with ❤️ by the feedback you provide. Every vote makes Hacker Reign smarter!**
