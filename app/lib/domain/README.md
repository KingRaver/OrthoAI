# OrthoAI Domain Context System

Orthopedic research context detection and prompt injection for OrthoAI.

## What It Does
- Detects **mode**: synthesis, mechanistic, hypothesis, study-design
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
  userInput: 'Compare outcomes of surgical repair vs conservative management in Achilles rupture',
  includeDomainKnowledge: true
});

console.log(context.mode); // synthesis
```

## Extension Points
- Add new domains in `domainKnowledge.ts`
- Add new modes in `modeDefinitions.ts`
- Update detection patterns in `contextDetector.ts`
