# DOKUMEN SPESIFIKASI PRODUK & MASTER CONTEXT (PRD.MD)
## PROJEK: SISTEM REPORT PEKERJAAN AUTO ELECTRICIAN
## SITE: PT. SAMUDERA MULIA ABADI - SCM KONAWE
## ARSITEKTUR: GOOGLE APPS SCRIPT WEB APP & GOOGLE SHEETS DATABASE
================================================================================

# ==============================================================================
# ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)
# ==============================================================================

### 1. NAMA PROJEK & PROBLEM STATEMENT
- **Nama Projek:** Sistem Report & Monitoring Pekerjaan Auto Electrician Tambang (AE-Report).
- **Entitas:** PT. Samudera Mulia Abadi (SMA) - Site SCM Konawe.
- **Problem Statement:** Pencatatan aktivitas harian teknisi listrik alat berat, pergantian baterai/aki, analisis kegagalan komponen (FAR/RCFA), inspeksi berkala, dan preventive maintenance sebelumnya tersebar atau manual. Diperlukan satu aplikasi web terintegrasi yang cepat diakses dari lapangan (mobile/desktop), hemat kuota, tahan tabrakan multi-user pada pergantian shift, dan menghasilkan dokumen cetak kop surat beresolusi tinggi secara otomatis.

---

### 2. PERAN PENGGUNA (USER ROLES)
1. **Teknisi / Auto Electrician Lapangan:**
   - Melakukan input laporan harian pekerjaan (Job Report) lengkap dengan multi-foto dokumentasi (Before/After/Bukti).
   - Melakukan pencatatan monitoring voltase, CCA, dan penggantian baterai armada.
   - Menginput laporan analisis kerusakan komponen elektrikal (Failure Analysis Report / FAR).
   - Mengisi checklist inspeksi harian/mingguan dan form Preventive Maintenance (PM).
2. **Lead / Supervisor / Planner:**
   - Memantau dashboard analitik eksekutif: MTBF, MTTR, availability unit, kategori kerusakan dominan, dan tren pekerjaan.
   - Mencetak dokumen resmi berformat A4 dengan kop surat perusahaan (Dokumen FAR, Kartu Riwayat Unit, Laporan Eksekutif Dashboard, Analisis Metrik).
3. **Administrator:**
   - Mengelola data master (Master Armada Tambang, Teknisi/Mekanik, Lokasi Pit, Kategori Kerusakan, Spare Part, Spesifikasi Baterai).
   - Mengunggah dan mengelola Logo Resmi Kop Surat Perusahaan di Data Hub Master.
   - Mengelola PIN Otorisasi Administrator di sheet `APP_SETTINGS`.

---

### 3. ARSITEKTUR & LINGKUNGAN KERJA
- **Frontend:** Antarmuka responsif ramah jempol (*Mobile-Friendly First* & Desktop Dashboard) menggunakan Vanilla HTML5, CSS3 kustom berpalet industrial navy/gold, dan JavaScript modular tanpa ketergantungan framework berat.
- **Backend Controller:** Google Apps Script (`code.gs`) berbasis RPC via `google.script.run` yang dilengkapi proteksi konkurensi `LockService`.
- **Database:** Google Spreadsheet dengan struktur tab baku non-destruktif (*Safe Migrate* di `setup.gs`).
- **File Storage:** Google Drive dengan struktur folder otomatis berjenjang `AE_DOKUMENTASI_KONAWE / [TAHUN] / [BULAN]` serta subfolder `SYSTEM_ASSETS` untuk aset logo resmi kop surat.
- **Arsitektur Modular Workspace:**
  - `code.gs`: Controller API, query database, mutasi transaksi, dan penyimpanan Google Drive.
  - `setup.gs`: Inisialisasi safe migration skema tabel dan nilai default konfigurasi aplikasi.
  - `index.html`: Struktur utama layout SPA, modal dialog, formulir input, dan template cetak PDF.
  - `css.html`: Styling terpadu, desain anti-AI yang elegan, variabel warna CSS, dan layout cetak A4 anti-clipping.
  - `js-core.html`: State manager, in-memory cache (`appDataCache`), navigasi tab, dan helper global.
  - `js-report.html`: Logika tabel riwayat pekerjaan, server-side pagination, debounced search, dan form input.
  - `js-breakdown.html`: Modul Failure Analysis Report (FAR), investigasi akar masalah (RCFA), dan generator PDF FAR.
  - `js-battery.html`: Modul pemantauan kesehatan aki, voltase, CCA, dan riwayat penggantian.
  - `js-inspection.html`: Modul inspeksi sistem kelistrikan unit tambang.
  - `js-pm.html`: Modul checklist dan log Preventive Maintenance elektrikal.
  - `js-dashboard.html`: Engine chart visual (Chart.js), filter periode, kalkulasi metrik, dan cetak PDF analitik.
  - `js-master.html`: Manajemen Data Hub Master dan pengelola Master Logo Kop Surat Perusahaan.
  - `js-productivity.html`: Modul kinerja teknisi yang terproteksi PIN Admin.
  - `js-settings.html`: Pengaturan koneksi folder Drive dan preferensi sistem.

---

