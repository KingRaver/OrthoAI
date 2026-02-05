# Strategy System Architecture Plan

## Executive Summary

Design and implement a **multi-model orchestration system** with ML-driven optimization that scales from simple rule-based strategies to advanced ensemble voting and performance analytics.

**Core Goals:**
- Adaptive model selection (Llama 3B → DeepSeek 16B based on complexity)
- Resource optimization (RAM/GPU/CPU/token usage)
- Multi-model workflows (chaining, ensemble voting)
- Performance analytics with data-driven learning
- Full conversation context awareness

---

## Phase 1: Foundation Architecture

### 1.1 Strategy Interface & Core Types

**Location:** `app/lib/strategy/types.ts`

```typescript
// Core strategy result
interface StrategyDecision {
  // Model selection
  selectedModel: string;
  fallbackModels?: string[];

  // Multi-model workflows
  modelChain?: ModelChainConfig;
  ensembleConfig?: EnsembleConfig;

  // Parameter optimization
  temperature: number;
  maxTokens: number;
  topP?: number;

  // Execution control
  streaming: boolean;
  enableTools: boolean;
  maxToolLoops: number;

  // Resource constraints
  resourceLimits?: ResourceConfig;

  // Analytics
  reasoning: string;
  confidence: number;
  strategyId: string;
}

// Multi-model support
interface ModelChainConfig {
  enabled: boolean;
  steps: Array<{
    model: string;
    role: 'draft' | 'refine' | 'validate' | 'review';
    minConfidence?: number;
  }>;
}

interface EnsembleConfig {
  enabled: boolean;
  models: string[];
  votingStrategy: 'majority' | 'weighted' | 'consensus';
  weights?: Record<string, number>;
}

// Resource management
interface ResourceConfig {
  maxRAM?: number;      // MB
  maxGPULayers?: number;
  maxCPUThreads?: number;
  thermalThreshold?: number;
  batteryAware?: boolean;
}
```

### 1.2 Base Strategy Class

**Location:** `app/lib/strategy/baseStrategy.ts`

```typescript
abstract class BaseStrategy {
  abstract name: string;
  abstract priority: number;

  // Core decision method
  abstract decide(context: StrategyContext): Promise<StrategyDecision>;

  // Optional hooks
  async preProcess(context: StrategyContext): Promise<void> {}
  async postProcess(decision: StrategyDecision): Promise<void> {}

  // Analytics integration
  async recordDecision(
    decision: StrategyDecision,
    outcome: StrategyOutcome
  ): Promise<void> {}
}

interface StrategyContext {
  // User input
  userMessage: string;
  conversationHistory: Message[];

  // Context detection results
  detectedMode: InteractionMode;
  detectedDomain: Domain;
  complexity: 'simple' | 'moderate' | 'complex';
  confidence: number;

  // System state
  availableModels: ModelInfo[];
  systemResources: SystemResourceInfo;
  conversationMetadata: ConversationMetadata;

  // Manual overrides
  manualModeOverride?: InteractionMode;
  manualModelOverride?: string;
}
```

---

## Phase 2: Built-in Strategy Implementations

### 2.1 Complexity-Based Strategy (MVP)

**Location:** `app/lib/strategy/implementations/complexityStrategy.ts`

**Logic:**
```
Simple tasks (< 50 tokens, no code) → Llama 3.2 (3B)
Moderate tasks (code review, explanations) → Qwen 2.5 (7B)
Complex tasks (architecture, deep analysis) → Qwen Coder (7B)
Expert tasks (large refactors, debugging) → DeepSeek V2 (16B)
```

**Decision Tree:**
1. Analyze complexity signals:
   - Input length
   - Code block presence/size
   - Technical keywords (async, architecture, refactor)
   - Domain complexity (python-backend = +1, mixed = +2)
2. Map to model tier
3. Apply resource constraints
4. Return decision

### 2.2 Cost Optimization Strategy

**Location:** `app/lib/strategy/implementations/costStrategy.ts`

**Logic:**
- Minimize token usage
- Prefer smaller models when confidence allows
- Track cumulative token usage per session
- Switch to larger models only when necessary

**Triggers:**
- Low confidence in small model → escalate to larger
- Failed response quality check → retry with better model
- User expresses dissatisfaction → upgrade model tier

### 2.3 Speed-First Strategy

**Location:** `app/lib/strategy/implementations/speedStrategy.ts`

