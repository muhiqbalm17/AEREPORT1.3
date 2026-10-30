/**
 * ============================================================================
 * SISTEM REPORT PEKERJAAN AUTO ELECTRICIAN - PT. SAMUDERA MULIA ABADI (KONAWE)
 * File: setup.gs
 * Fungsi: Inisialisasi Database Non-Destruktif (Safe Migrate) & Multi-Image Headers
 * ============================================================================
 */

const DB_SCHEMAS = {
  // 1. Log Pekerjaan Utama (dengan URL Foto Dokumentasi Multi-Upload)
  Log_Pekerjaan: [
    'IDReport', 'Timestamp', 'Status', 'Tanggal', 'JamMulai', 'JamSelesai', 'Shift', 'NoUnit', 
    'ModelUnit', 'LokasiPekerjaan', 'HMUnit', 'NamaMekanik', 'KategoriPekerjaan', 
    'StatusPart', 'DowntimeJam', 'DeskripsiPekerjaan', 'URLFotoBefore', 'URLFotoAfter', 'URLFotoDokumentasi'
  ],
  // 2. Log Monitoring Baterai (URLFoto menampung multi URL foto dipisah koma)
  Log_Baterai: [
    'Tanggal', 'NoUnit', 'MerkBaterai', 'Voltase', 'CCA', 'IR', 'KondisiFisik', 
    'StatusGanti', 'Mekanik', 'Catatan', 'URLFoto'
  ],
  // 3. Log Analisa Kerusakan / Breakdown RCFA (dengan HMUnit & Detail Part Komponen)
  Log_Breakdown: [
    'Tanggal', 'NoUnit', 'HMUnit', 'PartKomponen', 'PartNumber', 'NamaPart', 
    'KomponenGagal', 'DowntimeTotal', 'RootCause', 'ActionTaken', 
    'PreventionPlan', 'StatusRepair', 'URLFoto'
  ],
  // 4. Log Inspeksi Harian / Mingguan (URLFoto menampung multi URL temuan inspeksi)
  Log_Inspeksi: [
    'Tanggal', 'JamMulai', 'JamSelesai', 'NoUnit', 'HMUnit', 'Inspektor', 
    'StartingMotor', 'Alternator', 'LightingSystem', 'WiringHarness', 'Catatan', 'URLFoto', 'IDInspeksi', 'TipeInspeksi'
  ],
  // 5. Log Preventive Maintenance (URLFoto menampung multi URL dokumentasi servis)
  Log_PM: [
    'Tanggal', 'JamMulai', 'JamSelesai', 'NoUnit', 'PMLevel', 'HMUnit', 
    'NamaMekanik', 'Remarks', 'URLFoto'
  ],
  // 6. Master Tables
  Master_Unit: [
    'NoUnit', 'Tipe', 'Model', 'SerialNumber', 'LokasiPit', 'HmTerakhir'
  ],
  Master_Mechanic: [
    'Nama', 'NRP', 'Shift', 'Keahlian'
  ],
  Master_Location: [
    'NamaLokasi', 'TipeArea', 'Keterangan'
  ],
  Master_Part: [
    'PartNumber', 'NamaPart', 'Kategori', 'Merk', 'Satuan', 'UnitModel'
  ],
  Master_Battery: [
    'KodeBaterai', 'Merk', 'Kapasitas', 'Voltase', 'TipeAki', 'Aplikasi'
  ],
  Master_Category: [
    'Kategori'
  ],
  APP_SETTINGS: [
    'SETTING_KEY', 'SETTING_VALUE', 'DESCRIPTION'
  ]
};

/**
 * Inisialisasi Database dengan Logika Safe Migrate
 * Memeriksa sheet dan header; tidak akan menghapus data yang telah ada.
 */
