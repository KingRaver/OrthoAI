# 🗳️ Mode Voting & Feedback System

## Overview

Voting (👍/👎) is now available for **ALL interactions** - not just when using strategies! You can vote on responses from:
- **Auto Mode** (no mode selected)
- **Learning Mode** 🎓 (patient educator)
- **Code Review Mode** 👁️ (critical analyzer)
- **Expert Mode** 🧠 (deep technical)

**AND:**
- **All 6 Strategy Modes** (Speed, Quality, Complexity, Cost, Adaptive, Workflow)

---

## What Changed?

### Before (Limited Voting)
- ❌ Voting buttons only showed when **Strategy was enabled**
- ❌ Manual modes (Learning/Code Review/Expert) had **no feedback loop**
- ❌ Auto mode had **no voting at all**
- ❌ No way to compare which mode works best for you

### After (Universal Voting)
- ✅ Voting buttons show for **ALL responses**
- ✅ Manual modes **track and learn** from your feedback
- ✅ Auto mode **collects satisfaction data**
- ✅ Dashboard has **new "Mode Performance" tab**
- ✅ **Compare modes** side-by-side to find your favorite

---

## How It Works

### 1. **Voting UI** (Always Available)

Every AI response now has voting buttons:
```
👍 Helpful    👎 Not Helpful
```

**When do they show?**
- ✅ Auto mode (Strategy OFF, no manual mode selected)
- ✅ Learning mode (Strategy OFF, Learning selected)
- ✅ Code Review mode (Strategy OFF, Code Review selected)
- ✅ Expert mode (Strategy OFF, Expert selected)
- ✅ All 6 strategies (Strategy ON, any strategy selected)

**Previously:** Only showed when Strategy was enabled.

---

### 2. **Mode Tracking System**

New database and analytics for modes:

**Database:** `data/mode_analytics.db`
```sql
CREATE TABLE mode_interactions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,           -- 'auto', 'learning', 'code-review', 'expert'
  model_used TEXT,
  response_quality REAL,        -- 0.3 (bad) to 0.95 (good)
  response_time_ms INTEGER,
  tokens_used INTEGER,
  user_feedback TEXT,           -- 'positive', 'negative', 'neutral'
  created_at TEXT NOT NULL
);
```

**What gets tracked:**
- Which mode was used
- Which model responded
- Response quality (based on your vote)
- Performance metrics (time, tokens)
- Satisfaction trend over time

---

### 3. **Dashboard - New "Mode Performance" Tab**

Access: Click **"🐺 Hacker Reign"** logo → **Mode Performance** tab

**Shows for each mode:**
- **Total Interactions**: How many times you've used this mode
- **Quality %**: Overall response quality (0-100%)
- **Success Rate**: Percentage of successful responses
- **User Satisfaction %**: Based on your 👍/👎 votes

**Feedback Breakdown:**
- 👍 Helpful count (green)
- 👎 Not Helpful count (red)
- No Feedback count (gray)

**Satisfaction Trend Chart:**
- Visual mini-chart of last 10 interactions
- Green bars = positive feedback
- Red bars = negative feedback
- Gray bars = neutral/no feedback
- Shows if mode is improving or declining

---

## Mode Comparison Guide

### 🤖 **Auto Mode**
**What it is:** No mode selected - uses default system behavior

**Best for:**
- General questions
- Quick tasks
- When you don't need specific tone

**Dashboard shows:**
- How well default behavior works for you
- Baseline satisfaction to compare other modes against

---

### 🎓 **Learning Mode**
**What it is:** Patient educator, explains concepts with examples

**Personality:**
- Warm and encouraging
- Builds from fundamentals
- Uses analogies and examples
- Explains WHY, not just WHAT

**Best for:**
- Learning new concepts
- Understanding fundamentals
- Beginner-friendly explanations
- When you want step-by-step guidance

**Dashboard shows:**
- If educational tone resonates with you
- Whether examples and analogies help
- If patience vs. brevity is preferred

---

### 👁️ **Code Review Mode**
**What it is:** Critical analyst focused on code quality

**Personality:**
- Respectful but thorough
- Points out improvements
- Focuses on readability, performance, best practices
- Constructive feedback with alternatives

**Best for:**
- Reviewing your code
- Getting suggestions for improvements
- Learning best practices
- Identifying issues before production