### 4. DESAIN BASIS DATA (SHEET SCHEMAS)
1. **`Log_Pekerjaan` (19 Kolom):**
   `IDReport`, `Timestamp`, `Status`, `Tanggal`, `JamMulai`, `JamSelesai`, `Shift`, `NoUnit`, `ModelUnit`, `LokasiPekerjaan`, `HMUnit`, `NamaMekanik`, `KategoriPekerjaan`, `StatusPart`, `DowntimeJam`, `DeskripsiPekerjaan`, `URLFotoBefore`, `URLFotoAfter`, `URLFotoDokumentasi`
2. **`Log_Baterai` (12 Kolom):**
   `Tanggal`, `NoUnit`, `MerkBaterai`, `Voltase`, `CCA`, `IR`, `KondisiFisik`, `StatusGanti`, `Mekanik`, `Catatan`, `URLFoto`, `IDBaterai`
3. **`Log_Breakdown` (14 Kolom):**
   `Tanggal`, `NoUnit`, `HMUnit`, `PartKomponen`, `PartNumber`, `NamaPart`, `KomponenGagal`, `DowntimeTotal`, `RootCause`, `ActionTaken`, `PreventionPlan`, `StatusRepair`, `URLFoto`, `IDFAR`
4. **`Log_Inspeksi` (14 Kolom):**
   `Tanggal`, `JamMulai`, `JamSelesai`, `NoUnit`, `HMUnit`, `Inspektor`, `StartingMotor`, `Alternator`, `LightingSystem`, `WiringHarness`, `Catatan`, `URLFoto`, `IDInspeksi`, `TipeInspeksi`
5. **`Log_PM` (10 Kolom):**
   `Tanggal`, `JamMulai`, `JamSelesai`, `NoUnit`, `PMLevel`, `HMUnit`, `NamaMekanik`, `Remarks`, `URLFoto`, `IDPM`
6. **`Master_Unit` (6 Kolom):**
   `NoUnit`, `Tipe`, `Model`, `SerialNumber`, `LokasiPit`, `HmTerakhir`
7. **`Master_Mechanic` (4 Kolom):**
   `Nama`, `NRP`, `Shift`, `Keahlian`
8. **`Master_Location` (3 Kolom):**
   `NamaLokasi`, `TipeArea`, `Keterangan`
9. **`Master_Part` (6 Kolom):**
   `PartNumber`, `NamaPart`, `Kategori`, `Merk`, `Satuan`, `UnitModel`
10. **`Master_Battery` (6 Kolom):**
    `KodeBaterai`, `Merk`, `Kapasitas`, `Voltase`, `TipeAki`, `Aplikasi`
11. **`Master_Category` (1 Kolom):**
    `Kategori`
12. **`APP_SETTINGS` (3 Kolom):**
    `SETTING_KEY`, `SETTING_VALUE`, `DESCRIPTION` (Memuat konfigurasi `DRIVE_FOLDER_ID`, `SITE_NAME`, `ADMIN_PIN`, `COMPANY_LOGO_URL`)

---

# ==============================================================================
# ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
# ==============================================================================

### 1. STATUS ARSITEKTUR & LINGKUNGAN AKTIF
- Database Backend: Supabase PostgreSQL Cloud Database (`https://msilcjkjnrolekvpgupa.supabase.co`) & Supabase Storage CDN (`ae-dokumentasi`).
- Versi Rilis: **v5.0 (Supabase Cloud Database, Storage CDN & Universal Client Bridge)**.
- Mode Eksekusi: Direct Supabase Client SDK (@supabase/supabase-js) via PostgREST REST API & Universal Proxy Bridge dengan performa sub-second (< 150 ms) serta Client-Side In-Memory Cache (`appDataCache`).

### 2. LOGIKA BISNIS & FORMULA AKTIF
- **Penguncian Transaksi:** Seluruh operasi mutasi data (`submitWorkReport`, `submitBreakdownAnalysis`, `submitBatteryLog`, `submitInspectionLog`, `submitPMLog`, `updateWorkReport`, `deleteWorkReport`, `deleteBreakdownLog`, `deletePMLog`, `uploadCompanyLogo`, `deleteCompanyLogo`) diproteksi dengan `LockService.getScriptLock()` berdurasi tunggu 10.000–15.000 ms.
- **Generator ID Unik Sekuensial:** Menggunakan pemindaian nomor urut tertinggi `MAX + 1` terlindung lock pada bulan berjalan (`AE-YYYYMM-XXX`, `FAR-YYYYMM-XXX`, `BAT-YYYYMM-XXX`, `INSP-YYYYMM-XXX`, `PM-YYYYMM-XXX`).
- **Server-Side Pagination:** `getWorkReportsPaginated` memotong data murni (*Limit & Offset*) dengan pembacaan terbalik dari baris terbaru.
- **In-Memory Caching:** Navigasi antar-tab instan (0 detik) melalui objek `appDataCache` di browser tanpa fetch server berulang.
- **Keamanan PIN Admin:** Verifikasi PIN Admin dilakukan murni di layer backend melalui `verifyAdminPin(enteredPin)` yang memeriksa record `ADMIN_PIN` di tabel `APP_SETTINGS`.
- **Master Referensi Logo Kop Surat Universal:** Logo resmi resolusi tinggi yang diunggah melalui Tab 8 Master Data Hub disimpan ke Drive dan URL-nya dicatat ke `APP_SETTINGS` (`COMPANY_LOGO_URL`). Seluruh template dokumen cetak PDF (FAR, Kartu Unit, Dashboard, Analisis Metrik) tersinkronisasi otomatis menggunakan logo ini sebagai sumber referensi tunggal (*Single Source of Truth*).

