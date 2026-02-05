# 🧠 Hacker Reign - LLM Models Reference Guide

> Complete reference for local LLM models optimized for Python & TypeScript/Next.js development
> 
> **Hardware**: M4 MacBook Air 16GB | **Platform**: Ollama

---

## Table of Contents

- [Understanding Model Sizes (B Ratings)](#understanding-model-sizes-b-ratings)
- [MoE Models Explained](#moe-models-explained)
- [Quantization Guide](#quantization-guide)
- [RAM Requirements](#ram-requirements)
- [Recommended Models for 16GB Mac](#recommended-models-for-16gb-mac)
- [Model Download Commands](#model-download-commands)
- [Model Comparison Tables](#model-comparison-tables)
- [Configuration Examples](#configuration-examples)

---

## Understanding Model Sizes (B Ratings)

### What Does "B" Mean?

**B = Billion Parameters**

Parameters are the learned weights in a neural network - the numbers the model uses to make predictions. More parameters generally means:
- ✅ Better reasoning and code quality
- ✅ More nuanced understanding
- ❌ More RAM/VRAM required
- ❌ Slower inference speed

### Simple Analogy

Think of parameters like brain synapses:
- **7B** = 7 billion connections (smart assistant)
- **70B** = 70 billion connections (expert consultant)
- **480B** = 480 billion connections (genius-level)

### Size Categories

| Category | Parameters | Use Case | Quality |
|----------|------------|----------|---------|
| **Tiny** | 1B-3B | Quick completions, edge devices | Basic |
| **Small** | 7B-9B | Daily coding, fast responses | Good |
| **Medium** | 13B-16B | Complex tasks, better reasoning | Very Good |
| **Large** | 30B-34B | Production code, multi-file | Excellent |
| **XL** | 70B+ | Research, frontier tasks | State-of-art |

---

## MoE Models Explained

### What is MoE?

**MoE = Mixture of Experts**

Instead of using ALL parameters for every request, MoE models activate only a subset of "expert" sub-networks. This gives you big-model quality with small-model speed.

### Reading MoE Model Names

```
Qwen3-Coder-480B-A35B-Instruct
            │     │
            │     └── Active: Only 35B parameters used per token
            └──────── Total: 480B parameters available

DeepSeek-Coder-V2-236B (21B active)
                  │     │
                  │     └── Only 21B active per request
                  └──────── 236B total parameters
```

### Why MoE Matters for You

| Model | Total Params | Active Params | Effective RAM Need |
|-------|--------------|---------------|-------------------|
| Qwen3-Coder 30B | 30B | **3B** | ~8GB (Q4) ✅ |
| Qwen3-Coder 480B | 480B | **35B** | ~150GB ❌ |
| DeepSeek-V2 16B | 16B | **2.4B** | ~6GB (Q4) ✅ |
| DeepSeek-V3 671B | 671B | **37B** | ~200GB ❌ |

**Bottom Line**: MoE models let you run "30B quality" on 16GB hardware!

---

## Quantization Guide

### What is Quantization?

Quantization reduces the precision of model weights to shrink file size and RAM usage.

```
Full Precision (FP16): Each weight = 16 bits (2 bytes)
4-bit Quantized (Q4):  Each weight = 4 bits (0.5 bytes)
                       = 75% size reduction!
```

### Quantization Suffixes Explained

| Suffix | Bits | Quality | Size | Speed | Use Case |
|--------|------|---------|------|-------|----------|
| `fp16` / `bf16` | 16 | 100% | 1x | Slow | Research, max quality |
| `q8_0` | 8 | ~99% | 0.5x | Medium | Quality-focused |
| `q6_K` | 6 | ~97% | 0.4x | Medium | Good balance |
| `q5_K_M` | 5 | ~95% | 0.35x | Fast | **Recommended** |
| `q4_K_M` | 4 | ~90% | 0.25x | Fast | **Best for 16GB** |
| `q4_0` | 4 | ~85% | 0.25x | Fastest | Speed priority |
| `q3_K_M` | 3 | ~80% | 0.2x | Fastest | Tight RAM |
| `q2_K` | 2 | ~70% | 0.15x | Fastest | Last resort |

### Quantization Naming Convention

```
qwen2.5-coder:7b-instruct-q5_K_M
              │    │       │  │
              │    │       │  └── M = Medium (balanced quality/size)
              │    │       └───── K = K-quant method (better quality)
              │    └───────────── instruct = Chat/instruction tuned
              └────────────────── 7b = 7 billion parameters
```

### Quality vs Size Trade-off

```
Quality ████████████████████████████████████ 100%  FP16 (full)
        ███████████████████████████████████  99%   Q8
        █████████████████████████████████    97%   Q6_K
        ███████████████████████████████      95%   Q5_K_M ← Sweet spot
        █████████████████████████████        90%   Q4_K_M ← Best for 16GB
        ███████████████████████              85%   Q4_0
        █████████████████                    80%   Q3_K_M
        ███████████                          70%   Q2_K
```

---

## RAM Requirements

### Formula

```
Full Precision (FP16):
  RAM = Parameters (B) × 2 GB
  Example: 7B × 2 = 14GB

Quantized (Q4):
  RAM = Parameters (B) × 0.5 GB + 2GB overhead
  Example: 7B × 0.5 + 2 = 5.5GB
```

### Quick Reference Table

| Model Size | FP16 RAM | Q8 RAM | Q5 RAM | Q4 RAM | Fits 16GB? |
|------------|----------|--------|--------|--------|------------|
| **3B** | 6GB | 4GB | 3GB | 2.5GB | ✅ Any |
| **7B** | 14GB | 9GB | 6GB | 5GB | ✅ Q5 or lower |
| **13B** | 26GB | 15GB | 10GB | 8GB | ✅ Q4 only |
| **16B** | 32GB | 18GB | 12GB | 10GB | ⚠️ Q4, tight |
| **30B** | 60GB | 35GB | 22GB | 17GB | ⚠️ Q4 MoE only |
| **34B** | 68GB | 38GB | 25GB | 19GB | ❌ Too large |
| **70B** | 140GB | 75GB | 50GB | 38GB | ❌ Too large |

### Your M4 16GB Sweet Spots

```
✅ Perfect Fit:    3B-7B at Q5_K_M or Q4_K_M
✅ Good Fit:       13B at Q4_K_M
⚠️ Tight Fit:      16B at Q4_0, may swap
⚠️ MoE Exception:  30B-A3B (only 3B active) at Q4
❌ Won't Fit:      34B+ dense models
```

---

## Recommended Models for 16GB Mac

### Tier 1: Daily Drivers (Fast & Reliable)

| Model | Why | Speed | Quality |
|-------|-----|-------|---------|
| **Yi-Coder 9B** | Built for web dev (Python, JS, TS, Node) | 🚀🚀🚀 | ⭐⭐⭐⭐ |
| **Qwen2.5-Coder 7B** | Your current model, excellent all-rounder | 🚀🚀🚀 | ⭐⭐⭐⭐ |
| **DeepSeek-Coder-V2 16B** | GPT-4 level coding, MoE efficient | 🚀🚀 | ⭐⭐⭐⭐⭐ |
| **CodeGemma 7B** | Google's fast, lightweight coder | 🚀🚀🚀🚀 | ⭐⭐⭐ |

### Tier 2: Power Models (Complex Tasks)

| Model | Why | Speed | Quality |
|-------|-----|-------|---------|
| **Qwen3-Coder 30B-A3B** | 30B quality, only 3B active (MoE magic) | 🚀🚀 | ⭐⭐⭐⭐⭐ |
| **Codestral 22B** | Mistral's code specialist, 32K context | 🚀 | ⭐⭐⭐⭐⭐ |
| **CodeLlama 13B** | Meta's proven coder, good for Python | 🚀🚀 | ⭐⭐⭐⭐ |

### Tier 3: Specialists

| Model | Specialty | Best For |
|-------|-----------|----------|
| **StarCoder2 15B** | Multi-language, permissive license | Fine-tuning, open source projects |
| **Llama 3.2 3B** | Ultra-fast, general purpose | Quick chats, simple completions |
| **Mistral 7B** | Strong reasoning | Explaining code, documentation |

---

## Model Download Commands

### 🚀 Quick Start - Essential Models

```bash
# Your current setup (already have)
ollama pull qwen2.5-coder:7b-instruct-q5_K_M
ollama pull llama3.2:3b-instruct-q5_K_M

# Recommended additions
ollama pull yi-coder:9b                      # Best for web dev
ollama pull deepseek-coder-v2:16b            # GPT-4 level coding
```

### 📦 Full Model Library

#### Coding Specialists

```bash
# ══════════════════════════════════════════════════════════════
# QWEN FAMILY (Alibaba) - Excellent for Python & TypeScript
# ══════════════════════════════════════════════════════════════

# Qwen 2.5 Coder - Your current model, proven performer
ollama pull qwen2.5-coder:7b-instruct-q5_K_M     # 5GB - Daily driver
ollama pull qwen2.5-coder:7b-instruct-q4_K_M     # 4GB - Faster, slightly less quality
ollama pull qwen2.5-coder:14b-instruct-q4_K_M    # 9GB - Better reasoning
ollama pull qwen2.5-coder:32b-instruct-q4_K_M    # 20GB - Won't fit 16GB

# Qwen 3 Coder - Newest, agentic capabilities (MoE)
ollama pull qwen3-coder:30b                       # ~18GB - MoE, only 3B active!

# ══════════════════════════════════════════════════════════════
# DEEPSEEK FAMILY - GPT-4 Level Performance
# ══════════════════════════════════════════════════════════════

# DeepSeek Coder V2 - Rivals GPT-4 Turbo for coding
ollama pull deepseek-coder-v2:16b                # 10GB - Recommended
ollama pull deepseek-coder-v2:16b-lite-instruct-q4_K_M  # 6GB - Lighter

# DeepSeek Coder V1 - Still excellent
ollama pull deepseek-coder:6.7b                  # 4GB - Fast
ollama pull deepseek-coder:33b-instruct-q4_K_M   # 20GB - Won't fit

# DeepSeek V3 - Frontier model (needs 200GB+ RAM)
# ollama pull deepseek-v3                        # Too large for local

# ══════════════════════════════════════════════════════════════
# YI-CODER - Optimized for Web Development
# ══════════════════════════════════════════════════════════════

# Best for Python, JavaScript, TypeScript, Node, HTML, SQL
ollama pull yi-coder:9b                          # 6GB - Highly recommended!
ollama pull yi-coder:9b-chat                     # 6GB - Chat-tuned variant
ollama pull yi-coder:1.5b                        # 1GB - Ultra-light

# ══════════════════════════════════════════════════════════════
# CODELLAMA (Meta) - Battle-tested, Wide Language Support
# ══════════════════════════════════════════════════════════════

ollama pull codellama:7b-instruct                # 4GB - Fast
ollama pull codellama:13b-instruct               # 8GB - Better quality
ollama pull codellama:34b-instruct-q4_0          # 20GB - Won't fit
ollama pull codellama:7b-python                  # 4GB - Python specialist

# ══════════════════════════════════════════════════════════════
# CODESTRAL (Mistral) - Strong Reasoning, 32K Context
# ══════════════════════════════════════════════════════════════

ollama pull codestral:22b                        # 14GB - Tight fit
ollama pull codestral:22b-v0.1-q4_K_M            # 12GB - Quantized

# ══════════════════════════════════════════════════════════════
# CODEGEMMA (Google) - Lightweight, Fast
# ══════════════════════════════════════════════════════════════

ollama pull codegemma:7b                         # 5GB - Good all-rounder
ollama pull codegemma:7b-instruct                # 5GB - Chat-tuned
ollama pull codegemma:2b                         # 1.5GB - Ultra-fast

# ══════════════════════════════════════════════════════════════
# STARCODER2 - Permissive License, Great for Fine-tuning
# ══════════════════════════════════════════════════════════════

ollama pull starcoder2:15b                       # 10GB - Full featured
ollama pull starcoder2:7b                        # 5GB - Balanced
ollama pull starcoder2:3b                        # 2GB - Lightweight
```

#### General Purpose (Also Good for Coding)

```bash
# ══════════════════════════════════════════════════════════════
# LLAMA 3.x (Meta) - Excellent General + Coding
# ══════════════════════════════════════════════════════════════

ollama pull llama3.2:3b-instruct-q5_K_M          # 2GB - Fast general
ollama pull llama3.2:3b                          # 2GB - Base model
ollama pull llama3.1:8b-instruct-q5_K_M          # 5GB - Better reasoning

# ══════════════════════════════════════════════════════════════
# MISTRAL - Strong Reasoning
# ══════════════════════════════════════════════════════════════

ollama pull mistral:7b-instruct                  # 4GB - Great reasoning
ollama pull mistral-nemo:12b                     # 8GB - Newer, better

# ══════════════════════════════════════════════════════════════
# QWEN 2.5 General - Non-coder variants
# ══════════════════════════════════════════════════════════════

ollama pull qwen2.5:7b-instruct-q5_K_M           # 5GB - General purpose
ollama pull qwen2.5:14b-instruct-q4_K_M          # 9GB - Better reasoning
```

#### Embedding Models (For RAG)

```bash
# ══════════════════════════════════════════════════════════════
# EMBEDDING MODELS - For your memory/RAG system
# ══════════════════════════════════════════════════════════════

ollama pull nomic-embed-text                     # 137MB - Recommended
ollama pull mxbai-embed-large                    # 670MB - Higher accuracy
ollama pull all-minilm                           # 45MB - Ultra-light
```

### 🧹 Model Management Commands

```bash
# List all downloaded models
ollama list

# Show model details
ollama show qwen2.5-coder:7b-instruct-q5_K_M

# Remove a model
ollama rm codellama:7b-instruct

# Check disk usage
du -sh ~/.ollama/models

# Update a model
ollama pull qwen2.5-coder:7b-instruct-q5_K_M

# Run model interactively (test)
ollama run yi-coder:9b "Write a Python function to reverse a string"

# Keep model loaded in memory (faster responses)
OLLAMA_KEEP_ALIVE=-1 ollama serve
```

---

## Model Comparison Tables

### Coding Benchmarks (HumanEval)

Higher is better. HumanEval tests ability to write correct Python functions.

| Model | HumanEval | Pass@1 | Notes |
|-------|-----------|--------|-------|
| GPT-4 Turbo | 87% | - | Closed source baseline |
| Claude 3.5 Sonnet | 85% | - | Closed source baseline |
| **DeepSeek-Coder-V2 236B** | 81% | 90% | Best open source |
| **Qwen2.5-Coder 32B** | 79% | 87% | Excellent |
| **Qwen2.5-Coder 7B** | 68% | - | Your current model |
| **Yi-Coder 9B** | 65% | - | Web dev optimized |
| **CodeLlama 34B** | 62% | 77% | Proven performer |
| **DeepSeek-Coder-V2 16B** | 60% | - | Great for size |
| **StarCoder2 15B** | 58% | - | Permissive license |
| **CodeGemma 7B** | 52% | - | Fast & lightweight |

### Speed vs Quality (Your Hardware)

| Model | Tokens/sec* | Quality | RAM Used |
|-------|-------------|---------|----------|
| Llama 3.2 3B | ~80 t/s | ⭐⭐ | 3GB |
| CodeGemma 7B | ~45 t/s | ⭐⭐⭐ | 5GB |
| Yi-Coder 9B | ~35 t/s | ⭐⭐⭐⭐ | 6GB |
| Qwen2.5-Coder 7B (Q5) | ~40 t/s | ⭐⭐⭐⭐ | 5GB |
| DeepSeek-Coder-V2 16B | ~25 t/s | ⭐⭐⭐⭐⭐ | 10GB |
| Qwen3-Coder 30B (MoE) | ~20 t/s | ⭐⭐⭐⭐⭐ | 12GB |
| Codestral 22B (Q4) | ~15 t/s | ⭐⭐⭐⭐⭐ | 14GB |

*Approximate, varies by prompt length and system load

### Language Support Comparison

| Model | Python | TypeScript | JavaScript | React/Next.js | SQL |
|-------|--------|------------|------------|---------------|-----|
| **Yi-Coder 9B** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Qwen2.5-Coder 7B** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **DeepSeek-Coder-V2** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **CodeLlama 13B** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Codestral 22B** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **StarCoder2 15B** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## Configuration Examples

### Chat.tsx Model Selector

```typescript
// Recommended model configuration for Hacker Reign
const models = [
  // Fast - Daily coding
  { id: 'llama3.2:3b-instruct-q5_K_M', name: 'Llama 3.2', speed: '🚀' },
  
  // Balanced - Your current go-to
  { id: 'qwen2.5-coder:7b-instruct-q5_K_M', name: 'Vibe Coder', speed: '⚡' },
  
  // Web Dev Specialist
  { id: 'yi-coder:9b', name: 'Yi-Coder', speed: '🌐' },
  
  // Power - Complex tasks
  { id: 'deepseek-coder-v2:16b', name: 'DeepSeek V2', speed: '🧠' },
  
  // Agentic - Multi-file projects
  { id: 'qwen3-coder:30b', name: 'Qwen3 Agent', speed: '🎯' },
];
```

### Multi-Model Strategy

```typescript
// Strategy: Use different models for different tasks
const modelStrategy = {
  // Quick completions, simple questions
  quick: 'llama3.2:3b-instruct-q5_K_M',
  
  // Daily Python/TypeScript coding
  coding: 'qwen2.5-coder:7b-instruct-q5_K_M',
  
  // Full-stack web development
  webdev: 'yi-coder:9b',
  
  // Complex debugging, architecture decisions
  complex: 'deepseek-coder-v2:16b',
  
  // Multi-file refactoring, large codebases
  agentic: 'qwen3-coder:30b',
  
  // Embeddings for RAG/memory
  embedding: 'nomic-embed-text',
};
```

### Ollama Modelfile (Custom Configuration)

```dockerfile
# Save as: ~/.ollama/Modelfile.hackerreign
FROM qwen2.5-coder:7b-instruct-q5_K_M

# Optimized for coding tasks
PARAMETER temperature 0.3
PARAMETER top_p 0.85
PARAMETER top_k 40
PARAMETER repeat_penalty 1.2
PARAMETER num_ctx 16384
PARAMETER num_predict 5555

SYSTEM """You are Hacker Reign - a friendly coding expert specializing in Python and TypeScript/Next.js.

RULES:
- Respond in plain text, no markdown
- Be concise (1-3 sentences for simple questions)
- Write production-ready code
- Explain your reasoning briefly
"""
```

Create custom model:
```bash
ollama create hackerreign -f ~/.ollama/Modelfile.hackerreign
ollama run hackerreign
```

---

## Troubleshooting

### Model Won't Load

```bash
# Check available memory
vm_stat | grep "Pages free"

# Close other apps, then try
ollama run yi-coder:9b

# If still failing, try smaller quantization
ollama pull qwen2.5-coder:7b-instruct-q4_K_M
```

### Slow Generation

```bash
# Keep model loaded
OLLAMA_KEEP_ALIVE=-1 ollama serve

# Or set per-session
export OLLAMA_KEEP_ALIVE=-1

# Check if GPU is being used
ollama ps
```

### Out of Memory

```bash
# Use smaller model
ollama pull yi-coder:1.5b

# Or use more aggressive quantization
ollama pull qwen2.5-coder:7b-instruct-q4_0

# Clear cached models
ollama rm unused-model-name
```

---

## Quick Reference Card

### Best Models for Your Stack

| Task | Model | Command |
|------|-------|---------|
| **Python + TypeScript daily** | Yi-Coder 9B | `ollama pull yi-coder:9b` |
| **Quick responses** | Llama 3.2 3B | `ollama pull llama3.2:3b` |
| **Complex debugging** | DeepSeek-Coder-V2 | `ollama pull deepseek-coder-v2:16b` |
| **Multi-file refactor** | Qwen3-Coder 30B | `ollama pull qwen3-coder:30b` |
| **RAG embeddings** | Nomic Embed | `ollama pull nomic-embed-text` |

### Size Quick Guide

| RAM Available | Max Model Size | Best Option |
|---------------|----------------|-------------|
| 8GB | 7B Q4 | `codegamma:7b` |
| 16GB | 13B Q4 or 30B MoE | `yi-coder:9b` |
| 32GB | 30B Q5 | `codestral:22b` |
| 64GB+ | 70B Q4 | `llama3.1:70b` |

---

## Changelog

- **Jan 2026**: Initial version with M4 16GB optimizations
- Models tested: Qwen2.5-Coder, Yi-Coder, DeepSeek-Coder-V2, Qwen3-Coder

---

*Last Updated: January 9, 2026*
*Hardware: M4 MacBook Air 16GB*
*Ollama Version: Latest*