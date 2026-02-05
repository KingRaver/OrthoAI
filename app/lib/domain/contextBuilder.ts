/**
 * Context Builder
 * Orchestrates the domain context system:
 * 1. Detects user intent and context
 * 2. Applies user overrides (manual mode selection)
 * 3. Retrieves mode-specific system prompt
 * 4. Injects domain knowledge
 * 5. Returns complete system prompt
 */

import { ContextDetector, DetectionResult, DetectionMode, Domain } from './contextDetector';
import { getModeDefinition, InteractionMode } from './modeDefinitions';
import { formatDomainKnowledge } from './domainKnowledge';

// Re-export types for convenience
export type { Domain };

export interface ContextBuilderOptions {
  userInput: string;
  filePath?: string;
  manualModeOverride?: InteractionMode; // User explicitly selected a mode
  includeDomainKnowledge?: boolean; // Whether to inject domain context (default: true)
  includeDetectionReasoning?: boolean; // Log detection reasoning (default: false)
}

export interface BuiltContext {
  systemPrompt: string;
  mode: InteractionMode;
  detection: DetectionResult;
  modeOverridden: boolean;
  domainKnowledgeInjected: boolean;
}

/**
 * Main context builder class
 */
export class ContextBuilder {
  private static BASE_SYSTEM_PROMPT = `You are OrthoAI — an attending orthopedic surgeon and clinical advisor.
Speak like a senior clinician: decisive, pragmatic, and specific. Prioritize clinical decision-making, risk/benefit, and patient outcomes.
Be thorough and explanatory; include reasoning, differentials, and practical details. Avoid generic statements. When evidence is mixed, state the level of evidence and uncertainty plainly.
Ask 1-3 targeted clarifying questions when missing details would change assessment or management.`;

  /**
   * Build complete context and system prompt
   */
  static build(options: ContextBuilderOptions): BuiltContext {
    const {
      userInput,
      filePath,
      manualModeOverride,
      includeDomainKnowledge = true,
      includeDetectionReasoning = false,
    } = options;

    // Step 1: Detect context
    const detection = ContextDetector.detect(userInput, filePath);

    // Step 2: Determine final mode (user override takes precedence)
    const finalMode: InteractionMode = this.resolveFinalMode(detection.mode, manualModeOverride);
    const modeOverridden = manualModeOverride !== undefined && manualModeOverride !== detection.mode;

    // Step 3: Get mode-specific system prompt
    const modeDef = getModeDefinition(finalMode);
    let systemPrompt = `${this.BASE_SYSTEM_PROMPT}\n\n${modeDef.systemPrompt}`;

    // Step 4: Inject domain knowledge if applicable
    let domainKnowledgeInjected = false;
    if (includeDomainKnowledge && detection.domain) {
      const domainPrompt = formatDomainKnowledge(detection.domain);
      if (domainPrompt) {
        systemPrompt += '\n\n' + domainPrompt;
        domainKnowledgeInjected = true;
      }
    }

    // Step 5: Add detection reasoning if requested (helpful for debugging)
    if (includeDetectionReasoning) {
      systemPrompt += `\n\n[CONTEXT DETECTION - FOR REFERENCE ONLY]
Mode: ${finalMode}${modeOverridden ? ` (overridden from ${detection.mode})` : ' (auto-detected)'}
Confidence: ${ContextDetector.getConfidenceLevel(detection.confidence)} (${(detection.confidence * 100).toFixed(0)}%)
File Type: ${detection.fileType}
Domain: ${detection.domain || 'unknown'}
Complexity: ${detection.complexity}
Reasoning: ${detection.reasoning}`;
    }

    return {
      systemPrompt,
      mode: finalMode,
      detection,
      modeOverridden,
      domainKnowledgeInjected,
    };
  }

  /**
   * Resolve which mode to use (override beats detection)
   */
  private static resolveFinalMode(
    detectedMode: DetectionMode,
    manualOverride?: InteractionMode
  ): InteractionMode {
    if (manualOverride) {
      return manualOverride;
    }

    // Fall back to detected mode, or default to 'clinical-consult'
    return (detectedMode as InteractionMode) || 'clinical-consult';
  }

