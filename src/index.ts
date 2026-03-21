/**
 * index.ts — Universal IDX Laporan Pemegang Efek parser
 *
 * Tidak ada asumsi posisi halaman atau index tabel.
 * Semua section dideteksi berdasarkan signature konten.
 *
 * Usage:
 *   node --import tsx/esm src/index.ts --input ./input/XXXX_2026_1_31_ID.pdf
 *   node --import tsx/esm src/index.ts --input ./input/XXXX_2026_1_31_ID.pdf --out ./output/result.json
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { logger } from './utils/logger.js';
import { ParseError, ValidationError, BridgeError } from './utils/errors.js';
import { runPdfBridge } from './extractor/pdfBridge.js';
import { parseNum, parsePct } from './sanitizer/numberParser.js';
import { AALIReportSchema } from './validators/reportSchema.js';
import type {
  AALIReport, PemegangSaham, KategoriPublik,
  RingkasanPengendali, FreeFloatRow,
} from './types/report.js';
import type { PageData } from './types/token.js';

// ── CLI args ──────────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const inputPath  = resolve(getArg('--input') ?? './input/AALI_2026_1_31_ID.pdf');
const outputPath = resolve(getArg('--out')   ?? `./output/${basename(inputPath, '.pdf')}_extracted.json`);

// ── Cell helpers ──────────────────────────────────────────────────────────────

const clean   = (v: string | undefined): string => (v ?? '').replace(/\n/g, ' ').trim();
const cleanN  = (v: string | undefined): string => (v ?? '').replace(/\n/g, '').trim();
const num     = (v: string | undefined): number => parseNum(cleanN(v));
const pct     = (v: string | undefined): number => parsePct(clean(v));
const integer = (v: string | undefined): number => Math.round(num(v));

// ── Section detectors — scan semua tabel semua halaman ───────────────────────

type RawTable = string[][];

interface Located {
  table: RawTable;
  pageNum: number;
  tableIdx: number;
}

/** Cari semua tabel dari seluruh halaman yang cocok dengan predikat */
function findAllTables(pages: PageData[], predicate: (t: RawTable) => boolean): Located[] {
  const results: Located[] = [];
  for (const page of pages) {
    for (let ti = 0; ti < (page.tables ?? []).length; ti++) {
      const t = page.tables[ti];
      if (predicate(t)) results.push({ table: t, pageNum: page.page, tableIdx: ti });
    }
  }
  return results;
}

function findTable(pages: PageData[], predicate: (t: RawTable) => boolean): RawTable | null {
  const found = findAllTables(pages, predicate);
  return found.length > 0 ? found[0].table : null;
}

// Signature detectors berdasarkan header/konten — bukan posisi

const isMetadataTable = (t: RawTable): boolean =>
  t.some(r => r[0]?.toLowerCase().includes('nomor surat') ||
              r[0]?.toLowerCase().includes('kode emiten'));

const isPemegangTable = (t: RawTable): boolean =>
  t.length > 0 && t[0].some(h =>
    h?.toLowerCase().includes('jumlah saham') &&
    h?.toLowerCase().includes('sebelumnya')
  ) && t[0].some(h => h?.toLowerCase().includes('nama'));

const isKategoriPublikTable = (t: RawTable): boolean =>
  t.some(r => r[0]?.toLowerCase().includes('masyarakat'));

const isRingkasanPengendaliTable = (t: RawTable): boolean =>
  t.some(r =>
    r[0]?.toLowerCase().includes('total pengendali') ||
    r[0]?.toLowerCase().includes('total non pengendali')
  );

const isFreeFloatTable = (t: RawTable): boolean =>
  t.length > 0 && (
    t[0][0]?.toLowerCase() === 'keterangan' ||
    t.some(r => r[0]?.toLowerCase().includes('saham free float'))
  );

const isJumlahPemegangTable = (t: RawTable): boolean =>
  t.length > 0 && (
    t[0][0]?.toLowerCase().includes('bulan sebelumnya') ||
    t[0][1]?.toLowerCase().includes('bulan sekarang')
  );

const isPenerimaMaafaatTable = (t: RawTable): boolean =>
  t.length > 0 &&
  t[0][0]?.toLowerCase().trim() === 'nomor' &&
  t[0][1]?.toLowerCase().trim() === 'nama' &&
  t[0].length === 2; // hanya 2 kolom: nomor + nama (bukan tabel pengendali PT yang 4 kolom)

