# RAM Constraint System Documentation

## Overview

The Hacker Reign strategy system includes intelligent RAM management to prevent Out-Of-Memory (OOM) crashes while maximizing model performance. The system has been designed to be **essentially invisible** during normal operation - it trusts the adaptive strategy and only intervenes at critical levels.

## Table of Contents
- [How It Works](#how-it-works)
- [Configuration Options](#configuration-options)
- [Operating Modes](#operating-modes)
- [Understanding OOM](#understanding-oom)
- [Adjusting Thresholds](#adjusting-thresholds)
- [Troubleshooting](#troubleshooting)

---

## How It Works

### Three-Layer Architecture

1. **Monitor Layer** ([monitor.ts](../app/lib/strategy/resources/monitor.ts))
   - Measures free RAM from the operating system
   - Applies permissive multiplier (default: 1.0x = 100% of free RAM)
   - In "let it cook" mode: 1.5x (allows swap/virtual memory)

2. **Constraint Layer** ([constraints.ts](../app/lib/strategy/resources/constraints.ts))
   - Only intervenes at **critical** levels (< 30% of model requirement)
   - Logs warnings for informational purposes
   - Trusts adaptive strategy for all normal operations

3. **Adaptive Strategy**
   - Makes primary model selection decisions
   - Learns from historical performance
   - Not overridden by constraints unless critically low RAM

### Default Behavior

**Without any configuration:**
- Uses 100% of free RAM (no artificial limits)
- Only downgrades if RAM < 30% of model requirement
- Example with 8GB free RAM:
  - 16B model needs 16GB → Downgrade only if < 4.8GB free ✅
  - 7B model needs 8GB → Downgrade only if < 2.4GB free ✅
  - 3B model needs 4GB → Downgrade only if < 1.2GB free ✅

---

## Configuration Options

### Environment Variable Control

Add to your `.env.local` file:

```bash
# Disable RAM-based model downgrades entirely (let the machine cook!)
# Default: false (only critical OOM protection remains)
DISABLE_RAM_CONSTRAINTS=false
```

### Mode Comparison

| Setting | Available RAM Calculation | Intervention Threshold | Use Case |
|---------|--------------------------|------------------------|----------|
| `false` (default) | `freeRAM × 1.0` | < 30% of model req | Balanced - trusts strategy with safety net |
| `true` | `freeRAM × 1.5` | < 30% of model req | Aggressive - allows swap, maximum performance |

---

## Operating Modes

### 🛡️ Default Mode (Recommended)

```bash
DISABLE_RAM_CONSTRAINTS=false
```

**Characteristics:**
- Uses 100% of free RAM (no artificial reduction)
- Allows 95% RAM usage for recommended config
- Only intervenes at critical levels (< 30% of model requirement)
- Protects against OOM crashes
- Trusts adaptive strategy for model selection

**Example on 16GB Mac:**
```
Total RAM: 16,384 MB
System usage: ~8,000 MB
Free RAM: 8,384 MB
Available for models: 8,384 MB (100%)
Max recommended: 7,965 MB (95%)

✅ Can run 7B models (needs 8GB)
⚠️ May struggle with 16B models (needs 16GB)
❌ Will downgrade 16B → 7B if free RAM < 4.8GB
```

### 🚀 "Let It Cook" Mode (Maximum Performance)

```bash
DISABLE_RAM_CONSTRAINTS=true
```

**Characteristics:**
- Uses 150% of free RAM (allows swap/virtual memory)
- No upper limit on RAM usage
- Still protects against OOM at critical levels
- Best for systems with fast SSD swap

**Example on 16GB Mac:**
```
Total RAM: 16,384 MB
System usage: ~8,000 MB
Free RAM: 8,384 MB
Available for models: 12,576 MB (150%)
Max recommended: Unlimited

✅ Can run 7B models
✅ Can run 16B models (will use swap if needed)
❌ Will downgrade only if free RAM < 4.8GB
```

---

## Understanding OOM

### What is OOM?

**OOM (Out Of Memory)** occurs when a process tries to allocate more RAM than is available, causing:
- System crashes
- Process termination
- Severe performance degradation
- Data loss in unsaved work

### Model RAM Requirements

| Model | RAM Needed | Critical Threshold (30%) |
|-------|-----------|-------------------------|
| llama3.2:3b | 4 GB | 1.2 GB |
| qwen2.5-coder:7b | 8 GB | 2.4 GB |
| deepseek-v2:16b | 16 GB | 4.8 GB |

### Safety Net Activation

The system only forces a downgrade when:
```typescript
availableRAM < (modelRequirement × 0.3)
```

This means you need at least **30% of the recommended RAM** to run a model. Below this threshold, actual OOM risk is high.

---

## Adjusting Thresholds

### 🎯 Make Constraints Even More Permissive

If you want even less intervention, you can modify the code:

#### Option 1: Increase Critical Threshold

Edit [constraints.ts:25](../app/lib/strategy/resources/constraints.ts#L25):

```typescript
// Current: Only intervene at < 30% of model requirement
const criticalThreshold = modelRAMReq * 0.3;

// More aggressive: Only intervene at < 20%
const criticalThreshold = modelRAMReq * 0.2;

// Extremely aggressive: Only intervene at < 10%
const criticalThreshold = modelRAMReq * 0.1;
```

#### Option 2: Increase Free RAM Multiplier

Edit [monitor.ts:28](../app/lib/strategy/resources/monitor.ts#L28):

```typescript
// Current in "let it cook" mode
const availableRAM = disableConstraints ? freeRAM * 1.5 : freeRAM;

// More aggressive
const availableRAM = disableConstraints ? freeRAM * 2.0 : freeRAM;

// Extremely aggressive (not recommended)
const availableRAM = disableConstraints ? freeRAM * 3.0 : freeRAM;
```

#### Option 3: Disable Critical Check Entirely

Edit [constraints.ts:27](../app/lib/strategy/resources/constraints.ts#L27):

```typescript
// Current: Check if below critical threshold
if (!disableConstraints && resources.availableRAM < criticalThreshold) {
  // ... downgrade logic
}

// Disable: Never downgrade based on RAM
if (false) { // Always skip this check
  // ... downgrade logic (never runs)
}
```

**⚠️ Warning:** Disabling the critical check entirely may lead to OOM crashes!

---

## Troubleshooting

### Problem: System keeps downgrading models unnecessarily

**Symptoms:**
- Logs show "CRITICAL RAM" warnings when you have plenty of RAM
- Quality strategy always downgrades to 7B or 3B
- Adaptive strategy choices are being overridden

**Solutions:**

1. **Check environment variable:**
   ```bash
   # In .env.local
   DISABLE_RAM_CONSTRAINTS=true
   ```

2. **Check free RAM:**
   ```bash
   # On macOS/Linux
   free -m
   # Or
   vm_stat
   ```

3. **Increase critical threshold:**
   - Edit [constraints.ts:25](../app/lib/strategy/resources/constraints.ts#L25)
   - Change `0.3` to `0.2` or `0.1`

4. **Review logs:**
   - Look for `[Constraints] CRITICAL RAM:` warnings
   - Check `availableRAM` vs `modelRAMReq` values

### Problem: Getting OOM crashes

**Symptoms:**
- System becomes unresponsive
- Process terminates with "out of memory" error
- Severe slowdown when running larger models

**Solutions:**

1. **Enable constraints (safety net):**
   ```bash
   # In .env.local
   DISABLE_RAM_CONSTRAINTS=false
   ```

2. **Close other applications:**
   - Free up RAM for model inference
   - Check Activity Monitor / Task Manager

3. **Use smaller models:**
   - 16B → 7B for most tasks
   - 7B → 3B for simple tasks

4. **Increase swap space:**
   - macOS: Automatic
   - Linux: Configure swap file size
   - Windows: Increase virtual memory

### Problem: System is too cautious

**Current behavior:**
- Downgrades even when there's plenty of RAM
- Won't try 16B model despite having memory

**Solution - Adjust critical threshold:**

```typescript
// File: app/lib/strategy/resources/constraints.ts:25

// From (conservative):
const criticalThreshold = modelRAMReq * 0.3; // 30% minimum

// To (permissive):
const criticalThreshold = modelRAMReq * 0.15; // 15% minimum

// To (very permissive):
const criticalThreshold = modelRAMReq * 0.1; // 10% minimum
```

### Problem: Want more detailed logging

**Solution - Enable verbose logging:**

Edit [constraints.ts:33-36](../app/lib/strategy/resources/constraints.ts#L33-L36):

```typescript
// Add more detailed logs
} else if (config.maxRAM && resources.availableRAM < config.maxRAM) {
  // Current: Simple info log
  console.log(`[Constraints] Low RAM info: ${Math.round(resources.availableRAM)}MB available (not blocking)`);

  // Enhanced: Add more details
  console.log(`[Constraints] RAM Status:`, {
    available: `${Math.round(resources.availableRAM)}MB`,
    required: `${modelRAMReq}MB`,
    critical: `${Math.round(criticalThreshold)}MB`,
    model: decision.selectedModel,
    action: 'none (trusting adaptive strategy)'
  });
}
```

---

## Best Practices

### ✅ DO:
- Use default settings first (DISABLE_RAM_CONSTRAINTS=false)
- Monitor logs to understand when constraints activate
- Adjust thresholds based on your system's behavior
- Enable "let it cook" mode (DISABLE_RAM_CONSTRAINTS=true) if you have fast SSD

### ❌ DON'T:
- Completely disable OOM protection without understanding risks
- Set extremely low critical thresholds (< 0.1) without testing
- Ignore CRITICAL RAM warnings in logs
- Run 16B models on systems with < 8GB free RAM

---

## Quick Reference

### Files to Edit

| File | Line | Purpose |
|------|------|---------|
| `.env.local` | 45 | Enable/disable constraints |
| `monitor.ts` | 28 | Adjust free RAM multiplier |
| `constraints.ts` | 25 | Adjust critical threshold |
| `constraints.ts` | 115 | Adjust recommended config max RAM |

### Common Adjustments

**More Permissive (Recommended):**
```bash
# .env.local
DISABLE_RAM_CONSTRAINTS=true

# constraints.ts:25
const criticalThreshold = modelRAMReq * 0.2; // Was 0.3
```

**Default (Balanced):**
```bash
# .env.local
DISABLE_RAM_CONSTRAINTS=false

# constraints.ts:25
const criticalThreshold = modelRAMReq * 0.3;
```

**More Conservative:**
```bash
# .env.local
DISABLE_RAM_CONSTRAINTS=false

# constraints.ts:25
const criticalThreshold = modelRAMReq * 0.5; // Was 0.3
```

---

## Version History

### v2.1.1 - Permissive RAM Constraints (Jan 12, 2026)
- Changed default behavior to trust adaptive strategy
- Reduced intervention to critical levels only (< 30% of model requirement)
- Added `DISABLE_RAM_CONSTRAINTS` environment variable
- Increased default RAM usage to 95-100% of free RAM
- Added comprehensive logging for transparency

### v2.0.0 - Initial RAM Constraints (Jan 10, 2026)
- Aggressive constraints (56% of free RAM usable)
- Downgraded at 80% RAM usage threshold
- Fixed in v2.1.1 due to poor performance

---

## Support

For issues or questions about RAM management:

1. **Check logs:** Look for `[Constraints]` messages
2. **Review this document:** Most issues covered in Troubleshooting
3. **Adjust thresholds:** Start conservative, increase gradually
4. **Monitor system:** Use Activity Monitor / Task Manager while testing

**Related Documentation:**
- [STRUCTURE.md](STRUCTURE.md) - Project architecture
- [README.md](../README.md) - General usage
- [Strategy System](../app/lib/strategy/README.md) - Strategy details

---

**©2026 | Vivid Visions | HackerReign™**
