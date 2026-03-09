-- Insert admin profile by looking up the user by email
INSERT INTO public.profiles (id, email, role, status)
SELECT id, email, 'admin', 'active'
FROM auth.users
WHERE email = 'nganlinh4@soongsil.ac.kr'
ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active';
