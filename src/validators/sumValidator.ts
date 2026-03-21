import { ValidationError } from '../utils/errors.js';

const EPSILON = 0.1; // toleransi pembulatan

/**
 * Validasi: totalPengendaliPct + totalNonPengendaliPct harus = 100
 */
export function validatePercentageSum(
  pengendaliPct: number,
  nonPengendaliPct: number
): boolean {
  const total = pengendaliPct + nonPengendaliPct;
  if (Math.abs(total - 100) > EPSILON) {
    throw new ValidationError(
      `Sum check gagal: ${pengendaliPct} + ${nonPengendaliPct} = ${total} (bukan 100)`,
      { pengendaliPct, nonPengendaliPct, total }
    );
  }
  return true;
}

/**
 * Validasi: total saham dari semua kategori harus sama dengan grand total.
 */
export function validateShareCount(
  shares: number[],
  expectedTotal: number
): boolean {
  const actualTotal = shares.reduce((a, b) => a + b, 0);
  if (actualTotal !== expectedTotal) {
    throw new ValidationError(
      `Share count mismatch: Σ=${actualTotal}, expected=${expectedTotal}`,
      { shares, actualTotal, expectedTotal }
    );
  }
  return true;
}