-- Trigger: Yeni kullanıcı kaydında auth.users email'ini user_profiles'a kopyala
-- Bu SQL'i Supabase Dashboard > SQL Editor'da çalıştırın

-- 1. licenses tablosuna owner_email kolonu ekle
ALTER TABLE licenses
ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT NULL;

-- 2. user_profiles tablosuna email kolonu ekle
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

-- 3. Mevcut kurucu kullanıcıların email'ini auth.users'tan al ve doldur
UPDATE user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
  AND up.email IS NULL;

-- 4. Gelecekte yeni kayıt olunduğunda email otomatik kopyalansın (trigger)
CREATE OR REPLACE FUNCTION sync_user_email_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_sync_email ON auth.users;
CREATE TRIGGER on_auth_user_created_sync_email
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email_to_profile();
