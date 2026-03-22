/**
 * excelExporter.ts
 * Converts a list of parsed AALIReport objects into a single .xlsx file
 * via a Python openpyxl script.
 */

import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { InterestReport } from '../types/report.js';

const __dir   = dirname(fileURLToPath(import.meta.url));
const PY_SCRIPT  = resolve(__dir, '../../python/build_excel.py');
const PYTHON_BIN = process.env.PYTHON_BIN ?? 'python3';

function formatNames(val: string[] | 'N/A'): string {
  if (val === 'N/A' || !Array.isArray(val) || val.length === 0) return 'N/A';
  return val.join('; ');
}

export function buildRow(report: InterestReport): Record<string, string | number> {
  const ff = report.freeFloat;
  const rp = report.ringkasanPengendali;
  return {
    'Month':                                     report.metadata.periodeAkhir,
    'Date of PDF':                               report.metadata.tanggalLaporan,
    'Kode Emiten':                               report.metadata.kodeEmiten,
    'Nomor Surat':                               report.metadata.nomorSurat,
    'FF Saham <5%':                              ff[0]?.bulanIni  ?? '',
    'FF Direksi/Komisaris <5%':                  ff[1]?.bulanIni  ?? '',
    'FF Pengendali <5%':                         ff[2]?.bulanIni  ?? '',
    'FF Afiliasi <5%':                           ff[3]?.bulanIni  ?? '',
    'FF Treasury <5%':                           ff[4]?.bulanIni  ?? '',
    'FF Porto Investasi':                         ff[5]?.bulanIni  ?? '',
    'FreeFloat Total':                            ff[6]?.bulanIni  ?? '',
    'FF Saham Tercatat':                          ff[7]?.bulanIni  ?? '',
    '%FF':                                        ff[8]?.bulanIni  ?? '',
    'Total Pengendali Bulan Ini':                rp[0]?.jumlahSahamBulanIni    ?? '',
    'Total Non Pengendali Bulan Ini':            rp[1]?.jumlahSahamBulanIni    ?? '',
    'Persentase Total Pengendali Bulan Ini':     rp[0]?.persentaseBulanIni     ?? '',
    'Persentase Total Non Pengendali Bulan Ini': rp[1]?.persentaseBulanIni     ?? '',
    'Pemegang Saham':                            report.jumlahPemegang.bulanSekarang,
    'Penerima Manfaat Akhir':                    formatNames(report.penerimaManfaat),
    'Penerima Manfaat Akhir (PT)':               formatNames(report.pengendaliDalamBentukPT),
  };
}

export function exportToExcel(
  reports: InterestReport[],
  version: string,
  outputExcelDir: string
): string {
  mkdirSync(outputExcelDir, { recursive: true });

  const rows    = reports.map(buildRow);
  const outPath = resolve(join(outputExcelDir, `${version}.xlsx`));
  const tmpJson = resolve(join(outputExcelDir, `_tmp_${version}.json`));

  writeFileSync(tmpJson, JSON.stringify({ version, rows }, null, 2), 'utf-8');

  try {
    execFileSync(PYTHON_BIN, [PY_SCRIPT, tmpJson, outPath], {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    try { unlinkSync(tmpJson); } catch { /* ignore */ }
  }

  return outPath;
}