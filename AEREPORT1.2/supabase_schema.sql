-- ============================================================================
-- SISTEM REPORT PEKERJAAN AUTO ELECTRICIAN (AE-REPORT)
-- PT. SAMUDERA MULIA ABADI - SITE SCM KONAWE
-- FILE: supabase_schema.sql
-- FUNGSI: INISIALISASI DATABASE POSTGRESQL & STORAGE SUPABASE (TAHAP 1)
-- PENANGGUNG JAWAB: ZETTBOT BY ZETTBOS (SYSTEM ARCHITECT & LEAD ENGINEERING MENTOR)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EKSTENSI & PEMBERSIHAN (SAFE INITIALIZATION)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TABEL PENGATURAN APLIKASI (APP_SETTINGS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL DEFAULT '',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- ----------------------------------------------------------------------------
-- 2. TABEL DATA MASTER
-- ----------------------------------------------------------------------------

-- 2.1 Master Unit Armada
CREATE TABLE IF NOT EXISTS public.master_unit (
    no_unit TEXT PRIMARY KEY,
    tipe TEXT NOT NULL DEFAULT 'HAULER',
    model TEXT NOT NULL DEFAULT '',
    serial_number TEXT DEFAULT '',
    lokasi_pit TEXT DEFAULT '',
    hm_terakhir NUMERIC(10, 1) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 2.2 Master Mekanik / Teknisi
CREATE TABLE IF NOT EXISTS public.master_mechanic (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama TEXT NOT NULL UNIQUE,
    nrp TEXT DEFAULT '',
    shift TEXT DEFAULT 'Siang',
    keahlian TEXT DEFAULT 'AUTO ELECTRICIAN',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 2.3 Master Lokasi Pit / Area Kerja
CREATE TABLE IF NOT EXISTS public.master_location (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_lokasi TEXT NOT NULL UNIQUE,
    tipe_area TEXT DEFAULT '',
    keterangan TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 2.4 Master Spare Part Elektrikal
CREATE TABLE IF NOT EXISTS public.master_part (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_number TEXT NOT NULL UNIQUE,
    nama_part TEXT NOT NULL,
    kategori TEXT DEFAULT '',
    merk TEXT DEFAULT '',
    satuan TEXT DEFAULT 'PCS',
    unit_model TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 2.5 Master Spesifikasi Baterai / Aki
CREATE TABLE IF NOT EXISTS public.master_battery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_baterai TEXT NOT NULL UNIQUE,
    merk TEXT NOT NULL,
    kapasitas TEXT DEFAULT '',
    voltase TEXT DEFAULT '12V',
    tipe_aki TEXT DEFAULT 'MAINTENANCE FREE',
    aplikasi TEXT DEFAULT 'HEAVY EQUIPMENT',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 2.6 Master Kategori Kerusakan / Sistem
CREATE TABLE IF NOT EXISTS public.master_category (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kategori TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- ----------------------------------------------------------------------------
-- 3. TABEL TRANSAKSI & LOG OPERASIONAL
-- ----------------------------------------------------------------------------

-- 3.1 Log Laporan Harian Pekerjaan (Log_Pekerjaan)
CREATE TABLE IF NOT EXISTS public.log_pekerjaan (
    id_report TEXT PRIMARY KEY,                       -- Format: AE-YYYYMM-XXX
    timestamp_input TEXT,
    status TEXT NOT NULL DEFAULT 'RFU',               -- RFU, WAITING PART, BREAKDOWN, dll
    tanggal TEXT NOT NULL,                            -- DD/MM/YYYY
    jam_mulai TEXT,
    jam_selesai TEXT,
    shift TEXT NOT NULL DEFAULT 'Siang',              -- Siang / Malam
    no_unit TEXT NOT NULL REFERENCES public.master_unit(no_unit) ON UPDATE CASCADE,
    model_unit TEXT,
    lokasi_pekerjaan TEXT,
    hm_unit NUMERIC(10, 1) DEFAULT 0.0,
    nama_mekanik TEXT NOT NULL,
    kategori_pekerjaan TEXT,
    status_part TEXT DEFAULT 'GOOD',
    downtime_jam NUMERIC(6, 2) DEFAULT 0.0,
    deskripsi_pekerjaan TEXT,
    url_foto_before TEXT DEFAULT '',
    url_foto_after TEXT DEFAULT '',
    url_foto_dokumentasi TEXT DEFAULT '',             -- Multi-URL format: URL1|Caption1,URL2|Caption2
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 3.2 Log Monitoring & Penggantian Baterai (Log_Baterai)
CREATE TABLE IF NOT EXISTS public.log_baterai (
    id_baterai TEXT PRIMARY KEY,                      -- Format: BAT-YYYYMM-XXX
    tanggal TEXT NOT NULL,                            -- DD/MM/YYYY
    no_unit TEXT NOT NULL REFERENCES public.master_unit(no_unit) ON UPDATE CASCADE,
    merk_baterai TEXT,
    voltase NUMERIC(5, 2),
    cca INTEGER,
    ir NUMERIC(6, 2),
    kondisi_fisik TEXT DEFAULT 'BAIK',
    status_ganti TEXT DEFAULT 'NORMAL',               -- Masih Layak / Recharge Ulang / Ganti Baterai Baru
    mekanik TEXT,
    catatan TEXT,
    url_foto TEXT DEFAULT '',                         -- Multi-URL format: URL|Caption
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 3.3 Log Analisa Kerusakan Komponen / RCFA (Log_Breakdown)
CREATE TABLE IF NOT EXISTS public.log_breakdown (
    id_far TEXT PRIMARY KEY,                          -- Format: FAR-YYYYMM-XXX
    tanggal TEXT NOT NULL,                            -- DD/MM/YYYY
    no_unit TEXT NOT NULL REFERENCES public.master_unit(no_unit) ON UPDATE CASCADE,
    hm_unit NUMERIC(10, 1) DEFAULT 0.0,
    part_komponen TEXT,
    part_number TEXT,
    nama_part TEXT,
    komponen_gagal TEXT,
    downtime_total NUMERIC(6, 2) DEFAULT 0.0,
    root_cause TEXT,
    action_taken TEXT,
    prevention_plan TEXT,
    status_repair TEXT DEFAULT 'COMPLETED',
    url_foto TEXT DEFAULT '',                         -- Multi-URL format: URL|Caption
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 3.4 Log Inspeksi Elektrikal & AC (Log_Inspeksi)
CREATE TABLE IF NOT EXISTS public.log_inspeksi (
    id_inspeksi TEXT PRIMARY KEY,                     -- Format: INSP-YYYYMM-XXX
    tanggal TEXT NOT NULL,                            -- DD/MM/YYYY
    jam_mulai TEXT,
    jam_selesai TEXT,
    no_unit TEXT NOT NULL REFERENCES public.master_unit(no_unit) ON UPDATE CASCADE,
    hm_unit NUMERIC(10, 1) DEFAULT 0.0,
    inspektor TEXT NOT NULL,
    starting_motor TEXT DEFAULT 'GOOD',
    alternator TEXT DEFAULT 'GOOD',
    lighting_system TEXT DEFAULT 'GOOD',
    wiring_harness TEXT DEFAULT 'GOOD',
    catatan TEXT,
    url_foto TEXT DEFAULT '',                         -- Multi-URL format: URL|Caption
    tipe_inspeksi TEXT NOT NULL DEFAULT 'ELEKTRIKAL', -- ELEKTRIKAL vs AC_SYSTEM
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- 3.5 Log Preventive Maintenance (Log_PM)
CREATE TABLE IF NOT EXISTS public.log_pm (
    id_pm TEXT PRIMARY KEY,                           -- Format: PM-YYYYMM-XXX
    tanggal TEXT NOT NULL,                            -- DD/MM/YYYY
    jam_mulai TEXT,
    jam_selesai TEXT,
    no_unit TEXT NOT NULL REFERENCES public.master_unit(no_unit) ON UPDATE CASCADE,
    pm_level TEXT NOT NULL,                           -- PM1 (250 Jam), PM2, PM3, PM4
    hm_unit NUMERIC(10, 1) DEFAULT 0.0,
    nama_mekanik TEXT NOT NULL,
    remarks TEXT,
    url_foto TEXT DEFAULT '',                         -- Multi-URL format: URL|Caption
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Jakarta', NOW())
);

-- ----------------------------------------------------------------------------
-- 4. OTOMATISASI GENERATOR ID SEKUENSIAL TAMBANG (POSTGRESQL TRIGGER)
-- ----------------------------------------------------------------------------

-- 4.1 Fungsi Helper Generator ID: PREFIX-YYYYMM-XXX
CREATE OR REPLACE FUNCTION public.fn_generate_mining_id(p_prefix TEXT, p_table TEXT, p_id_column TEXT)
RETURNS TEXT AS $$
DECLARE
    v_year_month TEXT;
    v_target_prefix TEXT;
    v_max_num INTEGER := 0;
    v_sql TEXT;
    v_row RECORD;
    v_num_part INTEGER;
BEGIN
    -- Format YYYYMM zona waktu Asia/Jakarta (WITA/WIB)
    v_year_month := TO_CHAR(TIMEZONE('Asia/Jakarta', NOW()), 'YYYYMM');
    v_target_prefix := p_prefix || '-' || v_year_month || '-';
    
    -- Query scanning MAX number yang sudah ada
    v_sql := 'SELECT ' || quote_ident(p_id_column) || ' AS id_val FROM public.' || quote_ident(p_table) ||
             ' WHERE ' || quote_ident(p_id_column) || ' LIKE ' || quote_literal(v_target_prefix || '%');
             
    FOR v_row IN EXECUTE v_sql LOOP
        BEGIN
            v_num_part := CAST(SUBSTRING(v_row.id_val FROM LENGTH(v_target_prefix) + 1) AS INTEGER);
            IF v_num_part > v_max_num THEN
                v_max_num := v_num_part;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Skip jika ada format string anomali
        END;
    END LOOP;
    
    RETURN v_target_prefix || LPAD((v_max_num + 1)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 4.2 Triggers Sebelum Insert (Auto Generate ID jika kosong)
CREATE OR REPLACE FUNCTION public.trg_auto_id_pekerjaan()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_report IS NULL OR TRIM(NEW.id_report) = '' THEN
        NEW.id_report := public.fn_generate_mining_id('AE', 'log_pekerjaan', 'id_report');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_log_pekerjaan ON public.log_pekerjaan;
CREATE TRIGGER before_insert_log_pekerjaan
BEFORE INSERT ON public.log_pekerjaan
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_id_pekerjaan();

CREATE OR REPLACE FUNCTION public.trg_auto_id_baterai()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_baterai IS NULL OR TRIM(NEW.id_baterai) = '' THEN
        NEW.id_baterai := public.fn_generate_mining_id('BAT', 'log_baterai', 'id_baterai');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_log_baterai ON public.log_baterai;
CREATE TRIGGER before_insert_log_baterai
BEFORE INSERT ON public.log_baterai
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_id_baterai();

CREATE OR REPLACE FUNCTION public.trg_auto_id_breakdown()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_far IS NULL OR TRIM(NEW.id_far) = '' THEN
        NEW.id_far := public.fn_generate_mining_id('FAR', 'log_breakdown', 'id_far');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_log_breakdown ON public.log_breakdown;
CREATE TRIGGER before_insert_log_breakdown
BEFORE INSERT ON public.log_breakdown
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_id_breakdown();

CREATE OR REPLACE FUNCTION public.trg_auto_id_inspeksi()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_inspeksi IS NULL OR TRIM(NEW.id_inspeksi) = '' THEN
        NEW.id_inspeksi := public.fn_generate_mining_id('INSP', 'log_inspeksi', 'id_inspeksi');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_log_inspeksi ON public.log_inspeksi;
CREATE TRIGGER before_insert_log_inspeksi
BEFORE INSERT ON public.log_inspeksi
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_id_inspeksi();

CREATE OR REPLACE FUNCTION public.trg_auto_id_pm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_pm IS NULL OR TRIM(NEW.id_pm) = '' THEN
        NEW.id_pm := public.fn_generate_mining_id('PM', 'log_pm', 'id_pm');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_log_pm ON public.log_pm;
CREATE TRIGGER before_insert_log_pm
BEFORE INSERT ON public.log_pm
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_id_pm();

-- 4.3 Trigger Auto Update HM Terakhir pada Master Unit saat Log Disimpan
CREATE OR REPLACE FUNCTION public.trg_update_master_unit_hm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.hm_unit IS NOT NULL AND NEW.hm_unit > 0 THEN
        UPDATE public.master_unit
        SET hm_terakhir = GREATEST(COALESCE(hm_terakhir, 0), NEW.hm_unit),
            updated_at = TIMEZONE('Asia/Jakarta', NOW())
        WHERE no_unit = NEW.no_unit;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hm_from_pekerjaan ON public.log_pekerjaan;
CREATE TRIGGER update_hm_from_pekerjaan
AFTER INSERT OR UPDATE ON public.log_pekerjaan
FOR EACH ROW EXECUTE FUNCTION public.trg_update_master_unit_hm();

DROP TRIGGER IF EXISTS update_hm_from_inspeksi ON public.log_inspeksi;
CREATE TRIGGER update_hm_from_inspeksi
AFTER INSERT OR UPDATE ON public.log_inspeksi
FOR EACH ROW EXECUTE FUNCTION public.trg_update_master_unit_hm();

DROP TRIGGER IF EXISTS update_hm_from_pm ON public.log_pm;
CREATE TRIGGER update_hm_from_pm
AFTER INSERT OR UPDATE ON public.log_pm
FOR EACH ROW EXECUTE FUNCTION public.trg_update_master_unit_hm();

-- ----------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES (OPTIMASI SUB-SECOND QUERY & DASHBOARD)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_log_pekerjaan_unit_tgl ON public.log_pekerjaan(no_unit, tanggal);
CREATE INDEX IF NOT EXISTS idx_log_pekerjaan_status ON public.log_pekerjaan(status);
CREATE INDEX IF NOT EXISTS idx_log_pekerjaan_created ON public.log_pekerjaan(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_log_baterai_unit_tgl ON public.log_baterai(no_unit, tanggal);
CREATE INDEX IF NOT EXISTS idx_log_breakdown_unit_tgl ON public.log_breakdown(no_unit, tanggal);
CREATE INDEX IF NOT EXISTS idx_log_inspeksi_unit_tgl ON public.log_inspeksi(no_unit, tanggal, tipe_inspeksi);
CREATE INDEX IF NOT EXISTS idx_log_pm_unit_tgl ON public.log_pm(no_unit, tanggal, pm_level);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) & HAK AKSES API SUPABASE
-- ----------------------------------------------------------------------------
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_unit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_mechanic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_part ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_battery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_pekerjaan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_baterai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_inspeksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_pm ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Penuh untuk Klien Publik (anon) & Terautentikasi (authenticated)
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'app_settings', 'master_unit', 'master_mechanic', 'master_location', 
        'master_part', 'master_battery', 'master_category', 
        'log_pekerjaan', 'log_baterai', 'log_breakdown', 'log_inspeksi', 'log_pm'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE 'DROP POLICY IF EXISTS "Allow anon full access on ' || t || '" ON public.' || quote_ident(t);
        EXECUTE 'CREATE POLICY "Allow anon full access on ' || t || '" ON public.' || quote_ident(t) ||
                ' FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)';
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. SUPABASE STORAGE BUCKET: ae-dokumentasi
-- ----------------------------------------------------------------------------
-- Buat bucket penyimpanan foto publik jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES ('ae-dokumentasi', 'ae-dokumentasi', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Izin Akses Baca Publik pada Bucket ae-dokumentasi
DROP POLICY IF EXISTS "Public View on ae-dokumentasi" ON storage.objects;
CREATE POLICY "Public View on ae-dokumentasi"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'ae-dokumentasi');

-- Izin Upload & Edit pada Bucket ae-dokumentasi
DROP POLICY IF EXISTS "Public Upload on ae-dokumentasi" ON storage.objects;
CREATE POLICY "Public Upload on ae-dokumentasi"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'ae-dokumentasi');

DROP POLICY IF EXISTS "Public Modify on ae-dokumentasi" ON storage.objects;
CREATE POLICY "Public Modify on ae-dokumentasi"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'ae-dokumentasi');

DROP POLICY IF EXISTS "Public Delete on ae-dokumentasi" ON storage.objects;
CREATE POLICY "Public Delete on ae-dokumentasi"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'ae-dokumentasi');

-- ----------------------------------------------------------------------------
-- 8. INITIAL SEED DATA (DATA AWAL SETUP)
-- ----------------------------------------------------------------------------

-- 8.1 Settings Awal
INSERT INTO public.app_settings (setting_key, setting_value, description)
VALUES 
    ('SITE_NAME', 'PT. SAMUDERA MULIA ABADI - SCM KONAWE', 'Nama site operasional tambang'),
    ('ADMIN_PIN', '1234', 'PIN Otorisasi Administrator untuk edit master dan produktivitas'),
    ('COMPANY_LOGO_URL', '', 'URL Logo Resmi Perusahaan untuk Kop Surat Dokumen PDF')
ON CONFLICT (setting_key) DO NOTHING;

-- 8.2 Master Unit Default
INSERT INTO public.master_unit (no_unit, tipe, model, serial_number, lokasi_pit, hm_terakhir)
VALUES
    ('ADT4173', 'HAULER', 'VOLVO A40J', 'VLV-4173-C', 'PIT HAULING', 3445.0),
    ('ADT4174', 'HAULER', 'VOLVO A40J', 'VLV-4174-D', 'PIT RESLOPING', 1234.0),
    ('ADT4175', 'HAULER', 'VOLVO A40J', 'VLV-4175-E', 'PIT RENTAL', 2800.0),
    ('ADT4180', 'HAULER', 'KOMATSU HD785', 'KM-785-01', 'PIT MHRE', 5210.0),
    ('DT4204', 'HAULER', 'SHACMAN X3000', 'SHC-4204-T', 'PIT BR', 1890.0)
ON CONFLICT (no_unit) DO NOTHING;

-- 8.3 Master Kategori Kerusakan Default
INSERT INTO public.master_category (kategori)
VALUES
    ('STARTING MOTOR SYSTEM'),
    ('CHARGING SYSTEM (ALTERNATOR)'),
    ('LIGHTING & ACCESSORIES'),
    ('CABIN & INSTRUMENT CLUSTER'),
    ('SAFETY DEVICE & INTERLOCK'),
    ('BATTERY & CABLING'),
    ('AC SYSTEM'),
    ('WIRING HARNESS')
ON CONFLICT (kategori) DO NOTHING;
