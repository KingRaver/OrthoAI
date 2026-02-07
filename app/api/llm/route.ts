import { NextRequest, NextResponse } from 'next/server';
import { getMemoryManager } from '../../lib/memory';
import { getTools, executeTools } from '../../lib/tools';
import { buildContextForLLMCall } from '../../lib/domain/contextBuilder';
import { strategyManager } from '@/app/lib/strategy/manager';
import type { StrategyDecision } from '@/app/lib/strategy/types';
import OpenAI from 'openai';
import { getDefaultModel, getLlmApiKey, getLlmBaseUrl, getLlmChatUrl, getLlmRequestTimeoutMs } from '@/app/lib/llm/config';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions';
import type { ChatCompletionMessage } from 'openai/resources/chat/completions';
import type { ClinicalReferenceItem, EvidenceRecord } from '@/app/lib/knowledge/phase5Types';

const DEBUG_METRICS = process.env.DEBUG_METRICS === 'true';

function truncateText(value: string, maxLength = 520): string {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

const openai = new OpenAI({
  baseURL: getLlmBaseUrl(),
  apiKey: getLlmApiKey(),
  timeout: getLlmRequestTimeoutMs(),
  maxRetries: 0
});

export const runtime = 'nodejs'; // Required for SQLite/Chroma
export const maxDuration = 3600; // 60 minutes max for complex queries (local dev - Vercel limit is 300s, but we need more time for chain workflows)

export async function POST(req: NextRequest) {
  // Declare strategy variables outside try block for error handling
  let strategyDecision: StrategyDecision | null = null;
  let strategyStartTime = Date.now();

  try {
    const {
      model: requestedModel = getDefaultModel(),
      messages,
      stream: requestedStream = true,
      enableTools: requestedEnableTools = false,
      conversationId = null,
      useMemory: requestedUseMemory = true,
      filePath, // Optional: file path for domain detection
      manualModeOverride, // Optional: user-selected mode ('clinical-consult' | 'surgical-planning' | 'complications-risk' | 'imaging-dx' | 'rehab-rtp' | 'evidence-brief')
      caseId, // Optional: patient case ID for context injection
      researchMode = false, // Optional: enables remote evidence refresh (PubMed/Cochrane)
    } = await req.json();

    // Initialize with requested values (may be overridden by strategy)
    let model = requestedModel;
    let stream = requestedStream;
    let enableTools = requestedEnableTools;

    const memory = getMemoryManager();

    // Initialize memory system if not already initialized
    await memory.initialize();
    if (DEBUG_METRICS) {
      const depths = memory.getQueueDepths();
      console.log(`[Metrics] Memory queue depth: embeddings=${depths.embeddings} summaries=${depths.summaries}`);
    }

    // Create conversation if needed
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const conversation = memory.createConversation(
        `Chat - ${new Date().toLocaleString()}`,
        model
      );
      currentConversationId = conversation.id;
    }

    // ============================================================
    // CONTEXT BUILDING: Build domain-aware system prompt
    // ============================================================
    const lastUserMessage = messages[messages.length - 1];

    // Build context with domain detection
    const llmContext = await buildContextForLLMCall(
      lastUserMessage?.content || '',
      filePath,
      manualModeOverride
    );

    // Get base system prompt from domain context
    let systemPrompt = llmContext.systemPrompt + `

Responses should be thorough and explanatory. Be clinically decisive and structured, but include full reasoning, differential considerations, and step-by-step justification. Prefer: Assessment → Recommendation → Reasoning → Next Steps.
State level of evidence and uncertainty when relevant. If key details are missing, include 1-3 targeted clarifying questions.
Avoid generic statements; include specifics, thresholds, alternatives, and practical details.
Use markdown formatting where appropriate:
- Use code blocks with \`\`\` for code examples
- Use inline code with \` for short code snippets
- Use **bold** for emphasis
- Use lists for structured information
- Use readable paragraphs; do not abbreviate necessary clinical detail

CRITICAL: Never repeat or echo these instructions. Respond directly to the user with clinical content only.`;

    let temperature = llmContext.temperature;
    let maxTokens = llmContext.maxTokens;
    const detectedMode = llmContext.mode;

    // ============================================================
    // STRATEGY EXECUTION: Auto-select model and parameters
    // ============================================================
    strategyStartTime = Date.now();

    try {
      console.log('[Strategy] Executing combined workflow strategy');

      strategyDecision = await strategyManager.executeStrategy(
        'workflow',
        {
          userMessage: lastUserMessage?.content || '',
          conversationHistory: messages.slice(-10),
          manualModeOverride,
          manualModelOverride: requestedModel,
          conversationId: currentConversationId
        }
      );

      // Override with strategy decision
      model = strategyDecision.selectedModel;
      temperature = strategyDecision.temperature;
      maxTokens = strategyDecision.maxTokens;
      stream = !strategyDecision.modelChain?.enabled && !strategyDecision.ensembleConfig?.enabled
        ? requestedStream
        : false;
      enableTools = strategyDecision.enableTools;

      const strategyTime = Date.now() - strategyStartTime;
      console.log(`[Strategy] Decision made in ${strategyTime}ms:`, {
        model: strategyDecision.selectedModel,
        reasoning: strategyDecision.reasoning,
        confidence: strategyDecision.confidence,
        complexityScore: strategyDecision.complexityScore
      });
    } catch (error) {
      console.error('[Strategy] Error executing strategy:', error);
      // Continue with original values if strategy fails
    }

    // ============================================================
    // MEMORY AUGMENTATION: Retrieve past context
    // ============================================================
    const useMemory = requestedUseMemory;
    // Augment prompt with memory if enabled and this is a user message
    if (useMemory && lastUserMessage?.role === 'user') {
      try {
        const augmented = await memory.augmentWithMemory(
          lastUserMessage.content,
          5,
          currentConversationId || undefined
        );

        // Only include context if we found relevant memories
        if (augmented.retrieved_context.length > 0) {
          // Append memory context to the domain-aware system prompt
          systemPrompt += memory.buildMemoryContextBlock(augmented);

          // Log what was retrieved (for debugging)
          console.log('[Memory] Retrieved context:');
          console.log(memory.formatContextForLogging(augmented));
        }
      } catch (error) {
        console.warn('[Memory] Error augmenting prompt:', error);
        // Continue without memory augmentation
      }
    }

    // ============================================================
    // CASE CONTEXT INJECTION: Add patient case context
    // ============================================================
    if (caseId) {
      try {
        const { getCaseManager } = await import('@/app/lib/cases');
        const caseManager = getCaseManager();
        const patientCase = caseManager.getCase(caseId);

        if (patientCase) {
          const events = caseManager.listEvents(caseId);

          // Build case context block
          let caseContext = `\n\n## Active Patient Case Context\n`;
          caseContext += `**Case:** ${patientCase.title}\n`;
          caseContext += `**Status:** ${patientCase.status}\n`;

          if (patientCase.demographics) {
            const demo = patientCase.demographics;
            const demoStr = [
              demo.age ? `Age: ${demo.age}` : null,
              demo.sex ? `Sex: ${demo.sex}` : null,
              demo.occupation ? `Occupation: ${demo.occupation}` : null,
            ].filter(Boolean).join(', ');
            if (demoStr) caseContext += `**Demographics:** ${demoStr}\n`;
          }

          if (patientCase.complaints) {
            caseContext += `**Chief Complaint:** ${patientCase.complaints}\n`;
          }

          if (patientCase.history) {
            caseContext += `**History:** ${patientCase.history}\n`;
          }

          if (patientCase.medications) {
            caseContext += `**Medications:** ${patientCase.medications}\n`;
          }

          if (patientCase.allergies) {
            caseContext += `**Allergies:** ${patientCase.allergies}\n`;
          }

          if (patientCase.tags.length > 0) {
            caseContext += `**Tags:** ${patientCase.tags.join(', ')}\n`;
          }

          // Add timeline events
          if (events.length > 0) {
            caseContext += `\n**Timeline:**\n`;
            events.slice(-10).forEach(event => {
              const date = event.occurred_at || event.created_at;
              const formattedDate = new Date(date).toLocaleDateString();
              caseContext += `- ${formattedDate} [${event.event_type}]: ${event.summary || 'No summary'}\n`;
            });
          }

          caseContext += `\nUse this patient context to provide relevant, personalized responses. Reference the case details when applicable.`;

          systemPrompt += caseContext;
          console.log(`[Case] Injected context for case: ${patientCase.title}`);

          // Link conversation to case if not already linked
          if (currentConversationId) {
            try {
              caseManager.linkConversation(caseId, currentConversationId);
            } catch {
              // Ignore if already linked
            }
          }
        }
      } catch (error) {
        console.warn('[Case] Error injecting case context:', error);
        // Continue without case context
      }
    }

    // ============================================================
    // KNOWLEDGE CONTEXT INJECTION: Retrieve relevant clinical knowledge
    // ============================================================
    if (lastUserMessage?.role === 'user') {
      try {
        const { getKnowledgeManager } = await import('@/app/lib/knowledge');
        const { getClinicalKnowledgeBase } = await import('@/app/lib/knowledge/clinicalKnowledgeBase');
        const km = getKnowledgeManager();
        const clinicalKnowledge = getClinicalKnowledgeBase();
        const query = lastUserMessage.content;

        // Search knowledge base for relevant content
        const knowledgeResults = await km.search(query, { limit: 3 });
        const shouldIncludeEvidence = detectedMode === 'evidence-brief' ||
          manualModeOverride === 'evidence-brief' ||
          Boolean(researchMode);

        let evidenceResults: EvidenceRecord[] = [];
        let referenceResults: ClinicalReferenceItem[] = [];

        if (shouldIncludeEvidence) {
          evidenceResults = await clinicalKnowledge.searchEvidence(query, {
            limit: researchMode ? 6 : 4,
            includeRemote: Boolean(researchMode),
            minEvidenceLevel: 'level-4'
          });
        }

        // Keep treatment-oriented reference snippets available to the model.
        referenceResults = clinicalKnowledge.searchReferenceItems(query, { limit: 4 });

        if (knowledgeResults.length > 0) {
          let knowledgeContext = `\n\n## Clinical Knowledge Context\n`;
          knowledgeContext += `The following relevant clinical knowledge may inform your response:\n\n`;

          for (const result of knowledgeResults) {
            const doc = result.document;
            const chunk = result.chunk;
            const score = result.similarity.toFixed(2);

            knowledgeContext += `**${doc.title}**`;
            if (doc.subspecialty) {
              knowledgeContext += ` (${doc.subspecialty})`;
            }
            knowledgeContext += ` [relevance: ${score}]\n`;
            knowledgeContext += `${chunk.content}\n\n`;
          }

          knowledgeContext += `Use this knowledge to provide evidence-based recommendations when applicable.`;
          systemPrompt += knowledgeContext;
          console.log(`[Knowledge] Injected ${knowledgeResults.length} relevant knowledge chunks`);
        }

        if (evidenceResults.length > 0) {
          let evidenceContext = `\n\n## Evidence Snapshot\n`;
          evidenceContext += `For major treatment recommendations, cite supporting evidence IDs (e.g., [EV1], [EV2]).\n\n`;

          evidenceResults.forEach((item, index) => {
            const evidenceId = `EV${index + 1}`;
            const level = item.evidence_level || 'ungraded';
            const date = item.publication_date ? new Date(item.publication_date).toLocaleDateString() : 'date n/a';
            const abstractSnippet = item.abstract_text ? truncateText(item.abstract_text, 340) : 'No abstract available.';
            evidenceContext += `[${evidenceId}] ${item.title}\n`;
            evidenceContext += `- Level: ${level} | Study: ${item.study_type || 'unspecified'} | Score: ${item.evidence_score.toFixed(2)}\n`;
            evidenceContext += `- Journal/Date: ${item.journal || 'Unknown journal'} (${date})\n`;
            evidenceContext += `- Source: ${item.source_key}${item.url ? ` | URL: ${item.url}` : ''}\n`;
            evidenceContext += `- Abstract: ${abstractSnippet}\n\n`;
          });

          evidenceContext += `When evidence is mixed, state disagreement explicitly and still provide a best-supported recommendation.`;
          systemPrompt += evidenceContext;
          console.log(`[Knowledge] Injected ${evidenceResults.length} evidence records`);
        }

        if (referenceResults.length > 0) {
          let referenceContext = `\n\n## Drug, Device, and Procedure Reference Snapshot\n`;
          referenceResults.forEach((item, index) => {
            const refId = `REF${index + 1}`;
            referenceContext += `[${refId}] (${item.category}) ${item.name}\n`;
            referenceContext += `- Summary: ${truncateText(item.summary, 240)}\n`;
            if (item.indications) {
              referenceContext += `- Indications: ${truncateText(item.indications, 200)}\n`;
            }
            if (item.contraindications) {
              referenceContext += `- Contraindications: ${truncateText(item.contraindications, 200)}\n`;
            }
            referenceContext += '\n';
          });

          referenceContext += `Use these references to ground implant, medication, injection, and DME/bracing recommendations.`;
          systemPrompt += referenceContext;
          console.log(`[Knowledge] Injected ${referenceResults.length} clinical reference items`);
        }
      } catch (error) {
        console.warn('[Knowledge] Error searching knowledge base:', error);
        // Continue without knowledge context
      }
    }

    // ============================================================
    // PREPARE MESSAGES FOR LLM
    // ============================================================
    const enhancedMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      ...messages.slice(-10), // Keep last 10 messages for context window
    ];

    // ============================================================
    // SAVE USER MESSAGE TO MEMORY
    // ============================================================
    if (lastUserMessage?.role === 'user') {
      try {
        await memory.saveMessage(
          currentConversationId,
          'user',
          lastUserMessage.content
        );
      } catch (error) {
        console.warn('[Memory] Error saving user message:', error);
      }
    }

    // ============================================================
    // WORKFLOW ORCHESTRATOR: Check for multi-model workflows
    // ============================================================
    if (strategyDecision && (strategyDecision.modelChain?.enabled || strategyDecision.ensembleConfig?.enabled)) {
      try {
        console.log('[Workflow] Executing multi-model workflow');

        const { MultiModelOrchestrator } = await import('@/app/lib/strategy/orchestrator');
        const workflowStart = Date.now();
        const workflowResult = await MultiModelOrchestrator.executeWorkflow(
          strategyDecision,
          enhancedMessages,
          lastUserMessage?.content || ''
        );
        if (DEBUG_METRICS) {
          console.log(`[Metrics] Workflow latency: ${Date.now() - workflowStart}ms`);
        }

        // Log workflow outcome
        if (strategyDecision.id) {
          await strategyManager.logOutcome(strategyDecision.id, {
            decisionId: strategyDecision.id,
            responseQuality: 0.9, // Workflows generally produce high quality
            responseTime: Date.now() - strategyStartTime,
            tokensUsed: workflowResult.tokensUsed,
            errorOccurred: false,
            retryCount: 0,
            userFeedback: undefined
          });
        }

        // Store assistant response and return
        await memory.saveMessage(currentConversationId, 'assistant', workflowResult.response, model);

        return new NextResponse(
          JSON.stringify({
            content: workflowResult.response,
            model: strategyDecision.selectedModel,
            strategy: strategyDecision.strategyName,
            workflowMetadata: workflowResult.workflowMetadata,
            decisionId: strategyDecision.id,
            metadata: {
              detectedTheme: strategyDecision.metadata?.detectedTheme,
              complexityScore: strategyDecision.complexityScore,
              temperature: temperature,
              maxTokens: maxTokens
            }
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error('[Workflow] Error executing workflow:', error);
        // Fall through to normal single-model execution
      }
    }

    // ============================================================
    // CALL LLM
    // ============================================================

    // For streaming: use fetch for manual control
    if (stream) {
      const llmRequestStart = Date.now();
      const body: {
        model: string;
        messages: ChatCompletionMessageParam[];
        temperature: number;
        top_p: number;
        max_tokens: number;
        stream: boolean;
        tools?: ReturnType<typeof getTools>;
        tool_choice?: 'auto';
      } = {
        model,
        messages: enhancedMessages,
        temperature: temperature,
        top_p: 0.85,
        max_tokens: maxTokens,
        stream: true,
      };

      if (enableTools) {
        const tools = getTools();
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const url = getLlmChatUrl();

      // Undici is configured globally in instrumentation.ts with no timeouts
      const timeoutMs = getLlmRequestTimeoutMs();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM server error: ${response.status} - ${error}`);
      }

    // ============================================================
    // HANDLE STREAMING RESPONSE
    // ============================================================
      // For streaming, collect the response and save to memory after
      let fullContent = '';

      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              const reader = response.body?.getReader();
              if (!reader) throw new Error('No response body');

              // Send metadata first for frontend feedback tracking
              if (strategyDecision) {
                const metadataChunk = {
                  type: 'metadata',
                  decisionId: strategyDecision.id,
                  conversationId: currentConversationId,
                  theme: strategyDecision.metadata?.detectedTheme,
                  complexity: strategyDecision.complexityScore,
                  temperature: temperature,
                  maxTokens: maxTokens,
                  modelUsed: model
                };
                controller.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify(metadataChunk)}\n\n`)
                );
              }

              const decoder = new TextDecoder();
              let buffer = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = (buffer + text).split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const json = JSON.parse(line.slice(6));
                      const content = json.choices[0]?.delta?.content || '';
                      if (content) {
                        fullContent += content;
                        controller.enqueue(new TextEncoder().encode(line + '\n'));
                      }
                    } catch {
                      // Invalid JSON, skip
                    }
                  }
                }
              }

              // Handle any remaining buffered line
              const finalLine = buffer.trim();
              if (finalLine.startsWith('data: ')) {
                try {
                  const json = JSON.parse(finalLine.slice(6));
                  const content = json.choices[0]?.delta?.content || '';
                  if (content) {
                    fullContent += content;
                    controller.enqueue(new TextEncoder().encode(finalLine + '\n'));
                  }
                } catch {
                  // Invalid JSON, skip
                }
              }

              // ============================================================
              // SAVE ASSISTANT RESPONSE TO MEMORY (after streaming)
              // ============================================================
              if (fullContent) {
                try {
                  await memory.saveMessage(
                    currentConversationId,
                    'assistant',
                    fullContent,
                    { model_used: model }
                  );
                } catch (error) {
                  console.warn('[Memory] Error saving assistant message:', error);
                }
              }

              // ============================================================
              // LOG STRATEGY OUTCOME (streaming)
              // ============================================================
              if (strategyDecision) {
                try {
                  const responseTime = Date.now() - strategyStartTime;
                  await strategyManager.logOutcome(strategyDecision.id, {
                    decisionId: strategyDecision.id,
                    responseQuality: 0.8, // Default quality, can be improved with feedback
                    responseTime: responseTime,
                    tokensUsed: fullContent.length / 4, // Rough estimate
                    errorOccurred: false,
                    retryCount: 0
                  });
                  console.log(`[Strategy] Outcome logged for decision ${strategyDecision.id}`);
                } catch (error) {
                  console.warn('[Strategy] Error logging outcome:', error);
                }
              }

              if (DEBUG_METRICS) {
                console.log(`[Metrics] LLM streaming latency: ${Date.now() - llmRequestStart}ms`);
              }

              controller.close();
            } catch (error) {
              console.error('[Stream] Error:', error);
              controller.error(error);
            }
          },
        }),
        {
          headers: { 'Content-Type': 'text/event-stream' },
        }
      );
    }

    // ============================================================
    // HANDLE NON-STREAMING RESPONSE (using OpenAI SDK)
    // ============================================================
    // Use OpenAI SDK for non-streaming with proper types
    const llmRequestStart = Date.now();
    const completion = await openai.chat.completions.create({
      model,
      messages: enhancedMessages,
      temperature: temperature,
      top_p: 0.85,
      max_tokens: maxTokens,
      stream: false,
      tools: enableTools ? getTools() : undefined,
      tool_choice: enableTools ? 'auto' : undefined,
    });

    let currentCompletion = completion;
    let allMessages = enhancedMessages;

    // Tool looping with OpenAI SDK
    if (enableTools) {
      let loopCount = 0;
      const maxLoops = 5;

      while (true) {
        const message = currentCompletion.choices[0].message;

        // Check for proper tool_calls format
        if (message.tool_calls?.length) {
          loopCount++;
          if (loopCount > maxLoops) {
            throw new Error('Max tool loop iterations reached');
          }

          const toolCalls = message.tool_calls.filter(
            (tc): tc is ChatCompletionMessageFunctionToolCall =>
              tc.type === 'function'
          );
          allMessages.push(message as ChatCompletionMessageParam);
          allMessages = await executeTools(toolCalls, allMessages);

          // Make another call with the updated messages
          currentCompletion = await openai.chat.completions.create({
            model,
            messages: allMessages,
            max_tokens: maxTokens,
            stream: false,
          });
          continue;
        }

        // WORKAROUND: Some local servers return tool calls as text content
        // Try to parse content as a tool call
        if (message.content && typeof message.content === 'string') {
          const content = message.content.trim();

          // Check if content looks like a tool call JSON
          if ((content.startsWith('{') && content.includes('"name"')) ||
              (content.startsWith('```json') && content.includes('"name"'))) {
            try {
              // Extract JSON from code blocks if present
              let jsonStr = content;
              if (content.startsWith('```')) {
                const match = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
                if (match) jsonStr = match[1];
              }

              const toolCall = JSON.parse(jsonStr);

              if (toolCall.name && toolCall.arguments) {
                loopCount++;
                if (loopCount > maxLoops) {
                  throw new Error('Max tool loop iterations reached');
                }

                console.log('[Tool Workaround] Detected tool call in content:', toolCall.name);

                // Convert to proper tool_calls format
                const syntheticToolCall: ChatCompletionMessageFunctionToolCall = {
                  id: `call_${Date.now()}`,
                  type: 'function' as const,
                  function: {
                    name: toolCall.name,
                    arguments: JSON.stringify(toolCall.arguments)
                  }
                };

                // Add assistant message without the tool call content
                allMessages.push({
                  role: 'assistant',
                  content: null,
                  tool_calls: [syntheticToolCall]
                });

                // Execute the tool
                allMessages = await executeTools([syntheticToolCall], allMessages);

                // Make another call with the updated messages
                currentCompletion = await openai.chat.completions.create({
                  model,
                  messages: allMessages,
                  max_tokens: maxTokens,
                  stream: false,
                });
                continue;
              }
            } catch (e) {
              // Not a valid tool call JSON, treat as normal content
              console.log('[Tool Workaround] Content is not a valid tool call:', e);
            }
          }
        }

        // No tool calls found, exit loop
        break;
      }
    }

    const assistantMessage = currentCompletion.choices[0].message.content || '';
    if (DEBUG_METRICS) {
      console.log(`[Metrics] LLM latency: ${Date.now() - llmRequestStart}ms`);
    }

    // ============================================================
    // SAVE ASSISTANT RESPONSE TO MEMORY (non-streaming)
    // ============================================================
    try {
      await memory.saveMessage(
        currentConversationId,
        'assistant',
        assistantMessage,
        { model_used: model }
      );
    } catch (error) {
      console.warn('[Memory] Error saving assistant message:', error);
    }

    // ============================================================
    // LOG STRATEGY OUTCOME (non-streaming)
    // ============================================================
    if (strategyDecision) {
      try {
        const responseTime = Date.now() - strategyStartTime;
        const tokensUsed = currentCompletion.usage?.total_tokens || assistantMessage.length / 4;

        await strategyManager.logOutcome(strategyDecision.id, {
          decisionId: strategyDecision.id,
          responseQuality: 0.8, // Default quality, can be improved with feedback
          responseTime: responseTime,
          tokensUsed: tokensUsed,
          errorOccurred: false,
          retryCount: 0
        });
        console.log(`[Strategy] Outcome logged for decision ${strategyDecision.id}`);
      } catch (error) {
        console.warn('[Strategy] Error logging outcome:', error);
      }
    }

    // Return response with conversation ID, auto-selected model, decision ID, and learning metadata
    type LlmResponsePayload = ChatCompletionMessage & {
      conversationId: string | null;
      autoSelectedModel: string;
      decisionId?: string;
      metadata?: {
        detectedTheme?: string;
        complexityScore: number;
        temperature: number;
        maxTokens: number;
      };
      modeUsed?: string;
    };

    const responsePayload: LlmResponsePayload = {
      ...currentCompletion.choices[0].message,
      conversationId: currentConversationId,
      autoSelectedModel: model,
      decisionId: strategyDecision ? strategyDecision.id : undefined,
      metadata: strategyDecision ? {
        detectedTheme: strategyDecision.metadata?.detectedTheme as string | undefined,
        complexityScore: strategyDecision.complexityScore,
        temperature: temperature,
        maxTokens: maxTokens
      } : undefined,
      modeUsed: manualModeOverride || detectedMode
    };

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    console.error('[LLM API] Error:', error);

    // Log error outcome if strategy was used
    if (strategyDecision) {
      try {
        const responseTime = Date.now() - strategyStartTime;
        await strategyManager.logOutcome(strategyDecision.id, {
          decisionId: strategyDecision.id,
          responseQuality: 0,
          responseTime: responseTime,
          tokensUsed: 0,
          errorOccurred: true,
          retryCount: 0
        });
      } catch (logError) {
        console.warn('[Strategy] Error logging failed outcome:', logError);
      }
    }

    const message = error instanceof Error ? error.message : 'LLM request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
