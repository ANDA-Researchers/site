-- Debug: show current profile state
DO $$
DECLARE
  v_count integer;
  v_status text;
  v_role text;
BEGIN
  SELECT COUNT(*), MIN(status), MIN(role)
  INTO v_count, v_status, v_role
  FROM public.profiles
  WHERE email = 'nganlinh4@soongsil.ac.kr';

  RAISE NOTICE 'Profile count: %, status: %, role: %', v_count, v_status, v_role;

  -- Force update regardless
  UPDATE public.profiles
  SET status = 'active', role = 'admin'
  WHERE email = 'nganlinh4@soongsil.ac.kr';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Rows updated: %', v_count;

  -- If no rows exist at all, insert from auth.users
  IF v_count = 0 THEN
    INSERT INTO public.profiles (id, email, role, status)
    SELECT id, email, 'admin', 'active'
    FROM auth.users
    WHERE email = 'nganlinh4@soongsil.ac.kr';
    RAISE NOTICE 'Inserted new profile';
  END IF;
END $$;
