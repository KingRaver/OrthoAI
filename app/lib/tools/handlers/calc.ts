// lib/tools/handlers/calc.ts - Calculator Handler
import { evaluate } from 'mathjs'; // npm i mathjs @types/mathjs

type FunctionArguments = Record<string, unknown>;
type CalculatorArgs = { expression: string };

const isCalculatorArgs = (args: FunctionArguments): args is CalculatorArgs =>
  typeof args.expression === 'string';

export default async function calculator(args: FunctionArguments) {
  if (!isCalculatorArgs(args)) {
    throw new Error('Invalid expression: missing expression');
  }

  const { expression } = args;

  try {
    const result = evaluate(expression);
    const numeric = typeof result === 'number' ? result : Number(result);
    if (!Number.isFinite(numeric)) {
      throw new Error('Expression did not evaluate to a finite number');
    }
    return { expression, result: Number(numeric.toFixed(4)) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid expression: ${expression}${message ? ` (${message})` : ''}`);
  }
}
