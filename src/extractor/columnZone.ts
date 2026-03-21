export interface ColumnZone {
  name: string;
  xMin: number;
  xMax: number;
}

/**
 * X-zone mapping berdasarkan inspeksi koordinat aktual PDF AALI.
 * Halaman 1 tabel utama (Pemegang Saham > 5%).
 * Semua nilai dari hasil extract_words.py pada file asli.
 */
export const PAGE1_MAIN_TABLE_ZONES: ColumnZone[] = [
  { name: 'kategori',        xMin:  30,  xMax: 106 },
  { name: 'nama',            xMin: 106,  xMax: 166 },
  { name: 'alamat',          xMin: 166,  xMax: 248 },
  { name: 'jabatan',         xMin: 248,  xMax: 305 },
  { name: 'jumlahSblm',      xMin: 295,  xMax: 375 },
  { name: 'persenSblm',      xMin: 375,  xMax: 414 },
  { name: 'jumlahIni',       xMin: 414,  xMax: 490 },
  { name: 'persenIni',       xMin: 490,  xMax: 535 },
  { name: 'pengendali',      xMin: 535,  xMax: 590 },
  { name: 'afiliasi',        xMin: 590,  xMax: 650 },
];

/**
 * Halaman 1 tabel bawah (Masyarakat / Treasury / Total).
 */
export const PAGE1_PUBLIK_TABLE_ZONES: ColumnZone[] = [
  { name: 'kategori',        xMin:  30,  xMax: 230 },
  { name: 'jumlahSblm',      xMin: 230,  xMax: 315 },
  { name: 'persenSblm',      xMin: 305,  xMax: 355 },
  { name: 'jumlahIni',       xMin: 340,  xMax: 410 },
  { name: 'persenIni',       xMin: 415,  xMax: 465 },
];

export function assignColumn(x0: number, zones: ColumnZone[]): ColumnZone | null {
  for (const zone of zones) {
    if (x0 >= zone.xMin && x0 < zone.xMax) return zone;
  }
  return null;
}