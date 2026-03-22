-- ============================================================
-- VERİTABANI GÜNCELLEMESİ (TÜMÜNÜ SEÇİP ÇALIŞTIRIN)
-- "Database error saving new user" hatasını çözer ve email'i kurucu lisansına ekler.
-- ============================================================

-- 1. licenses tablosuna owner_email kolonu ekle
ALTER TABLE public.licenses
ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT NULL;

-- 2. user_profiles tablosuna email kolonu ekle
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

-- 3. Mevcut kullanıcıların email'ini auth.users'tan al ve doldur
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
  AND up.email IS NULL;

-- 4. YENİ KULLANICI KAYDEDİLDİĞİNDE: user_profiles kaydını oluştur
-- (Eski trigger fonksiyonunu email kolonuyla güncelliyoruz)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, username, role, company_code, permissions)
  VALUES (
    new.id,
    new.email, -- E-posta doğrudan kopyalanır
    COALESCE(new.raw_user_meta_data->>'username', 'Yeni Kullanıcı'),
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    new.raw_user_meta_data->>'company_code',
    CASE 
      WHEN (new.raw_user_meta_data->>'role') = 'kurucu' THEN 
        '{
          "can_view_products": true,
          "can_view_customers": true,
          "can_view_sales": true,
          "can_view_invoices": true,
          "can_view_pos": true,
          "can_view_users": true,
          "can_view_balances": true,
          "can_view_prices": true
        }'::jsonb
      ELSE 
        '{}'::jsonb
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Trigger zaten 'on_auth_user_created' adıyla var, biz sadece fonksiyonu güncelledik)

-- 5. KULLANICI EMAİLİNİ DEĞİŞTİRDİĞİNDE: user_profiles tablosunu güncelle
CREATE OR REPLACE FUNCTION sync_user_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sadece email DEĞİŞTİĞİNDE (UPDATE modunda) çalışacak trigger,
-- INSERT anında çakışmaları (Database error) önler.
DROP TRIGGER IF EXISTS on_auth_user_created_sync_email ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION sync_user_email_to_profile();
