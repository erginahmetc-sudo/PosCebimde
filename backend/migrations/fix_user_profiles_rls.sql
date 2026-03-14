-- ============================================================
-- FIX: user_profiles RLS Policies
-- Allow 'kurucu' (Founders) to insert profiles for their employees
-- ============================================================

-- First, drop the old restrictive insert policy
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;

-- Create a new, more flexible insert policy
CREATE POLICY "users_insert_profiles"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- A user can always insert their own profile (signup)
    id = auth.uid()
    OR
    -- OR a 'kurucu' (admin) can insert a profile for their same company
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() 
      AND role = 'kurucu'
      AND company_code = public.user_profiles.company_code
    )
  );

-- Also fix UPDATE policy to be more specific (Admins can update others, Users only themselves)
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;

CREATE POLICY "users_update_profiles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() -- Own profile
    OR
    EXISTS (
       SELECT 1 FROM public.user_profiles
       WHERE id = auth.uid() 
       AND role = 'kurucu'
       AND company_code = public.user_profiles.company_code
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR
    EXISTS (
       SELECT 1 FROM public.user_profiles
       WHERE id = auth.uid() 
       AND role = 'kurucu'
       AND company_code = public.user_profiles.company_code
    )
  );

COMMENT ON POLICY "users_insert_profiles" ON public.user_profiles IS 'Allow users to insert own profile or admins to insert for their company.';
