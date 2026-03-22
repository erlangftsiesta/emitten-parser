export interface Metadata {
  nomorSurat: string;
  namaPerusahaan: string;
  kodeEmiten: string;
  papanPencatatan: string;
  perihal: string;
  periodeAkhir: string;      // "2026-01-31" — dari teks "berakhir pada DD MonthName YYYY"
  tanggalLaporan: string;    // "10-02-2026 14:49" — dari tabel "Tanggal dan Waktu"
  biroAdministrasi: string;
}

export interface PemegangSaham {
  kategori: string;
  nama: string;
  alamat: string;
  jabatan: string;
  jumlahSahamSebelumnya: number;
  persenSahamSebelumnya: number;
  jumlahSahamBulanIni: number;
  persenSahamBulanIni: number;
  isPengendali: boolean;
  isAfiliasi: boolean;
}

export interface KategoriPublik {
  kategori: string;
  jumlahSahamSebelumnya: number;
  persenSebelumnya: number;
  jumlahSahamBulanIni: number;
  persenBulanIni: number;
}

export interface RingkasanPengendali {
  nama: string;
  jumlahSahamSebelumnya: number;
  persentaseSebelumnya: number;
  jumlahSahamBulanIni: number;
  persentaseBulanIni: number;
}

export interface FreeFloatRow {
  keterangan: string;
  bulanSebelumnya: number;
  bulanIni: number;
}

export interface JumlahPemegang {
  bulanSebelumnya: number;
  bulanSekarang: number;
  perubahan: number;
}

export interface KontrolValidasi {
  totalPengendaliPct: number;
  totalNonPengendaliPct: number;
  sumCheck: boolean;
  shareCountCheck: boolean;
  totalSahamTercatat: number;
  pctFreefloat: number;
}

export interface InterestReport {
  metadata: Metadata;
  pemegangSaham: PemegangSaham[];
  kategoriPublik: KategoriPublik[];
  ringkasanPengendali: RingkasanPengendali[];
  totalSaham: number;
  freeFloat: FreeFloatRow[];
  jumlahPemegang: JumlahPemegang;
  // Array nama bersih, sudah tervalidasi (tidak mengandung angka murni)
  penerimaManfaat: string[];
  // Nama PT pengendali dari tabel "Pengendali dari Pemegang Saham Pengendali dalam bentuk PT"
  // "N/A" jika section tidak ada di dokumen
  pengendaliDalamBentukPT: string[] | "N/A";
  kontrolValidasi: KontrolValidasi;
}