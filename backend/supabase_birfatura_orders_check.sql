-- ============================================================
-- Supabase SQL Editör'de çalıştırın: BirFatura "Onaylanmış Sipariş" için veri kontrolü
-- ============================================================

-- 1) Silinmemiş satış sayısı (backend /api/orders/ aynı filtreyi kullanır)
SELECT COUNT(*) AS satis_sayisi
FROM sales
WHERE is_deleted = false;

-- 2) Son 10 silinmemiş satış (sale_code, date, company_code)
SELECT sale_code, date, created_at, company_code, customer_name, total, is_deleted
FROM sales
WHERE is_deleted = false
ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
LIMIT 10;

-- 3) app_settings'te secret_token var mı? (BirFatura API şifresi ile eşleşmeli)
SELECT company_code, key, value
FROM app_settings
WHERE key = 'secret_token';

-- 4) company_code dağılımı (satışlar hangi company_code ile kayıtlı?)
SELECT company_code, COUNT(*) AS adet
FROM sales
WHERE is_deleted = false
GROUP BY company_code;

-- 5) sales tablosunda RLS açık mı?
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'sales';

-- 6) sales için RLS politikaları (SELECT izni nasıl?)
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'sales';

-- ============================================================
-- DÜZELTME: sales_insert politikasında qual NULL olduğu için
-- yeni satışlar company_code olmadan eklenebiliyor; sonra
-- sales_select (company_code = get_my_company_code()) yüzünden
-- görünmüyorlar. Aşağıdaki SQL ile INSERT'i kısıtlayın.
-- ============================================================

-- 7) Eski sales_insert politikasını kaldır
DROP POLICY IF EXISTS sales_insert ON sales;

-- 8) Yeni sales_insert: Sadece kendi şirketinizin company_code'u ile INSERT
CREATE POLICY sales_insert ON sales
  FOR INSERT
  TO authenticated
  WITH CHECK (company_code = get_my_company_code());

-- 9) Şirket kodunuzu bulmak için (UPDATE'te kullanacaksınız)
SELECT DISTINCT company_code FROM user_profiles LIMIT 5;
SELECT DISTINCT company_code FROM app_settings LIMIT 5;

-- 10) company_code NULL olan satış sayısı
SELECT COUNT(*) AS null_company_sayisi FROM sales WHERE company_code IS NULL AND is_deleted = false;

-- 11) NULL company_code'lu satışları düzeltin (BURAYA_SIRKET_KODUNUZ yerine 9. sorgudan gelen kodu yazın)
-- UPDATE sales SET company_code = 'BURAYA_SIRKET_KODUNUZ' WHERE company_code IS NULL AND is_deleted = false;
