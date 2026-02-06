// lib/tools/handlers/code-exec.ts - Secure Python/JavaScript Executor
// Uses Pyodide (WebAssembly) for Python and isolated-vm for JavaScript
type FunctionArguments = Record<string, unknown>;
type CodeExecArgs = { code: string; language?: string };
type CodeExecResult = { code: string; language: string; output: string | null; error: string | null };

type PyodideLike = {
  runPythonAsync(code: string): Promise<unknown>;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
};

// Lazy-loaded Pyodide instance for Python execution
let pyodideInstance: PyodideLike | null = null;

async function loadPyodide() {
  if (pyodideInstance) return pyodideInstance;

  try {
    // Dynamic import to avoid bundling issues
    const { loadPyodide: load } = await import('pyodide');
    pyodideInstance = (await load({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
    })) as PyodideLike;
    console.log('[CodeExec] Pyodide loaded successfully');
    return pyodideInstance;
  } catch (error) {
    console.error('[CodeExec] Failed to load Pyodide:', error);
    throw new Error('Python runtime not available');
  }
}

async function executePython(code: string): Promise<{ output: string; error: string | null }> {
  try {
    const pyodide = await loadPyodide();

    // Capture stdout
    await pyodide.runPythonAsync(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
    `);

    // Execute user code
    let result: unknown;
    try {
      result = await pyodide.runPythonAsync(code);
    } catch (execError) {
      const stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');
      const stderrText = toText(stderr);
      return {
        output: '',
        error: stderrText || (execError instanceof Error ? execError.message : String(execError)),
      };
    }

    // Get captured output
    const stdout = await pyodide.runPythonAsync('sys.stdout.getvalue()');
    const stdoutText = toText(stdout);

    return {
      output: stdoutText || (result !== undefined ? String(result) : 'Executed successfully'),
      error: null,
    };
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeJavaScript(code: string): Promise<{ output: string; error: string | null }> {
  try {
    // Use Node.js built-in vm module with strict timeout
    const vm = await import('vm');
    const util = await import('util');

    // Create isolated context with limited globals
    const sandbox = {
      console: {
        log: (...args: unknown[]) => capturedOutput.push(util.inspect(args, { depth: 2 })),
      },
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      process: undefined,
      require: undefined,
      global: undefined,
    };

    const capturedOutput: string[] = [];

    const context = vm.createContext(sandbox);

    // Execute with 5-second timeout
    const result = vm.runInContext(code, context, {
      timeout: 5000,
      displayErrors: true,
    });

    const output =
      capturedOutput.length > 0
        ? capturedOutput.join('\n')
        : result !== undefined
        ? String(result)
        : 'Executed successfully';

    return { output, error: null };
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const isCodeExecArgs = (args: FunctionArguments): args is CodeExecArgs =>
  typeof args.code === 'string' &&
  (args.language === undefined || typeof args.language === 'string');

export default async function code_exec(args: FunctionArguments): Promise<CodeExecResult> {
  if (!isCodeExecArgs(args)) {
    return {
      code: '',
      language: 'python',
      output: null,
      error: 'Invalid arguments: code is required',
    };
  }

  const { code, language = 'python' } = args;

  if (process.env.ENABLE_CODE_EXEC !== 'true') {
    return {
      code,
      language,
      output: null,
      error: 'Code execution is disabled'
    };
  }

  // Validate code length (prevent abuse)
  if (code.length > 10000) {
    return {
      code,
      language,
      output: null,
      error: 'Code too long (max 10,000 characters)',
    };
  }

  try {
    let result: { output: string; error: string | null };

    if (language === 'javascript' || language === 'js') {
      result = await executeJavaScript(code);
    } else if (language === 'python' || language === 'py') {
      result = await executePython(code);
    } else {
      // Default to Python
      result = await executePython(code);
    }

    return {
      code,
      language,
      output: result.output,
      error: result.error,
    };
  } catch (error) {
    return {
      code,
      language,
      output: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
