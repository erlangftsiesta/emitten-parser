import { ValidationError } from '../utils/errors.js';

const BOILERPLATE_PATTERN = /\s*\(mohon merujuk.*?\)/gi;

export function cleanBeneficiaryName(raw: string): string {
  return raw.replace(BOILERPLATE_PATTERN, '').trim();
}

export function extractBeneficiaries(table: string[][]): string[] {
  const names: string[] = [];

  for (const row of table) {
    if (!row || row.length < 2) continue;
    const nameCell = row[1] ?? '';

    // Skip header row
    if (!nameCell || nameCell.toLowerCase() === 'nama') continue;

    // Skip baris yang isinya bukan nama (misalnya header "Bulan Sebelumnya")
    const cleaned = cleanBeneficiaryName(nameCell);
    if (!cleaned) continue;

    // Heuristik: baris header/non-nama biasanya tidak mengandung boilerplate
    // dan tidak ada angka di kolom pertama (nomor urut)
    const nomorCell = (row[0] ?? '').trim();
    const isNomor = /^\d+$/.test(nomorCell);
    if (!isNomor) continue;

    names.push(cleaned);
  }

  if (names.length === 0) {
    throw new ValidationError('Tidak ada nama penerima manfaat ditemukan');
  }

  if (names.length !== 10) {
    throw new ValidationError(
      `Jumlah penerima manfaat tidak sesuai: expected 10, got ${names.length}`,
      { names }
    );
  }

  return names;
}