-- Create second admin user and profile
-- Note: auth.users insert must be done via API; this seeds the profile once the user exists
-- This migration will be a no-op if the user hasn't been created yet via the API
INSERT INTO public.profiles (id, email, role, status)
SELECT id, email, 'admin', 'active'
FROM auth.users
WHERE email = 'hpnq.work@outlook.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active';
