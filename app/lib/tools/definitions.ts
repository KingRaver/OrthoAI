// lib/tools/definitions.ts - JSON Schemas
import type { ChatCompletionTool } from 'openai/resources';

export const weatherTool: ChatCompletionTool[] = [{
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name (e.g., "New York")'
        }
      },
      required: ['city']
    }
  }
}];

export const calcTool: ChatCompletionTool[] = [{
  type: 'function',
  function: {
    name: 'calculator',
    description: 'Perform mathematical calculations including basic arithmetic, advanced functions (sqrt, sin, cos, log), and unit conversions',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Math expression to evaluate (e.g., "15 * 7 + 3", "sqrt(16)", "sin(pi/2)", "5 cm to inch")'
        }
      },
      required: ['expression']
    }
  }
}];

export const codeExecTool: ChatCompletionTool[] = [{
  type: 'function',
  function: {
    name: 'code_exec',
    description: 'Execute safe Python or JavaScript code snippets in an isolated sandbox environment',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Code to execute'
        },
        language: {
          type: 'string',
          enum: ['python', 'py', 'javascript', 'js'],
          description: 'Programming language to use (default: python)',
          default: 'python'
        }
      },
      required: ['code']
    }
  }
}];