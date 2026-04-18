-- Ensure both admin profiles exist and are active
INSERT INTO public.profiles (id, email, role, status)
SELECT id, email, 'admin', 'active'
FROM auth.users
WHERE email IN ('nganlinh4@soongsil.ac.kr', 'hpnq.work@outlook.com')
ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active';
