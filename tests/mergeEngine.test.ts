import { describe, it, expect } from 'vitest';
import { isSpillRow, vMerge, hMerge, buildMergedRows } from '../src/extractor/mergeEngine.js';
import { PAGE1_MAIN_TABLE_ZONES, PAGE1_PUBLIK_TABLE_ZONES } from '../src/extractor/columnZone.js';
import type { RowBucket } from '../src/types/token.js';

function makeBucket(tokens: Array<{ text: string; x0: number; x1: number; top: number }>): RowBucket {
  return {
    topCenter: tokens.reduce((s, t) => s + t.top, 0) / tokens.length,
    tokens: tokens.map(t => ({ ...t, bottom: t.top + 12 })),
  };
}

describe('isSpillRow', () => {
  it('deteksi spill: token "3" setelah "1.193.171.51"', () => {
    const prev = makeBucket([
      { text: '1.193.171.51', x0: 414.5, x1: 467, top: 350.2 },
      { text: '61,99%',       x0: 493.5, x1: 524, top: 350.2 },
    ]);
    const curr = makeBucket([
      { text: '3', x0: 462, x1: 467, top: 361.5 },
    ]);
    expect(isSpillRow(curr, prev, PAGE1_MAIN_TABLE_ZONES)).toBe(true);
  });

  it('bukan spill: selisih top terlalu besar', () => {
    const prev = makeBucket([{ text: '340.510.927', x0: 310, x1: 360, top: 317 }]);
    const curr = makeBucket([{ text: 'PT Astra', x0: 114, x1: 160, top: 348 }]);
    expect(isSpillRow(curr, prev, PAGE1_MAIN_TABLE_ZONES)).toBe(false);
  });

  it('bukan spill: curr punya banyak kolom terisi', () => {
    const prev = makeBucket([{ text: '340.510.927', x0: 310, x1: 360, top: 317 }]);
    const curr = makeBucket([
      { text: 'International', x0: 107, x1: 157, top: 326 },
      { text: 'Raya No. 8',   x0: 172, x1: 218, top: 326 },
      { text: '17,69%',       x0: 379, x1: 410, top: 326 },
    ]);
    expect(isSpillRow(curr, prev, PAGE1_MAIN_TABLE_ZONES)).toBe(false);
  });
});

describe('vMerge', () => {
  it('append digit "3" ke "1.193.171.51" tanpa spasi', () => {
    const baseRow = { jumlahIni: '1.193.171.51', persenIni: '61,99%' };
    const spill = makeBucket([{ text: '3', x0: 462, x1: 467, top: 361.5 }]);
    const result = vMerge(baseRow, spill, PAGE1_MAIN_TABLE_ZONES);
    expect(result['jumlahIni']).toBe('1.193.171.513');
    expect(result['persenIni']).toBe('61,99%');
  });

  it('append digit "7" ke "340.719.72"', () => {
    const baseRow = { jumlahIni: '340.719.72' };
    const spill = makeBucket([{ text: '7', x0: 390, x1: 395, top: 395.5 }]);
    const result = vMerge(baseRow, spill, PAGE1_PUBLIK_TABLE_ZONES ?? PAGE1_MAIN_TABLE_ZONES);
    expect(result['jumlahIni']).toBe('340.719.727');
  });

  it('append digit "3" ke total "1.924.688.33"', () => {
    const baseRow = { jumlahIni: '1.924.688.33' };
    const spill = makeBucket([{ text: '3', x0: 392, x1: 397, top: 486.5 }]);
    const result = vMerge(baseRow, spill, PAGE1_PUBLIK_TABLE_ZONES);
    expect(result['jumlahIni']).toBe('1.924.688.333');
  });
});

describe('buildMergedRows', () => {
  it('proses 2 bucket normal tanpa spill', () => {
    const buckets: RowBucket[] = [
      makeBucket([
        { text: '340.510.927', x0: 310, x1: 360, top: 317 },
        { text: '17,69%',      x0: 379, x1: 410, top: 317 },
      ]),
      makeBucket([
        { text: '50.286.166', x0: 245, x1: 290, top: 415 },
        { text: '2,62%',      x0: 311, x1: 337, top: 415 },
      ]),
    ];
    const rows = buildMergedRows(buckets, PAGE1_MAIN_TABLE_ZONES);
    expect(rows.length).toBe(2);
  });

  it('proses spill otomatis, output 1 baris', () => {
    const buckets: RowBucket[] = [
      makeBucket([
        { text: '1.193.171.51', x0: 414.5, x1: 467, top: 350.2 },
        { text: '61,99%',        x0: 493.5, x1: 524, top: 350.2 },
      ]),
      makeBucket([
        { text: '3', x0: 462, x1: 467, top: 361.5 },
      ]),
    ];
    const rows = buildMergedRows(buckets, PAGE1_MAIN_TABLE_ZONES);
    expect(rows.length).toBe(1);
    expect(rows[0]['jumlahIni']).toBe('1.193.171.513');
  });
});