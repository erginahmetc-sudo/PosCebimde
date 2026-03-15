-- ============================================================
-- KasaPOS RLS (Row Level Security) Policies
-- Her tablo için authenticated kullanıcıların kendi company_code'una
-- ait verilere erişmesini sağlayan policy'ler
-- ============================================================
--
-- KULLANIM: Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştırın.
-- Mevcut policy'ler varsa önce temizlenir, sonra yenileri oluşturulur.
-- ============================================================

-- Önce mevcut policy'leri temizle (varsa)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'user_profiles', 'products', 'customers', 'customer_payments',
            'sales', 'held_sales', 'shortcuts', 'invoices', 'app_settings'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- Yardımcı fonksiyon: Giriş yapan kullanıcının company_code'unu döndürür
CREATE OR REPLACE FUNCTION public.get_my_company_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_code FROM public.user_profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 1. USER_PROFILES
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi profilini okuyabilir
CREATE POLICY "users_select_own_profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Aynı şirketteki kullanıcıları görebilir (kullanıcı yönetimi için)
CREATE POLICY "users_select_same_company"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- Kullanıcı kendi profilini güncelleyebilir
CREATE POLICY "users_update_own_profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

-- Yeni kullanıcı kaydı (signup sırasında)
CREATE POLICY "users_insert_own_profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Kullanıcı silme (aynı şirketten)
CREATE POLICY "users_delete_same_company"
  ON public.user_profiles FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- 2. PRODUCTS
-- ============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select"
  ON public.products FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "products_insert"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "products_update"
  ON public.products FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "products_delete"
  ON public.products FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- 3. CUSTOMERS
-- ============================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select"
  ON public.customers FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "customers_insert"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "customers_update"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "customers_delete"
  ON public.customers FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- 4. CUSTOMER_PAYMENTS
-- ============================================================
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

-- customer_payments tablosunda company_code yoksa, customers tablosu üzerinden kontrol
-- Eğer company_code varsa direkt kontrol et
CREATE POLICY "customer_payments_select"
  ON public.customer_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_payments.customer_id
      AND c.company_code = public.get_my_company_code()
    )
  );

CREATE POLICY "customer_payments_insert"
  ON public.customer_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_payments.customer_id
      AND c.company_code = public.get_my_company_code()
    )
  );

CREATE POLICY "customer_payments_update"
  ON public.customer_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_payments.customer_id
      AND c.company_code = public.get_my_company_code()
    )
  );

CREATE POLICY "customer_payments_delete"
  ON public.customer_payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_payments.customer_id
      AND c.company_code = public.get_my_company_code()
    )
  );

-- ============================================================
-- 5. SALES
-- ============================================================
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_select"
  ON public.sales FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "sales_insert"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "sales_update"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "sales_delete"
  ON public.sales FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- 6. HELD_SALES
-- ============================================================
ALTER TABLE public.held_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "held_sales_select"
  ON public.held_sales FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "held_sales_insert"
  ON public.held_sales FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "held_sales_update"
  ON public.held_sales FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "held_sales_delete"
  ON public.held_sales FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- 7. SHORTCUTS
-- ============================================================
ALTER TABLE public.shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shortcuts_select"
  ON public.shortcuts FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "shortcuts_insert"
  ON public.shortcuts FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "shortcuts_update"
  ON public.shortcuts FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "shortcuts_delete"
  ON public.shortcuts FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- 8. INVOICES
-- ============================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "invoices_insert"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "invoices_update"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "invoices_delete"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());

-- ============================================================
-- 9. APP_SETTINGS
-- ============================================================
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (company_code = public.get_my_company_code());

CREATE POLICY "app_settings_insert"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "app_settings_update"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (company_code = public.get_my_company_code())
  WITH CHECK (company_code = public.get_my_company_code());

CREATE POLICY "app_settings_delete"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (company_code = public.get_my_company_code());