**Logic:**
- Always use Llama 3.2 (3B) unless forced to escalate
- Streaming enabled by default
- Reduced max_tokens (4000)
- Disable tools unless explicitly requested

### 2.4 Quality-First Strategy

**Location:** `app/lib/strategy/implementations/qualityStrategy.ts`

**Logic:**
- Default to DeepSeek V2 (16B) or Qwen Coder (7B)
- Higher temperature for creativity (0.6-0.7)
- Larger context windows (16K+)
- Enable ensemble voting for critical decisions

### 2.5 Adaptive Strategy (ML-Driven - Future)

**Location:** `app/lib/strategy/implementations/adaptiveStrategy.ts`

**Logic:**
- Query analytics database for historical performance
- Use confidence scores + past outcomes to predict best model
- Learn from user feedback (thumbs up/down)
- A/B test strategies and measure success rates

---

## Phase 3: Multi-Model Workflows

### 3.1 Model Chaining

**Use Case:** Fast draft + quality review

**Flow:**
```
User: "Refactor this 500-line component"
  ↓
Step 1 (Draft): Llama 3.2 generates quick refactor outline
  ↓
Step 2 (Refine): Qwen Coder expands with implementation
  ↓
Step 3 (Review): DeepSeek V2 critiques for edge cases
  ↓
Return combined result
```

**Implementation:** `app/lib/strategy/workflows/chain.ts`

### 3.2 Ensemble Voting

**Use Case:** Critical decisions requiring consensus

**Flow:**
```
User: "Is this authentication code secure?"
  ↓
Run in parallel:
  - Qwen 2.5 → analyzes code
  - Qwen Coder → checks patterns
  - DeepSeek V2 → security review
  ↓
Vote on consensus (weighted by confidence)
  ↓
Return majority opinion + dissenting views
```

**Implementation:** `app/lib/strategy/workflows/ensemble.ts`

---

## Phase 4: Performance Analytics & Learning

### 4.1 New Database Tables

**Location:** `app/lib/memory/storage/migrations/002_strategy_analytics.sql`

```sql
-- Track strategy decisions
CREATE TABLE strategy_decisions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  strategy_name TEXT NOT NULL,
  selected_model TEXT NOT NULL,
  reasoning TEXT,
  confidence REAL,
  context_complexity TEXT,
  decision_time_ms INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Track outcomes
CREATE TABLE strategy_outcomes (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  response_quality REAL,        -- 0-1 score
  user_feedback TEXT,            -- 'positive' | 'negative' | 'neutral'
  response_time_ms INTEGER,
  tokens_used INTEGER,
  error_occurred BOOLEAN,
  retry_count INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (decision_id) REFERENCES strategy_decisions(id) ON DELETE CASCADE
);

-- Track A/B experiments
CREATE TABLE strategy_experiments (
  id TEXT PRIMARY KEY,
  experiment_name TEXT NOT NULL,
  variant_a TEXT NOT NULL,
  variant_b TEXT NOT NULL,
  winner TEXT,
  confidence_level REAL,
  sample_size INTEGER,
  started_at TEXT NOT NULL,
  ended_at TEXT
);
```

### 4.2 Analytics Module

**Location:** `app/lib/strategy/analytics/tracker.ts`

**Capabilities:**
- Log every strategy decision
- Track response times by model
- Calculate success rates per strategy
- Identify low-performing model/task combinations
- Generate insights for ML training

**Methods:**
```typescript
class StrategyAnalytics {
  async logDecision(decision: StrategyDecision): Promise<string>;
  async logOutcome(decisionId: string, outcome: StrategyOutcome): Promise<void>;
  async getStrategyPerformance(strategyName: string): Promise<PerformanceMetrics>;
  async getModelPerformance(model: string): Promise<ModelMetrics>;
  async suggestOptimalStrategy(context: StrategyContext): Promise<string>;
}
```

### 4.3 Learning Pipeline (Future)

**Data Collection:**
1. Strategy decisions → SQLite
2. User feedback (thumbs up/down) → outcomes table
3. Response quality signals (retry rate, edit rate, follow-up questions)

**Training Loop:**
1. Export analytics to CSV/JSON
2. Train lightweight ML model (sklearn, TensorFlow.js)
3. Model predicts: `(context) → recommended_strategy`
4. Deploy as `AdaptiveStrategy`

---

## Phase 5: UI Integration