function initializeDatabase() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const timeZone = 'Asia/Jakarta';
    const nowStr = Utilities.formatDate(new Date(), timeZone, 'dd/MM/yyyy HH:mm:ss');
    
    // 1. Setup Semua Sheet dan Pastikan Kolom Baru Masuk Tanpa Merusak Data (Safe Migrate)
    Object.keys(DB_SCHEMAS).forEach(function(sheetName) {
      let sheet = getSheetCaseInsensitive(ss, sheetName);
      const expectedHeaders = DB_SCHEMAS[sheetName];
      
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(expectedHeaders);
        formatHeaderRow(sheet, expectedHeaders.length);
      } else {
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        
        if (lastRow === 0 || lastCol === 0) {
          sheet.appendRow(expectedHeaders);
          formatHeaderRow(sheet, expectedHeaders.length);
        } else {
          // Penyelarasan otomatis header Log_Breakdown jika sebelumnya terjadi pergeseran kolom
          if (sheetName === 'Log_Breakdown') {
            const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
            const cleanH = currentHeaders.map(function(h) { return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); });
            if (cleanH.indexOf('rootcause') === 4 || lastCol < expectedHeaders.length) {
              sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
              formatHeaderRow(sheet, expectedHeaders.length);
            }
          }

          // Safe Migrate: Tambahkan kolom yang belum ada tanpa merusak data baris
          const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
          expectedHeaders.forEach(function(header) {
            const headerExists = currentHeaders.some(function(h) {
              return h.trim().toLowerCase() === header.trim().toLowerCase();
            });
            if (!headerExists) {
              const nextCol = sheet.getLastColumn() + 1;
              sheet.getRange(1, nextCol).setValue(header);
              sheet.getRange(1, nextCol).setBackground('#0d1829').setFontColor('#ffffff').setFontWeight('bold');
            }
          });
        }
      }
    });

    // 2. Setup Folder Drive untuk Penyimpanan Foto Unit & Formulir
    let driveFolderId = '';
    try {
      const folders = DriveApp.getFoldersByName('AE_DOKUMENTASI_KONAWE');
      if (folders.hasNext()) {
        driveFolderId = folders.next().getId();
      } else {
        const newFolder = DriveApp.createFolder('AE_DOKUMENTASI_KONAWE');
        newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        driveFolderId = newFolder.getId();
      }
    } catch (e) {
      Logger.log('Peringatan inisialisasi folder Drive: ' + e.message);
    }

    // 3. Simpan setting aplikasi jika belum ada
    const settingsSheet = getSheetCaseInsensitive(ss, 'APP_SETTINGS');
    if (settingsSheet) {
      const settingsData = settingsSheet.getDataRange().getDisplayValues();
      const existingKeys = settingsData.map(function(row) { return row[0]; });

      if (!existingKeys.includes('DRIVE_FOLDER_ID') && driveFolderId) {
        settingsSheet.appendRow(['DRIVE_FOLDER_ID', driveFolderId, 'Folder Drive untuk dokumentasi Auto Electrician']);
      }
      if (!existingKeys.includes('SITE_NAME')) {
        settingsSheet.appendRow(['SITE_NAME', 'PT. SAMUDERA MULIA ABADI - SCM KONAWE', 'Nama site operasional']);
      }
      if (!existingKeys.includes('COMPANY_LOGO_URL')) {
        settingsSheet.appendRow(['COMPANY_LOGO_URL', '', 'URL Logo Resmi Perusahaan untuk Kop Surat Dokumen PDF']);
      }
    }

    // 4. Inisialisasi Dummy Data jika tabel masih kosong
    seedInitialData(ss, nowStr);
    
    SpreadsheetApp.flush();
    Logger.log('Safe Migrate Database Auto Electrician SMA Konawe Berhasil.');
    return { success: true, message: 'Database dan header multi-upload foto berhasil diverifikasi/disinkronkan.' };
  } catch (err) {
    Logger.log('Gagal inisialisasi database: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Styling header baris pertama dengan tema industrial navy
 */
function formatHeaderRow(sheet, numCols) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setBackground('#0d1829');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

/**
 * Helper mencari sheet tanpa sensitif huruf besar/kecil
 */
function getSheetCaseInsensitive(ss, sheetName) {
  if (!ss) return null;
  const sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;
  const cleanTarget = sheetName.toLowerCase().replace(/[\s_-]+/g, '');
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName().toLowerCase().replace(/[\s_-]+/g, '');
    if (name === cleanTarget) return sheets[i];
  }
  return null;
}

/**
 * Mengisi Master Unit dan Log Awal jika sheet masih kosong
 */
function seedInitialData(ss, nowStr) {
  const unitSheet = getSheetCaseInsensitive(ss, 'Master_Unit');
  if (unitSheet && unitSheet.getLastRow() <= 1) {
    const units = [
      ['ADT4173', 'HAULER', 'VOLVO A40J', 'VLV-4173-C', 'PIT HAULING', '3445.0'],
      ['ADT4174', 'HAULER', 'VOLVO A40J', 'VLV-4174-D', 'PIT RESLOPING', '1234.0'],
      ['ADT4175', 'HAULER', 'VOLVO A40J', 'VLV-4175-E', 'PIT RENTAL', '2800.0'],
      ['ADT4180', 'HAULER', 'KOMATSU HD785', 'KM-785-01', 'PIT MHRE', '5210.0'],
      ['DT4204', 'HAULER', 'SHACMAN X3000', 'SHC-4204-T', 'PIT BR', '1890.0']
    ];
    unitSheet.getRange(2, 1, units.length, units[0].length).setValues(units);
  }

  const reportSheet = getSheetCaseInsensitive(ss, 'Log_Pekerjaan');
  if (reportSheet && reportSheet.getLastRow() <= 1) {
    const dummyReports = [
      ['AE-1001', nowStr, 'RFU', '20/09/2026', '08:00', '10:00', 'Siang', 'ADT4173', 'VOLVO A40J', 'PIT UTARA', '3445.0', 'HENDRA', 'STARTING MOTOR SYSTEM', 'GOOD', '2.0', 'Inspeksi starter dan pembersihan terminal', '', '', '']
    ];
    reportSheet.getRange(2, 1, dummyReports.length, dummyReports[0].length).setValues(dummyReports);
  }
}