-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a SECURITY DEFINER function that bypasses RLS for the admin check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- Re-create the policy using the function (no recursion)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());
