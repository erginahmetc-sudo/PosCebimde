-- ============================================================
-- SUPERADMIN RLS BYPASS İÇİN YARDIMCI FONKSİYON VE POLİTİKA
-- Tüm kütüphane/lisansları görebilmesi için user_profiles RLS'ini aşması gerekir
-- ============================================================

-- 1. Superadmin kontrolü yapan yardımcı fonksiyon (Infinite Recursion önlemek için SECURITY DEFINER kullanır)
CREATE OR REPLACE FUNCTION public.is_superadmin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  )
$$;

-- 2. user_profiles tablosuna Superadmin okuma yetkisi ekleme
DROP POLICY IF EXISTS "superadmin_select_user_profiles" ON public.user_profiles;

CREATE POLICY "superadmin_select_user_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin_user());
