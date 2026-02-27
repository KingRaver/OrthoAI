import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';
import { executeTools } from '@/app/lib/tools/executor';
import { getTools } from '@/app/lib/tools';

function getFunctionToolNames(tools: ReturnType<typeof getTools>): string[] {
  return tools
    .filter(
      (tool): tool is Extract<(typeof tools)[number], { type: 'function'; function: { name: string } }> =>
        tool.type === 'function' && !!tool.function?.name
    )
    .map(tool => tool.function.name);
}

function makeToolCall(
  id: string,
  name: string,
  args: string
): ChatCompletionMessageFunctionToolCall {
  return {
    id,
    type: 'function',
    function: {
      name,
      arguments: args,
    },
  } as unknown as ChatCompletionMessageFunctionToolCall;
}

describe('tools', () => {
  afterEach(() => {
    delete process.env.ENABLE_GENERIC_TOOLS;
    delete process.env.ENABLE_CODE_EXEC;
    vi.restoreAllMocks();
  });

  it('gates tool availability behind environment flags', () => {
    process.env.ENABLE_GENERIC_TOOLS = 'false';
    expect(getTools()).toEqual([]);

    process.env.ENABLE_GENERIC_TOOLS = 'true';
    process.env.ENABLE_CODE_EXEC = 'false';
    const standardTools = getTools();
    const names = getFunctionToolNames(standardTools);

    expect(names).toContain('get_weather');
    expect(names).toContain('calculator');
    expect(names).not.toContain('code_exec');

    process.env.ENABLE_CODE_EXEC = 'true';
    const allTools = getFunctionToolNames(getTools());
    expect(allTools).toContain('code_exec');
  });

  it('executes calculator tool calls and appends tool messages', async () => {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: 'calculate 2 + 2' },
    ];

    const result = await executeTools(
      [makeToolCall('tool_1', 'calculator', JSON.stringify({ expression: '2 + 2' }))],
      messages
    );

    expect(result).toHaveLength(2);
    const toolMessage = result[1];
    expect(toolMessage.role).toBe('tool');

    if (typeof toolMessage.content !== 'string') {
      throw new Error('Expected tool content to be a string');
    }

    const parsed = JSON.parse(toolMessage.content) as { expression: string; result: number };
    expect(parsed.expression).toBe('2 + 2');
    expect(parsed.result).toBe(4);
  });

  it('returns structured tool errors for unknown tools and invalid arguments', async () => {
    const unknownResult = await executeTools(
      [makeToolCall('tool_2', 'unknown_tool', '{}')],
      []
    );

    const unknownContent = unknownResult[0].content;
    if (typeof unknownContent !== 'string') {
      throw new Error('Expected tool content to be a string');
    }

    const unknownParsed = JSON.parse(unknownContent) as { error: string; tool: string };
    expect(unknownParsed.error).toContain('Unknown tool');
    expect(unknownParsed.tool).toBe('unknown_tool');

    const invalidArgsResult = await executeTools(
      [makeToolCall('tool_3', 'calculator', '{not-json')],
      []
    );

    const invalidContent = invalidArgsResult[0].content;
    if (typeof invalidContent !== 'string') {
      throw new Error('Expected tool content to be a string');
    }

    const invalidParsed = JSON.parse(invalidContent) as { error: string; tool: string };
    expect(invalidParsed.error).toContain('Invalid tool arguments JSON');
    expect(invalidParsed.tool).toBe('calculator');
  });
});