### 5.1 New Strategy Selector Dropdown

**Location:** `components/Chat.tsx` (line 215-225)

**Add after Mode Selector:**

```tsx
{/* Strategy Selector */}
<select
  value={selectedStrategy}
  onChange={(e) => setSelectedStrategy(e.target.value)}
  className="px-5 py-3 rounded-2xl text-sm font-semibold bg-white/8 text-white border-2 border-cyan-light/30 hover:border-cyan-light/50 hover:bg-white/12 transition-all duration-200 shadow-lg hover:shadow-cyan-light/20 focus:outline-none focus:ring-2 focus:ring-cyan-light/60 cursor-pointer backdrop-blur-sm"
>
  <option value="auto">🤖 Auto Strategy</option>
  <option value="balanced">⚡ Balanced</option>
  <option value="speed">🚀 Speed First</option>
  <option value="quality">🧠 Quality First</option>
  <option value="cost">💰 Cost Optimized</option>
  <option value="manual">🎯 Manual Control</option>
</select>
```

### 5.2 Model Display (Read-Only When Auto)

**Enhancement:** Show which model was auto-selected

```tsx
{selectedStrategy !== 'manual' && autoSelectedModel && (
  <div className="text-xs text-cyan-light/70">
    Using: {autoSelectedModel} (auto-selected)
  </div>
)}
```

---

## Phase 6: API Integration Points

### 6.1 Strategy Manager (Main Orchestrator)

**Location:** `app/lib/strategy/manager.ts`

```typescript
class StrategyManager {
  private strategies: Map<string, BaseStrategy>;
  private analytics: StrategyAnalytics;

  constructor() {
    this.registerStrategy('balanced', new ComplexityStrategy());
    this.registerStrategy('speed', new SpeedStrategy());
    this.registerStrategy('quality', new QualityStrategy());
    this.registerStrategy('cost', new CostStrategy());
    this.registerStrategy('adaptive', new AdaptiveStrategy());
  }

  async executeStrategy(
    strategyName: string,
    context: StrategyContext
  ): Promise<StrategyDecision> {
    const strategy = this.strategies.get(strategyName);
    const decision = await strategy.decide(context);

    // Log decision for analytics
    await this.analytics.logDecision(decision);

    return decision;
  }
}
```

### 6.2 LLM API Route Integration

**Location:** `app/api/llm/route.ts`

**Changes:**
```typescript
// Line 15: Import strategy system
import { StrategyManager } from '@/app/lib/strategy/manager';
import { buildStrategyContext } from '@/app/lib/strategy/context';

// Line 45: Build strategy context
const strategyContext = buildStrategyContext({
  userMessage: lastUserMessage,
  conversationHistory: messages,
  detectedMode: detection.mode,
  detectedDomain: detection.domain,
  complexity: detection.complexity,
  confidence: detection.confidence,
  manualModeOverride,
  manualModelOverride: selectedStrategy === 'manual' ? model : undefined
});

// Line 50: Execute strategy
const strategyManager = new StrategyManager();
const decision = await strategyManager.executeStrategy(
  selectedStrategy || 'balanced',
  strategyContext
);

// Line 60: Use strategy decision
const finalModel = decision.selectedModel;
const finalTemperature = decision.temperature;
const finalMaxTokens = decision.maxTokens;
const shouldStream = decision.streaming;
const toolsEnabled = decision.enableTools;

// Line 200: Pass to LLM call
const response = await openai.chat.completions.create({
  model: finalModel,
  temperature: finalTemperature,
  max_tokens: finalMaxTokens,
  // ... rest of config
});

// Line 250: Log outcome
await strategyManager.logOutcome(decision.id, {
  responseTimeMs: responseTime,
  tokensUsed: totalTokens,
  errorOccurred: false
});
```

---

## Implementation Steps (All Built Together)

### **Step 1: Enhanced Complexity Detection**
**Enhance existing contextDetector.ts with new signals:**
- AST-level analysis (if code present)
- Lines of code counting
- Cyclomatic complexity estimation
- Async/concurrency pattern depth
- Import/dependency complexity

**Files to Modify:**
- `app/lib/domain/contextDetector.ts` - Add enhanced complexity signals

---

