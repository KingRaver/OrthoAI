// lib/tools/handlers/calc.ts - Calculator Handler
type FunctionArguments = Record<string, any>;
import { evaluate } from 'mathjs'; // npm i mathjs @types/mathjs

export default async function calculator(args: FunctionArguments) {
  const { expression } = args as { expression: string };
  
  try {
    const result = evaluate(expression);
    return { expression, result: Number(result.toFixed(4)) };
  } catch (error) {
    throw new Error(`Invalid expression: ${expression}`);
  }
}