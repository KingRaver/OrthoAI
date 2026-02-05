# OrthoAI Domain Context System

Orthopedic clinical context detection and prompt injection for OrthoAI.

## What It Does
- Detects **mode**: clinical-consult, surgical-planning, complications-risk, imaging-dx, rehab-rtp, evidence-brief
- Detects **domain**: clinical, surgical, biomechanics, tissue biology, imaging, rehabilitation
- Builds a system prompt with domain knowledge + mode-specific instructions

## Core Files
```
app/lib/domain/
├── contextDetector.ts    # Detects mode/domain/complexity
├── domainKnowledge.ts    # Orthopedic domain knowledge blocks
├── modeDefinitions.ts    # System prompts per mode
└── contextBuilder.ts     # Orchestrates prompt assembly
```

## Example
```ts
import { ContextBuilder } from './contextBuilder';

const context = ContextBuilder.build({
  userInput: 'Middle-aged runner with Achilles rupture asking operative vs nonoperative options',
  includeDomainKnowledge: true
});

console.log(context.mode); // clinical-consult
```

## Extension Points
- Add new domains in `domainKnowledge.ts`
- Add new modes in `modeDefinitions.ts`
- Update detection patterns in `contextDetector.ts`
