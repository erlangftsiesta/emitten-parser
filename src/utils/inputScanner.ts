/**
 * inputScanner.ts
 * Scans the input/ directory structure.
 *
 * Expected layout:
 *   input/
 *     01-2026/          ← subfolder named MM-YYYY
 *       AALI_....pdf
 *       ABBA_....pdf
 *     02-2026/
 *       ...
 *
 * Rules enforced:
 *   - No files directly inside input/ (only subfolders allowed)
 *   - Subfolder names must match MM-YYYY (month 01-12, year 4 digits)
 *   - Each subfolder must contain at least one .pdf file
 */

import { readdirSync, statSync } from 'fs';
import { resolve, join, basename, extname } from 'path';
import { ParseError } from './errors.js';

export interface PdfFile {
  kode: string;   // e.g. "AALI" — filename without extension and date suffix
  pdfPath: string;
  fileName: string;
}

export interface ScannedPeriod {
  period: string;   // e.g. "01-2026"
  month: number;    // 1-12
  year: number;     // e.g. 2026
  inputDir: string; // absolute path to subfolder
  files: PdfFile[];
}

const PERIOD_RE = /^(0[1-9]|1[0-2])-(\d{4})$/;

/** Extract emiten kode from PDF filename.
 *  "AALI_2026_1_31_ID.pdf" → "AALI"
 *  "ABBA_2026_1_31_ID.pdf" → "ABBA"
 *  Fallback: filename without extension.
 */
function extractKode(fileName: string): string {
  const noExt = basename(fileName, extname(fileName));
  // IDX naming convention: KODE_YYYY_M_DD_ID or KODE_YYYY_MM_DD_ID
  const match = noExt.match(/^([A-Z0-9]+)_/);
  return match ? match[1] : noExt;
}

export function scanInputDir(inputRoot: string): ScannedPeriod[] {
  const absRoot = resolve(inputRoot);
  let entries: string[];

  try {
    entries = readdirSync(absRoot);
  } catch {
    throw new ParseError(`Input directory tidak ditemukan: ${absRoot}`);
  }

  // Enforce: tidak boleh ada file langsung di input/
  const rootFiles = entries.filter(e => statSync(join(absRoot, e)).isFile());
  if (rootFiles.length > 0) {
    throw new ParseError(
      `Input folder tidak boleh mengandung file langsung (hanya subfolder).\n` +
      `File ditemukan di root: ${rootFiles.join(', ')}`
    );
  }

  const periods: ScannedPeriod[] = [];

  for (const entry of entries) {
    const entryPath = join(absRoot, entry);
    if (!statSync(entryPath).isDirectory()) continue;

    // Validate subfolder name format MM-YYYY
    const match = entry.match(PERIOD_RE);
    if (!match) {
      throw new ParseError(
        `Nama subfolder tidak valid: "${entry}"\n` +
        `Format wajib: MM-YYYY (contoh: 01-2026, 12-2025)\n` +
        `Bulan harus 01-12.`
      );
    }

    const month = parseInt(match[1], 10);
    const year  = parseInt(match[2], 10);

    // Scan PDF files in subfolder
    const subEntries = readdirSync(entryPath);

    // Enforce: no nested subdirectories (optional, warn only)
    const subDirs = subEntries.filter(e => statSync(join(entryPath, e)).isDirectory());
    if (subDirs.length > 0) {
      console.warn(`[WARN] Subfolder di dalam period folder diabaikan: ${subDirs.join(', ')}`);
    }

    const pdfFiles: PdfFile[] = subEntries
      .filter(e => e.toLowerCase().endsWith('.pdf') && statSync(join(entryPath, e)).isFile())
      .map(e => ({
        kode: extractKode(e),
        pdfPath: join(entryPath, e),
        fileName: e,
      }));

    if (pdfFiles.length === 0) {
      console.warn(`[WARN] Subfolder "${entry}" tidak mengandung PDF — dilewati`);
      continue;
    }

    periods.push({ period: entry, month, year, inputDir: entryPath, files: pdfFiles });
  }

  // Sort by year then month
  periods.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  return periods;
}