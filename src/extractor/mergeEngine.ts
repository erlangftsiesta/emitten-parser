import type { RowBucket } from '../types/token.js';
import type { ColumnZone } from './columnZone.js';
import { assignColumn } from './columnZone.js';

const SPILL_THRESHOLD = Number(process.env.SPILL_THRESHOLD ?? 14);

export interface MergedRow {
  [colName: string]: string;
}

/**
 * H-Merge: gabungkan token dalam bucket yang sama dan kolom yang sama
 * menjadi satu string (sorted by x0).
 */
export function hMerge(bucket: RowBucket, zones: ColumnZone[]): MergedRow {
  const row: MergedRow = {};

  for (const token of bucket.tokens) {
    const zone = assignColumn(token.x0, zones);
    if (!zone) continue;

    if (row[zone.name]) {
      row[zone.name] += ' ' + token.text;
    } else {
      row[zone.name] = token.text;
    }
  }

  return row;
}

/**
 * Deteksi apakah sebuah bucket adalah "spill row" dari baris sebelumnya.
 * Kriteria:
 * - Jumlah kolom yang terisi < 3 (bukan baris data penuh)
 * - Semua token yang ada adalah numerik pendek (1-3 karakter)
 * - Top bucket ini > top bucket sebelumnya (beda < SPILL_THRESHOLD)
 */
export function isSpillRow(
  current: RowBucket,
  previous: RowBucket,
  zones: ColumnZone[]
): boolean {
  const topDiff = current.topCenter - previous.topCenter;
  if (topDiff <= 0 || topDiff > SPILL_THRESHOLD) return false;

  const currentRow = hMerge(current, zones);
  const filledCols = Object.values(currentRow).filter(v => v.trim() !== '');

  if (filledCols.length === 0 || filledCols.length >= 3) return false;

  // Semua nilai yang ada harus pendek dan numerik
  return filledCols.every(v => v.trim().length <= 4 && /^\d+$/.test(v.trim()));
}

/**
 * V-Merge: append konten spill row ke baris sebelumnya.
 * Misalnya: row[i]['jumlahIni'] = '1.193.171.51' + '3' -> '1.193.171.513'
 */
export function vMerge(
  baseRow: MergedRow,
  spillBucket: RowBucket,
  zones: ColumnZone[]
): MergedRow {
  const spillRow = hMerge(spillBucket, zones);
  const merged = { ...baseRow };

  for (const [colName, spillVal] of Object.entries(spillRow)) {
    if (spillVal.trim() === '') continue;
    if (merged[colName]) {
      // Langsung append tanpa spasi (digit terpotong, bukan kata)
      merged[colName] = merged[colName].trimEnd() + spillVal.trim();
    } else {
      merged[colName] = spillVal.trim();
    }
  }

  return merged;
}

/**
 * Main merge pipeline: proses semua buckets, deteksi spill, return rows bersih.
 */
export function buildMergedRows(
  buckets: RowBucket[],
  zones: ColumnZone[]
): MergedRow[] {
  const rows: MergedRow[] = [];

  let i = 0;
  while (i < buckets.length) {
    const current = buckets[i];
    let row = hMerge(current, zones);

    // Lookahead: cek apakah bucket berikutnya adalah spill dari bucket ini
    if (i + 1 < buckets.length) {
      const next = buckets[i + 1];
      if (isSpillRow(next, current, zones)) {
        row = vMerge(row, next, zones);
        i++; // skip spill row
      }
    }

    // Hanya simpan row yang punya minimal 1 kolom terisi
    if (Object.values(row).some(v => v.trim() !== '')) {
      rows.push(row);
    }

    i++;
  }

  return rows;
}