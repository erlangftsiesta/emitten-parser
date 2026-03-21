import { describe, it, expect } from 'vitest';
import { validatePercentageSum, validateShareCount } from '../src/validators/sumValidator.js';
import { cleanBeneficiaryName, extractBeneficiaries } from '../src/validators/beneficiaryExtractor.js';
import { ValidationError } from '../src/utils/errors.js';

describe('validatePercentageSum', () => {
  it('79.68 + 20.32 = 100 — PASS', () => {
    expect(validatePercentageSum(79.68, 20.32)).toBe(true);
  });

  it('nilai salah melempar ValidationError', () => {
    expect(() => validatePercentageSum(80, 21)).toThrow(ValidationError);
  });
});

describe('validateShareCount', () => {
  it('total cocok — PASS', () => {
    expect(validateShareCount([1924688333], 1924688333)).toBe(true);
  });

  it('total tidak cocok melempar ValidationError', () => {
    expect(() => validateShareCount([1000000], 999999)).toThrow(ValidationError);
  });
});

describe('cleanBeneficiaryName', () => {
  it('hapus boilerplate dari nama', () => {
    const raw = "Djony Bunarto Tjondro (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')";
    expect(cleanBeneficiaryName(raw)).toBe('Djony Bunarto Tjondro');
  });

  it('nama pendek tanpa boilerplate', () => {
    expect(cleanBeneficiaryName('Rudy')).toBe('Rudy');
  });
});

describe('extractBeneficiaries', () => {
  const mockTable: string[][] = [
    ['Nomor', 'Nama'],
    ['1', "Djony Bunarto Tjondro (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['2', "Rudy (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['3', "Gidion Hasan (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['4', "Henry Tanoto (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['5', "Santosa (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['6', "Gita Tiffani Boer (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['7', "Fxl Kesuma (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['8', "Hamdani Dzulkarnaen Salim (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['9', "Thomas Junaidi Alim W. (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
    ['10', "Hsu Hai Yeh (mohon merujuk pada 'Informasi Lain' bagian 'Penerima Manfaat')"],
  ];

  it('ekstrak 10 nama bersih', () => {
    const names = extractBeneficiaries(mockTable);
    expect(names).toHaveLength(10);
    // Verifikasi boilerplate sudah dihapus
    expect(names[0]).toBe('Djony Bunarto Tjondro');
    expect(names[9]).toBe('Hsu Hai Yeh');
    // Pastikan tidak ada sisa teks "(mohon merujuk...)"
    names.forEach(n => expect(n).not.toContain('mohon merujuk'));
  });

  it('kurang dari 10 nama melempar ValidationError', () => {
    expect(() => extractBeneficiaries(mockTable.slice(0, 5))).toThrow(ValidationError);
  });
}); 