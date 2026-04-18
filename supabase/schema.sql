-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending')),
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- SECURITY DEFINER function to check admin status without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- Admins can read all profiles (for User Management section)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Only Edge Functions (service role) can INSERT/UPDATE/DELETE
-- No client-side write policies needed

-- ──────────────────────────────────────────────────────────────
-- INITIAL SETUP (run after creating admin user via Dashboard → Auth → Users → Invite user)
-- Replace <ADMIN_USER_UUID> and <ADMIN_EMAIL> with actual values
-- ──────────────────────────────────────────────────────────────

-- INSERT INTO public.profiles (id, email, role, status)
-- VALUES ('<ADMIN_USER_UUID>', '<ADMIN_EMAIL>', 'admin', 'active');