const isPengirimTable = (t: RawTable): boolean =>
  t.some(r => r[0]?.toLowerCase().includes('nama pengirim') ||
              r[0]?.toLowerCase().includes('tanggal dan waktu'));

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  logger.info(`Pipeline start: ${basename(inputPath)}`);

  if (!existsSync(inputPath)) {
    logger.error(`File tidak ditemukan: ${inputPath}`);
    process.exit(1);
  }

  // ── FASE 1: Extraction ─────────────────────────────────────────────────────
  logger.step('Fase 1: PDF extraction');
  const raw = runPdfBridge(inputPath);
  logger.done('Fase 1: PDF extraction');

  const pages = raw.pages;
  logger.info(`Halaman: ${pages.length}, Total tabel: ${pages.reduce((s, p) => s + p.tables.length, 0)}`);

  // ── FASE 2: Section parsing ────────────────────────────────────────────────
  logger.step('Fase 2: Section parsing');

  // — Metadata —
  const metaTable = findTable(pages, isMetadataTable) ?? [];
  const metaMap: Record<string, string> = {};
  for (const row of metaTable) {
    if (row[0]?.trim() && row[1]?.trim()) {
      metaMap[row[0].trim()] = row[1].trim();
    }
  }
  // Fallback: nama perusahaan sering di row[1] col[1] tanpa label
  if (!metaMap['Nama Perusahaan']) {
    const r1 = metaTable[1];
    if (r1?.[1]?.trim()) metaMap['Nama Perusahaan'] = r1[1].trim();
  }

  // — Pemegang Saham (bisa lintas halaman, kumpulkan semua tabel yang cocok) —
  const pemegangSaham: PemegangSaham[] = [];
  const pemegangTables = findAllTables(pages, isPemegangTable);
  logger.info(`Tabel pemegang ditemukan: ${pemegangTables.length} (${pemegangTables.map(t => `hal.${t.pageNum}`).join(', ')})`);

  for (const { table } of pemegangTables) {
    for (let i = 1; i < table.length; i++) {
      const row = table[i];
      if (!row) continue;
      const nama = clean(row[1]);
      if (!nama || nama.toLowerCase() === 'nama') continue;
      // Skip baris yang sebenarnya header (nama = header kolom)
      if (nama.toLowerCase().includes('jumlah saham')) continue;

      pemegangSaham.push({
        kategori:              clean(row[0]) || 'Pemegang Saham > 5%',
        nama,
        alamat:                clean(row[2]),
        jabatan:               clean(row[3]),
        jumlahSahamSebelumnya: num(row[4]),
        persenSahamSebelumnya: pct(row[5]),
        jumlahSahamBulanIni:   num(row[6]),
        persenSahamBulanIni:   pct(row[7]),
        isPengendali:          (row[8] ?? '').includes('X'),
        isAfiliasi:            (row[9] ?? '').includes('X'),
      });
    }
  }

  // — Kategori Publik —
  const kategoriPublik: KategoriPublik[] = [];
  const katTables = findAllTables(pages, isKategoriPublikTable);
  for (const { table } of katTables) {
    for (const row of table) {
      if (!row || !row[0]) continue;
      const kat = clean(row[0]);
      if (!kat) continue;
      kategoriPublik.push({
        kategori:              kat,
        jumlahSahamSebelumnya: num(row[1]),
        persenSebelumnya:      pct(row[2]),
        jumlahSahamBulanIni:   num(row[3]),
        persenBulanIni:        pct(row[4]),
      });
    }
  }

  const totalRow = kategoriPublik.find(r => r.kategori.toLowerCase() === 'total');
  const totalSaham = totalRow?.jumlahSahamBulanIni ?? 0;

  // — Ringkasan Pengendali —
  const ringkasanPengendali: RingkasanPengendali[] = [];
  const ringkasanTable = findTable(pages, isRingkasanPengendaliTable) ?? [];
  for (const row of ringkasanTable) {
    if (!row || !row[0]) continue;
    const nama = clean(row[0]);
    if (!nama || nama.toLowerCase() === 'nama') continue;
    ringkasanPengendali.push({
      nama,
      jumlahSahamSebelumnya: num(row[1]),
      persentaseSebelumnya:  pct(row[2]),
      jumlahSahamBulanIni:   num(row[3]),
      persentaseBulanIni:    pct(row[4]),
    });
  }

  // — Free Float —
  const freeFloat: FreeFloatRow[] = [];
  const ffTable = findTable(pages, isFreeFloatTable) ?? [];
  for (const row of ffTable) {
    if (!row || !row[0]) continue;
    const ket = clean(row[0]);
    if (!ket || ket.toLowerCase() === 'keterangan') continue;
    freeFloat.push({
      keterangan:      ket,
      bulanSebelumnya: num(row[1]),
      bulanIni:        num(row[2]),
    });
  }

  // — Jumlah Pemegang Saham —
  const jpTable = findTable(pages, isJumlahPemegangTable) ?? [];
  const jpDataRow = jpTable[1] ?? [];
  const jumlahPemegang = {
    bulanSebelumnya: integer(jpDataRow[0]),
    bulanSekarang:   integer(jpDataRow[1]),
    perubahan:       integer(jpDataRow[2]),
  };

  // — Pengirim / Tanggal —
  const pengirimTable = findTable(pages, isPengirimTable) ?? [];
  const pengirimMap: Record<string, string> = {};
  for (const row of pengirimTable) {
    if (row[0]?.trim() && row[1]?.trim()) {
      pengirimMap[row[0].trim()] = row[1].trim();
    }
  }

  logger.done('Fase 2: Section parsing');

  // ── FASE 3: Validation ─────────────────────────────────────────────────────
  logger.step('Fase 3: Integrity validation');

  // — Penerima Manfaat —
  // Cari tabel dengan signature: 2 kolom, col[0]="Nomor", col[1]="Nama"
  // Jumlah bisa bervariasi (1, 4, 10, dst) — tidak hardcode angka
  const penerimaManfaat: string[] = [];
  const pmTable = findTable(pages, isPenerimaMaafaatTable);
  if (pmTable) {
    for (const row of pmTable) {
      if (!row || !row[1]) continue;
      const nomor = (row[0] ?? '').trim();
      if (!nomor || !/^\d+$/.test(nomor)) continue; // skip non-nomor (header)
      // Bersihkan boilerplate "(mohon merujuk...)" jika ada
      const cleaned = row[1]
        .replace(/\s*\(mohon merujuk.*?\)/gi, '')
        .replace(/\n/g, ' ')
        .trim();
      if (cleaned) penerimaManfaat.push(cleaned);
    }
  }
  logger.info(`Penerima manfaat ditemukan: ${penerimaManfaat.length} nama`);

  // — Sum check pengendali —
  const pengendaliRow    = ringkasanPengendali.find(r =>
    r.nama.toLowerCase().includes('pengendali') && !r.nama.toLowerCase().includes('non')
  );
  const nonPengendaliRow = ringkasanPengendali.find(r =>
    r.nama.toLowerCase().includes('non')
  );
  const totalPengendaliPct    = pengendaliRow?.persentaseBulanIni    ?? 0;
  const totalNonPengendaliPct = nonPengendaliRow?.persentaseBulanIni ?? 0;
  const sumTotal = totalPengendaliPct + totalNonPengendaliPct;
  const sumCheck = Math.abs(sumTotal - 100) < 0.5;

  if (!sumCheck) {
    logger.warn(`Sum check: ${totalPengendaliPct} + ${totalNonPengendaliPct} = ${sumTotal} (bukan 100, toleransi 0.5)`);
  }

  const ffPctRow = freeFloat.find(r => r.keterangan.includes('% Saham Free Float'));
  const pctFreefloat = ffPctRow?.bulanIni ?? 0;

  logger.done('Fase 3: Integrity validation');

  // ── BUILD OUTPUT ───────────────────────────────────────────────────────────
  logger.step('Build & schema validate output');

  // Ekstrak tanggal laporan dari pengirimMap
  const tglLaporan = pengirimMap['Tanggal dan Waktu']?.split(' ')[0] ?? '';

  const report: AALIReport = {
    metadata: {
      nomorSurat:       metaMap['Nomor Surat']      ?? '',
      namaPerusahaan:   metaMap['Nama Perusahaan']  ?? '',
      kodeEmiten:       metaMap['Kode Emiten']      ?? '',
      papanPencatatan:  metaMap['Papan Pencatatan'] ?? '',
      perihal:          metaMap['Perihal']          ?? 'Laporan Bulanan Registrasi Pemegang Efek',
      periodeAkhir:     '2026-01-31',
      tanggalLaporan:   tglLaporan,
      biroAdministrasi: metaMap['Biro Administrasi Efek'] ?? '',
    },
    pemegangSaham,
    kategoriPublik,
    ringkasanPengendali,
    totalSaham,
    freeFloat,
    jumlahPemegang,
    penerimaManfaat,
    kontrolValidasi: {
      totalPengendaliPct,
      totalNonPengendaliPct,
      sumCheck,
      shareCountCheck: totalSaham > 0,
      totalSahamTercatat: totalSaham,
      pctFreefloat,
    },
  };

  // Zod validation
  const zodResult = AALIReportSchema.safeParse(report);
  if (!zodResult.success) {
    logger.warn('Zod schema issues:');
    for (const issue of zodResult.error.issues) {
      logger.warn(`  [${issue.path.join('.')}] ${issue.message}`);
    }
  } else {
    logger.info('Zod schema: VALID');
  }

  logger.done('Build & schema validate output');

  // ── WRITE OUTPUT ───────────────────────────────────────────────────────────
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  logger.info(`Output: ${outputPath}`);

  console.log('\n' + '─'.repeat(60));
  console.log(`SUMMARY — ${metaMap['Kode Emiten'] ?? basename(inputPath)}`);
  console.log('─'.repeat(60));
  console.log(`  Nama Perusahaan      : ${metaMap['Nama Perusahaan'] ?? '-'}`);
  console.log(`  Pemegang Saham       : ${pemegangSaham.length} entri`);
  console.log(`  Kategori Publik      : ${kategoriPublik.length} entri`);
  console.log(`  Total Saham          : ${totalSaham.toLocaleString('id-ID')}`);
  console.log(`  % Free Float         : ${pctFreefloat}%`);
  console.log(`  Sum Check (100%)     : ${sumCheck ? 'PASS ✓' : 'WARN ⚠'}`);
  console.log(`  Penerima Manfaat     : ${penerimaManfaat.length} nama`);
  console.log(`  Jumlah Pemegang      : ${jumlahPemegang.bulanSekarang.toLocaleString('id-ID')}`);
  console.log('─'.repeat(60) + '\n');
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
    logger.error('Unexpected error', err);
  }
  process.exit(1);
});