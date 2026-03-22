/**
 * index.ts — Universal IDX Laporan Pemegang Efek pipeline
 *
 * Usage:
 *   # Process all periods in input/
 *   node --import tsx/esm src/index.ts
 *
 *   # Process one specific period
 *   node --import tsx/esm src/index.ts --period 01-2026
 *
 *   # Force re-process all files (ignore VC cache)
 *   node --import tsx/esm src/index.ts --force
 *
 *   # Only export Excel (skip PDF processing)
 *   node --import tsx/esm src/index.ts --excel-only --period 01-2026
 *
 * Output layout:
 *   output/
 *     json/
 *       AALI.json
 *       ABBA.json
 *     excel/
 *       01-2026.xlsx
 *       01-2026-rev1.xlsx
 *   VersionControl.json
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import { logger } from './utils/logger.js';
import { ParseError, ValidationError, BridgeError } from './utils/errors.js';
import { scanInputDir } from './utils/inputScanner.js';
import {
  loadVC, saveVC, getFilesToProcess,
  registerFile, registerExcel, nextExcelVersion,
} from './utils/versionControl.js';
import { runPdfBridge } from './extractor/pdfBridge.js';
import { parseNum, parsePct } from './sanitizer/numberParser.js';
import { AALIReportSchema } from './validators/reportSchema.js';
import { exportToExcel } from './exporter/excelExporter.js';
import type {
  InterestReport, PemegangSaham, KategoriPublik,
  RingkasanPengendali, FreeFloatRow,
} from './types/report.js';
import type { PageData, WordToken } from './types/token.js';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args          = process.argv.slice(2);
const getArg        = (f: string) => { const i = args.indexOf(f); return i !== -1 ? args[i+1] : undefined; };
const hasFlag       = (f: string) => args.includes(f);

const INPUT_ROOT    = resolve('./input');
const JSON_OUT_DIR  = resolve('./output/json');
const EXCEL_OUT_DIR = resolve('./output/excel');
const FILTER_PERIOD = getArg('--period');
const FORCE         = hasFlag('--force');
const EXCEL_ONLY    = hasFlag('--excel-only');

// ── Cell helpers ──────────────────────────────────────────────────────────────

const clean   = (v: string | undefined): string => (v ?? '').replace(/\n/g, ' ').trim();
const cleanN  = (v: string | undefined): string => (v ?? '').replace(/\n/g, '').trim();
const num     = (v: string | undefined): number => parseNum(cleanN(v));
const pct     = (v: string | undefined): number => parsePct(clean(v));
const integer = (v: string | undefined): number => Math.round(num(v));

// ── Date helpers ──────────────────────────────────────────────────────────────

const BULAN_MAP: Record<string, string> = {
  januari:'01', februari:'02', maret:'03', april:'04',
  mei:'05', juni:'06', juli:'07', agustus:'08',
  september:'09', oktober:'10', november:'11', desember:'12',
};

function parsePeriodeAkhir(words: WordToken[]): string {
  const text = words.map(w => w.text).join(' ');
  const m = text.match(
    /berakhir\s+pada\s+(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/i
  );
  if (!m) return '';
  const day   = m[1].padStart(2, '0');
  const month = BULAN_MAP[m[2].toLowerCase()] ?? '??';
  const year  = m[3];
  return `${year}-${month}-${day}`;
}

// ── Name helpers ──────────────────────────────────────────────────────────────

function isValidName(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^\d+$/.test(t)) return false;
  if (/^[\d\s.,%]+$/.test(t)) return false;
  return true;
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*\(mohon merujuk.*?\)/gi, '')
    .replace(/\n/g, ' ')
    .trim();
}

// ── Section detectors ─────────────────────────────────────────────────────────

type RawTable = string[][];

interface Located { table: RawTable; pageNum: number; tableIdx: number; }

function findAllTables(pages: PageData[], pred: (t: RawTable) => boolean): Located[] {
  const r: Located[] = [];
  for (const p of pages)
    for (let i = 0; i < (p.tables ?? []).length; i++)
      if (pred(p.tables[i])) r.push({ table: p.tables[i], pageNum: p.page, tableIdx: i });
  return r;
}

function findTable(pages: PageData[], pred: (t: RawTable) => boolean): RawTable | null {
  return findAllTables(pages, pred)[0]?.table ?? null;
}

const isMetadataTable        = (t: RawTable) => t.some(r => r[0]?.toLowerCase().includes('nomor surat') || r[0]?.toLowerCase().includes('kode emiten'));
const isPemegangTable        = (t: RawTable) => t.length > 0 && t[0].some(h => h?.toLowerCase().includes('jumlah saham') && h?.toLowerCase().includes('sebelumnya')) && t[0].some(h => h?.toLowerCase().includes('nama'));
const isKategoriPublikTable  = (t: RawTable) => t.some(r => r[0]?.toLowerCase().includes('masyarakat'));
const isRingkasanTable       = (t: RawTable) => t.some(r => r[0]?.toLowerCase().includes('total pengendali') || r[0]?.toLowerCase().includes('total non pengendali'));
const isFreeFloatTable       = (t: RawTable) => t.length > 0 && (t[0][0]?.toLowerCase().trim() === 'keterangan' || t.some(r => r[0]?.toLowerCase().includes('saham free float')));
const isJumlahPemegangTable  = (t: RawTable) => t.length > 0 && (t[0][0]?.toLowerCase().includes('bulan sebelumnya') || t[0][1]?.toLowerCase().includes('bulan sekarang'));
const isPenerimaManfaatTable = (t: RawTable) => t.length > 0 && t[0].length === 2 && t[0][0]?.toLowerCase().trim() === 'nomor' && t[0][1]?.toLowerCase().trim() === 'nama';
const isPengendaliPTTable    = (t: RawTable) => t.length > 0 && t[0].length >= 3 && t[0][0]?.toLowerCase().trim() === 'nomor' && t[0][1]?.toLowerCase().trim() === 'nama' && (t[0][2]?.toLowerCase().includes('alamat') || t[0].length === 4);
const isPengirimTable        = (t: RawTable) => t.some(r => r[0]?.toLowerCase().includes('nama pengirim') || r[0]?.toLowerCase().includes('tanggal dan waktu'));

// ── Core PDF parser ───────────────────────────────────────────────────────────

function parsePdf(pdfPath: string): InterestReport {
  const raw   = runPdfBridge(pdfPath);
  const pages = raw.pages;
  if (!pages.length) throw new ParseError('PDF kosong');

  // Metadata
  const metaTable = findTable(pages, isMetadataTable) ?? [];
  const metaMap: Record<string, string> = {};
  for (const r of metaTable)
    if (r[0]?.trim() && r[1]?.trim()) metaMap[r[0].trim()] = r[1].trim();
  if (!metaMap['Nama Perusahaan']) {
    const r1 = metaTable[1];
    if (r1?.[1]?.trim()) metaMap['Nama Perusahaan'] = r1[1].trim();
  }

  // PeriodeAkhir from free text
  const periodeAkhir = parsePeriodeAkhir(pages[0]?.words ?? []);

  // Pemegang Saham
  const pemegangSaham: PemegangSaham[] = [];
  for (const { table } of findAllTables(pages, isPemegangTable)) {
    for (let i = 1; i < table.length; i++) {
      const r = table[i];
      if (!r) continue;
      const nama = clean(r[1]);
      if (!nama || nama.toLowerCase() === 'nama' || nama.toLowerCase().includes('jumlah saham')) continue;
      pemegangSaham.push({
        kategori: clean(r[0]) || 'Pemegang Saham > 5%',
        nama, alamat: clean(r[2]), jabatan: clean(r[3]),
        jumlahSahamSebelumnya: num(r[4]), persenSahamSebelumnya: pct(r[5]),
        jumlahSahamBulanIni:   num(r[6]), persenSahamBulanIni:   pct(r[7]),
        isPengendali: (r[8] ?? '').includes('X'),
        isAfiliasi:   (r[9] ?? '').includes('X'),
      });
    }
  }

  // Kategori Publik
  const kategoriPublik: KategoriPublik[] = [];
  for (const { table } of findAllTables(pages, isKategoriPublikTable))
    for (const r of table) {
      const kat = clean(r[0]);
      if (!kat) continue;
      kategoriPublik.push({
        kategori: kat, jumlahSahamSebelumnya: num(r[1]), persenSebelumnya: pct(r[2]),
        jumlahSahamBulanIni: num(r[3]), persenBulanIni: pct(r[4]),
      });
    }
  const totalSaham = kategoriPublik.find(r => r.kategori.toLowerCase() === 'total')?.jumlahSahamBulanIni ?? 0;

  // Ringkasan Pengendali
  const ringkasanPengendali: RingkasanPengendali[] = [];
  for (const r of (findTable(pages, isRingkasanTable) ?? [])) {
    const nama = clean(r[0]);
    if (!nama || nama.toLowerCase() === 'nama') continue;
    ringkasanPengendali.push({
      nama, jumlahSahamSebelumnya: num(r[1]), persentaseSebelumnya: pct(r[2]),
      jumlahSahamBulanIni: num(r[3]), persentaseBulanIni: pct(r[4]),
    });
  }

  // Free Float
  const freeFloat: FreeFloatRow[] = [];
  for (const r of (findTable(pages, isFreeFloatTable) ?? [])) {
    const ket = clean(r[0]);
    if (!ket || ket.toLowerCase() === 'keterangan') continue;
    freeFloat.push({ keterangan: ket, bulanSebelumnya: num(r[1]), bulanIni: num(r[2]) });
  }

  // Jumlah Pemegang
  const jpRow = (findTable(pages, isJumlahPemegangTable) ?? [])[1] ?? [];
  const jumlahPemegang = {
    bulanSebelumnya: integer(jpRow[0]),
    bulanSekarang:   integer(jpRow[1]),
    perubahan:       integer(jpRow[2]),
  };

  // Pengirim / Tanggal
  const pengirimMap: Record<string, string> = {};
  for (const r of (findTable(pages, isPengirimTable) ?? []))
    if (r[0]?.trim() && r[1]?.trim()) pengirimMap[r[0].trim()] = r[1].trim();
  const tanggalLaporan = (pengirimMap['Tanggal dan Waktu'] ?? '').trim();

  // Penerima Manfaat
  const penerimaManfaat: string[] = [];
  for (const r of (findTable(pages, isPenerimaManfaatTable) ?? [])) {
    const nomor = (r[0] ?? '').trim();
    if (!nomor || !/^\d+$/.test(nomor)) continue;
    const cleaned = cleanName(r[1] ?? '');
    if (isValidName(cleaned)) penerimaManfaat.push(cleaned);
  }

  // Pengendali dalam bentuk PT
  let pengendaliDalamBentukPT: string[] | 'N/A' = 'N/A';
  const ptTable = findTable(pages, isPengendaliPTTable);
  if (ptTable) {
    const names: string[] = [];
    for (const r of ptTable) {
      const nomor = (r[0] ?? '').trim();
      if (!nomor || !/^\d+$/.test(nomor)) continue;
      const cleaned = cleanName(r[1] ?? '');
      if (isValidName(cleaned)) names.push(cleaned);
    }
    if (names.length > 0) pengendaliDalamBentukPT = names;
  }

  // Sum check
  const pengRow    = ringkasanPengendali.find(r => r.nama.toLowerCase().includes('pengendali') && !r.nama.toLowerCase().includes('non'));
  const nonRow     = ringkasanPengendali.find(r => r.nama.toLowerCase().includes('non'));
  const tPct       = pengRow?.persentaseBulanIni    ?? 0;
  const ntPct      = nonRow?.persentaseBulanIni     ?? 0;
  const sumCheck   = Math.abs(tPct + ntPct - 100) < 0.5;
  const ffPctRow   = freeFloat.find(r => r.keterangan.includes('% Saham Free Float'));

  const report: InterestReport = {
    metadata: {
      nomorSurat:       metaMap['Nomor Surat']      ?? '',
      namaPerusahaan:   metaMap['Nama Perusahaan']  ?? '',
      kodeEmiten:       metaMap['Kode Emiten']      ?? '',
      papanPencatatan:  metaMap['Papan Pencatatan'] ?? '',
      perihal:          metaMap['Perihal']          ?? 'Laporan Bulanan Registrasi Pemegang Efek',
      periodeAkhir,
      tanggalLaporan,
      biroAdministrasi: metaMap['Biro Administrasi Efek'] ?? '',
    },
    pemegangSaham, kategoriPublik, ringkasanPengendali, totalSaham,
    freeFloat, jumlahPemegang, penerimaManfaat, pengendaliDalamBentukPT,
    kontrolValidasi: {
      totalPengendaliPct: tPct, totalNonPengendaliPct: ntPct, sumCheck,
      shareCountCheck: totalSaham > 0, totalSahamTercatat: totalSaham,
      pctFreefloat: ffPctRow?.bulanIni ?? 0,
    },
  };

  const zod = AALIReportSchema.safeParse(report);
  if (!zod.success) {
    for (const issue of zod.error.issues)
      logger.warn(`  [${issue.path.join('.')}] ${issue.message}`);
  }

  return report;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('IDX PDF Pipeline start');
  logger.info(`Mode: ${EXCEL_ONLY ? 'excel-only' : 'full'} | force: ${FORCE} | period filter: ${FILTER_PERIOD ?? 'all'}`);

  mkdirSync(JSON_OUT_DIR,  { recursive: true });
  mkdirSync(EXCEL_OUT_DIR, { recursive: true });

  // Scan input structure
  const allPeriods = scanInputDir(INPUT_ROOT);
  if (allPeriods.length === 0) {
    logger.warn('Tidak ada period subfolder ditemukan di input/');
    return;
  }

  const periods = FILTER_PERIOD
    ? allPeriods.filter(p => p.period === FILTER_PERIOD)
    : allPeriods;

  if (periods.length === 0) {
    logger.warn(`Period "${FILTER_PERIOD}" tidak ditemukan`);
    return;
  }

  logger.info(`Periods yang akan diproses: ${periods.map(p => p.period).join(', ')}`);

  const vc = loadVC();

  for (const period of periods) {
    logger.info(`\n${'═'.repeat(55)}`);
    logger.info(`Period: ${period.period} | ${period.files.length} PDF files`);
    logger.info('═'.repeat(55));

    // ── Step 1: Determine which files need processing ──────────────────────
    const toProcess = EXCEL_ONLY
      ? []
      : FORCE
        ? period.files
        : getFilesToProcess(period.period, period.files, vc);

    if (toProcess.length === 0 && !EXCEL_ONLY) {
      logger.info('Semua file sudah up-to-date. Lanjut ke Excel export...');
    } else if (toProcess.length > 0) {
      logger.info(`File yang perlu diproses: ${toProcess.length} / ${period.files.length}`);
      const skipped = period.files.length - toProcess.length;
      if (skipped > 0) logger.info(`File dilewati (cached): ${skipped}`);
    }

    // ── Step 2: Parse PDFs → JSON ──────────────────────────────────────────
    for (const { kode, pdfPath, fileName } of toProcess) {
      logger.step(`Parsing ${fileName}`);
      try {
        const report    = parsePdf(pdfPath);
        const jsonOut   = resolve(join(JSON_OUT_DIR, `${kode}.json`));
        writeFileSync(jsonOut, JSON.stringify(report, null, 2), 'utf-8');
        registerFile(vc, period.period, kode, pdfPath, jsonOut);
        saveVC(vc); // save after each file so partial runs are recoverable
        logger.done(`Parsing ${fileName} → ${kode}.json`);
      } catch (err) {
        logger.error(`GAGAL parsing ${fileName}:`, err instanceof Error ? err.message : err);
      }
    }

    // ── Step 3: Load all JSONs for this period ─────────────────────────────
    const periodEntry = vc[period.period];
    if (!periodEntry || Object.keys(periodEntry.files).length === 0) {
      logger.warn(`Tidak ada JSON tersedia untuk period ${period.period}, skip Excel export`);
      continue;
    }

    const reports: InterestReport[] = [];
    for (const [kode, entry] of Object.entries(periodEntry.files)) {
      const jsonPath = resolve(entry.outputJson);
      if (!existsSync(jsonPath)) {
        logger.warn(`JSON tidak ditemukan untuk ${kode}: ${jsonPath}`);
        continue;
      }
      try {
        reports.push(JSON.parse(readFileSync(jsonPath, 'utf-8')) as InterestReport);
      } catch {
        logger.warn(`Gagal membaca JSON untuk ${kode}`);
      }
    }

    if (reports.length === 0) {
      logger.warn('Tidak ada report valid, skip Excel');
      continue;
    }

    // Sort by kodeEmiten alphabetically
    reports.sort((a, b) => a.metadata.kodeEmiten.localeCompare(b.metadata.kodeEmiten));

    // ── Step 4: Export Excel ───────────────────────────────────────────────
    const version   = nextExcelVersion(vc, period.period);
    const excelPath = exportToExcel(reports, version, EXCEL_OUT_DIR);
    registerExcel(vc, period.period, version, reports.length);
    saveVC(vc);

    logger.info(`Excel: ${excelPath} (${reports.length} emiten, version: ${version})`);

    console.log(`\n  Period ${period.period} selesai:`);
    console.log(`  ├─ JSON    : ${Object.keys(periodEntry.files).length} file di output/json/`);
    console.log(`  └─ Excel   : output/excel/${version}.xlsx\n`);
  }

  logger.info('Pipeline selesai.');
}

main().catch(err => {
  if (err instanceof BridgeError) {
    logger.error('Bridge error', err.message);
    if (err.stderr) logger.error('stderr:', err.stderr);
  } else if (err instanceof ValidationError) {
    logger.error('Validation error', err.message);
  } else if (err instanceof ParseError) {
    logger.error('Parse error', err.message);
  } else {
    logger.error('Unexpected error', err instanceof Error ? err.message : err);
  }
  process.exit(1);
});