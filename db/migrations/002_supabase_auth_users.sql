-- Link Supabase Auth identities to the application users table.
-- Run this in Supabase SQL Editor after db/schema.sql.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET auth_user_id = NEW.id,
      full_name = COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), full_name),
      email = NEW.email,
      email_verified_at = NEW.email_confirmed_at,
      updated_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND auth_user_id IS NULL;

  IF FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (auth_user_id, full_name, email, email_verified_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN NEW.email_confirmed_at IS NULL THEN NULL ELSE NEW.email_confirmed_at END
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET email = EXCLUDED.email,
        email_verified_at = EXCLUDED.email_verified_at,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill Auth users that existed before this migration.
INSERT INTO public.users (auth_user_id, full_name, email, email_verified_at)
SELECT
  au.id,
  COALESCE(NULLIF(BTRIM(au.raw_user_meta_data ->> 'full_name'), ''), split_part(au.email, '@', 1)),
  au.email,
  au.email_confirmed_at
FROM auth.users au
WHERE au.email IS NOT NULL
ON CONFLICT (auth_user_id) DO UPDATE
  SET email = EXCLUDED.email,
      email_verified_at = EXCLUDED.email_verified_at,
      updated_at = now();
