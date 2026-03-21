/**
 * fragmentJoiner.ts
 * Safety net post-vMerge: deteksi dan gabungkan angka yang masih terpotong.
 *
 * Pola angka terpotong Indonesia:
 *   "1.193.171.51" → seharusnya "1.193.171.513"
 *
 * Ini terjadi jika vMerge di mergeEngine gagal mendeteksi spill
 * karena threshold terlalu ketat atau token berada di posisi tidak terduga.
 */

// Regex: angka ribuan Indonesia yang digit terakhirnya < 3 (kemungkinan terpotong)
const TRUNCATED_ID_NUMBER = /^\d{1,3}(\.\d{3})*\.\d{1,2}$/;
const PURE_DIGITS = /^\d{1,4}$/;

export interface JoinCandidate {
  colName: string;
  value: string;
}

/**
 * Cek apakah sebuah string angka tampak terpotong.
 */
export function isTruncatedNumber(s: string): boolean {
  return TRUNCATED_ID_NUMBER.test(s.trim());
}

/**
 * Gabungkan fragment jika ditemukan pola terpotong antar dua sel yang berdekatan.
 * Dipanggil setelah buildMergedRows, sebelum sanitization.
 */
export function joinFragments(
  rows: Array<Record<string, string>>,
  numericCols: string[]
): Array<Record<string, string>> {
  const result: Array<Record<string, string>> = [];

  let i = 0;
  while (i < rows.length) {
    const current = { ...rows[i] };

    if (i + 1 < rows.length) {
      const next = rows[i + 1];
      let merged = false;

      for (const col of numericCols) {
        const currVal = (current[col] ?? '').trim();
        const nextVal = (next[col] ?? '').trim();

        if (isTruncatedNumber(currVal) && PURE_DIGITS.test(nextVal)) {
          current[col] = currVal + nextVal;
          merged = true;
        }
      }

      if (merged) {
        result.push(current);
        i += 2; // skip baris berikutnya karena sudah di-merge
        continue;
      }
    }

    result.push(current);
    i++;
  }

  return result;
}