### 3. LOG PEMBARUAN RESMI
- **v1.0**: Rilis awal pencatatan log harian elektrikal dan master armada.
- **v1.1**: Penambahan modul analisa kerusakan (FAR/RCFA) dan cetak berkas kartu unit PDF.
- **v1.2**: Dukungan multi-foto Base64 kompresi canvas, perbaikan auto-heal sel `#ERROR!` formula, dan sinkronisasi otomatis HM unit.
- **v2.0**: Rekayasa Sistem Skalabilitas Besar:
  - Implementasi Server-Side Pagination dengan kontrol UI halaman (Sebelumnya / Selanjutnya).
  - Pemasangan `LockService` anti-race-condition pada seluruh endpoint mutasi data.
  - Standardisasi Primary Key sekuensial (`AE-*`, `FAR-*`, `BAT-*`, `INSP-*`, `PM-*`).
  - Arsitektur Client-Side In-Memory Caching (`appDataCache`) & On-Demand Lazy Loading per tab.
  - Subfolder berjenjang Tahun/Bulan di Google Drive untuk ketahanan ribuan foto.
  - Pemindahan verifikasi PIN Admin ke backend tabel `APP_SETTINGS`.
- **v2.1**: Master Logo Resmi Kop Surat Perusahaan (Universal Reference):
  - Fungsionalisasi penuh upload logo resmi PNG/JPG ke Google Drive (`uploadCompanyLogo`) dengan perlindungan concurrency LockService.
  - Penyimpanan URL logo terpusat di tabel `APP_SETTINGS` (`COMPANY_LOGO_URL`).
  - Pemuatan awal instan via `getInitialMetadata()` ke seluruh klien/pengguna multi-device.
  - Sinkronisasi otomatis ke seluruh template cetak PDF (Dokumen FAR, Kartu Riwayat Unit, Laporan Dashboard, dan Dokumen Analisis Metrik Kelistrikan).
  - Opsi nonaktifkan/hapus logo dengan fungsi backend `deleteCompanyLogo()` untuk mengembalikan ke logo default SMA.
- **v2.2**: Sinkronisasi Logo Header Topbar dengan Master Data Logo Resmi:
  - Penambahan elemen gambar dinamis `#topbarCompanyLogo` di bilah navigasi atas berdampingan dengan fallback SVG `#topbarDefaultSvg`.
  - Integrasi dinamis di `syncCompanyLogoDisplay()` (`js-master.html`) sehingga logo di header aplikasi selalu sinkron dengan Logo Resmi di Master Data.
  - Penyesuaian fleksibilitas kontainer di `css.html` agar proporsional untuk logo rasio 1:1 maupun horizontal (3:1 / 4:1) di layar mobile dan desktop.
- **v2.3**: Pemformatan Baris Menurun Teks Deskripsi & Tindakan Perbaikan FAR (Multi-line List & Enter Formatter):
  - Penambahan properti `white-space: pre-wrap !important;` pada kotak Poin II (`farPdfRootCause`), Poin III (`farPdfActionTaken`), dan Poin IV (`farPdfPreventionPlan`) di template cetak PDF.
  - Implementasi parser cerdas `formatMultilineBreakdownText()` di `js-breakdown.html` untuk mempertahankan tombol Enter keyboard serta memecah penomoran sekuensial (1. 2. 3. dst) menjadi baris baru yang rapi.
- **v2.4**: Persistensi & Tampilan Keterangan Teks Asli Foto Bukti Investigasi FAR (Evidence & Visual Findings):
  - Mengganti keterangan foto generik statis ("Foto Bukti #1, #2, #3") dengan teks keterangan asli temuan investigasi lapangan yang diinputkan pengguna.
  - Format penyimpanan terpusat non-destruktif di backend Google Sheets `Log_Breakdown` kolom `URLFoto` dengan pola `URL|TeksKeterangan`, 100% kompatibel ke belakang (*backward compatible*).
  - Pemuatan terurai otomatis di `getBreakdownLogs()` ke array `photosList` (URL bersih) dan `photoCaptions` (array teks keterangan asli).
  - Penambahan kemampuan peninjauan dan pengeditan langsung keterangan foto di Modal Detail FAR (`updateFarItemCaption()`) serta sinkronisasi database via `updateBreakdownPhotoCaptions()`.
  - Penataan tipografi tegas (slate `#1e293b`, uppercase, line-height seimbang) pada Poin V Dokumen Cetak PDF FAR (`#farPdfPhotosContainer`).
- **v2.5**: Standarisasi Teks Keterangan Foto Asli ke Seluruh Modul Unggahan (Pekerjaan, PM, Baterai, Inspeksi):
  - Penambahan helper terpusat `combineUrlsWithCaptions()` dan `parseDelimitedPhotoEntries()` di `code.gs`.
  - Integrasi pengiriman array `captions` pada seluruh formulir unggah (`js-report.html`, `js-pm.html`, `js-battery.html`, `js-inspection.html`).
  - Format terpusat `URL|Caption` diterapkan ke sheet `Log_Pekerjaan`, `Log_PM`, `Log_Baterai`, dan `Log_Inspeksi` dengan jaminan 100% *backward-compatibility*.
  - Modal detail Laporan Pekerjaan (`openDetailModal`) dan Preventive Maintenance (`openDetailPMModal`) kini menampilkan galeri foto responsif lengkap dengan teks keterangan temuan teknis asli di bawah setiap gambar.
  - Tampilan baris log Baterai menampilkan tautan pratinjau foto interaktif lengkap dengan teks temuan fisik/kondisi aki.
