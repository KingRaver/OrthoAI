import { NextRequest, NextResponse } from 'next/server';
import { getMemoryManager } from '../../lib/memory';
import { getTools, executeTools } from '../../lib/tools';
import { buildContextForLLMCall } from '../../lib/domain/contextBuilder';
import { strategyManager } from '@/app/lib/strategy/manager';
import type { StrategyDecision, StrategyType } from '@/app/lib/strategy/types';
import OpenAI from 'openai';
import { getDefaultModel, getLlmApiKey, getLlmBaseUrl, getLlmChatUrl } from '@/app/lib/llm/config';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

const openai = new OpenAI({
  baseURL: getLlmBaseUrl(),
  apiKey: getLlmApiKey(),
  timeout: 3600000, // 1 hour timeout (milliseconds)
  maxRetries: 0
});

export const runtime = 'nodejs'; // Required for SQLite/Chroma
export const maxDuration = 3600; // 60 minutes max for complex queries (local dev - Vercel limit is 300s, but we need more time for chain workflows)

export async function POST(req: NextRequest) {
  // Declare strategy variables outside try block for error handling
  let strategyEnabled = false;
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
      manualModeOverride, // Optional: user-selected mode ('synthesis' | 'mechanistic' | 'hypothesis' | 'study-design')
      strategyEnabled: requestStrategyEnabled = false, // NEW: Strategy system toggle
      selectedStrategy = 'balanced', // NEW: Which strategy to use
      workflowMode = 'auto', // NEW: Workflow mode ('auto' | 'chain' | 'ensemble')
    } = await req.json();

    // Update outer scope variables
    strategyEnabled = requestStrategyEnabled;

    // Initialize with requested values (may be overridden by strategy)
    let model = requestedModel;
    let stream = requestedStream;
    let enableTools = requestedEnableTools;

    const memory = getMemoryManager();

    // Initialize memory system if not already initialized
    await memory.initialize();

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

