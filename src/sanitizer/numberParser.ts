/**
 * Konversi format angka Indonesia ke number JavaScript.
 *
 * Format Indonesia: titik = ribuan, koma = desimal
 * Contoh: "1.924.688.333" -> 1924688333
 *         "17,69%"        -> 17.69  (isPercent: true)
 *         "20,3"          -> 20.3
 *         "0"             -> 0
 *
 * Format Anglo-Saxon (halaman 2 dokumen ini):
 *         "1,533,682,440" -> 1533682440
 *         "79.68%"        -> 79.68
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

  // Deteksi flag persen
  const isPercent = s.endsWith('%');
  if (isPercent) s = s.slice(0, -1).trim();

  // Hapus karakter X (boolean marker kolom Pengendali)
  s = s.replace(/X/g, '').trim();

  if (s === '') return null;

  // Deteksi format: Anglo-Saxon vs Indonesia
  // Anglo-Saxon: koma sebagai ribuan → "1,533,682,440" atau "79.68"
  // Indonesia: titik sebagai ribuan → "1.924.688.333" atau "17,69"
  const isAngloSaxon = detectAngloSaxon(s, isPercent);

  let normalized: string;

  if (isAngloSaxon) {
    // Hapus koma ribuan, titik sudah jadi desimal
    normalized = s.replace(/,/g, '');
  } else {
    // Hapus titik ribuan, ubah koma desimal -> titik
    normalized = s.replace(/\./g, '').replace(',', '.');
  }

  // Hapus karakter non-numerik sisa (kecuali titik dan minus)
  normalized = normalized.replace(/[^\d.\-]/g, '');

  if (normalized === '' || normalized === '.') return null;

  const value = parseFloat(normalized);
  if (isNaN(value)) return null;

  return { value, isPercent, original };
}

/**
 * Deteksi apakah string menggunakan format Anglo-Saxon.
 * Heuristik: jika koma diikuti tepat 3 digit lalu koma/end → Anglo-Saxon thousands.
 */
function detectAngloSaxon(s: string, isPercent: boolean): boolean {
  // Anglo-Saxon thousands: koma diikuti tepat 3 digit lalu koma/end
  if (/\d,\d{3}(,|$)/.test(s)) return true;

  if (/^\d+\.\d+$/.test(s)) {
    const parts = s.split('.');
    const afterDot = parts[parts.length - 1];
    if (parts.length === 2 && afterDot.length === 3) {
      // Tepat 3 digit: ambiguous antara ribuan Indonesia vs desimal 3 tempat
      // Jika ini nilai persen, tidak mungkin > 100 ribuan → pasti desimal
      if (isPercent) return true;
      // Jika bukan persen, tepat 3 digit = ribuan Indonesia (e.g. "16.323")
      return false;
    }
    // Selain 3 digit = desimal Anglo-Saxon (e.g. "79.68", "18.85")
    if (parts.length === 2) return true;
  }

  return false;
}

/**
 * Parse dan return hanya nilai number-nya. Throw jika tidak bisa parse.
 */
export function parseNum(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  const result = parseIndonesianNumber(raw);
  return result?.value ?? 0;
}

/**
 * Parse persen: return float 0-100.
 */
export function parsePct(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  const result = parseIndonesianNumber(raw);
  return result?.value ?? 0;
}