**Dashboard shows:**
- If critical feedback style works for you
- Whether suggestions are actionable
- If tone is helpful vs. too harsh

---

### 🧠 **Expert Mode**
**What it is:** Deep technical discussion, assumes knowledge

**Personality:**
- Assumes you know fundamentals
- Dives into edge cases and nuances
- Discusses trade-offs and architecture
- References advanced patterns

**Best for:**
- Complex technical discussions
- Architecture decisions
- Performance optimization
- When you want depth, not basics

**Dashboard shows:**
- If advanced discussions are helpful
- Whether assumptions match your level
- If depth is valuable vs. overwhelming

---

## How Modes Learn (Future Enhancement)

Currently, modes are **tracked but static** - they don't adapt behavior like strategies do.

**What's tracked NOW:**
- ✅ Satisfaction per mode
- ✅ Quality scores
- ✅ Feedback trends
- ✅ Comparative performance

**Future enhancements could include:**
- 🔮 **Adaptive prompts**: Adjust verbosity based on satisfaction
- 🔮 **Hybrid modes**: Combine best aspects of multiple modes
- 🔮 **Auto mode selection**: Suggest best mode based on question type
- 🔮 **Personalized modes**: Learn your preferred teaching/review style

For now, use the dashboard to **manually** choose which mode works best for you!

---

## Complete Feedback Flow

### **When You Vote on a Mode Response:**

```
1. You select a mode (Learning/Code Review/Expert/Auto)
   ↓
2. AI responds with that mode's personality
   ↓
3. You vote 👍 Helpful or 👎 Not Helpful
   ↓
4. Frontend sends feedback to /api/feedback
   ↓
5. Backend records to mode_analytics.db:
   - Updates user_feedback field
   - Calculates quality score (0.95 or 0.3)
   - Links to mode name
   ↓
6. Dashboard reads mode_interactions table
   ↓
7. Aggregates:
   - Total interactions per mode
   - Average satisfaction
   - Feedback breakdown (👍/👎 counts)
   - Satisfaction trend (last 10)
   ↓
8. Displays in "Mode Performance" tab
   ↓
9. You see which mode works best for you!
```

---

## Technical Implementation

### Files Created/Modified

**New Files:**
- `app/lib/domain/modeAnalytics.ts` - Mode tracking system

**Modified Files:**
- `components/Chat.tsx` - Added mode field to learningContext, enabled voting for all modes
- `app/api/feedback/route.ts` - Added mode tracking
- `app/api/analytics/route.ts` - Added mode performance endpoint
- `components/LearningDashboard.tsx` - Added Mode Performance tab

### Code Changes

**1. Chat Component** - Always create decisionId:
```typescript
// Non-streaming
const aiMsg: Message = {
  id: aiId,
  role: 'assistant',
  content,
  decisionId: data.decisionId || aiId, // Fallback to message ID
  learningContext: {
    ...context,
    mode: manualMode || 'auto' // Track mode
  }
};

// Streaming
const finalDecisionId = streamDecisionId || aiId; // Always set
```

**2. Voting UI** - Remove strategy requirement:
```typescript
// Before:
{strategyEnabled && msg.decisionId && (
  <div>Voting buttons</div>
)}

// After:
{msg.decisionId && (
  <div>Voting buttons</div>
)}
```

**3. Mode Analytics** - New tracking class:
```typescript
export class ModeAnalytics {
  async logInteraction(params: {
    id: string;
    mode: string; // 'auto', 'learning', 'code-review', 'expert'
    modelUsed: string;
    responseQuality: number;
    responseTime: number;
    tokensUsed: number;
    userFeedback?: 'positive' | 'negative' | 'neutral' | null;
  }): Promise<void> { ... }

  async updateMetrics(id: string, responseTime: number, tokensUsed: number): Promise<void> { ... }

  async updateFeedback(id: string, feedback: string): Promise<void> { ... }

  async getModePerformance(mode: string): Promise<ModePerformance> { ... }
}
```

**4. LLM Route** - Create mode interactions independently:
```typescript
// Create mode interaction BEFORE streaming/non-streaming split
let modeInteractionId: string | undefined = undefined;

if (!strategyEnabled) {
  const currentMode = manualModeOverride || 'auto';
  modeInteractionId = `mode_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await modeAnalytics.logInteraction({
    id: modeInteractionId,
    mode: currentMode,
    modelUsed: model,
    responseQuality: 0.8,
    responseTime: 0, // Updated after response completes
    tokensUsed: 0, // Updated after response completes
    userFeedback: null
  });
}

