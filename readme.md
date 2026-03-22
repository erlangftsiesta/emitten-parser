# IDX PDF Pipeline

Parser otomatis **Laporan Bulanan Registrasi Pemegang Efek** dari IDX (Bursa Efek Indonesia) ke JSON dan Excel.

---

## Struktur Folder Project

```
emitten-parser/
├── input/                        ← taruh PDF di sini (wajib pakai subfolder)
│   └── 01-2026/                  ← format: MM-YYYY
│       ├── AALI_2026_1_31_ID.pdf
│       ├── ABBA_2026_1_31_ID.pdf
│       └── AADI_2026_1_31_ID.pdf
│
├── output/
│   ├── json/                     ← hasil ekstraksi per emiten
│   │   ├── AALI.json
│   │   └── ABBA.json
│   └── excel/                    ← hasil export Excel per periode
│       ├── 01-2026.xlsx
│       ├── 01-2026-rev1.xlsx     ← otomatis naik versi tiap run
│       └── 01-2026-rev2.xlsx
│
├── python/
│   ├── extract_words.py          ← PDF → koordinat teks (pdfplumber)
│   ├── build_excel.py            ← JSON → Excel (openpyxl)
│   └── requirements.txt
│
├── src/                          ← TypeScript source
├── tests/
├── VersionControl.json           ← dibuat otomatis, jangan dihapus
├── package.json
└── .env
```

---

## Requirements

### Node.js
- Node.js **>= 18**
- npm

### Python
- Python **>= 3.8**
- pip

---

## Instalasi

### 1. Clone / extract project

```bash
cd emitten-parser
```

### 2. Install Node dependencies

```bash
npm install
```

### 3. Install Python dependencies

```bash
pip install -r python/requirements.txt
```

Atau manual:

```bash
pip install pdfplumber openpyxl
```

---

## Cara Pakai

### Aturan Folder Input (WAJIB)

> **Tidak boleh ada file PDF langsung di folder `input/`.  
> Semua PDF harus berada di dalam subfolder bernama `MM-YYYY`.**

```
✅ BENAR
input/
  01-2026/
    AALI_2026_1_31_ID.pdf
    ABBA_2026_1_31_ID.pdf

❌ SALAH — file langsung di input/
input/
  AALI_2026_1_31_ID.pdf
  
❌ SALAH — format nama subfolder salah
input/
  januari-2026/
  2026-01/
  jan26/
```

Format subfolder: `MM-YYYY`
- MM = bulan 2 digit (`01` sampai `12`)
- YYYY = tahun 4 digit
- Contoh valid: `01-2026`, `12-2025`, `06-2027`

---

### Run Pipeline

#### Proses semua period
```bash
npm run dev
```

Pipeline akan:
1. Scan semua subfolder di `input/`
2. Cek `VersionControl.json` — file yang sudah diproses sebelumnya di-skip
3. Parse PDF baru → simpan ke `output/json/KODE.json`
4. Export semua JSON period tersebut → `output/excel/MM-YYYY.xlsx`

#### Proses satu period tertentu
```bash
npm run period 01-2026
```

#### Paksa proses ulang semua (ignore cache)
```bash
npm run force
```

Gunakan ini kalau kamu update kode parser dan mau re-render semua PDF dari awal.

#### Hanya buat Excel baru (skip parsing PDF)
```bash
npm run excel-only -- --period 01-2026
```

Gunakan ini kalau JSON sudah ada tapi kamu mau export Excel ulang (misal ada perubahan format kolom).

---

## Skenario Umum

### Skenario 1 — Bulan baru, semua file baru

```bash
# Taruh semua PDF Februari 2026 di input/02-2026/
# Lalu:
npm run dev
```

Output: `output/excel/02-2026.xlsx`

---

### Skenario 2 — Ada tambahan file di tengah bulan

Misal: bulan Januari 2026 sudah ada 211 file, tiba-tiba ada 2 file baru tambahan.

```bash
# Taruh 2 file baru ke input/01-2026/ (biarkan yang lama tetap ada)
# Lalu:
npm run dev
```

Pipeline otomatis mendeteksi hanya 2 file baru via `VersionControl.json`,  
parse 2 itu saja, lalu buat `output/excel/01-2026-rev1.xlsx`.

Yang lama (`01-2026.xlsx`) **tidak dihapus**.

---

### Skenario 3 — File PDF diupdate (diganti isinya)

Pipeline tracking via `mtime` (modification time file).  
Kalau file PDF di-replace dengan yang baru, otomatis terdeteksi sebagai changed dan akan diparse ulang.

---

### Skenario 4 — Mau re-render semua dari awal

```bash
npm run force
```

Atau hapus manual `VersionControl.json` lalu `npm run dev`.

---

## Output JSON