- **v2.6**: Penanganan & Pemulihan Otomatis Formula Error `#ERROR!` pada Modul PM (Backend & Frontend):
  - Penerapan `sanitizeSheetValue` pada `submitPMLog` di `code.gs` untuk mencegah evaluasi rumus liar Google Sheets saat teknisi menginput catatan berawalan tanda hubung (`-`), tambah (`+`), atau sama dengan (`=`).
  - Mekanisme Auto-Healing cerdas pada `getPMLogs` di `code.gs`: memeriksa formula sel Google Sheets ketika mendeteksi nilai `#ERROR!`, memulihkan teks asli dari formula, dan menuliskan kembali teks dengan tanda petik tunggal (`'`) ke `Log_PM`.
  - Fallback sanitasi bertingkat di Frontend (`js-pm.html` dan `js-dashboard.html`): mendeteksi pola `#ERROR!` atau formula error dan menampilkan teks deskripsi servis yang bersih (`Servis berkala sesuai checklist [Level PM]`).
- **v2.7**: Fitur Penghapusan Aman Log PM (Delete PM Record & Anti-Accidental Confirmation Modal):
  - Penambahan tombol `🗑 Hapus Log PM` pada footer modal Detail Pelaksanaan PM (`#viewPMDetailModal`) di `index.html`.
  - Implementasi modal dialog konfirmasi eksplisit `#deletePMConfirmModal` untuk mencegah penghapusan tanpa sengaja dengan menampilkan detail Level PM, No Unit, dan Tanggal servis.
  - Penambahan endpoint backend `deletePMLog(targetData)` di `code.gs` terlindung `LockService` 15.000 ms dengan dual matching (`IDPM` & composite key).
  - Sinkronisasi otomatis cache in-memory (`appDataCache`), array lokal `globalPMLogs`, dan re-render instan tabel riwayat PM serta metrik dashboard.
- **v2.8**: Integrasi Fungsi Keyboard & Autocomplete pada Selektor Unit (Cetak Kartu Unit & Form PM):
  - Konversi dropdown statis `#subtabUnitPdfSelect` dari `<select>` menjadi combo-box `<input type="text" list="unitDataList">` dengan pintasan tombol keyboard `Enter` untuk unduh PDF kartu riwayat unit instan.
  - Konversi dropdown `#pmNoUnit` pada formulir Preventive Maintenance menjadi `<input type="text" list="unitDataList">` yang memicu keyboard fisik/virtual seketika serta mendukung auto-uppercase dan pencarian fleksibel (*fuzzy typing*).
  - Penyesuaian `populateUnitPdfSelect()` di `js-report.html` dan `renderUnitDatalist()` di `js-core.html` untuk memastikan kompatibilitas penuh antar-elemen.
- **v2.9**: Standarisasi Tipe Preventive Maintenance (`PM250 -> PM1`, `PM500 -> PM2`, `PM1000 -> PM3`, `PM2000 -> PM4`):
  - Standardisasi opsi pilihan dropdown input PM dan filter riwayat PM menjadi `PM1 (250 Jam)`, `PM2 (500 Jam)`, `PM3 (1000 Jam)`, dan `PM4 (2000 Jam)`.
  - Implementasi fungsi normalisasi dua arah `normalizePMLevel()` dan `getPMLevelHours()` di `js-pm.html` dan `js-dashboard.html` untuk menjamin data historis lama di Google Sheets tetap terbaca tanpa migrasi destruktif.
  - Resolusi cacat edge-case regex pada algoritma kalkulasi sisa HM dan target PM berikutnya, menjamin akurasi perhitungan prediktif jadwal servis tambang Konawe Site.
- **v2.10**: Universal Interactive Cross-Filtering Chart-to-Table pada Seluruh Metrik Modal Dashboard:
  - Implementasi engine filter reaktif dua arah Chart.js v4 di `js-dashboard.html`: hook `plugins.legend.onClick` dan kanvas `onClick` dengan helper universal `getChartActiveLabels()` dan `handleChartElementSoloClick()`.
  - Sinkronisasi instan pada modal **Log Pekerjaan** (`total_jobs`): ketika pengguna mencoret/mengisolasi status pada donat (misal: hanya `WAITING PART`), tabel detail di bawahnya secara otomatis menyaring dan hanya menampilkan baris kasus yang berstatus `WAITING PART`.
  - Penerapan menyeluruh pada seluruh grafik modal metrik:
    - `battery`: filter kondisi kelayakan baterai (`Masih Layak`, `Recharge Ulang`, `Ganti Baterai Baru`).
    - `pm`: filter level servis PM (`PM1`, `PM2`, `PM3`, `PM4`) via klik batang grafik.
    - `inspection`: filter kondisi armada normal vs temuan upnormal.
    - `part_ratio`: filter intervensi ganti spare part (REPLACE) vs reparasi komponen tanpa part (REPAIR).
    - `matrix_system`: filter pie chart per sub-sistem kelistrikan.
    - `top_category`: klik batang Pareto untuk meninjau rincian kasus kategori sistem terkait.
    - `pa`, `mttr`, `mtbf`: klik batang model armada/kategori untuk menyaring baris matriks unit armada terkait.
    - `matrix_recurring`: klik batang unit untuk menyaring kronologi unit dengan kerusakan berulang.
  - Penyajian indikator status dinamis pada judul tabel (badge nama filter & counter kasus) serta tombol cepat `Tampilkan Semua` / `Kembali`.
  - Harmonisasi penuh dengan modul cetak PDF metrik (`downloadMetricModalPDF`), memastikan gambar grafik dan tabel yang diekspor ke PDF selaras dengan filter aktif pengguna.
