/**
 * versionControl.ts
 * Manages VersionControl.json at project root.
 * Tracks which PDF files have been processed and their hash/mtime,
 * so we only re-process new or changed files.
 *
 * VersionControl.json shape:
 * {
 *   "01-2026": {
 *     "processedAt": "2026-02-10T14:49:00.000Z",
 *     "files": {
 *       "AALI": { "mtime": 1707566940000, "outputJson": "output/json/AALI.json" },
 *       "ABBA": { "mtime": 1707566941000, "outputJson": "output/json/ABBA.json" }
 *     },
 *     "excelVersions": [
 *       { "version": "01-2026",     "generatedAt": "2026-02-10T14:49:00.000Z", "fileCount": 2 },
 *       { "version": "01-2026-rev1","generatedAt": "2026-02-11T09:00:00.000Z", "fileCount": 4 }
 *     ]
 *   }
 * }
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const VC_PATH = resolve('./VersionControl.json');

export interface FileEntry {
  mtime: number;
  outputJson: string;
}

export interface ExcelVersion {
  version: string;       // e.g. "01-2026" or "01-2026-rev1"
  generatedAt: string;   // ISO timestamp
  fileCount: number;
}

export interface PeriodEntry {
  processedAt: string;
  files: Record<string, FileEntry>;
  excelVersions: ExcelVersion[];
}

export type VersionControlData = Record<string, PeriodEntry>;

export function loadVC(): VersionControlData {
  if (!existsSync(VC_PATH)) return {};
  try {
    return JSON.parse(readFileSync(VC_PATH, 'utf-8')) as VersionControlData;
  } catch {
    return {};
  }
}

export function saveVC(data: VersionControlData): void {
  writeFileSync(VC_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/** Get mtime of a file in ms, or 0 if not found */
export function getMtime(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Check which PDF files in a period need (re)processing.
 * Generic over T so it preserves fileName and any other fields.
 */
export function getFilesToProcess<T extends { kode: string; pdfPath: string }>(
  period: string,
  pdfFiles: T[],
  vc: VersionControlData
): T[] {
  const periodEntry = vc[period];
  if (!periodEntry) return pdfFiles;

  return pdfFiles.filter(({ kode, pdfPath }) => {
    const existing = periodEntry.files[kode];
    if (!existing) return true;
    return getMtime(pdfPath) !== existing.mtime;
  });
}

/** Register a processed file into VC data */
export function registerFile(
  vc: VersionControlData,
  period: string,
  kode: string,
  pdfPath: string,
  outputJson: string
): void {
  if (!vc[period]) {
    vc[period] = { processedAt: new Date().toISOString(), files: {}, excelVersions: [] };
  }
  vc[period].files[kode] = {
    mtime: getMtime(pdfPath),
    outputJson,
  };
  vc[period].processedAt = new Date().toISOString();
}

/**
 * Determine the next Excel version string for a period.
 * If no versions yet → "01-2026"
 * If "01-2026" exists → "01-2026-rev1"
 * If "01-2026-rev1" exists → "01-2026-rev2"
 */
export function nextExcelVersion(vc: VersionControlData, period: string): string {
  const entry = vc[period];
  if (!entry || entry.excelVersions.length === 0) return period;

  const existing = entry.excelVersions.map(v => v.version);
  // Find highest rev number
  let maxRev = 0;
  for (const v of existing) {
    const match = v.match(/-rev(\d+)$/);
    if (match) maxRev = Math.max(maxRev, parseInt(match[1]));
    else if (v === period) maxRev = Math.max(maxRev, 0);
  }
  return `${period}-rev${maxRev + 1}`;
}

/** Register an Excel export into VC data */
export function registerExcel(
  vc: VersionControlData,
  period: string,
  version: string,
  fileCount: number
): void {
  if (!vc[period]) {
    vc[period] = { processedAt: new Date().toISOString(), files: {}, excelVersions: [] };
  }
  vc[period].excelVersions.push({
    version,
    generatedAt: new Date().toISOString(),
    fileCount,
  });
}