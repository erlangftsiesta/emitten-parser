import { z } from 'zod';

export const MetadataSchema = z.object({
  nomorSurat: z.string().min(1),
  namaPerusahaan: z.string().min(1),
  kodeEmiten: z.string().min(1),
  papanPencatatan: z.string(),
  perihal: z.string(),
  periodeAkhir: z.string(),
  tanggalLaporan: z.string(),
  biroAdministrasi: z.string(),
});

export const PemegangSahamSchema = z.object({
  kategori: z.string(),
  nama: z.string().min(1),
  alamat: z.string(),
  jabatan: z.string(),
  jumlahSahamSebelumnya: z.number().nonnegative(),
  persenSahamSebelumnya: z.number().min(0).max(100),
  jumlahSahamBulanIni: z.number().nonnegative(),
  persenSahamBulanIni: z.number().min(0).max(100),
  isPengendali: z.boolean(),
  isAfiliasi: z.boolean(),
});

export const KategoriPublikSchema = z.object({
  kategori: z.string().min(1),
  jumlahSahamSebelumnya: z.number().nonnegative(),
  persenSebelumnya: z.number().min(0).max(100),
  jumlahSahamBulanIni: z.number().nonnegative(),
  persenBulanIni: z.number().min(0).max(100),
});

export const RingkasanPengendaliSchema = z.object({
  nama: z.string().min(1),
  jumlahSahamSebelumnya: z.number().nonnegative(),
  persentaseSebelumnya:  z.number().nonnegative(),
  jumlahSahamBulanIni:   z.number().nonnegative(),
  persentaseBulanIni:    z.number().nonnegative(),
});

export const FreeFloatRowSchema = z.object({
  keterangan: z.string().min(1),
  bulanSebelumnya: z.number().nonnegative(),
  bulanIni: z.number().nonnegative(),
});

export const JumlahPemegangSchema = z.object({
  bulanSebelumnya: z.number().nonnegative(),
  bulanSekarang: z.number().nonnegative(),
  perubahan: z.number(),
});

export const KontrolValidasiSchema = z.object({
  totalPengendaliPct: z.number(),
  totalNonPengendaliPct: z.number(),
  sumCheck: z.boolean(),
  shareCountCheck: z.boolean(),
  totalSahamTercatat: z.number().nonnegative(),
  pctFreefloat: z.number().min(0).max(100),
});

export const AALIReportSchema = z.object({
  metadata: MetadataSchema,
  pemegangSaham: z.array(PemegangSahamSchema).min(1),
  kategoriPublik: z.array(KategoriPublikSchema).min(1),
  ringkasanPengendali: z.array(RingkasanPengendaliSchema).min(1),
  totalSaham: z.number().positive(),
  freeFloat: z.array(FreeFloatRowSchema).min(1),
  jumlahPemegang: JumlahPemegangSchema,
  penerimaManfaat: z.array(z.string().min(1)).min(1),
  kontrolValidasi: KontrolValidasiSchema,
});

export type AALIReportZod = z.infer<typeof AALIReportSchema>;