  /**
   * Build context for streaming LLM response
   * Returns the parts needed for streaming API calls
   */
  static buildForStreaming(options: ContextBuilderOptions) {
    const context = this.build(options);

    return {
      systemPrompt: context.systemPrompt,
      mode: context.mode,
      temperature: getModeDefinition(context.mode).temperatureSuggestion,
      maxTokens: getModeDefinition(context.mode).maxTokensSuggestion,
      // Useful metadata for debugging
      metadata: {
        modeOverridden: context.modeOverridden,
        domainDetected: context.detection.domain,
        confidence: context.detection.confidence,
      },
    };
  }

  /**
   * Format context info for logging
   */
  static formatContextInfo(context: BuiltContext): string {
    const lines = [
      `\n[Context Detection]`,
      `  Mode: ${context.mode}${context.modeOverridden ? ' (overridden)' : ' (auto-detected)'}`,
      `  Confidence: ${ContextDetector.getConfidenceLevel(context.detection.confidence)}`,
      `  Domain: ${context.detection.domain || 'unknown'}`,
      `  File Type: ${context.detection.fileType}`,
      `  Complexity: ${context.detection.complexity}`,
      `  Domain Knowledge: ${context.domainKnowledgeInjected ? '✓ Injected' : '✗ Not injected'}`,
      `  Reasoning: ${context.detection.reasoning}`,
    ];

    return lines.join('\n');
  }
}

/**
 * Convenience function for building context in API routes
 */
export async function buildContextForLLMCall(
  userMessage: string,
  filePath?: string,
  manualModeOverride?: InteractionMode
): Promise<{
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  mode: InteractionMode;
}> {
  const context = ContextBuilder.buildForStreaming({
    userInput: userMessage,
    filePath,
    manualModeOverride,
    includeDomainKnowledge: true,
    includeDetectionReasoning: process.env.DEBUG_CONTEXT === 'true',
  });

  // Log context detection if debugging
  if (process.env.DEBUG_CONTEXT === 'true') {
    const fullContext = ContextBuilder.build({
      userInput: userMessage,
      filePath,
      manualModeOverride,
      includeDomainKnowledge: true,
      includeDetectionReasoning: true,
    });
    console.log(ContextBuilder.formatContextInfo(fullContext));
  }

  return {
    systemPrompt: context.systemPrompt,
    temperature: context.temperature,
    maxTokens: context.maxTokens,
    mode: context.mode,
  };
}

/**
 * Example integration in LLM API route:
 * 
 * import { buildContextForLLMCall } from '@/lib/domain/contextBuilder';
 * 
 * export async function POST(req: NextRequest) {
 *   const {
 *     messages,
 *     filePath,
 *     manualModeOverride, // Optional: user selected a mode
 *   } = await req.json();
 * 
 *   const lastUserMessage = messages[messages.length - 1]?.content;
 * 
 *   // Build context with domain knowledge
 *   const llmContext = await buildContextForLLMCall(
 *     lastUserMessage,
 *     filePath,
 *     manualModeOverride
 *   );
 * 
 *   // Use in LLM call
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4',
 *     system: llmContext.systemPrompt,
 *     temperature: llmContext.temperature,
 *     max_tokens: llmContext.maxTokens,
 *     messages: [...messages],
 *   });
 * 
 *   return NextResponse.json(response);
 * }
 * 
 * 
 * Example usage with detection logging:
 * 
 * // In terminal, enable debugging:
 * // export DEBUG_CONTEXT=true
 * 
 * const context = ContextBuilder.build({
 *   userInput: 'Can you review this async code?',
 *   filePath: 'utils/fetch.py',
 *   includeDomainKnowledge: true,
 *   includeDetectionReasoning: true,
 * });
 * 
 * console.log(ContextBuilder.formatContextInfo(context));
 * // Output:
 * // [Context Detection]
 * //   Mode: clinical-consult (auto-detected)
 * //   Confidence: Very High
 * //   Domain: python-backend
 * //   File Type: python
 * //   Complexity: moderate
 * //   Domain Knowledge: ✓ Injected
 * //   Reasoning: Detected clinical-consult mode • paper content detected • Primary domain: orthopedics clinical
 */
