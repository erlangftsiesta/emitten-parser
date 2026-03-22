import { describe, it, expect } from 'vitest';
import { parseIndonesianNumber, parseNum, parsePct } from '../src/sanitizer/numberParser.js';

describe('parseNum — format ribuan Indonesia (titik = ribuan)', () => {
  it('angka besar multi-titik', () => {
    expect(parseNum('1.924.688.333')).toBe(1924688333);
    expect(parseNum('340.510.927')).toBe(340510927);
    expect(parseNum('50.286.166')).toBe(50286166);
    expect(parseNum('1.193.171.513')).toBe(1193171513);
  });

  it('angka kecil ribuan Indonesia', () => {
    expect(parseNum('8.500')).toBe(8500);
    expect(parseNum('22.700')).toBe(22700);
    expect(parseNum('2.506.265')).toBe(2506265);
  });

  it('jumlah pemegang — "16.323" bukan desimal', () => {
    expect(parseNum('16.323')).toBe(16323);
    expect(parseNum('15.785')).toBe(15785);
    expect(parseNum('84.228')).toBe(84228);
    expect(parseNum('77.816')).toBe(77816);
  });

  it('nol dan kosong', () => {
    expect(parseNum('0')).toBe(0);
    expect(parseNum('')).toBe(0);
    expect(parseNum(undefined)).toBe(0);
  });
});

describe('parseNum — format Anglo-Saxon (koma = ribuan)', () => {
  it('angka besar multi-koma', () => {
    expect(parseNum('1,533,682,440')).toBe(1533682440);
    expect(parseNum('391,005,893')).toBe(391005893);
    expect(parseNum('3,654,154,437')).toBe(3654154437);
    expect(parseNum('4,132,737,323')).toBe(4132737323);
  });
});

describe('parsePct — persen format Indonesia (koma = desimal)', () => {
  it('persen dengan koma desimal', () => {
    expect(parsePct('17,69%')).toBeCloseTo(17.69);
    expect(parsePct('61,99%')).toBeCloseTo(61.99);
    expect(parsePct('40,47%')).toBeCloseTo(40.47);
    expect(parsePct('2,62%')).toBeCloseTo(2.62);
  });

  it('persen tanpa trailing zero', () => {
    expect(parsePct('20,3')).toBeCloseTo(20.3);
    expect(parsePct('17,7%')).toBeCloseTo(17.7);
    expect(parsePct('33')).toBeCloseTo(33);
  });

  it('persen nol', () => {
    expect(parsePct('0%')).toBe(0);
    expect(parsePct('0')).toBe(0);
  });
});

describe('parsePct — persen format Anglo-Saxon (titik = desimal)', () => {
  it('persen 2 digit desimal', () => {
    expect(parsePct('79.68%')).toBeCloseTo(79.68);
    expect(parsePct('20.32%')).toBeCloseTo(20.32);
    expect(parsePct('40.47%')).toBeCloseTo(40.47);
    expect(parsePct('59.53%')).toBeCloseTo(59.53);
  });

  it('persen 3 digit desimal — KRITIS: 46.927% bukan 46927%', () => {
    expect(parsePct('46.927%')).toBeCloseTo(46.927);
    expect(parsePct('53.073%')).toBeCloseTo(53.073);
    expect(parsePct('18.85%')).toBeCloseTo(18.85);
    expect(parsePct('18.81%')).toBeCloseTo(18.81);
  });
});

describe('parseIndonesianNumber — edge cases', () => {
  it('karakter X (boolean marker) → null', () => {
    expect(parseIndonesianNumber('X')).toBeNull();
  });

  it('string kosong dan strip → null', () => {
    expect(parseIndonesianNumber('')).toBeNull();
    expect(parseIndonesianNumber('-')).toBeNull();
    expect(parseIndonesianNumber('N/A')).toBeNull();
  });

  it('isPercent flag benar', () => {
    const r1 = parseIndonesianNumber('17,69%');
    expect(r1?.isPercent).toBe(true);

    const r2 = parseIndonesianNumber('1.924.688.333');
    expect(r2?.isPercent).toBe(false);
  });

  it('nilai desimal kecil', () => {
    expect(parsePct('0,0001%')).toBeCloseTo(0.0001);
    expect(parsePct('0,0322%')).toBeCloseTo(0.0322);
  });
});