Setiap PDF menghasilkan satu file JSON di `output/json/`.  
Naming: `KODE_EMITEN.json` (contoh: `AALI.json`, `ABBA.json`).

Struktur utama:

```json
{
  "metadata": {
    "nomorSurat": "FIN-IR/AAL/EXT/002/II/2026",
    "namaPerusahaan": "Astra Agro Lestari Tbk",
    "kodeEmiten": "AALI",
    "periodeAkhir": "2026-01-31",
    "tanggalLaporan": "10-02-2026 14:49"
  },
  "pemegangSaham": [...],
  "kategoriPublik": [...],
  "ringkasanPengendali": [...],
  "totalSaham": 1924688333,
  "freeFloat": [...],
  "jumlahPemegang": {
    "bulanSebelumnya": 16323,
    "bulanSekarang": 15785,
    "perubahan": 538
  },
  "penerimaManfaat": ["Djony Bunarto Tjondro", "Rudy", "..."],
  "pengendaliDalamBentukPT": ["PT Kubu Capital"] | "N/A",
  "kontrolValidasi": {
    "sumCheck": true,
    "totalSahamTercatat": 1924688333,
    "pctFreefloat": 20.3
  }
}
```

---

## Output Excel

Setiap Excel berisi **satu sheet**, satu baris per emiten, dengan kolom:

| Kolom | Sumber JSON |
|---|---|
| Month | `metadata.periodeAkhir` |
| Date of PDF | `metadata.tanggalLaporan` |
| Kode Emiten | `metadata.kodeEmiten` |
| Nomor Surat | `metadata.nomorSurat` |
| FF Saham <5% | `freeFloat[0].bulanIni` |
| FF Direksi/Komisaris <5% | `freeFloat[1].bulanIni` |
| FF Pengendali <5% | `freeFloat[2].bulanIni` |
| FF Afiliasi <5% | `freeFloat[3].bulanIni` |
| FF Treasury <5% | `freeFloat[4].bulanIni` |
| FF Porto Investasi | `freeFloat[5].bulanIni` |
| FreeFloat Total | `freeFloat[6].bulanIni` |
| FF Saham Tercatat | `freeFloat[7].bulanIni` |
| %FF | `freeFloat[8].bulanIni` |
| Total Pengendali Bulan Ini | `ringkasanPengendali[0].jumlahSahamBulanIni` |
| Total Non Pengendali Bulan Ini | `ringkasanPengendali[1].jumlahSahamBulanIni` |
| Persentase Total Pengendali | `ringkasanPengendali[0].persentaseBulanIni` |
| Persentase Total Non Pengendali | `ringkasanPengendali[1].persentaseBulanIni` |
| Pemegang Saham | `jumlahPemegang.bulanSekarang` |
| Penerima Manfaat Akhir | `penerimaManfaat` (dipisah `;`) |
| Penerima Manfaat Akhir (PT) | `pengendaliDalamBentukPT` (dipisah `;`) |

---

## VersionControl.json

File ini dibuat otomatis di root folder. **Jangan hapus** kecuali mau re-process semua dari awal.

Isinya mencatat:
- File PDF mana yang sudah diproses (beserta `mtime`)
- Path JSON outputnya
- Riwayat versi Excel yang pernah digenerate

```json
{
  "01-2026": {
    "processedAt": "2026-02-10T14:49:00.000Z",
    "files": {
      "AALI": {
        "mtime": 1707566940000,
        "outputJson": "output/json/AALI.json"
      }
    },
    "excelVersions": [
      { "version": "01-2026",     "generatedAt": "...", "fileCount": 211 },
      { "version": "01-2026-rev1","generatedAt": "...", "fileCount": 213 }
    ]
  }
}
```

---

## Tests

```bash
npm test
```

Menjalankan 30 unit test yang mencakup:
- Merge engine (spill detection antar baris tabel)
- Number parser (format Indonesia vs Anglo-Saxon, edge cases persen)
- Validator (sum check, beneficiary extraction)

---

## Troubleshooting

### Error: "Input folder tidak boleh mengandung file langsung"
Pindahkan semua PDF dari `input/` ke dalam subfolder `input/MM-YYYY/`.

### Error: "Nama subfolder tidak valid"
Pastikan nama folder persis format `MM-YYYY`. Contoh: `01-2026`, bukan `1-2026` atau `jan-2026`.

### Excel tidak terbuat
Pastikan Python dan openpyxl terinstall:
```bash
python3 -c "import openpyxl; print('OK')"
```

### Sum check WARN di log
Bukan error fatal — data tetap tersimpan. Artinya `Total Pengendali % + Total Non Pengendali %` tidak tepat 100 di PDF sumber (biasanya karena pembulatan di laporan aslinya).

### Mau lihat detail parsing satu file
```bash
node --import tsx/esm src/index.ts --period 01-2026 --force 2>&1 | grep -E "AALI|INFO|WARN|ERROR"
```