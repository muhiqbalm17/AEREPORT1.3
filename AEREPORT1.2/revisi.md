# RENCANA REVISI SISTEM (REVISI.MD)
## STATUS: SELESAI DITERAPKAN & DISINKRONISASI (100% COMPLETED)
## FITUR: PERBAIKAN SCROLL & GESTUR GESER HORIZONTAL TABEL JADWAL & MONITORING INSPEKSI DI HP (MOBILE HORIZONTAL SWIPE)
## DOKUMEN RUJUKAN: PRD.MD (SISTEM REPORT PEKERJAAN AUTO ELECTRICIAN - PT SMA KONAWE)
## PENANGGUNG JAWAB: ZETTBOT BY ZETTBOS (SYSTEM ARCHITECT & LEAD ENGINEERING MENTOR)
## PRINSIP KERJA: ZERO BACKEND CHANGES / "JANGAN UBAH SCRIPT APAPUN" (code.gs 100% UTUH)

---

### 1. ANALISIS KELUHAN & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Pengguna menyampaikan instruksi perbaikan:
> *1. Perbaiki tabel pada menu jadwal & monitoring prediktif inspeksi electrical & AC yang pada saat dibuka di hp tidak bisa di geser*  
> *"Jangan ubah script apapun"!!!*

Berdasarkan audit komprehensif pada struktur DOM dan stylesheet:

1. **Akar Masalah 1 — Kelas Pembungkus Tabel Non-Scrollable (`.table-responsive`):**
   - Pada [index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/index.html) baris 974 dan [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html) baris 3333, tabel `#inspScheduleTable` dibungkus dengan:
     ```html
     <div class="table-responsive">
         <table class="data-table" id="inspScheduleTable">
     ```
   - Sementara seluruh tabel lain di aplikasi (Tabel Report Pekerjaan baris 409, Breakdown baris 527, FAR baris 804, PM baris 1498, Battery baris 1676) menggunakan kelas `.table-container`.

2. **Akar Masalah 2 — `.table-responsive` Kehilangan Properti `overflow-x: auto`:**
   - Di [css.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/css.html) baris 875 dan baris 1826 (`@media (max-width: 768px)`), aturan `overflow-x: auto !important;`, `width: 100% !important;`, dan `-webkit-overflow-scrolling: touch !important;` **hanya** didefinisikan untuk selector `.table-container`.
   - Selector `.table-responsive` hanya muncul di baris 2312 untuk `overscroll-behavior` dan `touch-action`, namun **TIDAK memiliki deklarasi `overflow-x: auto;` sama sekali**.
   - Secara default CSS, nilai `overflow-x` pada `div` adalah `visible`.

3. **Akar Masalah 3 — Terpotong & Terkunci oleh Kontainer Induk `.card`:**
   - Elemen induk dari tabel ini adalah `.card` (baris 842 di [index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/index.html)), di mana styling CSS global pada [css.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/css.html) baris 328 secara tegas menetapkan:
     ```css
     .card {
       ...
       overflow: hidden !important;
     }
     ```
   - **Dampak Kritis:** Tabel `#inspScheduleTable` memiliki 9 kolom (NO, NO UNIT, MODEL, HM TERAKHIR, TGL UPDATE, TARGET HM, SISA HM, STATUS URGENSI, AKSI) dengan kebutuhan lebar minimal ~780px. Ketika dibuka di layar smartphone (lebar 360px - 412px), tabel melebar keluar. Karena pembungkusnya (`.table-responsive`) bukan scroll-container, tabel terpotong paksa oleh `.card` yang `overflow: hidden`. Layar sentuh HP tidak mendeteksi area scroll horizontal, sehingga gestur geser/swipe jari **macet total (tidak bisa digeser)**.

---

### 2. RANCANGAN SOLUSI TEKNIS (ZERO BACKEND CHANGES)

Sesuai instruksi mutlak pengguna (*"Jangan ubah script apapun"*: backend `code.gs`, `setup.gs`, `migrate_to_supabase.gs` 100% TIDAK DISENTUH), perbaikan dikerjakan murni pada lapisan CSS dan HTML frontend:

```
                            [LAYAR SMARTPHONE / HP (360px - 412px)]
                                              │
                                              ▼
                    ┌───────────────────────────────────────────────────┐
                    │  .card { overflow: hidden !important; }           │
                    │                                                   │
                    │  ┌─────────────────────────────────────────────┐  │
                    │  │ .table-container.table-responsive           │  │
                    │  │  - width: 100% !important;                  │  │
                    │  │  - overflow-x: auto !important; (AKTIF)     │  │
                    │  │  - -webkit-overflow-scrolling: touch !imp;  │  │
                    │  │  - touch-action: pan-x pan-y !important;    │  │
                    │  │                                             │  │
                    │  │  ┌───────────────────────────────────────┐  │  │
                    │  │  │ #inspScheduleTable (min-width: 780px) │  │  │
                    │  │  │ [NO][UNIT][MODEL][HM][TGL][TARGET]... │  │  │
                    │  │  │ ◄─── BISA DIGESER MULUS KE KANAN ───► │  │  │
                    │  │  └───────────────────────────────────────┘  │  │
                    │  └─────────────────────────────────────────────┘  │
                    └───────────────────────────────────────────────────┘
```

