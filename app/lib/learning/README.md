# Continuous Learning & Adaptation (OrthoAI)

## Overview

OrthoAI’s learning system continuously improves model selection and generation parameters based on your feedback. It is designed for attending-level orthopedic clinical workflows (clinical consults, surgical planning, complications/risk, imaging dx, rehab/RTP, evidence briefs), not coding tasks.

## Key Features Implemented

### 1. User Feedback Collection
**Location**: `components/Chat.tsx`

- **Thumbs Up/Down** feedback for every assistant response
- **Immediate UI feedback** and async logging
- **Applies to all modes** (Auto, Clinical Consult, Surgical Planning, Complications/Risk, Imaging Dx, Rehab/RTP, Evidence Brief)

### 2. Feedback API + Learning Integration
**Location**: `app/api/feedback/route.ts`

Records feedback across multiple learning layers:
- **Strategy outcomes** (only when strategy is enabled)
- **Mode analytics** (tracks which mode performed best)
- **Theme patterns** (learns themes from user prompts)
- **Parameter tuning** (temperature/maxTokens/tool usage)
- **Quality prediction** (historical outcome modeling)

### 3. Pattern Recognition (Orthopedic Themes)
**Location**: `app/lib/learning/patternRecognition.ts`

Detects core orthopedic clinical themes:
- `clinical-consult`
- `surgical-planning`
- `complications-risk`
- `imaging-dx`
- `rehab-rtp`
- `evidence-brief`

Learns which models and parameters perform best for each theme.

### 4. Dynamic Parameter Tuning
**Location**: `app/lib/learning/parameterTuner.ts`

- Buckets complexity (0–33, 34–66, 67–100)
- Learns optimal temperature and token limits per theme/complexity
- Enables tools only when confidence is high

### 5. Adaptive Strategy (ML‑Driven)
**Location**: `app/lib/strategy/implementations/adaptiveStrategy.ts`

Uses:
- Theme detection
- Historical strategy performance
- Parameter tuning recommendations
- System resource constraints

To decide between BioMistral and BioGPT and set parameters.

### 6. Quality Prediction Model
**Location**: `app/lib/learning/qualityPredictor.ts`

Predicts expected response quality before generation based on:
- Theme match
- Complexity alignment
- Model history
- Parameter optimality

---

## Notes

This learning system is scoped to orthopedic clinical workflows. If you expand OrthoAI into new domains, update theme patterns and parameter heuristics accordingly.
