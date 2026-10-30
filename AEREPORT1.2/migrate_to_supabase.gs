/**
 * ============================================================================
 * SISTEM REPORT PEKERJAAN AUTO ELECTRICIAN - PT. SAMUDERA MULIA ABADI (KONAWE)
 * File: migrate_to_supabase.gs
 * Fungsi: Otomatisasi Migrasi Seluruh Data Google Sheets ke Supabase PostgreSQL (Tahap 2)
 * Penanggung Jawab: ZettBOT by Zettbos (System Architect & Lead Engineering Mentor)
 * ============================================================================
 */

const SUPABASE_CONFIG = {
  REST_URL: 'https://msilcjkjnrolekvpgupa.supabase.co/rest/v1',
  ANON_KEY: 'sb_publishable_iDGKz6yQsi7Y_1O1f4wrtg_gXLEVtjB'
};

/**
 * FUNGSI UTAMA: Jalankan fungsi ini dari Google Apps Script Editor untuk migrasi 1-Klik
 */
function migrateGoogleSheetsToSupabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('ERROR: Spreadsheet aktif tidak ditemukan.');
    return { success: false, message: 'Spreadsheet tidak aktif' };
  }

  Logger.log('=== MEMULAI MIGRASI DATA GOOGLE SHEETS KE SUPABASE ===');
  const results = {};

  try {
    // 1. Migrasi Master Tables terlebih dahulu (menjaga foreign keys)
    results.master_unit = migrateMasterUnit(ss);
    results.master_mechanic = migrateMasterMechanic(ss);
    results.master_location = migrateMasterLocation(ss);
    results.master_part = migrateMasterPart(ss);
    results.master_battery = migrateMasterBattery(ss);
    results.master_category = migrateMasterCategory(ss);
    results.app_settings = migrateAppSettings(ss);

    // 2. Migrasi Log Transaksi
    results.log_pekerjaan = migrateLogPekerjaan(ss);
    results.log_baterai = migrateLogBaterai(ss);
    results.log_breakdown = migrateLogBreakdown(ss);
    results.log_inspeksi = migrateLogInspeksi(ss);
    results.log_pm = migrateLogPM(ss);

    Logger.log('=== SEMUA MIGRASI SELESAI ===');
    Logger.log(JSON.stringify(results, null, 2));
    return { success: true, summary: results };
  } catch (err) {
    Logger.log('Terjadi kesalahan migrasi: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// HELPER: Batch Upsert ke Supabase REST API
// ----------------------------------------------------------------------------
function supabaseBatchUpsert(table, records, onConflictCol) {
  if (!records || records.length === 0) {
    return { status: 'skipped', count: 0, message: 'Tidak ada baris data' };
  }

  const endpoint = SUPABASE_CONFIG.REST_URL + '/' + table;
  const headers = {
    'apikey': SUPABASE_CONFIG.ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_CONFIG.ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': onConflictCol 
      ? 'resolution=merge-duplicates' 
      : 'return=minimal'
  };

  const CHUNK_SIZE = 50;
  let totalSuccess = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const options = {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(chunk),
      muteHttpExceptions: true
    };

    const res = UrlFetchApp.fetch(endpoint, options);
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      totalSuccess += chunk.length;
    } else {
      Logger.log('Peringatan batch ' + table + ' (' + code + '): ' + res.getContentText());
    }
  }

  return { status: 'success', count: totalSuccess, totalRows: records.length };
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const clean = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function parseIntSafe(val) {
  if (val === null || val === undefined || val === '') return null;
  const clean = String(val).replace(/[^0-9-]/g, '');
  const num = parseInt(clean, 10);
  return isNaN(num) ? null : num;
}

// ----------------------------------------------------------------------------
// MIGRATOR MASTER DATA
// ----------------------------------------------------------------------------
function migrateMasterUnit(ss) {
  const sheet = ss.getSheetByName('Master_Unit');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const noUnit = String(r[0] || '').trim().toUpperCase();
    if (!noUnit) continue;

    records.push({
      no_unit: noUnit,
      tipe: String(r[1] || 'HAULER').trim().toUpperCase(),
      model: String(r[2] || '').trim(),
      serial_number: String(r[3] || '').trim(),
      lokasi_pit: String(r[4] || '').trim(),
      hm_terakhir: parseNumber(r[5]) || 0
    });
  }
  return supabaseBatchUpsert('master_unit', records, 'no_unit');
}

