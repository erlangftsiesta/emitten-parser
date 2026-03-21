import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ExtractorOutput } from '../types/token.js';
import { BridgeError } from '../utils/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = join(__dirname, '../../python/extract_words.py');
const PYTHON_BIN = process.env.PYTHON_BIN ?? 'python3';

export function runPdfBridge(pdfPath: string): ExtractorOutput {
  let stdout: string;

  try {
    stdout = execFileSync(PYTHON_BIN, [PYTHON_SCRIPT, pdfPath], {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    throw new BridgeError(
      `Python bridge gagal: ${e.message ?? 'unknown error'}`,
      e.stderr
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new BridgeError('Output Python bukan JSON valid', stdout.slice(0, 200));
  }

  const output = parsed as ExtractorOutput & { error?: string };
  if (output.error) {
    throw new BridgeError(`Python error: ${output.error}`);
  }

  if (!output.pages || !Array.isArray(output.pages)) {
    throw new BridgeError('Output Python tidak memiliki field "pages"');
  }

  return output as ExtractorOutput;
}