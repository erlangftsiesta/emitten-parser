import { describe, it, expect } from 'vitest';
import { parseIndonesianNumber, parseNum, parsePct } from '../src/sanitizer/numberParser.js';

describe('parseIndonesianNumber', () => {
  it('angka ribuan Indonesia — titik sebagai separator', () => {
    expect(parseNum('1.924.688.333')).toBe(1924688333);
    expect(parseNum('340.510.927')).toBe(340510927);
    expect(parseNum('50.286.166')).toBe(50286166);
  });

  it('angka ribuan Anglo-Saxon — koma sebagai separator (halaman 2)', () => {
    expect(parseNum('1,533,682,440')).toBe(1533682440);
    expect(parseNum('391,005,893')).toBe(391005893);
  });

  it('persen format Indonesia dengan koma desimal', () => {
    const r = parseIndonesianNumber('17,69%');
    expect(r?.value).toBeCloseTo(17.69);
    expect(r?.isPercent).toBe(true);
  });

  it('persen format Anglo-Saxon dengan titik desimal', () => {
    const r = parseIndonesianNumber('79.68%');
    expect(r?.value).toBeCloseTo(79.68);
    expect(r?.isPercent).toBe(true);
  });

  it('parsePct: "20,3" tanpa trailing zero', () => {
    expect(parsePct('20,3')).toBeCloseTo(20.3);
  });

  it('parsePct: "2,62%"', () => {
    expect(parsePct('2,62%')).toBeCloseTo(2.62);
  });

  it('nilai nol', () => {
    expect(parseNum('0')).toBe(0);
    expect(parsePct('0%')).toBe(0);
  });

  it('string kosong return 0', () => {
    expect(parseNum('')).toBe(0);
    expect(parsePct('')).toBe(0);
  });

  it('karakter X (boolean marker) diabaikan', () => {
    const r = parseIndonesianNumber('X');
    expect(r).toBeNull();
  });
});