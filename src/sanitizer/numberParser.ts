/**
 * numberParser.ts
 * Konversi format angka Indonesia dan Anglo-Saxon ke number JavaScript.
 *
 * Format Indonesia : titik = ribuan, koma = desimal  → "1.924.688.333", "17,69%"
 * Format Anglo-Saxon: koma = ribuan, titik = desimal → "1,533,682,440", "79.68%"
 */

export interface ParsedNumber {
  value: number;
  isPercent: boolean;
  original: string;
}

export function parseIndonesianNumber(raw: string): ParsedNumber | null {
  const original = raw;
  let s = raw.trim();

  if (s === '' || s === '-' || s === 'N/A') return null;

  // Hapus flag persen
  const isPercent = s.endsWith('%');
  if (isPercent) s = s.slice(0, -1).trim();

  // Hapus marker boolean X
  s = s.replace(/X/g, '').trim();
  if (s === '') return null;

  const isAngloSaxon = detectAngloSaxon(s, isPercent);

  let normalized: string;
  if (isAngloSaxon) {
    // Hapus koma ribuan, titik sudah jadi desimal
    normalized = s.replace(/,/g, '');
  } else {
    // Hapus titik ribuan, ubah koma desimal → titik
    normalized = s.replace(/\./g, '').replace(',', '.');
  }

  // Hapus karakter non-numerik sisa
  normalized = normalized.replace(/[^\d.\-]/g, '');
  if (normalized === '' || normalized === '.') return null;

  const value = parseFloat(normalized);
  if (isNaN(value)) return null;

  return { value, isPercent, original };
}

/**
 * Deteksi format Anglo-Saxon vs Indonesia.
 * Aturan utama:
 *  - Ada koma diikuti tepat 3 digit → Anglo-Saxon thousands
 *  - Ada titik dengan tepat 3 digit setelahnya (bukan persen) → Indonesia thousands
 *  - Ada titik dengan digit ≠ 3 → Anglo-Saxon decimal
 *  - Jika ini persen dan ada titik dengan 3 digit → tetap Anglo-Saxon (misal "46.927%")
 */
function detectAngloSaxon(s: string, isPercent: boolean): boolean {
  // Anglo-Saxon thousands: koma diikuti tepat 3 digit lalu koma/end
  if (/\d,\d{3}(,|$)/.test(s)) return true;

  if (/^\d+\.\d+$/.test(s)) {
    const parts = s.split('.');
    const afterDot = parts[parts.length - 1];
    if (parts.length === 2 && afterDot.length === 3) {
      // Tepat 3 digit setelah titik: ambiguous
      // Jika nilai persen → mustahil > 100 ribuan → pasti desimal Anglo-Saxon
      // Jika bukan persen → ribuan Indonesia (e.g. "16.323")
      return isPercent;
    }
    // Selain 3 digit → Anglo-Saxon decimal (e.g. "79.68", "18.85")
    if (parts.length === 2) return true;
  }

  return false;
}

export function parseNum(raw: string | undefined): number {
  if (!raw || raw.trim() === '') return 0;
  return parseIndonesianNumber(raw)?.value ?? 0;
}

export function parsePct(raw: string | undefined): number {
  if (!raw || raw.trim() === '') return 0;
  return parseIndonesianNumber(raw)?.value ?? 0;
}