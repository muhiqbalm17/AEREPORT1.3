/**
 * ============================================================================
 * SISTEM REPORT PEKERJAAN AUTO ELECTRICIAN - PT. SAMUDERA MULIA ABADI (KONAWE)
 * File: code.gs (Backend Controller, CRUD, Multi-Upload to Drive, Auto-Sync & Delete)
 * ============================================================================
 */

function doGet(e) {
  try {
    const template = HtmlService.createTemplateFromFile('index');
    return template.evaluate()
      .setTitle('Program Kerja Auto Electrician - PT SMA Konawe')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>Gagal memuat aplikasi: ' + err.message + '</h3>');
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ============================================================================
 * KONSTANTA PEMETAAN INDEKS KOLOM BAKU (INDEX-BASED MAPPING)
 * Menjamin keamanan pengambilan data kebal terhadap modifikasi teks header
 * ============================================================================
 */
const COL_REPORT = {
  ID: 0,
  TIMESTAMP: 1,
  STATUS: 2,
  TANGGAL: 3,
  JAM_MULAI: 4,
  JAM_SELESAI: 5,
  SHIFT: 6,
  NO_UNIT: 7,
  MODEL_UNIT: 8,
  LOKASI: 9,
  HM_UNIT: 10,
  NAMA_MEKANIK: 11,
  KATEGORI: 12,
  STATUS_PART: 13,
  DOWNTIME: 14,
  DESKRIPSI: 15,
  FOTO_BEFORE: 16,
  FOTO_AFTER: 17,
  FOTO_DOK: 18
};

const COL_BATTERY = {
  TANGGAL: 0,
  NO_UNIT: 1,
  MERK: 2,
  VOLTASE: 3,
  CCA: 4,
  IR: 5,
  KONDISI_FISIK: 6,
  STATUS_GANTI: 7,
  MEKANIK: 8,
  CATATAN: 9,
  URL_FOTO: 10,
  ID: 11
};

const COL_BREAKDOWN = {
  TANGGAL: 0,
  NO_UNIT: 1,
  HM_UNIT: 2,
  PART_KOMPONEN: 3,
  PART_NUMBER: 4,
  NAMA_PART: 5,
  KOMPONEN_GAGAL: 6,
  DOWNTIME: 7,
  ROOT_CAUSE: 8,
  ACTION_TAKEN: 9,
  PREVENTION_PLAN: 10,
  STATUS_REPAIR: 11,
  URL_FOTO: 12,
  ID: 13
};

const COL_INSPEKSI = {
  TANGGAL: 0,
  JAM_MULAI: 1,
  JAM_SELESAI: 2,
  NO_UNIT: 3,
  HM_UNIT: 4,
  INSPEKTOR: 5,
  STARTING_MOTOR: 6,
  ALTERNATOR: 7,
  LIGHTING: 8,
  WIRING: 9,
  CATATAN: 10,
  URL_FOTO: 11,
  ID: 12,
  TIPE_INSPEKSI: 13
};

const COL_PM = {
  TANGGAL: 0,
  JAM_MULAI: 1,
  JAM_SELESAI: 2,
  NO_UNIT: 3,
  PM_LEVEL: 4,
  HM_UNIT: 5,
  NAMA_MEKANIK: 6,
  REMARKS: 7,
  URL_FOTO: 8,
  ID: 9
};

const COL_UNIT = {
  NO_UNIT: 0,
  TIPE: 1,
  MODEL: 2,
  SERIAL_NUMBER: 3,
  LOKASI_PIT: 4,
  HM_TERAKHIR: 5
};

/**
 * Generator ID Unik Sekuensial Otomatis (Incremental Unique ID Generator)
 * Format Standar Tambang: PREFIX-YYYYMM-XXX (contoh: AE-202610-001)
 * Menghitung MAX + 1 pada bulan berjalan di database
 */
function generateSequentialId(sheet, prefix, colIndex1Based) {
  const timeZone = 'Asia/Jakarta';
  const now = new Date();
  const yearMonth = Utilities.formatDate(now, timeZone, 'yyyyMM');
  const targetPrefix = prefix + '-' + yearMonth + '-';
  
  let maxNum = 0;
  const lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow > 1) {
    const colIdx = Math.max(1, colIndex1Based);
    const lastCol = sheet.getLastColumn();
    if (colIdx <= lastCol) {
      const values = sheet.getRange(2, colIdx, lastRow - 1, 1).getDisplayValues();
      for (let i = 0; i < values.length; i++) {
        const val = String(values[i][0] || '').trim().toUpperCase();
        if (val.indexOf(targetPrefix) === 0) {
          const numPart = parseInt(val.substring(targetPrefix.length), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      }
    }
  }
  const nextNum = maxNum + 1;
  const padStr = ('000' + nextNum).slice(nextNum >= 1000 ? -4 : -3);
  return targetPrefix + padStr;
}

/**
 * Sanitasi input teks agar tidak dievaluasi sebagai formula oleh Google Sheets
 * Menghindari timbulnya #ERROR! jika input teks diawali simbol matematika: =, +, -, @
 */
function sanitizeSheetValue(val) {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[=+\-@]/.test(trimmed)) {
      return "'" + val;
    }
  }
  return val;
}

/**
 * Mengambil metadata awal (Armada, Mekanik, Lokasi, Kategori, Suku Cadang)
 */
function getInitialMetadata() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = {
      success: true,
      units: [],
      categories: [],
      mechanics: [],
      locations: [],
      parts: []
    };

    const sheetUnits = getSheetCaseInsensitive(ss, 'Master_Unit');
    if (sheetUnits && sheetUnits.getLastRow() > 1) {
      const data = sheetUnits.getRange(2, 1, sheetUnits.getLastRow() - 1, sheetUnits.getLastColumn()).getDisplayValues();
      result.units = data.map(function(row) {
        return {
          noUnit: (row[0] || '').trim().toUpperCase(),
          tipe: row[1] || 'HAULER',
          model: row[2] || '',
          serialNumber: row[3] || '',
          lokasiPit: row[4] || '',
          hmTerakhir: row[5] || '0'
        };
      }).filter(function(u) { return u.noUnit !== ''; });
    }

    const sheetCat = getSheetCaseInsensitive(ss, 'Master_Category');
    if (sheetCat && sheetCat.getLastRow() > 1) {
      const data = sheetCat.getRange(2, 1, sheetCat.getLastRow() - 1, 1).getDisplayValues();
      result.categories = data.map(function(row) { return (row[0] || '').trim().toUpperCase(); })
                              .filter(function(c) { return c !== ''; });
    } else {
      result.categories = [
        'STARTING MOTOR SYSTEM',
        'ALTERNATOR & CHARGING SYSTEM',
        'LIGHTING SYSTEM & ROTARY',
        'WIRING HARNESS & CABLE TRAY',
        'CABIN INSTRUMENT & GAUGES',
        'AIR CONDITIONING & BLOWER',
        'SAFETY DEVICE (E-STOP, HORN, CAMERA)',
        'BATTERY & CABLE BANK'
      ];
    }

    const sheetMek = getSheetCaseInsensitive(ss, 'Master_Mechanic');
    if (sheetMek && sheetMek.getLastRow() > 1) {
      const data = sheetMek.getRange(2, 1, sheetMek.getLastRow() - 1, sheetMek.getLastColumn()).getDisplayValues();
      result.mechanics = data.map(function(row) {
        return {
          nama: (row[0] || '').trim().toUpperCase(),
          nrp: row[1] || '-',
          shift: row[2] || '-',
          keahlian: row[3] || 'AUTO ELECTRICIAN'
        };
      }).filter(function(m) { return m.nama !== ''; });
    }

    const sheetLok = getSheetCaseInsensitive(ss, 'Master_Location');
    if (sheetLok && sheetLok.getLastRow() > 1) {
      const data = sheetLok.getRange(2, 1, sheetLok.getLastRow() - 1, sheetLok.getLastColumn()).getDisplayValues();
      result.locations = data.map(function(row) {
        return {
          namaLokasi: (row[0] || '').trim().toUpperCase(),
          tipeArea: row[1] || 'PIT AREA',
          keterangan: row[2] || ''
        };
      }).filter(function(l) { return l.namaLokasi !== ''; });
    }

    const sheetPart = getSheetCaseInsensitive(ss, 'Master_Part');
    if (sheetPart && sheetPart.getLastRow() > 1) {
      const dataPart = sheetPart.getRange(2, 1, sheetPart.getLastRow() - 1, sheetPart.getLastColumn()).getDisplayValues();
      result.parts = dataPart.map(function(row) {
        return {
          partNumber: (row[0] || '').trim().toUpperCase(),
          namaPart: (row[1] || '').trim().toUpperCase(),
          kategori: row[2] || '',
          merk: row[3] || '',
          satuan: row[4] || 'PCS',
          unitModel: row[5] || ''
        };
      }).filter(function(p) { return p.partNumber !== '' || p.namaPart !== ''; });
    }

    // Ambil URL Logo Resmi Perusahaan dari APP_SETTINGS
    result.companyLogoUrl = '';
    const sheetSettings = getSheetCaseInsensitive(ss, 'APP_SETTINGS');
    if (sheetSettings && sheetSettings.getLastRow() > 1) {
      const dataSettings = sheetSettings.getRange(2, 1, sheetSettings.getLastRow() - 1, 2).getDisplayValues();
      for (let i = 0; i < dataSettings.length; i++) {
        if (String(dataSettings[i][0]).trim().toUpperCase() === 'COMPANY_LOGO_URL') {
          result.companyLogoUrl = String(dataSettings[i][1] || '').trim();
          break;
        }
      }
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Menggabungkan URL foto dengan keterangan asli (format URL|Caption)
 */
function combineUrlsWithCaptions(urls, captions) {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return '';
  const entries = [];
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    const cap = (captions && Array.isArray(captions) && captions[i]) 
      ? String(captions[i]).replace(/[|\r\n]/g, ' ').trim() 
      : '';
    entries.push(cap ? (u + '|' + cap) : u);
  }
  return entries.join(', ');
}

/**
 * Mengurai string URL foto spreadsheet menjadi array URL bersih dan array caption asli
 */
function parseDelimitedPhotoEntries(rawString) {
  const rawEntries = (rawString || '').split(/(?:,\s*|\r?\n)+/).map(function(e) { return e.trim(); }).filter(Boolean);
  const photos = [];
  const captions = [];

  rawEntries.forEach(function(entry) {
    if (!entry) return;
    let cleanUrl = entry;
    let capText = '';
    if (entry.indexOf('|') !== -1) {
      const pIdx = entry.indexOf('|');
      cleanUrl = entry.substring(0, pIdx).trim();
      capText = entry.substring(pIdx + 1).trim();
      if (cleanUrl.length > 10 && (cleanUrl.indexOf('http') === 0 || cleanUrl.indexOf('data:image') === 0)) {
        photos.push(cleanUrl);
        captions.push(capText);
      }
    } else {
      const tokens = entry.split(/\s+/);
      tokens.forEach(function(tk) {
        tk = tk.trim();
        if (tk.length > 10 && (tk.indexOf('http') === 0 || tk.indexOf('data:image') === 0)) {
          photos.push(tk);
          captions.push('');
        }
      });
    }
  });

  return { photosList: photos, photoCaptions: captions };
}

/**
 * Menyimpan Laporan Pekerjaan (Mendukung Multi-Foto Base64 & LockService Concurrency)
 */
function submitWorkReport(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Pekerjaan');
    if (!sheet) throw new Error('Sheet Log_Pekerjaan tidak ditemukan.');

    const timeZone = 'Asia/Jakarta';
    const now = new Date();
    const timestampStr = Utilities.formatDate(now, timeZone, 'dd/MM/yyyy HH:mm:ss');
    // Penomoran ID Sekuensial Baku Tambang: AE-YYYYMM-XXX
    const reportId = generateSequentialId(sheet, 'AE', COL_REPORT.ID + 1);

    let uploadedUrls = [];
    if (payload.imagesBase64 && Array.isArray(payload.imagesBase64) && payload.imagesBase64.length > 0) {
      uploadedUrls = saveMultipleBase64ImagesToDrive(payload.imagesBase64, 'REPORT_' + (payload.noUnit || 'UNIT'), payload.driveFolderId);
    }

    const allUrlsCombined = combineUrlsWithCaptions(uploadedUrls, payload.captions);
    const urlBefore = (uploadedUrls.length > 0) ? (uploadedUrls[0] + (payload.captions && payload.captions[0] ? '|' + String(payload.captions[0]).replace(/[|\r\n]/g, ' ').trim() : '')) : (payload.urlFotoBefore || '');
    const urlAfter = (uploadedUrls.length > 1) ? (uploadedUrls[1] + (payload.captions && payload.captions[1] ? '|' + String(payload.captions[1]).replace(/[|\r\n]/g, ' ').trim() : '')) : (payload.urlFotoAfter || '');

    const newRow = [
      reportId,
      timestampStr,
      payload.status || 'RFU',
      payload.tanggal || Utilities.formatDate(now, timeZone, 'yyyy-MM-dd'),
      payload.jamMulai || '',
      payload.jamSelesai || '',
      payload.shift || 'Siang',
      (payload.noUnit || '').toUpperCase().trim(),
      payload.modelUnit || '',
      payload.lokasiPekerjaan || '',
      payload.hmUnit || '',
      payload.namaMekanik || '',
      payload.kategoriPekerjaan || '',
      payload.statusPart || 'GOOD',
      payload.downtimeJam || '0',
      sanitizeSheetValue(payload.deskripsiPekerjaan || ''),
      urlBefore,
      urlAfter,
      allUrlsCombined
    ];

    sheet.appendRow(newRow);
    syncLatestUnitHM(ss, payload.noUnit, payload.hmUnit);

    SpreadsheetApp.flush();
    return { success: true, reportId: reportId };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Mengambil Laporan Pekerjaan Secara Terpaginasi (Server-Side Pagination & Reverse Scan)
 */
function getWorkReportsPaginated(page, pageSize, categoryFilter, searchKeyword) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Pekerjaan');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, reports: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 1 };
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 25);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

    // Auto-heal sel yang menampilkan #ERROR! akibat formula salah ketik/simbol inputan mekanik
    let didHeal = false;
    for (let i = 0; i < rawData.length; i++) {
      const cellVal = rawData[i][COL_REPORT.DESKRIPSI];
      if (typeof cellVal === 'string' && /#(ERROR!|REF!|VALUE!|N\/A)/i.test(cellVal)) {
        try {
          const brokenCell = sheet.getRange(i + 2, COL_REPORT.DESKRIPSI + 1);
          const formulaStr = brokenCell.getFormula();
          if (formulaStr) {
            const cleanText = formulaStr.replace(/^=[\+]?/, '');
            brokenCell.setValue("'" + cleanText);
            rawData[i][COL_REPORT.DESKRIPSI] = cleanText;
            didHeal = true;
          }
        } catch (healErr) {
          // Lanjutkan jika sel terproteksi
        }
      }
    }
    if (didHeal) SpreadsheetApp.flush();

    const mapped = [];
    for (let i = rawData.length - 1; i >= 0; i--) {
      const r = rawData[i];
      if (!r[COL_REPORT.NO_UNIT] && !r[COL_REPORT.ID]) continue;
      mapped.push({
        idReport: r[COL_REPORT.ID] || '',
        timestamp: r[COL_REPORT.TIMESTAMP] || '',
        status: r[COL_REPORT.STATUS] || 'RFU',
        tanggal: r[COL_REPORT.TANGGAL] || '',
        jamMulai: r[COL_REPORT.JAM_MULAI] || '',
        jamSelesai: r[COL_REPORT.JAM_SELESAI] || '',
        shift: r[COL_REPORT.SHIFT] || 'Siang',
        noUnit: r[COL_REPORT.NO_UNIT] || '',
        modelUnit: r[COL_REPORT.MODEL_UNIT] || '',
        lokasiPekerjaan: r[COL_REPORT.LOKASI] || '',
        hmUnit: r[COL_REPORT.HM_UNIT] || '',
        namaMekanik: r[COL_REPORT.NAMA_MEKANIK] || '',
        kategoriPekerjaan: r[COL_REPORT.KATEGORI] || '',
        statusPart: r[COL_REPORT.STATUS_PART] || 'GOOD',
        downtimeJam: r[COL_REPORT.DOWNTIME] || '0',
        deskripsiPekerjaan: r[COL_REPORT.DESKRIPSI] || '',
        urlFotoBefore: r[COL_REPORT.FOTO_BEFORE] || '',
        urlFotoAfter: r[COL_REPORT.FOTO_AFTER] || '',
        urlFotoDokumentasi: r[COL_REPORT.FOTO_DOK] || '',
        photosList: parseDelimitedPhotoEntries(r[COL_REPORT.FOTO_DOK] || [r[COL_REPORT.FOTO_BEFORE], r[COL_REPORT.FOTO_AFTER]].filter(Boolean).join(', ')).photosList,
        photoCaptions: parseDelimitedPhotoEntries(r[COL_REPORT.FOTO_DOK] || [r[COL_REPORT.FOTO_BEFORE], r[COL_REPORT.FOTO_AFTER]].filter(Boolean).join(', ')).photoCaptions
      });
    }

    const kw = (searchKeyword || '').trim().toLowerCase();
    const cat = (categoryFilter || '').trim().toUpperCase();

    const filtered = mapped.filter(function(item) {
      const matchCat = !cat || (item.kategoriPekerjaan && item.kategoriPekerjaan.toUpperCase() === cat);
      let matchSearch = true;
      if (kw) {
        matchSearch = (item.noUnit && item.noUnit.toLowerCase().indexOf(kw) !== -1) ||
                      (item.namaMekanik && item.namaMekanik.toLowerCase().indexOf(kw) !== -1) ||
                      (item.deskripsiPekerjaan && item.deskripsiPekerjaan.toLowerCase().indexOf(kw) !== -1) ||
                      (item.idReport && item.idReport.toLowerCase().indexOf(kw) !== -1);
      }
      return matchCat && matchSearch;
    });

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / ps) || 1;
    const startIndex = (p - 1) * ps;
    const paginated = filtered.slice(startIndex, startIndex + ps);

    return {
      success: true,
      reports: paginated,
      totalCount: totalCount,
      page: p,
      pageSize: ps,
      totalPages: totalPages
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Menyimpan Analisa Kerusakan (RCFA - Failure Analysis Report) dengan LockService & ID Sekuensial
 */
function submitBreakdownAnalysis(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Breakdown');
    if (!sheet) throw new Error('Sheet Log_Breakdown tidak ditemukan.');

    const timeZone = 'Asia/Jakarta';
    const now = new Date();
    // Penomoran ID Sekuensial: FAR-YYYYMM-XXX
    const idFar = generateSequentialId(sheet, 'FAR', COL_BREAKDOWN.ID + 1);

    let uploadedUrls = [];
    if (payload.imagesBase64 && Array.isArray(payload.imagesBase64) && payload.imagesBase64.length > 0) {
      uploadedUrls = saveMultipleBase64ImagesToDrive(payload.imagesBase64, 'FAR_' + (payload.noUnit || 'UNIT'), payload.driveFolderId);
    }
    
    // Gabungkan URL foto dengan caption asli (URL|Caption)
    let combinedPhotoEntries = [];
    if (uploadedUrls.length > 0) {
      for (let i = 0; i < uploadedUrls.length; i++) {
        let u = uploadedUrls[i];
        let cap = (payload.captions && Array.isArray(payload.captions) && payload.captions[i]) 
          ? String(payload.captions[i]).replace(/[|\r\n]/g, ' ').trim() 
          : '';
        combinedPhotoEntries.push(cap ? (u + '|' + cap) : u);
      }
    }
    const allUrlsCombined = combinedPhotoEntries.join(', ');

    const kompLabel = payload.partNumber ? ('[' + payload.partNumber + '] ' + (payload.namaPart || payload.komponenGagal)) : (payload.komponenGagal || payload.namaPart || '');

    // Standarisasi header Log_Breakdown 14-kolom (dengan IDFAR)
    const standardHeaders = [
      'Tanggal', 'NoUnit', 'HMUnit', 'PartKomponen', 'PartNumber', 'NamaPart', 
      'KomponenGagal', 'DowntimeTotal', 'RootCause', 'ActionTaken', 
      'PreventionPlan', 'StatusRepair', 'URLFoto', 'IDFAR'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(standardHeaders);
      formatHeaderRow(sheet, standardHeaders.length);
    } else {
      const currentH = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
      const cleanH = currentH.map(function(h) { return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); });
      if (cleanH.indexOf('rootcause') === 4 || currentH.length < 13) {
        sheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
        formatHeaderRow(sheet, standardHeaders.length);
      } else if (cleanH.indexOf('idfar') === -1) {
        sheet.getRange(1, 14).setValue('IDFAR');
        formatHeaderRow(sheet, 14);
      }
    }

    const newRow = [
      payload.tanggal || Utilities.formatDate(now, timeZone, 'yyyy-MM-dd'),
      (payload.noUnit || '').toUpperCase().trim(),
      payload.hmUnit || '',
      kompLabel,
      payload.partNumber || '',
      payload.namaPart || payload.komponenGagal || '',
      payload.komponenGagal || '',
      payload.downtimeTotal || '0',
      payload.rootCause || '',
      payload.actionTaken || '',
      payload.preventionPlan || '',
      payload.statusRepair || 'REPLACE',
      allUrlsCombined,
      idFar
    ];

    sheet.appendRow(newRow);
    if (payload.hmUnit) {
      syncLatestUnitHM(ss, payload.noUnit, payload.hmUnit);
    }

    SpreadsheetApp.flush();
    return { success: true, idFar: idFar };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Mengambil Seluruh Log Analisa Kerusakan (FAR) dengan Auto-Heal Kolom & IDFAR
 */
function getBreakdownLogs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Breakdown');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, logs: [] };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    const cleanH = headers.map(function(h) { return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); });

    // Auto-heal header baris 1 jika sebelumnya bergeser (RootCause di index 4)
    if (cleanH.indexOf('rootcause') === 4) {
      const standardHeaders = [
        'Tanggal', 'NoUnit', 'HMUnit', 'PartKomponen', 'PartNumber', 'NamaPart', 
        'KomponenGagal', 'DowntimeTotal', 'RootCause', 'ActionTaken', 
        'PreventionPlan', 'StatusRepair', 'URLFoto', 'IDFAR'
      ];
      sheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
      formatHeaderRow(sheet, standardHeaders.length);
      SpreadsheetApp.flush();
    }

    const mapped = rawData.map(function(r) {
      let tgl = r[0] || '';
      let unit = r[1] || '';
      let hm = r[2] || '';
      let partKomp = r[3] || '';
      let partNum = r[4] || '';
      let namaPart = r[5] || '';
      let kompGagal = r[6] || '';
      let dt = r[7] || '0';
      let root = r[8] || '';
      let action = r[9] || '';
      let prev = r[10] || '';
      let status = r[11] || 'REPLACE';
      let urlRaw = r[12] || '';
      let idFar = r[13] || '';

      // Deteksi jika baris ini berasal dari format lama 9-kolom
      const isOld9Col = (r.length <= 9 || !r[12]) && 
                        (String(r[7]).toUpperCase().indexOf('REPLACE') !== -1 || 
                         String(r[7]).toUpperCase().indexOf('REPAIR') !== -1 || 
                         String(r[7]).toUpperCase().indexOf('WAITING') !== -1 ||
                         String(r[8]).indexOf('http') !== -1);

      if (isOld9Col) {
        root = r[4] || '';
        action = r[5] || '';
        prev = r[6] || '';
        status = r[7] || 'REPLACE';
        urlRaw = r[8] || '';
        partNum = '';
        namaPart = r[3] || '';
        kompGagal = r[3] || '';
        dt = '0';
      }

      // Ekstrak URL foto dan caption asli (mendukung format URL|Caption maupun format lama)
      const rawEntries = (urlRaw || '').split(/(?:,\s*|\r?\n)+/).map(function(e) { return e.trim(); }).filter(Boolean);
      const photosArray = [];
      const captionsArray = [];

      rawEntries.forEach(function(entry) {
        if (!entry) return;
        let cleanUrl = entry;
        let captionText = '';
        if (entry.indexOf('|') !== -1) {
          const pipeIdx = entry.indexOf('|');
          cleanUrl = entry.substring(0, pipeIdx).trim();
          captionText = entry.substring(pipeIdx + 1).trim();
          if (cleanUrl.length > 10 && (cleanUrl.indexOf('http') === 0 || cleanUrl.indexOf('data:image') === 0)) {
            photosArray.push(cleanUrl);
            captionsArray.push(captionText);
          }
        } else {
          // Kompatibilitas format lama (mungkin spasi antar URL)
          const tokens = entry.split(/\s+/);
          tokens.forEach(function(tk) {
            tk = tk.trim();
            if (tk.length > 10 && (tk.indexOf('http') === 0 || tk.indexOf('data:image') === 0)) {
              photosArray.push(tk);
              captionsArray.push('');
            }
          });
        }
      });

      return {
        idFar: idFar,
        tanggal: tgl,
        noUnit: unit,
        hmUnit: hm,
        partKomponen: namaPart || partKomp || kompGagal,
        partNumber: partNum,
        namaPart: namaPart || partKomp,
        komponenGagal: kompGagal || partKomp,
        downtimeTotal: dt,
        rootCause: root,
        actionTaken: action,
        preventionPlan: prev,
        statusRepair: status || 'REPLACE',
        urlFoto: urlRaw,
        photosList: photosArray,
        photoCaptions: captionsArray
      };
    }).reverse();

    return { success: true, logs: mapped };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Memperbarui keterangan foto asli pada dokumen FAR yang sudah tersimpan
 */
function updateBreakdownPhotoCaptions(idFar, captions) {
  if (!idFar || !captions || !Array.isArray(captions)) return { success: false, error: 'Parameter tidak valid' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Breakdown');
    if (!sheet) return { success: false, error: 'Sheet Log_Breakdown tidak ditemukan' };
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, error: 'Belum ada data' };
    const lastCol = Math.max(sheet.getLastColumn(), 14);
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

    for (let r = 0; r < data.length; r++) {
      const rowId = data[r][13] || '';
      if (String(rowId).trim().toUpperCase() === String(idFar).trim().toUpperCase()) {
        const urlRaw = data[r][12] || '';
        const entries = (urlRaw || '').split(/(?:,\s*|\r?\n)+/).map(function(e) { return e.trim(); }).filter(Boolean);
        const newEntries = [];
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const cleanUrl = entry.indexOf('|') !== -1 ? entry.split('|')[0].trim() : entry.split(/\s+/)[0].trim();
          const cap = (captions[i] !== undefined && captions[i] !== null) ? String(captions[i]).replace(/[|\r\n]/g, ' ').trim() : '';
          newEntries.push(cap ? (cleanUrl + '|' + cap) : cleanUrl);
        }
        const updatedUrlsCombined = newEntries.join(', ');
        sheet.getRange(r + 2, 13).setValue(updatedUrlsCombined);
        SpreadsheetApp.flush();
        return { success: true };
      }
    }
    return { success: false, error: 'ID FAR tidak ditemukan' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Menghapus Log Dokumen FAR Berdasarkan IDFAR / Pencocokan Kolom
 */
function deleteBreakdownLog(targetData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Breakdown');
    if (!sheet || sheet.getLastRow() <= 1) {
      throw new Error('Sheet Log_Breakdown kosong atau tidak ditemukan.');
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

    const targetId = (targetData.idFar || targetData.id || '').trim().toUpperCase();
    const targetUnit = (targetData.noUnit || '').trim().toUpperCase();
    const targetDate = (targetData.tanggal || '').trim();
    const targetPart = (targetData.namaPart || targetData.partKomponen || targetData.partNumber || '').trim().toUpperCase();
    const targetRC = (targetData.rootCause || '').trim().toLowerCase();

    let rowToDelete = -1;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rId = String(row[COL_BREAKDOWN.ID] || '').trim().toUpperCase();
      if (targetId && rId && rId === targetId) {
        rowToDelete = i + 2;
        break;
      }

      const rDate = (row[0] || '').trim();
      const rUnit = (row[1] || '').trim().toUpperCase();
      const rPartKomp = ((row[3] || '') + ' ' + (row[4] || '') + ' ' + (row[5] || '')).toUpperCase();
      const rRC = (row[8] || '').trim().toLowerCase();

      const matchUnit = !targetUnit || rUnit === targetUnit;
      const matchDate = !targetDate || rDate === targetDate;
      const matchPart = !targetPart || rPartKomp.indexOf(targetPart) !== -1;
      const matchRC = !targetRC || rRC.indexOf(targetRC.substring(0, 15)) !== -1;

      if (matchUnit && matchDate && (matchPart || matchRC)) {
        rowToDelete = i + 2;
        break;
      }
    }

    if (rowToDelete !== -1) {
      sheet.deleteRow(rowToDelete);
      SpreadsheetApp.flush();
      return { success: true, message: 'Dokumen FAR berhasil dihapus dari spreadsheet.' };
    } else {
      throw new Error('Data FAR yang cocok tidak ditemukan di spreadsheet.');
    }
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Menyimpan Log Baterai dengan LockService & IDBaterai Sekuensial
 */
function submitBatteryLog(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Baterai');
    if (!sheet) throw new Error('Sheet Log_Baterai tidak ditemukan.');

    const timeZone = 'Asia/Jakarta';
    const now = new Date();
    // Penomoran ID Sekuensial: BAT-YYYYMM-XXX
    const idBat = generateSequentialId(sheet, 'BAT', COL_BATTERY.ID + 1);

    let uploadedUrls = [];
    if (payload.imagesBase64 && Array.isArray(payload.imagesBase64) && payload.imagesBase64.length > 0) {
      uploadedUrls = saveMultipleBase64ImagesToDrive(payload.imagesBase64, 'BAT_' + (payload.noUnit || 'UNIT'), payload.driveFolderId);
    }
    const allUrlsCombined = combineUrlsWithCaptions(uploadedUrls, payload.captions);

    // Safe Migrate: Pastikan kolom IDBaterai ada di header
    if (sheet.getLastColumn() < 12) {
      sheet.getRange(1, 12).setValue('IDBaterai');
      formatHeaderRow(sheet, 12);
    }

    const newRow = [
      payload.tanggal || Utilities.formatDate(now, timeZone, 'yyyy-MM-dd'),
      (payload.noUnit || '').toUpperCase().trim(),
      payload.merkBaterai || '',
      payload.voltase || '',
      payload.cca || '',
      payload.ir || '',
      payload.kondisiFisik || 'BAIK',
      payload.statusGanti || 'MASIH LAYAK',
      payload.mekanik || '',
      payload.catatan || '',
      allUrlsCombined,
      idBat
    ];

    sheet.appendRow(newRow);
    SpreadsheetApp.flush();
    return { success: true, idBat: idBat };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Menyimpan Log Inspeksi dengan LockService & IDInspeksi Sekuensial
 */
function submitInspectionLog(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Inspeksi');
    if (!sheet) throw new Error('Sheet Log_Inspeksi tidak ditemukan.');

    const timeZone = 'Asia/Jakarta';
    const now = new Date();
    // Penomoran ID Sekuensial: INSP-YYYYMM-XXX
    const idInsp = generateSequentialId(sheet, 'INSP', COL_INSPEKSI.ID + 1);

    let uploadedUrls = [];
    if (payload.imagesBase64 && Array.isArray(payload.imagesBase64) && payload.imagesBase64.length > 0) {
      uploadedUrls = saveMultipleBase64ImagesToDrive(payload.imagesBase64, 'INSP_' + (payload.noUnit || 'UNIT'), payload.driveFolderId);
    }
    const allUrlsCombined = combineUrlsWithCaptions(uploadedUrls, payload.captions);

    // Safe Migrate: Pastikan kolom IDInspeksi ada di header
    if (sheet.getLastColumn() < 13) {
      sheet.getRange(1, 13).setValue('IDInspeksi');
      formatHeaderRow(sheet, 13);
    }
    // Safe Migrate: Pastikan kolom TipeInspeksi ada di header
    if (sheet.getLastColumn() < 14) {
      sheet.getRange(1, 14).setValue('TipeInspeksi');
      formatHeaderRow(sheet, 14);
    }

    const tipeInsp = payload.tipeInspeksi || (payload.isACInspection ? 'AC_SYSTEM' : 'ELEKTRIKAL');

    const newRow = [
      payload.tanggal || Utilities.formatDate(now, timeZone, 'yyyy-MM-dd'),
      payload.jamMulai || '',
      payload.jamSelesai || '',
      (payload.noUnit || '').toUpperCase().trim(),
      payload.hmUnit || '',
      payload.inspektor || '',
      payload.startingMotor || (tipeInsp === 'AC_SYSTEM' ? '-' : 'NORMAL'),
      payload.alternator || (tipeInsp === 'AC_SYSTEM' ? '-' : 'NORMAL'),
      payload.lightingSystem || (tipeInsp === 'AC_SYSTEM' ? '-' : 'NORMAL'),
      payload.wiringHarness || (tipeInsp === 'AC_SYSTEM' ? '-' : 'RAPI'),
      payload.catatan || '',
      allUrlsCombined,
      idInsp,
      tipeInsp
    ];

    sheet.appendRow(newRow);
    syncLatestUnitHM(ss, payload.noUnit, payload.hmUnit);

    SpreadsheetApp.flush();
    return { success: true, idInsp: idInsp };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Menyimpan Log Preventive Maintenance dengan LockService & IDPM Sekuensial
 */
function submitPMLog(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_PM');
    if (!sheet) throw new Error('Sheet Log_PM tidak ditemukan.');

    const timeZone = 'Asia/Jakarta';
    const now = new Date();
    // Penomoran ID Sekuensial: PM-YYYYMM-XXX
    const idPM = generateSequentialId(sheet, 'PM', COL_PM.ID + 1);

    let uploadedUrls = [];
    if (payload.imagesBase64 && Array.isArray(payload.imagesBase64) && payload.imagesBase64.length > 0) {
      uploadedUrls = saveMultipleBase64ImagesToDrive(payload.imagesBase64, 'PM_' + (payload.noUnit || 'UNIT'), payload.driveFolderId);
    }
    const allUrlsCombined = combineUrlsWithCaptions(uploadedUrls, payload.captions);

    // Safe Migrate: Pastikan kolom IDPM ada di header
    if (sheet.getLastColumn() < 10) {
      sheet.getRange(1, 10).setValue('IDPM');
      formatHeaderRow(sheet, 10);
    }

    const newRow = [
      payload.tanggal || Utilities.formatDate(now, timeZone, 'yyyy-MM-dd'),
      payload.jamMulai || '',
      payload.jamSelesai || '',
      (payload.noUnit || '').toUpperCase().trim(),
      payload.pmLevel || 'PM1',
      payload.hmUnit || '',
      payload.namaMekanik || payload.leadMekanik || '',
      sanitizeSheetValue(payload.remarks || ''),
      allUrlsCombined,
      idPM
    ];

    sheet.appendRow(newRow);
    syncLatestUnitHM(ss, payload.noUnit, payload.hmUnit);

    SpreadsheetApp.flush();
    return { success: true, idPM: idPM };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Mengambil Log Preventive Maintenance dengan Pemulihan Otomatis Formula Error (#ERROR!)
 */
function getPMLogs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_PM');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, logs: [] };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const rawData = range.getDisplayValues();
    const formulas = range.getFormulas();
    let hasHealed = false;

    const mapped = rawData.map(function(r, idx) {
      let rem = r[COL_PM.REMARKS] || '';
      // Deteksi & pulihkan teks cacat formula (#ERROR!, #VALUE!, #REF!)
      if (typeof rem === 'string' && /#(ERROR!|VALUE!|REF!|NAME\?|N\/A)/i.test(rem)) {
        let f = (formulas[idx] && formulas[idx][COL_PM.REMARKS]) ? String(formulas[idx][COL_PM.REMARKS]) : '';
        if (f) {
          // Pulihkan teks dari formula, misal: "=- Ganti oli filter" -> "- Ganti oli filter"
          let recovered = f.replace(/^=[+\-@]?\s*/, '').trim();
          if (recovered) {
            rem = recovered;
            try {
              sheet.getRange(idx + 2, COL_PM.REMARKS + 1).setValue("'" + recovered);
              hasHealed = true;
            } catch (e) {}
          } else {
            rem = 'Servis berkala sesuai checklist ' + (r[COL_PM.PM_LEVEL] || 'PM1');
          }
        } else {
          rem = 'Servis berkala sesuai checklist ' + (r[COL_PM.PM_LEVEL] || 'PM1');
        }
      }

      const parsedPhotos = parseDelimitedPhotoEntries(r[COL_PM.URL_FOTO] || '');
      return {
        idPM: r[COL_PM.ID] || '',
        tanggal: r[COL_PM.TANGGAL] || '',
        jamMulai: r[COL_PM.JAM_MULAI] || '',
        jamSelesai: r[COL_PM.JAM_SELESAI] || '',
        jam: (r[COL_PM.JAM_MULAI] && r[COL_PM.JAM_SELESAI]) ? (r[COL_PM.JAM_MULAI] + ' - ' + r[COL_PM.JAM_SELESAI]) : '',
        noUnit: r[COL_PM.NO_UNIT] || '',
        pmLevel: r[COL_PM.PM_LEVEL] || 'PM1',
        hmUnit: r[COL_PM.HM_UNIT] || '',
        namaMekanik: r[COL_PM.NAMA_MEKANIK] || '',
        remarks: rem,
        urlFoto: r[COL_PM.URL_FOTO] || '',
        photosList: parsedPhotos.photosList,
        photoCaptions: parsedPhotos.photoCaptions
      };
    }).reverse();

    if (hasHealed) {
      SpreadsheetApp.flush();
    }

    return { success: true, logs: mapped };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Menghapus Data Log Preventive Maintenance Terlindung LockService
 */
function deletePMLog(targetData) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_PM');
    if (!sheet || sheet.getLastRow() <= 1) {
      throw new Error('Sheet Log_PM kosong atau tidak ditemukan.');
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const rawData = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

    const targetId = (targetData.idPM || targetData.id || '').trim().toUpperCase();
    const targetUnit = (targetData.noUnit || '').trim().toUpperCase();
    const targetDate = (targetData.tanggal || '').trim();
    const targetLevel = (targetData.pmLevel || '').trim().toUpperCase();
    const targetHM = targetData.hmUnit !== undefined && targetData.hmUnit !== null ? String(targetData.hmUnit).trim() : '';

    let rowToDelete = -1;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rId = String(row[COL_PM.ID] || '').trim().toUpperCase();
      if (targetId && rId && rId === targetId) {
        rowToDelete = i + 2;
        break;
      }

      const rDate = (row[COL_PM.TANGGAL] || '').trim();
      const rUnit = (row[COL_PM.NO_UNIT] || '').trim().toUpperCase();
      const rLevel = (row[COL_PM.PM_LEVEL] || '').trim().toUpperCase();
      const rHM = (row[COL_PM.HM_UNIT] || '').trim();

      const matchUnit = !targetUnit || rUnit === targetUnit;
      const matchDate = !targetDate || rDate === targetDate;
      const matchLevel = !targetLevel || rLevel === targetLevel;
      const matchHM = !targetHM || rHM === targetHM;

      if (matchUnit && matchDate && matchLevel && matchHM) {
        rowToDelete = i + 2;
        break;
      }
    }

    if (rowToDelete !== -1) {
      sheet.deleteRow(rowToDelete);
      SpreadsheetApp.flush();
      return { success: true, message: 'Log PM berhasil dihapus dari spreadsheet.' };
    } else {
      throw new Error('Data PM yang cocok tidak ditemukan di spreadsheet.');
    }
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Mengambil Seluruh Log Pengujian Baterai
 */
function getBatteryLogs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Baterai');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, logs: [] };
    }

    const rawData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
    const mapped = rawData.map(function(r) {
      const parsedPhotos = parseDelimitedPhotoEntries(r[COL_BATTERY.URL_FOTO] || '');
      return {
        idBaterai: r[COL_BATTERY.ID] || '',
        tanggal: r[COL_BATTERY.TANGGAL] || '',
        noUnit: r[COL_BATTERY.NO_UNIT] || '',
        merkBaterai: r[COL_BATTERY.MERK] || '',
        voltase: r[COL_BATTERY.VOLTASE] || '',
        cca: r[COL_BATTERY.CCA] || '',
        ir: r[COL_BATTERY.IR] || '',
        kondisiFisik: r[COL_BATTERY.KONDISI_FISIK] || 'BAIK',
        statusGanti: r[COL_BATTERY.STATUS_GANTI] || 'MASIH LAYAK',
        mekanik: r[COL_BATTERY.MEKANIK] || '',
        catatan: r[COL_BATTERY.CATATAN] || '',
        urlFoto: r[COL_BATTERY.URL_FOTO] || '',
        photosList: parsedPhotos.photosList,
        photoCaptions: parsedPhotos.photoCaptions
      };
    }).reverse();

    return { success: true, logs: mapped };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengambil Seluruh Log Checklist Inspeksi
 */
function getInspectionLogs() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Inspeksi');
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, logs: [] };
    }

    const rawData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getDisplayValues();
    const mapped = rawData.map(function(r) {
      const parsedPhotos = parseDelimitedPhotoEntries(r[COL_INSPEKSI.URL_FOTO] || '');
      return {
        idInspeksi: r[COL_INSPEKSI.ID] || '',
        tanggal: r[COL_INSPEKSI.TANGGAL] || '',
        jamMulai: r[COL_INSPEKSI.JAM_MULAI] || '',
        jamSelesai: r[COL_INSPEKSI.JAM_SELESAI] || '',
        noUnit: r[COL_INSPEKSI.NO_UNIT] || '',
        hmUnit: r[COL_INSPEKSI.HM_UNIT] || '',
        inspektor: r[COL_INSPEKSI.INSPEKTOR] || '',
        startingMotor: r[COL_INSPEKSI.STARTING_MOTOR] || 'NORMAL',
        alternator: r[COL_INSPEKSI.ALTERNATOR] || 'NORMAL',
        lightingSystem: r[COL_INSPEKSI.LIGHTING] || 'NORMAL',
        wiringHarness: r[COL_INSPEKSI.WIRING] || 'RAPI',
        catatan: r[COL_INSPEKSI.CATATAN] || '',
        urlFoto: r[COL_INSPEKSI.URL_FOTO] || '',
        photosList: parsedPhotos.photosList,
        photoCaptions: parsedPhotos.photoCaptions,
        tipeInspeksi: r[COL_INSPEKSI.TIPE_INSPEKSI] || (String(r[COL_INSPEKSI.CATATAN] || '').indexOf('[INSPEKSI AC]') !== -1 ? 'AC_SYSTEM' : 'ELEKTRIKAL')
      };
    }).reverse();

    return { success: true, logs: mapped };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengambil Ringkasan Metrik Dashboard (Optimasi Pembacaan Targeted Range - Ringan & Cepat)
 */
function getDashboardMetrics(month, year) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetReports = getSheetCaseInsensitive(ss, 'Log_Pekerjaan');
    const sheetBreakdown = getSheetCaseInsensitive(ss, 'Log_Breakdown');
    const sheetBattery = getSheetCaseInsensitive(ss, 'Log_Baterai');
    const sheetPM = getSheetCaseInsensitive(ss, 'Log_PM');
    const sheetInsp = getSheetCaseInsensitive(ss, 'Log_Inspeksi');

    let totalBat = 0;
    if (sheetBattery && sheetBattery.getLastRow() > 1) {
      // Hanya baca kolom tanggal (Kolom A)
      const dataBat = sheetBattery.getRange(2, 1, sheetBattery.getLastRow() - 1, 1).getDisplayValues();
      dataBat.forEach(function(b) {
        if (isDateInPeriod(b[0] || '', month, year)) totalBat++;
      });
    }

    let totalPM = 0;
    if (sheetPM && sheetPM.getLastRow() > 1) {
      // Hanya baca kolom tanggal (Kolom A)
      const dataPM = sheetPM.getRange(2, 1, sheetPM.getLastRow() - 1, 1).getDisplayValues();
      dataPM.forEach(function(p) {
        if (isDateInPeriod(p[0] || '', month, year)) totalPM++;
      });
    }

    let totalInsp = 0;
    if (sheetInsp && sheetInsp.getLastRow() > 1) {
      // Hanya baca kolom tanggal (Kolom A)
      const dataInsp = sheetInsp.getRange(2, 1, sheetInsp.getLastRow() - 1, 1).getDisplayValues();
      dataInsp.forEach(function(i) {
        if (isDateInPeriod(i[0] || '', month, year)) totalInsp++;
      });
    }

    let totalReports = 0;
    let uniquePartKeysBackend = {};

    if (sheetReports && sheetReports.getLastRow() > 1) {
      // Baca dari Kolom 2 (No Unit / B) hingga Kolom 14 (StatusPart / N)
      const dataR = sheetReports.getRange(2, 2, sheetReports.getLastRow() - 1, 13).getDisplayValues();
      dataR.forEach(function(r) {
        const u = r[0] || '';   // No Unit di index 0 (kolom B)
        const tgl = r[2] || ''; // Tanggal di index 2 (kolom D)
        if (isDateInPeriod(tgl, month, year)) {
          totalReports++;
          const sp = String(r[12] || '').toUpperCase(); // StatusPart di index 12 (kolom N)
          if (sp === 'BAD' || sp === 'REPLACE' || sp === 'REPLACE PART') {
            uniquePartKeysBackend[String(u).trim().toUpperCase() + '_' + String(tgl).trim()] = true;
          }
        }
      });
    }

    if (sheetBreakdown && sheetBreakdown.getLastRow() > 1) {
      // Baca kolom tanggal (Kolom 1 / A) hingga StatusRepair (Kolom 12 / L)
      const dataB = sheetBreakdown.getRange(2, 1, sheetBreakdown.getLastRow() - 1, 12).getDisplayValues();
      dataB.forEach(function(b) {
        const tgl = b[0] || '';
        const u = b[1] || '';
        if (isDateInPeriod(tgl, month, year)) {
          const st = String(b[11] || 'REPLACE').toUpperCase();
          if (st === 'REPLACE' || st === 'WAITING PART') {
            uniquePartKeysBackend[String(u).trim().toUpperCase() + '_' + String(tgl).trim()] = true;
          }
        }
      });
    }

    const totalReplaceCases = Object.keys(uniquePartKeysBackend).length;
    const totalSample = totalReports + totalReplaceCases;
    const partRatioVal = totalReplaceCases + ' Kasus';

    return {
      success: true,
      metrics: {
        totalBattery: totalBat,
        totalPM: totalPM,
        totalInspection: totalInsp,
        totalReports: totalReports,
        partRatio: partRatioVal
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Memperbarui Data Laporan Pekerjaan dengan LockService
 */
function updateWorkReport(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Pekerjaan');
    if (!sheet) throw new Error('Sheet Log_Pekerjaan tidak ditemukan.');

    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    let rowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === payload.idReport) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Laporan dengan ID ' + payload.idReport + ' tidak ditemukan.');

    sheet.getRange(rowIndex, COL_REPORT.STATUS + 1).setValue(payload.status || 'RFU');
    sheet.getRange(rowIndex, COL_REPORT.TANGGAL + 1).setValue(payload.tanggal || '');
    sheet.getRange(rowIndex, COL_REPORT.JAM_MULAI + 1).setValue(payload.jamMulai || '');
    sheet.getRange(rowIndex, COL_REPORT.JAM_SELESAI + 1).setValue(payload.jamSelesai || '');
    sheet.getRange(rowIndex, COL_REPORT.SHIFT + 1).setValue(payload.shift || 'Siang');
    sheet.getRange(rowIndex, COL_REPORT.NO_UNIT + 1).setValue((payload.noUnit || '').toUpperCase().trim());
    sheet.getRange(rowIndex, COL_REPORT.MODEL_UNIT + 1).setValue(payload.modelUnit || '');
    sheet.getRange(rowIndex, COL_REPORT.LOKASI + 1).setValue(payload.lokasiPekerjaan || '');
    sheet.getRange(rowIndex, COL_REPORT.HM_UNIT + 1).setValue(payload.hmUnit || '');
    sheet.getRange(rowIndex, COL_REPORT.NAMA_MEKANIK + 1).setValue(payload.namaMekanik || '');
    sheet.getRange(rowIndex, COL_REPORT.KATEGORI + 1).setValue(payload.kategoriPekerjaan || '');
    sheet.getRange(rowIndex, COL_REPORT.DOWNTIME + 1).setValue(payload.downtimeJam || '0');
    sheet.getRange(rowIndex, COL_REPORT.DESKRIPSI + 1).setValue(sanitizeSheetValue(payload.deskripsiPekerjaan || ''));

    syncLatestUnitHM(ss, payload.noUnit, payload.hmUnit);

    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Menghapus Laporan Pekerjaan dengan LockService
 */
function deleteWorkReport(idReport) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Log_Pekerjaan');
    if (!sheet) throw new Error('Sheet Log_Pekerjaan tidak ditemukan.');

    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    let rowIndex = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === idReport) {
        rowIndex = i + 2;
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Laporan ID ' + idReport + ' tidak ditemukan.');

    sheet.deleteRow(rowIndex);
    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Operasi Master Data
 */
function addMasterUnit(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Master_Unit');
    if (!sheet) throw new Error('Sheet Master_Unit tidak ditemukan.');

    sheet.appendRow([
      (payload.noUnit || '').toUpperCase().trim(),
      payload.tipeUnit || 'HAULER',
      (payload.model || '').toUpperCase().trim(),
      payload.serialNumber || '',
      (payload.lokasiPit || '').toUpperCase().trim(),
      payload.hmTerakhir || '0'
    ]);

    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function addMasterMechanic(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Master_Mechanic');
    if (!sheet) throw new Error('Sheet Master_Mechanic tidak ditemukan.');

    sheet.appendRow([
      (payload.nama || '').toUpperCase().trim(),
      payload.nrp || '-',
      'Siang',
      payload.keahlian || 'AUTO ELECTRICIAN'
    ]);

    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function addMasterLocation(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Master_Location');
    if (!sheet) throw new Error('Sheet Master_Location tidak ditemukan.');

    sheet.appendRow([
      (payload.namaLokasi || '').toUpperCase().trim(),
      payload.tipeArea || 'PIT AREA',
      payload.keterangan || ''
    ]);

    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function addMasterCategory(categoryName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Master_Category');
    if (!sheet) throw new Error('Sheet Master_Category tidak ditemukan.');

    sheet.appendRow([(categoryName || '').toUpperCase().trim()]);
    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function deleteMasterCategory(categoryName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Master_Category');
    if (!sheet) throw new Error('Sheet Master_Category tidak ditemukan.');

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0].toUpperCase() === categoryName.toUpperCase()) {
        sheet.deleteRow(i + 2);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function addMasterPart(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Master_Part');
    if (!sheet) throw new Error('Sheet Master_Part tidak ditemukan.');

    sheet.appendRow([
      (payload.partNumber || '').toUpperCase().trim(),
      (payload.namaPart || '').toUpperCase().trim(),
      payload.kategori || '',
      (payload.merk || '').toUpperCase().trim(),
      payload.satuan || 'PCS',
      (payload.unitModel || '').toUpperCase().trim()
    ]);

    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function addMasterBattery(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheetCaseInsensitive(ss, 'Master_Battery');
    if (!sheet) throw new Error('Sheet Master_Battery tidak ditemukan.');

    sheet.appendRow([
      (payload.kodeBaterai || '').toUpperCase().trim(),
      (payload.merk || '').toUpperCase().trim(),
      payload.kapasitas || '',
      payload.voltase || '12V',
      payload.tipeAki || 'MF',
      (payload.aplikasi || '').toUpperCase().trim()
    ]);

    SpreadsheetApp.flush();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getAllMasterData() {
  return getInitialMetadata();
}

/**
 * Helper mencari atau membuat subfolder di Google Drive
 */
function getOrCreateDriveFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  const newF = parentFolder.createFolder(folderName);
  newF.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newF;
}

/**
 * Menyimpan Kumpulan Foto Base64 ke Google Drive dengan Struktur Berjenjang (Tahun/Bulan)
 * Menghindari penumpukan puluhan ribu file dalam satu folder akar Drive
 */
function saveMultipleBase64ImagesToDrive(base64Array, prefix, folderId) {
  const urls = [];
  if (!base64Array || !Array.isArray(base64Array) || base64Array.length === 0) return urls;

  let rootFolder = null;
  try {
    if (folderId && folderId.trim()) {
      rootFolder = DriveApp.getFolderById(folderId.trim());
    }
  } catch (e) {
    Logger.log('Folder ID kustom tidak ditemukan: ' + e.message);
  }

  if (!rootFolder) {
    const folders = DriveApp.getFoldersByName('AE_DOKUMENTASI_KONAWE');
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder('AE_DOKUMENTASI_KONAWE');
      rootFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
  }

  const timeZone = 'Asia/Jakarta';
  const now = new Date();
  const currentYear = Utilities.formatDate(now, timeZone, 'yyyy');
  const currentMonth = Utilities.formatDate(now, timeZone, 'MM');
  const timestamp = Utilities.formatDate(now, timeZone, 'yyyyMMdd_HHmmss');

  // Subfolder Berjenjang: AE_DOKUMENTASI_KONAWE / [TAHUN] / [BULAN]
  let targetFolder = rootFolder;
  try {
    const yearFolder = getOrCreateDriveFolder(rootFolder, currentYear);
    targetFolder = getOrCreateDriveFolder(yearFolder, currentMonth);
  } catch (fErr) {
    targetFolder = rootFolder;
  }

  base64Array.forEach(function(base64Data, idx) {
    try {
      if (!base64Data || typeof base64Data !== 'string') return;
      let cleanData = base64Data;
      let contentType = 'image/jpeg';
      if (base64Data.indexOf('data:') === 0) {
        const parts = base64Data.split(',');
        const match = parts[0].match(/:(.*?);/);
        if (match) contentType = match[1];
        cleanData = parts[1];
      }
      const decodedBytes = Utilities.base64Decode(cleanData);
      const fileName = (prefix || 'AE_PHOTO') + '_' + timestamp + '_' + (idx + 1) + '.jpg';
      const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
      const file = targetFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      urls.push(file.getUrl());
    } catch (err) {
      Logger.log('Gagal menyimpan foto #' + (idx + 1) + ': ' + err.message);
    }
  });

  return urls;
}

/**
 * Sinkronisasi Hour Meter Terkini ke Master Unit
 */
function syncLatestUnitHM(ss, noUnit, hmVal) {
  try {
    if (!noUnit || !hmVal) return;
    const newHM = parseFloat(hmVal);
    if (isNaN(newHM) || newHM <= 0) return;

    const sheetUnits = getSheetCaseInsensitive(ss, 'Master_Unit');
    if (!sheetUnits || sheetUnits.getLastRow() <= 1) return;

    const lastRow = sheetUnits.getLastRow();
    const data = sheetUnits.getRange(2, 1, lastRow - 1, 6).getDisplayValues();

    for (let i = 0; i < data.length; i++) {
      if (data[i][0].toUpperCase() === noUnit.toUpperCase()) {
        const currentMasterHM = parseFloat(data[i][5]) || 0;
        if (newHM > currentMasterHM) {
          sheetUnits.getRange(i + 2, 6).setValue(newHM.toFixed(1));
        }
        break;
      }
    }
  } catch (err) {
    Logger.log('Gagal sinkron HM: ' + err.message);
  }
}

function isDateInPeriod(dateStr, month, year) {
  if (!dateStr) return false;
  const targetM = parseInt(month, 10);
  const targetY = parseInt(year, 10);
  if (isNaN(targetM) || isNaN(targetY)) return false;

  if (dateStr instanceof Date) {
    return (dateStr.getMonth() + 1 === targetM) && (dateStr.getFullYear() === targetY);
  }

  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  let rYear, rMonth;
  if (parts.length >= 3) {
    if (parts[0].length === 4) {
      rYear = parseInt(parts[0], 10);
      rMonth = parseInt(parts[1], 10);
    } else if (parts[2].length === 4) {
      rYear = parseInt(parts[2], 10);
      rMonth = parseInt(parts[1], 10);
    } else if (parts[2].length === 2) {
      rYear = 2000 + parseInt(parts[2], 10);
      rMonth = parseInt(parts[1], 10);
    }
  }

  if (rYear && rMonth) {
    return rYear === targetY && rMonth === targetM;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return (d.getMonth() + 1 === targetM) && (d.getFullYear() === targetY);
  }
  return false;
}

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
 * ============================================================================
 * MODUL PENDAFTARAN AKUN PENGGUNA BARU
 * Mengirimkan data permohonan ke Administrator: muh.iqbal.m17@gmail.com
 * ============================================================================
 */
function submitUserRegistration(formData) {
  try {
    const adminEmail = 'muh.iqbal.m17@gmail.com';
    const nama = (formData && formData.nama) ? formData.nama : 'Pengguna Baru';
    const username = (formData && formData.username) ? formData.username : '-';
    const telepon = (formData && formData.telepon) ? formData.telepon : '-';
    const jabatan = (formData && formData.jabatan) ? formData.jabatan : '-';
    const emailPemohon = (formData && formData.email) ? formData.email : '-';
    const alasan = (formData && formData.alasan) ? formData.alasan : '-';

    const subject = '[PENDAFTARAN AKUN BARU] Auto Electrician SMA - ' + nama;
    const body =
      'Halo Administrator,\n\n' +
      'Terdapat permohonan pendaftaran akun pengguna baru untuk Aplikasi Auto Electrician PT Samudera Mulia Abadi (Site Konawe):\n\n' +
      '--------------------------------------------------\n' +
      '• Nama Lengkap       : ' + nama + '\n' +
      '• Usulan Username    : ' + username + '\n' +
      '• Jabatan/Posisi     : ' + jabatan + '\n' +
      '• No. WhatsApp / HP  : ' + telepon + '\n' +
      '• Email Pemohon      : ' + emailPemohon + '\n' +
      '• Alasan Akses       : ' + alasan + '\n' +
      '• Waktu Pengajuan    : ' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'dd/MM/yyyy HH:mm:ss') + ' WITA\n' +
      '--------------------------------------------------\n\n' +
      'Silakan lakukan verifikasi dan aktivasi kredensial pengguna jika disetujui.\n\n' +
      'Salam,\n' +
      'Sistem Otomatisasi Program Kerja Auto Electrician\n' +
      'PT Samudera Mulia Abadi (SOM Konawe)';

    MailApp.sendEmail(adminEmail, subject, body);

    return {
      success: true,
      message: 'Permohonan pendaftaran berhasil dikirimkan ke email Administrator (' + adminEmail + ').'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Gagal mengirim email: ' + err.message
    };
  }
}

/**
 * ============================================================================
 * MODUL KEAMANAN OTORISASI: VERIFIKASI & PENGELOLAAN PIN ADMINISTRATOR
 * Tersimpan aman di sheet APP_SETTINGS backend, tidak terekspos di client JS
 * ============================================================================
 */
function verifyAdminPin(enteredPin) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let registeredPin = '2026';
    const settingsSheet = getSheetCaseInsensitive(ss, 'APP_SETTINGS');
    if (settingsSheet && settingsSheet.getLastRow() > 1) {
      const data = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getDisplayValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim().toUpperCase() === 'ADMIN_PIN') {
          registeredPin = String(data[i][1]).trim();
          break;
        }
      }
    }

    const cleanInput = String(enteredPin || '').trim();
    if (cleanInput === registeredPin) {
      return { success: true, authorized: true };
    } else {
      return { success: false, authorized: false, message: 'PIN Administrator salah atau tidak cocok.' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function changeAdminPin(currentPin, newPin) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const authCheck = verifyAdminPin(currentPin);
    if (!authCheck.authorized) {
      return { success: false, message: 'PIN saat ini salah. Otorisasi ditolak.' };
    }

    const cleanNewPin = String(newPin || '').trim();
    if (cleanNewPin.length < 4) {
      return { success: false, message: 'PIN baru minimal harus 4 karakter!' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingsSheet = getSheetCaseInsensitive(ss, 'APP_SETTINGS');
    if (!settingsSheet) throw new Error('Sheet APP_SETTINGS tidak ditemukan.');

    const data = settingsSheet.getDataRange().getDisplayValues();
    let rowIdx = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === 'ADMIN_PIN') {
        rowIdx = i + 1;
        break;
      }
    }

    if (rowIdx !== -1) {
      settingsSheet.getRange(rowIdx, 2).setValue(cleanNewPin);
    } else {
      settingsSheet.appendRow(['ADMIN_PIN', cleanNewPin, 'PIN akses otorisasi Administrator']);
    }

    SpreadsheetApp.flush();
    return { success: true, message: 'PIN Administrator berhasil diperbarui.' };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * ============================================================================
 * MODUL MASTER LOGO RESMI PERUSAHAAN (KOP SURAT DOKUMEN PDF & SISTEM)
 * Menyimpan berkas ke Google Drive dan URL ke sheet APP_SETTINGS
 * ============================================================================
 */
function uploadCompanyLogo(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (!payload || !payload.imageBase64) {
      return { success: false, error: 'Data gambar logo tidak valid atau kosong.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let folderId = payload.driveFolderId || '';

    // Ambil folder ID dari APP_SETTINGS jika tidak dikirim dari payload
    const settingsSheet = getSheetCaseInsensitive(ss, 'APP_SETTINGS');
    if (settingsSheet && settingsSheet.getLastRow() > 1 && !folderId) {
      const data = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getDisplayValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim().toUpperCase() === 'DRIVE_FOLDER_ID') {
          folderId = String(data[i][1]).trim();
          break;
        }
      }
    }

    let targetFolder = null;
    try {
      if (folderId) {
        targetFolder = DriveApp.getFolderById(folderId);
      }
    } catch (e) {
      Logger.log('Folder ID spesifik tidak dapat diakses: ' + e.message);
    }

    if (!targetFolder) {
      const folders = DriveApp.getFoldersByName('AE_DOKUMENTASI_KONAWE');
      if (folders.hasNext()) {
        targetFolder = folders.next();
      } else {
        targetFolder = DriveApp.createFolder('AE_DOKUMENTASI_KONAWE');
        targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
    }

    // Subfolder khusus aset sistem
    const assetFolder = getOrCreateDriveFolder(targetFolder, 'SYSTEM_ASSETS');

    // Decode Base64
    let cleanData = payload.imageBase64;
    let contentType = 'image/png';
    let ext = 'png';
    if (cleanData.indexOf('data:') === 0) {
      const parts = cleanData.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) {
        contentType = match[1];
        if (contentType.indexOf('jpeg') !== -1 || contentType.indexOf('jpg') !== -1) {
          ext = 'jpg';
        }
      }
      cleanData = parts[1];
    }

    const decodedBytes = Utilities.base64Decode(cleanData);
    const fileName = 'COMPANY_LOGO_OFFICIAL_' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd_HHmmss') + '.' + ext;
    const blob = Utilities.newBlob(decodedBytes, contentType, fileName);
    const file = assetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const logoUrl = 'https://drive.google.com/uc?id=' + file.getId();

    // Simpan ke APP_SETTINGS sebagai sumber referensi universal aplikasi
    if (settingsSheet) {
      const data = settingsSheet.getDataRange().getDisplayValues();
      let rowIdx = -1;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim().toUpperCase() === 'COMPANY_LOGO_URL') {
          rowIdx = i + 1;
          break;
        }
      }

      if (rowIdx !== -1) {
        settingsSheet.getRange(rowIdx, 2).setValue(logoUrl);
      } else {
        settingsSheet.appendRow(['COMPANY_LOGO_URL', logoUrl, 'URL Logo Resmi Perusahaan untuk Kop Surat Dokumen PDF']);
      }
    }

    SpreadsheetApp.flush();
    return {
      success: true,
      message: 'Logo resmi perusahaan berhasil diunggah ke Google Drive dan disimpan sebagai referensi aplikasi!',
      logoUrl: logoUrl,
      fileId: file.getId()
    };
  } catch (err) {
    Logger.log('Gagal mengunggah logo: ' + err.message);
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * Menghapus Logo Kustom Perusahaan dari APP_SETTINGS
 */
function deleteCompanyLogo() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingsSheet = getSheetCaseInsensitive(ss, 'APP_SETTINGS');
    if (settingsSheet && settingsSheet.getLastRow() > 1) {
      const data = settingsSheet.getDataRange().getDisplayValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim().toUpperCase() === 'COMPANY_LOGO_URL') {
          settingsSheet.getRange(i + 1, 2).setValue('');
          break;
        }
      }
    }
    SpreadsheetApp.flush();
    return { success: true, message: 'Logo resmi perusahaan telah dinonaktifkan. Seluruh kop surat kembali menggunakan logo default.' };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}