### **Step 2: Core Strategy System**
**Files to Create:**
- `app/lib/strategy/types.ts` - Core interfaces (StrategyDecision, StrategyContext, ModelChainConfig, EnsembleConfig, ResourceConfig)
- `app/lib/strategy/baseStrategy.ts` - Abstract base class with hooks
- `app/lib/strategy/context.ts` - Context builder that integrates with existing domain detection
- `app/lib/strategy/manager.ts` - Strategy orchestrator and registry

---

### **Step 3: All Strategy Implementations**
**Files to Create:**
- `app/lib/strategy/implementations/complexityStrategy.ts` - Model selection based on enhanced complexity
- `app/lib/strategy/implementations/speedStrategy.ts` - Always optimize for speed (smallest models)
- `app/lib/strategy/implementations/qualityStrategy.ts` - Always optimize for quality (largest models)
- `app/lib/strategy/implementations/costStrategy.ts` - Token-aware optimization
- `app/lib/strategy/implementations/adaptiveStrategy.ts` - Analytics-driven selection (basic version)

---

### **Step 4: Multi-Model Workflows**
**Files to Create:**
- `app/lib/strategy/workflows/chain.ts` - Model chaining (draft → refine → review)
- `app/lib/strategy/workflows/ensemble.ts` - Ensemble voting (parallel models + consensus)
- `app/lib/strategy/orchestrator.ts` - Multi-model workflow coordinator

---

### **Step 5: Analytics & Learning**
**Files to Create:**
- `app/lib/memory/storage/migrations/002_strategy_analytics.sql` - Strategy decision tracking tables
- `app/lib/strategy/analytics/tracker.ts` - Performance analytics and logging
- `app/lib/strategy/analytics/insights.ts` - Query strategy performance, generate recommendations

**Files to Modify:**
- `app/lib/memory/storage/sqlite.ts` - Add strategy analytics methods

---

### **Step 6: Resource Management**
**Files to Create:**
- `app/lib/strategy/resources/monitor.ts` - System resource detection (RAM, GPU, CPU, thermal, battery)
- `app/lib/strategy/resources/constraints.ts` - Resource-aware decision constraints

---

### **Step 7: UI Integration**
**Files to Modify:**
- `components/Chat.tsx` - Add Strategy ON/OFF toggle + strategy selector dropdown (only visible when ON)

**UI Changes:**
```
[🤖 Auto-detect ▼] [Vibe Coder ▼] [Strategy: OFF ▼] [Tools OFF] [Voice ON]
                                          ↓ (when clicked)
                                   [⚡ Balanced ▼]
                                   [🚀 Speed First]
                                   [🧠 Quality First]
                                   [💰 Cost Optimized]
                                   [🔗 Chain Models]
                                   [🗳️ Ensemble Vote]
```

When Strategy is ON:
- Model selector becomes read-only (shows auto-selected model)
- Strategy selector determines which optimization strategy to use

When Strategy is OFF:
- Original behavior preserved (manual model selection)

---

### **Step 8: API Integration**
**Files to Modify:**
- `app/api/llm/route.ts` - Integrate strategy manager, execute decisions, log outcomes

**Integration Points:**
1. Build strategy context from request
2. Execute selected strategy (if enabled)
3. Use strategy decision to override model/parameters
4. Handle multi-model workflows (chain/ensemble)
5. Log decision + outcome to analytics

---

## Critical Files Overview

| File | Purpose | Lines Est. |
|------|---------|-----------|
| `strategy/types.ts` | Core TypeScript interfaces | ~200 |
| `strategy/baseStrategy.ts` | Abstract strategy class | ~100 |
| `strategy/manager.ts` | Strategy orchestration | ~150 |
| `strategy/context.ts` | Context builder for strategies | ~100 |
| `strategy/implementations/complexityStrategy.ts` | MVP strategy | ~200 |
| `strategy/analytics/tracker.ts` | Performance analytics | ~250 |
| `strategy/workflows/chain.ts` | Model chaining | ~200 |
| `strategy/workflows/ensemble.ts` | Ensemble voting | ~250 |
| **Total (Phase 1-6)** | | **~1,450** |

---

## Design Principles

1. **Progressive Enhancement:** Each phase builds on the previous, no breaking changes
2. **Open/Closed Principle:** Easy to add new strategies without modifying manager
3. **Single Responsibility:** Each strategy focuses on one optimization goal
4. **Data-Driven:** Analytics drive future improvements, not assumptions
5. **Graceful Degradation:** If strategy fails, fall back to manual mode
6. **User Control:** Manual mode always available as override

---

## Future Expansion Paths