function migrateMasterMechanic(ss) {
  const sheet = ss.getSheetByName('Master_Mechanic');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const nama = String(r[0] || '').trim();
    if (!nama) continue;
    records.push({
      nama: nama,
      nrp: String(r[1] || '').trim(),
      shift: String(r[2] || 'Siang').trim(),
      keahlian: String(r[3] || 'AUTO ELECTRICIAN').trim()
    });
  }
  return supabaseBatchUpsert('master_mechanic', records, 'nama');
}

function migrateMasterLocation(ss) {
  const sheet = ss.getSheetByName('Master_Location');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const nama = String(r[0] || '').trim();
    if (!nama) continue;
    records.push({
      nama_lokasi: nama,
      tipe_area: String(r[1] || '').trim(),
      keterangan: String(r[2] || '').trim()
    });
  }
  return supabaseBatchUpsert('master_location', records, 'nama_lokasi');
}

function migrateMasterPart(ss) {
  const sheet = ss.getSheetByName('Master_Part');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const partNo = String(r[0] || '').trim();
    if (!partNo) continue;
    records.push({
      part_number: partNo,
      nama_part: String(r[1] || '').trim(),
      kategori: String(r[2] || '').trim(),
      merk: String(r[3] || '').trim(),
      satuan: String(r[4] || 'PCS').trim(),
      unit_model: String(r[5] || '').trim()
    });
  }
  return supabaseBatchUpsert('master_part', records, 'part_number');
}

function migrateMasterBattery(ss) {
  const sheet = ss.getSheetByName('Master_Battery');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const kode = String(r[0] || '').trim();
    if (!kode) continue;
    records.push({
      kode_baterai: kode,
      merk: String(r[1] || '').trim(),
      kapasitas: String(r[2] || '').trim(),
      voltase: String(r[3] || '12V').trim(),
      tipe_aki: String(r[4] || 'MAINTENANCE FREE').trim(),
      aplikasi: String(r[5] || 'HEAVY EQUIPMENT').trim()
    });
  }
  return supabaseBatchUpsert('master_battery', records, 'kode_baterai');
}

function migrateMasterCategory(ss) {
  const sheet = ss.getSheetByName('Master_Category');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const kat = String(rows[i][0] || '').trim();
    if (!kat) continue;
    records.push({ kategori: kat });
  }
  return supabaseBatchUpsert('master_category', records, 'kategori');
}

function migrateAppSettings(ss) {
  const sheet = ss.getSheetByName('APP_SETTINGS');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const key = String(r[0] || '').trim();
    if (!key) continue;
    records.push({
      setting_key: key,
      setting_value: String(r[1] || '').trim(),
      description: String(r[2] || '').trim()
    });
  }
  return supabaseBatchUpsert('app_settings', records, 'setting_key');
}

// ----------------------------------------------------------------------------
// MIGRATOR LOG TRANSAKSI
// ----------------------------------------------------------------------------
function migrateLogPekerjaan(ss) {
  const sheet = ss.getSheetByName('Log_Pekerjaan');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const idReport = String(r[0] || '').trim();
    const noUnit = String(r[7] || '').trim().toUpperCase();
    if (!idReport || !noUnit) continue;

    records.push({
      id_report: idReport,
      timestamp_input: String(r[1] || ''),
      status: String(r[2] || 'RFU').trim().toUpperCase(),
      tanggal: String(r[3] || '').trim(),
      jam_mulai: String(r[4] || '').trim(),
      jam_selesai: String(r[5] || '').trim(),
      shift: String(r[6] || 'Siang').trim(),
      no_unit: noUnit,
      model_unit: String(r[8] || '').trim(),
      lokasi_pekerjaan: String(r[9] || '').trim(),
      hm_unit: parseNumber(r[10]) || 0,
      nama_mekanik: String(r[11] || '').trim(),
      kategori_pekerjaan: String(r[12] || '').trim(),
      status_part: String(r[13] || 'GOOD').trim(),
      downtime_jam: parseNumber(r[14]) || 0,
      deskripsi_pekerjaan: String(r[15] || '').trim(),
      url_foto_before: String(r[16] || '').trim(),
      url_foto_after: String(r[17] || '').trim(),
      url_foto_dokumentasi: String(r[18] || '').trim()
    });
  }
  return supabaseBatchUpsert('log_pekerjaan', records, 'id_report');
}

