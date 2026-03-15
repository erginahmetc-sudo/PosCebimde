-- ============================================================
-- TRIGGER: Handle New User Registration
-- Automate user_profiles creation from auth.users metadata
-- ============================================================

-- 1. Create the function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, role, company_code, permissions)
  VALUES (
    new.id,
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

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a public.user_profiles record when a new user signs up.';
