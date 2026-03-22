import { z } from 'zod';

export const MetadataSchema = z.object({
  nomorSurat:       z.string(),
  namaPerusahaan:   z.string().min(1),
  kodeEmiten:       z.string().min(1),
  papanPencatatan:  z.string(),
  perihal:          z.string(),
  periodeAkhir:     z.string(), // "2026-01-31"
  tanggalLaporan:   z.string(), // "10-02-2026 14:49"
  biroAdministrasi: z.string(),
});

export const PemegangSahamSchema = z.object({
  kategori:                 z.string(),
  nama:                     z.string().min(1),
  alamat:                   z.string(),
  jabatan:                  z.string(),
  jumlahSahamSebelumnya:    z.number().nonnegative(),
  persenSahamSebelumnya:    z.number().nonnegative(),
  jumlahSahamBulanIni:      z.number().nonnegative(),
  persenSahamBulanIni:      z.number().nonnegative(),
  isPengendali:             z.boolean(),
  isAfiliasi:               z.boolean(),
});

export const KategoriPublikSchema = z.object({
  kategori:                 z.string().min(1),
  jumlahSahamSebelumnya:    z.number().nonnegative(),
  persenSebelumnya:         z.number().nonnegative(),
  jumlahSahamBulanIni:      z.number().nonnegative(),
  persenBulanIni:           z.number().nonnegative(),
});

export const RingkasanPengendaliSchema = z.object({
  nama:                     z.string().min(1),
  jumlahSahamSebelumnya:    z.number().nonnegative(),
  persentaseSebelumnya:     z.number().nonnegative(),
  jumlahSahamBulanIni:      z.number().nonnegative(),
  persentaseBulanIni:       z.number().nonnegative(),
});

export const FreeFloatRowSchema = z.object({
  keterangan:      z.string().min(1),
  bulanSebelumnya: z.number().nonnegative(),
  bulanIni:        z.number().nonnegative(),
});

export const JumlahPemegangSchema = z.object({
  bulanSebelumnya: z.number().nonnegative(),
  bulanSekarang:   z.number().nonnegative(),
  perubahan:       z.number(),
});

export const KontrolValidasiSchema = z.object({
  totalPengendaliPct:    z.number().nonnegative(),
  totalNonPengendaliPct: z.number().nonnegative(),
  sumCheck:              z.boolean(),
  shareCountCheck:       z.boolean(),
  totalSahamTercatat:    z.number().nonnegative(),
  pctFreefloat:          z.number().nonnegative(),
});

// Nama validator: tidak boleh berisi angka saja
const namaSchema = z.string()
  .min(1)
  .refine(s => !/^\d+$/.test(s.trim()), {
    message: 'Nama tidak boleh berupa angka murni',
  });

export const AALIReportSchema = z.object({
  metadata:              MetadataSchema,
  pemegangSaham:         z.array(PemegangSahamSchema).min(1),
  kategoriPublik:        z.array(KategoriPublikSchema).min(1),
  ringkasanPengendali:   z.array(RingkasanPengendaliSchema).min(1),
  totalSaham:            z.number().nonnegative(),
  freeFloat:             z.array(FreeFloatRowSchema).min(1),
  jumlahPemegang:        JumlahPemegangSchema,
  penerimaManfaat:       z.array(namaSchema).min(1),
  pengendaliDalamBentukPT: z.union([
    z.array(namaSchema).min(1),
    z.literal('N/A'),
  ]),
  kontrolValidasi:       KontrolValidasiSchema,
});

export type AALIReportZod = z.infer<typeof AALIReportSchema>;