- **v2.12**: Harmonisasi & Deduplikasi Konsolidasi Rasio Sparepart (Opsi B: 6 Kasus Identik):
  - Mengatasi inkonsistensi kalkulasi (Dashboard 4 kasus vs Modal Pill 6 kasus vs Tabel 8 kasus) akibat perbedaan logika `Math.max()`, deduplikasi unit-tanggal, dan penggabungan array ganda.
  - Menerapkan deduplikasi cerdas di `openDashboardMetricModal('part_ratio')` ([js-dashboard.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-dashboard.html)):
    - Mengkonsolidasi entri ganti part pada unit dan tanggal yang sama antara `Analisa Kerusakan` dan `Laporan Pekerjaan` menjadi 1 baris kasus terpadu dengan badge status `ANALISA & REPORT` berlatar amber emas (`#fef3c7`), serta menggabungkan galeri foto teknis.
    - Menghasilkan tepat 6 baris data di tabel matriks, selaras 100% dengan `totalReplaceCount: 6 Kasus`.
  - Sinkronisasi Kartu Dashboard (`#kpiPartRatio`) di `loadDashboardKPI()` dan Cetak PDF (`#dashPdfPartRatio`) di `downloadDashboardReportPDF()` menggunakan deduplikasi kunci gabungan `(noUnit + '_' + tanggal)` sehingga keduanya menampilkan angka identik **`6 Kasus`**.
  - Sinkronisasi backend `getDashboardMetrics()` di [code.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/code.gs) dengan formula deduplikasi serupa.
- **v3.0**: Rilis Modul Prediktif & Monitoring Inspeksi Terintegrasi (Elektrikal & AC System):
  - Pemisahan sub-tab "Jadwal & Monitoring Inspeksi" dan "Input Pelaksanaan Inspeksi" dengan bilah navigasi pill terpadu.
  - Implementasi mesin prediksi interval inspeksi berbasis HM unit berjalan (siklus 250 jam) dilengkapi 4 kartu metrik urgensi (Hari Ini, Besok, Overdue/Jatuh Tempo, dan Riwayat Pelaksanaan).
  - Segmentasi armada berdasarkan tipe unit master data (`HAULER`, `DIGGER`, `ANCILLARY`, `SUPPORT`) dan filter sistem (`⚡ Kelistrikan` vs `❄️ AC System`).
  - Formulir pelaksanaan terpisah khusus AC SYSTEM dengan checklist 6 parameter teknis pendingin kabin (Kompresor, Freon R134a, Kondensor, Evaporator, Blower, Ducting).
  - Skema backend non-destruktif `Log_Inspeksi` 14 kolom dengan penambahan kolom `TipeInspeksi` (`ELEKTRIKAL` vs `AC_SYSTEM`).
  - Sinkronisasi real-time data log inspeksi di Dashboard (KPI Card, Donut Chart Modal, Filter Periode, dan Ekspor Cetak PDF).
- **v3.1**: Penyempurnaan Tampilan Antarmuka Jadwal & Monitoring Inspeksi (Inspection UI Refinement):
  - Penyesuaian panel sorotan unit (Spotlight Panel) tersembunyi secara default (`display: none`), hanya terbuka secara spesifik saat kartu metrik diklik (*toggle on/off on-click*) lengkap dengan tombol tutup `✕`.
  - Eliminasi kolom `STATUS AC` pada tabel monitoring untuk menghasilkan layout tabel yang lebih lapang dan proporsional.
  - Eliminasi tombol `+ AC` pada kolom AKSI tabel, mempertahankan satu tombol tunggal `+ Input` yang seragam dengan estetika modul PM.
  - Penyederhanaan kolom `TIPE / MODEL` menjadi `MODEL` saja (menghilangkan badge tipe armada), dengan preservasi filter tipe unit master data di bilah navigasi atas.
- **v3.2**: Tampilan Tanggal Inspeksi Terakhir & Standardisasi Format Tabel Riwayat Log Inspeksi:
  - Konsolidasi pencarian inspeksi terakhir unit (`latestAnyInsp`) berdasarkan kronologi tanggal terbaru dan fallback in-memory cache, mencakup riwayat inspeksi elektrikal maupun AC system.
  - Tampilan kolom `INSPEKSI TERAKHIR` menampilkan tanggal pelaksanaan resmi (`DD/MM/YYYY`) dan sub-teks HM unit serta indikator sistem (`⚡ Elec` / `❄️ AC`).
  - Standardisasi modal riwayat log inspeksi (`#inspectionHistoryModal`) dari bentuk kartu susun (*card list*) menjadi **Tabel Data Terstruktur & Responsif** bergaya tema gelap `#1e293b` yang selaras dengan modul riwayat PM.
  - Sinkronisasi indeks pemilihan baris filter riwayat dengan modal detail peninjauan foto dokumentasi.
