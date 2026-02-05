// lib/tools/executor.ts - Fixed role type issue
import type { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from 'openai/resources/chat';

type ChatCompletionMessageToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type FunctionArguments = Record<string, any>;

// Map tool names to handler file names
const toolHandlerMap: Record<string, string> = {
  'get_weather': 'weather',
  'calculator': 'calc',
  'code_exec': 'code-exec'
};

export async function executeTools(
  toolCalls: ChatCompletionMessageToolCall[],
  messages: ChatCompletionMessageParam[]
): Promise<ChatCompletionMessageParam[]> {

  for (const toolCall of toolCalls) {
    if (toolCall.type !== 'function') {
      console.warn('Non-function tool call:', toolCall);
      continue;
    }

    const toolFn = toolCall.function;
    const toolName = toolFn.name;

    try {
      // Map tool name to handler file name
      const handlerFileName = toolHandlerMap[toolName];
      if (!handlerFileName) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      console.log(`[Tool Executor] Loading handler for ${toolName} from ./handlers/${handlerFileName}`);

      const module = await import(`./handlers/${handlerFileName}`);
      const handler = module.default as (args: FunctionArguments) => Promise<any>;

      if (!handler) {
        throw new Error(`No default handler in ${handlerFileName}`);
      }
      
      let args: FunctionArguments;
      try {
        args = JSON.parse(toolFn.arguments ?? '{}');
        console.log(`[Tool Executor] Parsed arguments for ${toolName}:`, args);
      } catch (parseError) {
        throw new Error(`Invalid tool arguments JSON: ${toolFn.arguments}`);
      }

      console.log(`[Tool Executor] Executing ${toolName}...`);
      const result = await handler(args);
      console.log(`[Tool Executor] ${toolName} result:`, result);

      // Use type assertion - SDK allows 'tool' role for tool responses
      const toolMessage: ChatCompletionToolMessageParam = {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: typeof result === 'string' ? result : JSON.stringify(result)
      };
      messages.push(toolMessage);

    } catch (error) {
      console.error(`[Tool Executor] Tool ${toolName} failed:`, error);
      console.error(`[Tool Executor] Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');

      const errorMessage: ChatCompletionToolMessageParam = {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({
          error: error instanceof Error ? error.message : 'Execution failed',
          tool: toolName
        })
      };
      messages.push(errorMessage);
    }
  }

  console.log(`[Tool Executor] Completed ${toolCalls.length} tool call(s)`);
  return messages;
}