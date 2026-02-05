// lib/tools/handlers/code-exec.ts - Secure Python/JavaScript Executor
// Uses Pyodide (WebAssembly) for Python and isolated-vm for JavaScript
type FunctionArguments = Record<string, any>;

// Lazy-loaded Pyodide instance for Python execution
let pyodideInstance: any = null;

async function loadPyodide() {
  if (pyodideInstance) return pyodideInstance;

  try {
    // Dynamic import to avoid bundling issues
    const { loadPyodide: load } = await import('pyodide');
    pyodideInstance = await load({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
    });
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
    let result;
    try {
      result = await pyodide.runPythonAsync(code);
    } catch (execError) {
      const stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');
      return {
        output: '',
        error: stderr || (execError instanceof Error ? execError.message : String(execError)),
      };
    }

    // Get captured output
    const stdout = await pyodide.runPythonAsync('sys.stdout.getvalue()');

    return {
      output: stdout || (result !== undefined ? String(result) : 'Executed successfully'),
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
        log: (...args: any[]) => capturedOutput.push(util.inspect(args, { depth: 2 })),
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

export default async function code_exec(args: FunctionArguments) {
  const { code, language = 'python' } = args as { code: string; language?: string };

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