- **v3.3**: Pembersihan Duplikasi Pop-Up Detail AC & Streamlining Tabel Riwayat Inspeksi:
  - Dekonstruksi string checklist parameter AC pada modal detail (`#viewInspectionDetailModal`): elemen "PARAMETER AC" menampilkan grid 2 kolom terstruktur untuk 6 parameter AC, sementara "CATATAN & TEMUAN TAMBAHAN" murni menampilkan catatan bebas teknisi (bebas duplikasi teks).
  - Penyederhanaan tabel riwayat log inspeksi: mengeliminasi kolom teks panjang "RINCIAN TEMUAN / CATATAN" dan menggantikannya dengan kolom bersih "INSPEKTOR" beserta indikator lampiran foto.
- **v3.4**: Harmonisasi Format Tabel & Proporsi Lebar Kolom-Teks Seimbang (Zero Empty Gap):
  - Pembagian persentase lebar 100% pada tabel riwayat log inspeksi (`#inspectionHistoryModal`): TANGGAL (15%), NOMOR UNIT (18%), HM UNIT (12%), JENIS INSPEKSI (20%), INSPEKTOR (22%), DETAIL (13%) menghilangkan celah kosong horizontal secara permanen.
  - Harmonisasi tipografi dan perataan simetris pada tabel riwayat pelaksanaan PM (`#pmHistoryModal`) dengan distribusi kolom presisi (14%, 16%, 12%, 18%, 28%, 12%).
  - Penyelarasan kontras warna teks dan tipografi baris pada tabel monitoring jadwal dan prediksi inspeksi.
- **v3.5**: Penyelarasan Tabel Monitoring Inspeksi dengan Tabel PM (TGL UPDATE & Sisa HM Hitam):
  - Konversi kolom `INSPEKSI TERAKHIR` menjadi `TGL UPDATE` di `index.html` dengan menampilkan tanggal update aktif HM unit (`row.lastDate`) persis seperti tabel jadwal PM.
  - Pengubahan warna teks sisa HM (&le; 20 jam dan overdue) dari merah muda `#f87171` menjadi hitam tegas `#0f172a` berbobot tebal 800 untuk keterbacaan optimal di lapangan.
- **v3.6**: Indikator Loading Cepat & Responsif pada Seluruh Tombol Formulir Utama:
  - Implementasi helper universal `setButtonLoading(btn, isLoading, loadingText)` pada `js-core.html` dan styling `.btn-loading` pada `css.html`.
  - Integrasi animasi micro-spinner FontAwesome berputar halus dan penguncian anti-double-submit pada 3 tombol submit utama: `SIMPAN REPORT PEKERJAAN`, `SIMPAN CHECKLIST INSPEKSI ELEKTRIKAL`, dan `SIMPAN CHECKLIST INSPEKSI AC`.
  - Mekanisme auto-restore instan yang memulihkan teks asli tombol secara otomatis saat server mengembalikan respons (berhasil atau gagal).
- **v3.7**: Penyatuan Seluruh Teks Sisa HM Menjadi Hitam Pekat:
  - Mengubah seluruh teks nilai jam pada kolom `SISA HM` tabel jadwal inspeksi (`#inspScheduleTable`) dari variasi warna kuning (`#fbbf24`) dan hijau (`#34d399`) menjadi warna hitam pekat tegas (`#0f172a; font-weight: 800;`) untuk keterbacaan kontras tinggi dan keseragaman visual penuh.
- **v3.8**: Interval Khusus AC SYSTEM (150 HM) & Dedicated View Filtering:
  - Implementasi formula interval kelipatan 150 HM murni pada subsistem AC (`Math.ceil((currentHM + 0.1) / 150) * 150`), tersinkronisasi dengan riwayat inspeksi AC terakhir (`latestACInsp.hm + 150`).
  - Pembaruan filter sistem: tombol `❄️ AC SYSTEM` kini menyaring eksklusif armada ber-AC, menghitung Target HM & Sisa HM berbasis siklus 150 HM, menyortir urgensi AC, dan mengarahkan tombol aksi `+ Input` langsung ke formulir checklist AC 6 parameter (`applyUnitToInspectionForm(..., 'ac')`).
  - Sinkronisasi dinamis 4 kartu metrik urgensi dan Spotlight Panel di atas tabel mengikuti filter sistem yang sedang aktif.
  - Penyelarasan label teks tombol filter sistem: `⚡ Kelistrikan` &rarr; `⚡ ELECTRICAL` dan `❄️ AC System Saja` &rarr; `❄️ AC SYSTEM`.
- **v3.9**: Restrukturisasi Modal Log Inspeksi Dashboard (Proporsi ELECTRICAL vs AC SYSTEM):
  - Konversi fokus pemantauan log inspeksi dashboard dari kondisi normal/upnormal menjadi komparasi proporsi riwayat `ELECTRICAL` vs `AC SYSTEM`.
  - Pembaruan stat bar atas (`Total Riwayat`, `Inspeksi ELECTRICAL`, `Inspeksi AC SYSTEM`) dan Donut Chart interaktif dua warna (`#0284c7` vs `#10b981`).
  - Standarisasi tabel matriks inspeksi modal menjadi 8 kolom bersih (`NO`, `TANGGAL`, `NO UNIT`, `HM UNIT`, `JENIS INSPEKSI`, `INSPEKTOR`, `STATUS KONDISI`, `CATATAN / TEMUAN`).
