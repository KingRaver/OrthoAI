// lib/tools/index.ts
import type { ChatCompletionTool } from 'openai/resources';
import { weatherTool, calcTool, codeExecTool } from './definitions';

export const getTools = (): ChatCompletionTool[] => {
  if (process.env.ENABLE_GENERIC_TOOLS !== 'true') {
    return [];
  }
  const tools = [...weatherTool, ...calcTool];
  if (process.env.ENABLE_CODE_EXEC === 'true') {
    tools.push(...codeExecTool);
  }
  return tools;
};

export type ToolName = 'get_weather' | 'calculator' | 'code_exec';
export { executeTools } from './executor';