Keep responses clear, concise, and helpful. Use markdown formatting where appropriate:
- Use code blocks with \`\`\` for code examples
- Use inline code with \` for short code snippets
- Use **bold** for emphasis
- Use lists for structured information
- Keep responses 1-3 sentences per concept when possible`;

    let temperature = llmContext.temperature;
    let maxTokens = llmContext.maxTokens;
    const detectedMode = llmContext.mode;

    // ============================================================
    // STRATEGY EXECUTION: Auto-select model and parameters
    // ============================================================
    strategyStartTime = Date.now();

    if (strategyEnabled) {
      try {
        console.log(`[Strategy] Executing strategy: ${selectedStrategy}`);

        // If workflow strategy is selected, configure the workflow mode
        if (selectedStrategy === 'workflow') {
          const { WorkflowStrategy } = await import('@/app/lib/strategy/implementations/workflowStrategy');
          const workflowStrategy = strategyManager['strategies'].get('workflow') as InstanceType<typeof WorkflowStrategy>;
          if (workflowStrategy && 'setWorkflowMode' in workflowStrategy) {
            workflowStrategy.setWorkflowMode(workflowMode as 'auto' | 'chain' | 'ensemble');
            console.log(`[Workflow] Mode set to: ${workflowMode}`);
          }
        }

        strategyDecision = await strategyManager.executeStrategy(
          selectedStrategy as StrategyType,
          {
            userMessage: lastUserMessage?.content || '',
            conversationHistory: messages.slice(-10),
            manualModeOverride,
            manualModelOverride: requestedModel
          }
        );

        // Override with strategy decision
        model = strategyDecision.selectedModel;
        temperature = strategyDecision.temperature;
        maxTokens = strategyDecision.maxTokens;
        stream = strategyDecision.streaming;
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
    if (strategyEnabled && strategyDecision && (strategyDecision.modelChain?.enabled || strategyDecision.ensembleConfig?.enabled)) {
      try {
        console.log('[Workflow] Executing multi-model workflow');

        const { MultiModelOrchestrator } = await import('@/app/lib/strategy/orchestrator');
        const workflowResult = await MultiModelOrchestrator.executeWorkflow(
          strategyDecision,
          enhancedMessages,
          lastUserMessage?.content || ''
        );

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
    // ============================================================
    // CREATE MODE INTERACTION (before streaming/non-streaming)
    // ============================================================
    // Store the modeInteractionId to return to frontend for voting
    let modeInteractionId: string | undefined = undefined;

    if (!strategyEnabled) {
      try {
        const { modeAnalytics } = await import('@/app/lib/domain/modeAnalytics');
        const currentMode = manualModeOverride || detectedMode;
        modeInteractionId = `mode_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        await modeAnalytics.logInteraction({
          id: modeInteractionId,
          mode: currentMode,
          modelUsed: model,
          responseQuality: 0.8, // Default, will be updated by user feedback
          responseTime: 0, // Will be updated after response completes
          tokensUsed: 0, // Will be updated after response completes
          userFeedback: null
        });
        console.log(`[Mode] Interaction logged: ${currentMode} (${modeInteractionId})`);
      } catch (error) {
        console.warn('[Mode] Error logging interaction:', error);
      }
    }

    if (stream) {
      const body: any = {
        model,
        messages: enhancedMessages,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.85,
        stream: true,
      };

      if (enableTools) {
        const tools = getTools();
        body.tools = tools;
        body.tool_choice = 'auto';
      }

      const url = getLlmChatUrl();

      // Undici is configured globally in instrumentation.ts with no timeouts
      const timeoutMs = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || '0', 10);
      const controller = timeoutMs > 0 ? new AbortController() : null;
      const timeoutId = timeoutMs > 0
        ? setTimeout(() => controller?.abort(), timeoutMs)
        : null;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        body: JSON.stringify(body),
        signal: controller?.signal
      });
      if (timeoutId) clearTimeout(timeoutId);

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
              // Either strategy decision or mode interaction
              if (strategyEnabled && strategyDecision) {
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
              } else if (modeInteractionId) {
                // Send mode interaction ID for voting without strategy
                const metadataChunk = {
                  type: 'metadata',
                  decisionId: modeInteractionId,
                  conversationId: currentConversationId,
                  mode: manualModeOverride || detectedMode,
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
              if (strategyEnabled && strategyDecision) {
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

              // ============================================================
              // UPDATE MODE INTERACTION METRICS (streaming)
              // ============================================================
              if (!strategyEnabled && modeInteractionId) {
                try {
                  const { modeAnalytics } = await import('@/app/lib/domain/modeAnalytics');
                  const responseTime = Date.now() - strategyStartTime;
                  const tokensUsed = Math.floor(fullContent.length / 4); // Rough estimate

                  // Update with actual metrics (quality will be updated by user feedback later)
                  await modeAnalytics.updateMetrics(modeInteractionId, responseTime, tokensUsed);
                  console.log(`[Mode] Metrics updated: ${modeInteractionId} (${responseTime}ms, ${tokensUsed} tokens)`);
                } catch (error) {
                  console.warn('[Mode] Error updating metrics:', error);
                }
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
    const completion = await openai.chat.completions.create({
      model,
      messages: enhancedMessages,
      max_tokens: maxTokens,
      temperature: temperature,
      top_p: 0.85,
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

          const toolCalls = message.tool_calls;
          allMessages.push(message as ChatCompletionMessageParam);
          allMessages = await executeTools(toolCalls as any, allMessages);

          // Make another call with the updated messages
          currentCompletion = await openai.chat.completions.create({
            model,
            messages: allMessages,
            stream: false,
          } as any);
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
                const syntheticToolCall = {
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
                } as any);

                // Execute the tool
                allMessages = await executeTools([syntheticToolCall] as any, allMessages);

                // Make another call with the updated messages
                currentCompletion = await openai.chat.completions.create({
                  model,
                  messages: allMessages,
                  stream: false,
                } as any);
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
    if (strategyEnabled && strategyDecision) {
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

    // ============================================================
    // UPDATE MODE INTERACTION METRICS (non-streaming)
    // ============================================================
    if (!strategyEnabled && modeInteractionId) {
      try {
        const { modeAnalytics } = await import('@/app/lib/domain/modeAnalytics');
        const responseTime = Date.now() - strategyStartTime;
        const tokensUsed = currentCompletion.usage?.total_tokens || Math.floor(assistantMessage.length / 4);

        await modeAnalytics.updateMetrics(modeInteractionId, responseTime, tokensUsed);
        console.log(`[Mode] Metrics updated: ${modeInteractionId} (${responseTime}ms, ${tokensUsed} tokens)`);
      } catch (error) {
        console.warn('[Mode] Error updating metrics:', error);
      }
    }

    // Return response with conversation ID, auto-selected model, decision ID, and learning metadata
    const responsePayload: any = {
      ...currentCompletion.choices[0].message,
      conversationId: currentConversationId,
      autoSelectedModel: strategyEnabled ? model : undefined,
      // Return either strategy decisionId or mode interactionId for voting
      decisionId: strategyEnabled && strategyDecision ? strategyDecision.id : modeInteractionId,
      metadata: strategyEnabled && strategyDecision ? {
        detectedTheme: strategyDecision.metadata?.detectedTheme,
        complexityScore: strategyDecision.complexityScore,
        temperature: temperature,
        maxTokens: maxTokens
      } : undefined,
      modeUsed: strategyEnabled ? undefined : (manualModeOverride || detectedMode)
    };

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('[LLM API] Error:', error);

    // Log error outcome if strategy was used
    if (strategyEnabled && strategyDecision) {
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

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