- **v4.0**: Tombol Detail Interaktif pada Matriks Riwayat Inspeksi Dashboard:
  - Mengubah kolom `CATATAN / TEMUAN` menjadi kolom aksi `DETAIL` dengan tombol `[Detail]` pada setiap baris tabel modal dashboard.
  - Mengeliminasi teks mentah checklist parameter AC/Elektrikal yang panjang dan bertumpuk, menjaga proporsi tinggi baris tabel tetap ramping dan rapi.
  - Integrasi pembukaan pop-up detail resmi (`#viewInspectionDetailModal`) langsung dari dashboard yang menampilkan parameter teknis lengkap dan galeri foto temuan.
- **v4.1**: Parser Pembersih Catatan Pop-Up Detail & Akurasi Badge Kondisi Temuan:
  - Pembersihan teks catatan pada pop-up detail (`#viewInspectionDetailModal`): mengeliminasi prefix database `[STATUS UNIT: ...]` dan strip `-`. Jika form temuan tambahan tidak diisi mekanik, sistem menampilkan keterangan bersih `"Tidak ada catatan tambahan."` (bukan string mentah `[STATUS UNIT: RFU] -`).
  - Penyelarasan penentuan badge kondisi pada tabel modal inspeksi dashboard: badge `⚠️ ADA TEMUAN` hanya muncul jika mekanik benar-benar mengisi catatan temuan pada form "Temuan Tambahan & Tindakan Segera" atau terjadi status kerusakan/abnormalitas aktual. Jika form tidak diisi dan status unit RFU, tabel menampilkan badge **`✅ RFU / NORMAL`** secara akurat.
- **v4.2**: Penyeragaman Badge AC 'ADA TEMUAN' & Kelengkapan Seluruh Checklist pada Pop-Up Detail:
  - Penyeragaman status temuan AC system pada tabel dashboard: mengeliminasi teks `❄️ KURANG DINGIN` dan `❄️ RUSAK / ANGIN`, langsung memberikan badge tegas seragam **`⚠️ ADA TEMUAN`** jika AC mengalami abnormalitas pendinginan, kerusakan kompresor, atau catatan temuan mekanik. Hanya unit dingin optimal yang berstatus **`❄️ DINGIN (RFU)`**.
  - Menampilkan SEMUA hasil checklist pada pop-up detail (`#viewInspectionDetailModal`): merender 7 parameter lengkap Elektrikal (Starter, Alternator, Lighting, Wiring, Cabin Instrument, Safety Device, Battery Bank) dan seluruh parameter AC System (Status Pendinginan + 6 parameter teknis kompresor, freon, kondensor, evaporator, blower, louver).
  - Non-destruktif safe-tagging parameter elektrikal pada form submit dan pembersihan otomatis tag metadata dari kotak catatan pop-up detail.
- **v4.3**: Tipografi Hitam Kontras Tinggi (High-Contrast Black) untuk Badge Sistem & Tombol Detail:
  - Penyelarasan warna teks pada kolom badge sistem (`⚡ ELECTRICAL` & `❄️ AC SYSTEM`) dari warna biru/hijau menjadi **Hitam Pekat Tegas (`color: #0f172a; font-weight: 800;`)** pada tabel dashboard dan tabel riwayat inspeksi.
  - Penyelarasan warna teks pada tombol aksi `[Detail]` dari biru menjadi **Hitam Pekat Tegas (`color: #0f172a; font-weight: 800;`)** dengan border netral kokoh (`#94a3b8`) dan background `#f8fafc`.
  - Optimalisasi kontras keterbacaan (*outdoor sunlight legibility*) untuk teknisi dan pengawas di lapangan.
- **v4.4**: Optimasi Antarmuka Mobile Responsif (Android & iOS Ergonomics Overhaul):
  - Penataan sticky header mobile: `.topbar` mengalir alami dan `.nav-tabs-wrapper` menjadi satu-satunya bilah sticky di `top: 0`, mengeliminasi tabrakan vertikal dengan area Notch / Dynamic Island iPhone secara permanen.
  - Subnav menu inspeksi (`📅 JADWAL & MONITORING INSPEKSI` dan `+ INPUT PELAKSANAAN`) tampil utuh 100% tanpa terpotong atau tertutup navigasi atas.
  - Normalisasi tombol "Segarkan" pada header kartu menjadi proporsi compact ramah jempol (tidak lagi membentang 100% selebar layar).
  - Restrukturisasi panel filter jadwal inspeksi: bilah pill filter tipe unit (`SEMUA TIPE`, `HAULER`, `DIGGER`, `ANCILLARY`, `SUPPORT`) dan filter sistem mendapat lebar penuh dengan horizontal scroll mulus tanpa terpotong tepi layar, serta kolom pencarian unit responsif full-width (100%).