### Year 1:
- Remote model support (OpenAI, Anthropic fallback)
- Cost tracking with budget limits
- User preference learning
- Strategy recommendations

### Year 2:
- Multi-agent workflows (research agent + code agent)
- Federated learning across users (privacy-preserving)
- Custom strategy builder UI
- Real-time strategy A/B testing dashboard

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Strategy overhead slows responses | High | Cache decisions, async logging, haiku for strategy logic |
| Wrong model selected | Medium | Confidence thresholds, user feedback loop, manual override |
| Analytics bloat database | Low | Auto-cleanup old decisions (30 days), optional analytics |
| Multi-model costs too high | Medium | Cost limits, user confirmation for expensive workflows |
| Complexity overwhelms users | Medium | Default to "Auto", hide advanced options, good tooltips |

---

## Success Metrics

**Phase 1 (MVP):**
- ✅ Strategy system integrated without breaking existing features
- ✅ 80%+ accuracy in model selection vs manual user choice
- ✅ Average response time maintained or improved

**Phase 3 (Analytics):**
- ✅ 100% of decisions logged
- ✅ Analytics dashboard shows strategy performance
- ✅ Identify worst-performing strategy/model combos

**Phase 6 (ML-Driven):**
- ✅ Adaptive strategy outperforms rule-based 70%+ of the time
- ✅ User satisfaction improves (measured by feedback)
- ✅ Token costs reduced by 20%+ vs always-use-largest-model

---

## Key Design Decisions Based on Requirements

### 1. **Strategy ON/OFF Toggle (User Requirement)**
- Default: OFF (preserves current behavior)
- When OFF: Manual model selection works as before
- When ON: Strategy system takes control, model selector shows auto-selected model (read-only)
- Toggle persists in conversation state

### 2. **Enhanced Complexity Detection (User Requirement)**
- Extend existing `contextDetector.ts` rather than replace
- Add new signals: AST analysis, LOC, cyclomatic complexity, async depth
- Maintain backward compatibility with existing mode detection
- New complexity score: 0-100 (more granular than simple/moderate/complex)

### 3. **All Models Available (User Confirmation)**
- No need for model availability checking
- All models in dropdown are installed and ready
- Fallback logic not required for MVP

### 4. **Immediate Full Implementation (User Requirement)**
- Build all components in one implementation cycle
- No phased rollout - ship complete system
- Include all strategies, workflows, analytics from start
- Test thoroughly before deployment

---

## Implementation Order (Step-by-Step)

We'll build this in dependency order to avoid import issues:

1. **Types & Interfaces** → Foundation for everything
2. **Enhanced Complexity Detection** → Needed by strategies
3. **Base Strategy Class** → Abstract class for implementations
4. **Context Builder** → Bridges domain detection + strategy system
5. **Individual Strategies** → Concrete implementations
6. **Multi-Model Workflows** → Chain and ensemble orchestration
7. **Analytics Infrastructure** → Database + tracker
8. **Resource Monitor** → System awareness
9. **Strategy Manager** → Orchestrator that ties it all together
10. **API Integration** → LLM route modifications
11. **UI Integration** → Strategy toggle + selector
12. **Testing & Validation** → Ensure everything works

---

## Success Criteria

### Functional Requirements:
- ✅ Strategy toggle appears in UI (OFF by default)
- ✅ When OFF: Existing behavior unchanged
- ✅ When ON: Model auto-selected based on chosen strategy
- ✅ All 6 strategies work (Balanced, Speed, Quality, Cost, Chain, Ensemble)
- ✅ Multi-model workflows execute correctly
- ✅ Analytics log all decisions and outcomes
- ✅ Resource constraints respected

### Performance Requirements:
- ✅ Strategy decision adds < 50ms latency
- ✅ Enhanced complexity detection adds < 20ms
- ✅ Analytics logging is async (no blocking)
- ✅ Multi-model workflows complete in reasonable time (< 2x single model)

### Data Requirements:
- ✅ 100% of strategy decisions logged to database
- ✅ Outcomes captured (response time, tokens, quality signals)
- ✅ Analytics queries performant (< 100ms for common queries)

---

## Next Steps

Ready to implement! The plan covers:
- Complete architecture for all 6 strategies
- Multi-model workflows (chain + ensemble)
- Full analytics infrastructure
- Resource management
- Clean UI integration with toggle

Would you like me to proceed with implementation?