// Return mode interaction ID as decisionId when strategy disabled
return {
  decisionId: strategyEnabled ? strategyDecision.id : modeInteractionId
};
```

**5. Feedback API** - Handle both strategy and mode voting:
```typescript
// Check if we have a valid strategy decision ID
const hasValidDecisionId = decisionId &&
                            decisionId !== 'undefined' &&
                            decisionId !== 'null' &&
                            decisionId.startsWith('decision_'); // Strategy decisions start with 'decision_'

// Update strategy outcome ONLY if valid strategy decision
if (hasValidDecisionId) {
  try {
    await strategyManager.logOutcome(decisionId, {
      decisionId,
      responseQuality: qualityScore,
      responseTime: responseTime || 0,
      tokensUsed: tokensUsed || 0,
      errorOccurred: false,
      retryCount: 0,
      userFeedback: feedback
    });
    console.log(`[Feedback] Strategy outcome logged for decision ${decisionId}`);
  } catch (error: any) {
    console.warn(`[Feedback] Could not log strategy outcome:`, error.message);
    // Continue - mode tracking should still work
  }
} else {
  console.log(`[Feedback] No strategy decision (using mode ${mode || 'auto'} without strategy enabled)`);
}

// Record mode interaction feedback (separate from strategy)
if (mode) {
  await modeAnalytics.updateFeedback(decisionId, feedback);
}
```

---

## Usage Guide

### Step 1: Select a Mode

In the top nav, use the **Mode dropdown**:
- 🤖 Auto (default)
- 🎓 Learning
- 👁️ Code Review
- 🧠 Expert

### Step 2: Ask Questions

Chat normally - the AI will respond with that mode's personality.

### Step 3: Vote on Responses

After each response, click:
- 👍 **Helpful** - if you liked the response
- 👎 **Not Helpful** - if it didn't work for you

### Step 4: Check Dashboard

1. Click **"🐺 Hacker Reign"** logo in top-left
2. Navigate to **"Mode Performance"** tab
3. See which modes have highest satisfaction

### Step 5: Optimize Your Workflow

Use dashboard data to:
- ✅ Identify your preferred mode
- ✅ See which modes work for which tasks
- ✅ Compare modes side-by-side
- ✅ Stick with what works best

---

## Dashboard Scenarios

### Scenario 1: Finding Your Preferred Mode

**Initial State:**
```
Auto Mode: 12 interactions, 65% satisfaction
Learning Mode: 8 interactions, 82% satisfaction
Code Review Mode: 5 interactions, 58% satisfaction
Expert Mode: 3 interactions, 91% satisfaction
```

**Insight:** Expert mode works best for you! Learning mode is good too.

**Action:** Use Expert mode for most tasks, Learning mode for new concepts.

---

### Scenario 2: Mode Isn't Working

**Mode State:**
```
Code Review Mode
Satisfaction: 42%
Feedback: 2 👍, 7 👎, 3 neutral
Trend: [Red, Red, Gray, Red, Red, Red, Gray, Red]
```

**Insight:** Code Review mode's critical tone isn't working.

**Action:** Try Learning mode for a gentler approach, or Expert mode for depth without critique.

---

### Scenario 3: All Modes Performing Well

**All Modes:**
```
Auto: 78%
Learning: 85%
Code Review: 81%
Expert: 89%
```

**Insight:** All modes work well! Use based on task type.

**Action:**
- Learning for new concepts
- Code Review for improvements
- Expert for architecture
- Auto for quick tasks

---

## Strategy vs. Mode Voting

### What's the Difference?

| Aspect | **Strategies** | **Modes** |
|--------|---------------|-----------|
| **What they control** | Model selection, parameters | AI personality/tone |
| **Toggle in UI** | "Strategy" switch | "Mode" dropdown |
| **Examples** | Speed, Quality, Complexity, Adaptive | Learning, Code Review, Expert |
| **Learning** | Adapt behavior based on feedback | Currently static (tracked only) |
| **Best for** | Resource optimization | Communication style |

### Can You Use Both?

**Yes!** They work together:
- **Strategy** decides WHICH model + HOW to configure it
- **Mode** decides HOW the AI communicates

**Example:**
```
Strategy: Adaptive (uses ML to pick best model)
Mode: Learning (patient educator tone)
Result: Smart model selection + educational communication style
```

### Which Should You Vote On?

**Vote on BOTH!**
- Strategy voting → Improves model selection
- Mode voting → Shows which communication style you prefer

Both appear in dashboard for comparison.

---

## FAQ

### Q: Do I need Strategy enabled to vote?
**A:** No! Voting now works for ALL interactions, with or without strategies.

### Q: What if I don't select a mode?
**A:** You're using "Auto" mode - it still tracks and shows in dashboard!

### Q: Can modes learn and adapt like strategies?
**A:** Not yet. Modes are currently static personalities. Dashboard shows which you prefer, but they don't change behavior. This could be a future enhancement!

### Q: Which mode should I use?
**A:** Check the dashboard after trying each! Everyone is different. The data will show which works best for YOU.

### Q: Does mode voting affect strategy learning?
**A:** No, they're separate systems. Mode votes go to `mode_analytics.db`, strategy votes go to `strategy_analytics.db`.

### Q: Can I see mode + strategy combination performance?
**A:** Not yet, but that would be a great feature! Currently tracked separately.

### Q: Why does Auto mode have data?
**A:** When you don't select a mode, it defaults to "auto" and still tracks satisfaction. This is your baseline!

### Q: How do I reset mode data?
**A:** Delete `data/mode_analytics.db` to wipe all mode voting history and start fresh.

### Q: I got a "FOREIGN KEY constraint failed" error when voting?
**A:** This was a bug that's now fixed! The issue occurred when voting in Auto mode without Strategy enabled. The fix ensures mode interactions get their own unique IDs (`mode_...`) separate from strategy decisions (`decision_...`), preventing foreign key conflicts.

---

## Troubleshooting

### Problem: Voting buttons not showing

**Check:**
1. Is there a `decisionId` on the message? (Check browser console)
2. Is the message from the assistant (not user)?
3. Try refreshing the page

**Solution:** If buttons still don't show, check [Chat.tsx:459](../components/Chat.tsx#L459) - voting requires `msg.decisionId` to exist.

---

### Problem: Vote doesn't update dashboard

**Check:**
1. Open browser Network tab
2. Vote on a message
3. Look for POST to `/api/feedback`
4. Check the response

**Common causes:**
- ❌ `decisionId` is undefined
- ❌ `mode` field is missing
- ❌ Database connection issue

**Solution:** Check console logs for:
```
[Feedback] Mode {mode} feedback: {feedback} (quality: {score})
[Mode] Interaction updated: {id}
```

---

### Problem: Foreign key constraint error

**Symptoms:**
```
SqliteError: FOREIGN KEY constraint failed
    at StrategyAnalytics.logOutcome