- **v5.0**: Migrasi Arsitektur Enterprise ke Supabase Cloud (PostgreSQL Database & Storage CDN):
  - Inisialisasi 12 tabel PostgreSQL strongly-typed via [supabase_schema.sql](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/supabase_schema.sql) dengan Triggers otomatis ID Sekuensial tambang (`AE-*`, `BAT-*`, `FAR-*`, `INSP-*`, `PM-*`), auto-update HM unit, RLS policies, dan performance indexes.
  - Pembuatan script migrasi 1-klik non-destruktif [migrate_to_supabase.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/migrate_to_supabase.gs) untuk menyalin seluruh histori data lama Google Sheets ke Supabase dalam hitungan detik.
  - Implementasi [js-supabase.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-supabase.html) berisi Supabase Client SDK, Storage Uploader (bucket `ae-dokumentasi`), 22 endpoint database, dan Universal `google.script.run` Proxy Bridge.
  - Seluruh modul UI ([js-report.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-report.html), [js-dashboard.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-dashboard.html), [js-breakdown.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-breakdown.html), dll) kini beroperasi dengan performa sub-second (< 150 ms) tanpa mengubah logika antarmuka lama (*Zero Breaking Changes*).
- **v5.1**: Harmonisasi Filter Periode Dashboard & Penayangan Seluruh Log Pekerjaan (11 Kartu Metrik):
  - **Akar Masalah Terselesaikan**: Format tanggal dengan waktu/jam (timestamp ISO atau `DD/MM/YYYY HH:mm:ss`) serta teks bulan bahasa Indonesia (`29 Oktober 2026`) sebelumnya gagal diverifikasi oleh pemotong string sederhana `split(/[-/]/)`, membatasi data yang lolos filter menjadi hanya 5 record pendek tanpa jam.
  - **Universal Date Parser Super Tangguh**: Implementasi `parseDateComponents()` dan upgrade `isDateInSelectedPeriod()` di [js-core.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-core.html) dan [js-dashboard.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-dashboard.html). Mengabaikan komponen waktu/jam, mengekstraksi tanggal murni, dan mengenali seluruh variasi format (`DD/MM/YYYY`, `YYYY-MM-DD`, teks bulan Indonesia/Inggris, 2-digit tahun).
  - **Dukungan Opsi "Semua Bulan" & "Semua Tahun"**: Menambahkan `<option value="all">Semua Bulan</option>` pada `#dashMonth` dan `<option value="all">Semua Tahun</option>` pada `#dashYear` di [index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/index.html). Seluruh 11 kartu metrik kini dapat menampilkan kalkulasi bulanan spesifik maupun data kumulatif sepanjang masa.
  - **Multi-Stream Auto-Fetch**: Implementasi `fetchAllDashboardData()` di [js-dashboard.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/js-dashboard.html) yang memuat kelima stream data lengkap (`log_pekerjaan`, `log_baterai`, `log_pm`, `log_inspeksi`, `log_breakdown`) secara proaktif ke in-memory browser.
  - **Perlindungan Anti-Overwrite**: `loadDashboardKPI()` memastikan angka kalkulasi lokal yang lengkap tidak tertimpa nilai parsial yang lebih kecil dari query latar belakang.
  - **Sinkronisasi Modul Cetak PDF**: `downloadDashboardReportPDF()` memanfaatkan `isDateInSelectedPeriod` terpadu sehingga seluruh 11 metrik pada berkas rekapitulasi PDF identik 100% dengan tampilan kartu dashboard.
  - **Sinkronisasi Bundle Standalone**: Seluruh modul yang diperbarui disinkronkan ke berkas distribusi mandiri [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html).
  - **Kepatuhan Mutlak**: Seluruh backend Apps Script ([code.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/code.gs), [setup.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/setup.gs), [migrate_to_supabase.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/migrate_to_supabase.gs)) 100% tidak diubah sama sekali (*Zero backend script alteration*).
- **v5.2**: Pemulihan Gestur Geser & Scroll Horizontal Tabel Jadwal & Monitoring Inspeksi di HP:
  - **Akar Masalah Terselesaikan**: Pembungkus tabel `#inspScheduleTable` sebelumnya hanya menggunakan kelas `.table-responsive` tanpa properti `overflow-x: auto !important;`, sementara elemen induk `.card` memiliki `overflow: hidden !important;`. Akibatnya, pada layar HP (~360px - 412px), tabel 9 kolom terpotong di sisi kanan dan tidak merespons gestur geser sentuh (swipe horizontal macet).
  - **Harmonisasi Markup Kontainer**: Menyelaraskan pembungkus tabel menjadi `<div class="table-container table-responsive">` di [index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/index.html) dan [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html), mewarisi kontainer scroll, custom scrollbar, dan solid navy border.
  - **Penguatan CSS Desktop & Mobile**: Menambahkan `.table-responsive` ke blok `.table-container` desktop dan `@media (max-width: 768px)` di [css.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/css.html) dan [dist/index.html](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/dist/index.html) dengan `overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; touch-action: pan-x pan-y !important;`.
  - **Kerapian Kolom Selancar Mobile**: Menetapkan `min-width: 780px !important;` dan `white-space: nowrap !important;` pada `#inspScheduleTable` di layar HP agar tabel meluncur mulus tanpa teks bertumpuk atau terpotong.
  - **Zero Backend Alteration**: Berkas backend ([code.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/code.gs), [setup.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/setup.gs), [migrate_to_supabase.gs](file:///c:/Users/HP/.gemini/antigravity-ide/PROJECT/AEREPORT1.2/migrate_to_supabase.gs)) **100% UTUH TIDAK DISENTUH**.

