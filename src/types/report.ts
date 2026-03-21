export interface Metadata {
  nomorSurat: string;
  namaPerusahaan: string;
  kodeEmiten: string;
  papanPencatatan: string;
  perihal: string;
  periodeAkhir: string;     // "2026-01-31"
  tanggalLaporan: string;   // "2026-02-10"
  biroAdministrasi: string;
}

export interface PemegangSaham {
  kategori: string;         // "Pemegang Saham > 5%"
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
  kategori: string;         // "Masyarakat - Warkat - Scrip"
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

export interface AALIReport {
  metadata: Metadata;
  pemegangSaham: PemegangSaham[];
  kategoriPublik: KategoriPublik[];
  ringkasanPengendali: RingkasanPengendali[];
  totalSaham: number;
  freeFloat: FreeFloatRow[];
  jumlahPemegang: JumlahPemegang;
  penerimaManfaat: string[];
  kontrolValidasi: KontrolValidasi;
}