```

**Cause:** This was a bug when voting in Auto mode without Strategy enabled. The system tried to log strategy outcomes for mode interactions.

**Fix Applied:**
- Mode interactions now get unique IDs: `mode_1234...`
- Strategy decisions get unique IDs: `decision_5678...`
- Feedback API checks ID prefix to route correctly
- Mode votes → `mode_analytics.db`
- Strategy votes → `strategy_analytics.db`

**If you still see this error:**
1. Make sure you're running the latest code
2. Delete `data/mode_analytics.db` and `data/strategy_analytics.db`
3. Restart the server
4. Try voting again

---

## Summary

🎉 **Voting is now universal!** Every response can be voted on, regardless of mode or strategy.

✅ **4 interaction modes tracked:** Auto, Learning, Code Review, Expert
✅ **Dashboard shows mode performance:** New tab with detailed metrics
✅ **Compare modes easily:** See which communication style works best
✅ **Feedback builds data:** Help identify your optimal workflow

**Start voting on every response to build your mode performance profile!**

---

## Related Documentation

- [DASHBOARD.md](./DASHBOARD.md) - Complete dashboard guide (includes strategy voting)
- [INFO_FLOW.md](./INFO_FLOW.md) - System architecture
- [README.md](../README.md) - Getting started

---

**Built to give you insight into which communication styles work best for YOUR workflow!** 📊