function migrateLogBaterai(ss) {
  const sheet = ss.getSheetByName('Log_Baterai');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const idBat = String(r[11] || '').trim() || ('BAT-MIG-' + i);
    const noUnit = String(r[1] || '').trim().toUpperCase();
    if (!noUnit) continue;

    records.push({
      id_baterai: idBat,
      tanggal: String(r[0] || '').trim(),
      no_unit: noUnit,
      merk_baterai: String(r[2] || '').trim(),
      voltase: parseNumber(r[3]),
      cca: parseIntSafe(r[4]),
      ir: parseNumber(r[5]),
      kondisi_fisik: String(r[6] || 'BAIK').trim(),
      status_ganti: String(r[7] || 'NORMAL').trim(),
      mekanik: String(r[8] || '').trim(),
      catatan: String(r[9] || '').trim(),
      url_foto: String(r[10] || '').trim()
    });
  }
  return supabaseBatchUpsert('log_baterai', records, 'id_baterai');
}

function migrateLogBreakdown(ss) {
  const sheet = ss.getSheetByName('Log_Breakdown');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const idFar = String(r[13] || '').trim() || ('FAR-MIG-' + i);
    const noUnit = String(r[1] || '').trim().toUpperCase();
    if (!noUnit) continue;

    records.push({
      id_far: idFar,
      tanggal: String(r[0] || '').trim(),
      no_unit: noUnit,
      hm_unit: parseNumber(r[2]) || 0,
      part_komponen: String(r[3] || '').trim(),
      part_number: String(r[4] || '').trim(),
      nama_part: String(r[5] || '').trim(),
      komponen_gagal: String(r[6] || '').trim(),
      downtime_total: parseNumber(r[7]) || 0,
      root_cause: String(r[8] || '').trim(),
      action_taken: String(r[9] || '').trim(),
      prevention_plan: String(r[10] || '').trim(),
      status_repair: String(r[11] || 'COMPLETED').trim(),
      url_foto: String(r[12] || '').trim()
    });
  }
  return supabaseBatchUpsert('log_breakdown', records, 'id_far');
}

function migrateLogInspeksi(ss) {
  const sheet = ss.getSheetByName('Log_Inspeksi');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const idInsp = String(r[12] || '').trim() || ('INSP-MIG-' + i);
    const noUnit = String(r[3] || '').trim().toUpperCase();
    if (!noUnit) continue;

    records.push({
      id_inspeksi: idInsp,
      tanggal: String(r[0] || '').trim(),
      jam_mulai: String(r[1] || '').trim(),
      jam_selesai: String(r[2] || '').trim(),
      no_unit: noUnit,
      hm_unit: parseNumber(r[4]) || 0,
      inspektor: String(r[5] || '').trim(),
      starting_motor: String(r[6] || 'GOOD').trim(),
      alternator: String(r[7] || 'GOOD').trim(),
      lighting_system: String(r[8] || 'GOOD').trim(),
      wiring_harness: String(r[9] || 'GOOD').trim(),
      catatan: String(r[10] || '').trim(),
      url_foto: String(r[11] || '').trim(),
      tipe_inspeksi: String(r[13] || 'ELEKTRIKAL').trim().toUpperCase()
    });
  }
  return supabaseBatchUpsert('log_inspeksi', records, 'id_inspeksi');
}

function migrateLogPM(ss) {
  const sheet = ss.getSheetByName('Log_PM');
  if (!sheet) return { status: 'not_found' };
  const rows = sheet.getDataRange().getDisplayValues();
  if (rows.length <= 1) return { status: 'empty' };

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const idPM = String(r[9] || '').trim() || ('PM-MIG-' + i);
    const noUnit = String(r[3] || '').trim().toUpperCase();
    if (!noUnit) continue;

    records.push({
      id_pm: idPM,
      tanggal: String(r[0] || '').trim(),
      jam_mulai: String(r[1] || '').trim(),
      jam_selesai: String(r[2] || '').trim(),
      no_unit: noUnit,
      pm_level: String(r[4] || 'PM1').trim(),
      hm_unit: parseNumber(r[5]) || 0,
      nama_mekanik: String(r[6] || '').trim(),
      remarks: String(r[7] || '').trim(),
      url_foto: String(r[8] || '').trim()
    });
  }
  return supabaseBatchUpsert('log_pm', records, 'id_pm');
}