#### Rincian Tindakan Teknis:

1. **Harmonisasi Markup Kontainer di `index.html` & `dist/index.html`:**
   - Mengubah wrapper tabel jadwal inspeksi dari:
     ```html
     <div class="table-responsive">
     ```
     menjadi:
     ```html
     <div class="table-container table-responsive">
     ```
   - Hal ini langsung memberikan warisan styling standar dari `.table-container`: border navy solid, custom scrollbar, tinggi proporsional, dan kemampuan scroll dua arah yang konsisten dengan tabel-tabel lainnya.

2. **Perkuatan Aturan CSS Global & Mobile di `css.html` & `dist/index.html`:**
   - Menambahkan selector `.table-responsive` ke blok `.table-container` desktop (baris 875):
     ```css
     .table-container,
     .table-responsive {
       width: 100%;
       max-width: 100%;
       overflow-x: auto !important;
       overflow-y: auto;
       max-height: 480px !important;
       ...
     }
     ```
   - Menambahkan selector `.table-responsive` ke blok mobile `@media (max-width: 768px)` (baris 1826):
     ```css
     .table-container,
     .table-responsive {
       width: 100% !important;
       max-width: 100% !important;
       overflow-x: auto !important;
       overflow-y: auto !important;
       max-height: 400px !important;
       -webkit-overflow-scrolling: touch !important;
       touch-action: pan-x pan-y !important;
       overscroll-behavior-x: contain !important;
       overscroll-behavior-y: auto !important;
       border-radius: var(--radius-sm) !important;
     }
     ```
   - Mengunci lebar minimum `#inspScheduleTable` di mobile agar seluruh 9 kolom tersaji rapi dalam 1 baris tanpa teks saling tumpang tindih (*text wrapping* liar):
     ```css
     @media (max-width: 768px) {
       #inspScheduleTable {
         min-width: 780px !important;
         width: max-content !important;
       }
       #inspScheduleTable th,
       #inspScheduleTable td {
         white-space: nowrap !important;
       }
     }
     ```

3. **Sinkronisasi Bundel Standalone (`dist/index.html`):**
   - Menyelaraskan seluruh perbaikan markup dan CSS di atas ke dalam [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html) sehingga build Vercel / PWA Standalone langsung otomatis mutakhir dan responsif.

---

### 3. DAFTAR BERKAS YANG DIUBAH VS BERKAS YANG AMAN

| Nama Berkas | Aksi | Status Keamanan & Catatan |
| :--- | :--- | :--- |
| **`code.gs`** | ❌ **DILARANG DIUBAH** | **100% UTUH. Tidak disentuh satu karakter pun sesuai instruksi.** |
| **`setup.gs`** | ❌ **TIDAK DIUBAH** | Struktur skema database Sheets aman & utuh. |
| **`migrate_to_supabase.gs`** | ❌ **TIDAK DIUBAH** | Script migrasi backend aman & utuh. |
| [index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/index.html) | ✅ **EDIT (Frontend)** | Penyelarasan kelas pembungkus `<div class="table-container table-responsive">`. |
| [css.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/css.html) | ✅ **EDIT (Frontend)** | Penambahan `overflow-x: auto !important;` pada `.table-responsive` & `min-width: 780px` pada `#inspScheduleTable` di layar HP. |
| [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html) | ✅ **EDIT (Build)** | Penyelarasan markup dan CSS pada bundel standalone distribusi. |
| [prd.md](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/prd.md) | ✅ **DOKUMENTASI** | Pencatatan changelog resmi v5.2 setelah eksekusi selesai. |

---

### 4. STATUS IMPLEMENTASI & VERIFIKASI SELESAI

Persetujuan pengguna **"OKE TERAPKAN"** telah dieksekusi secara sukses dan tervalidasi penuh:

- [x] **Harmonisasi Wrapper Markup**: `<div class="table-container table-responsive">` telah dipasang di [index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/index.html) dan [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html).
- [x] **Desktop Scroll & Kontainer Navy**: Selector `.table-responsive` telah digabungkan ke blok `.table-container` di [css.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/css.html) dan [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html) dengan `overflow-x: auto !important;`, border navy solid, dan custom scrollbar.
- [x] **Mobile Touch & Horizontal Swipe**: Aturan `@media (max-width: 768px)` pada [css.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/css.html) dan [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html) telah dilengkapi `overflow-x: auto !important;`, `-webkit-overflow-scrolling: touch !important;`, dan `touch-action: pan-x pan-y !important;`.
- [x] **Kerapian Kolom Selancar Mobile**: Tabel `#inspScheduleTable` diatur dengan `min-width: 780px !important;` dan `white-space: nowrap !important;` pada th/td sehingga seluruh 9 kolom meluncur mulus tanpa teks bertumpuk atau terpotong.
- [x] **Sinkronisasi Bundel Standalone**: Berkas [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html) telah disinkronkan 100% identik dengan source code aplikasi.
- [x] **Jaminan Backend Utuh**: Berkas backend ([code.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/code.gs), [setup.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/setup.gs), [migrate_to_supabase.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/migrate_to_supabase.gs)) **100% TIDAK DISENTUH SAMA SEKALI**.
- [x] **Pencatatan Master Context**: Telah dicatat resmi pada [prd.md](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/prd.md) (Log Pembaruan Resmi v5.2).
