-- Run migrations in Supabase SQL Editor (Project > SQL Editor).
-- REQUIRED for return-request flow: run section 6 before users can request returns.

-- 1. Add role column and credit_score column to user_profiles if missing
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('admin', 'user'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 100
  CONSTRAINT credit_score_range CHECK (credit_score >= 0 AND credit_score <= 200);

-- 2. Add overdue_penalized column to borrowings if missing
ALTER TABLE public.borrowings
  ADD COLUMN IF NOT EXISTS overdue_penalized BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Auto-create a profile row for every new signup (with 100 base credit)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, first_name, last_name, phone, address, library_id, role, credit_score)
  VALUES (NEW.id, '', '', '', '', '', 'user', 100)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Trigger to adjust user credit score when admin confirms return (return_pending → returned)
CREATE OR REPLACE FUNCTION public.handle_borrowing_return()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credit_change INTEGER := 0;
  v_due_date DATE;
  v_return_date DATE;
BEGIN
  -- Only trigger when admin confirms return (return_pending → returned)
  IF NEW.status = 'returned' AND OLD.status = 'return_pending' THEN
    -- Compare by date (not timestamp) so returns on due-date are treated as on-time.
    v_due_date := NEW.due_date::date;
    v_return_date := COALESCE(NEW.returned_date, NOW())::date;

    -- Check if returned early (3+ days before due_date), on-time, or late
    IF v_return_date <= v_due_date THEN
      IF (v_due_date - v_return_date) >= 3 THEN
        v_credit_change := 15; -- Early return bonus
      ELSE
        v_credit_change := 10; -- On-time return bonus
      END IF;
    ELSE
      v_credit_change := -20; -- Late return penalty
    END IF;

    -- Ensure a profile row exists, then apply delta with clamp [0, 200].
    INSERT INTO public.user_profiles (id, first_name, last_name, phone, address, library_id, role, credit_score)
    VALUES (NEW.user_id, '', '', '', '', '', 'user', 100)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.user_profiles
    SET credit_score = GREATEST(0, LEAST(200, COALESCE(credit_score, 100) + v_credit_change))
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_borrowing_return ON public.borrowings;
CREATE TRIGGER trg_handle_borrowing_return
  AFTER UPDATE OF status ON public.borrowings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_borrowing_return();

-- 5. RPC function to check and penalize overdue borrowings on load
CREATE OR REPLACE FUNCTION public.penalize_overdue_borrowings()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  FOR r IN
    SELECT id, user_id FROM public.borrowings
    WHERE status IN ('active', 'return_pending') AND due_date < v_now AND overdue_penalized = FALSE
  LOOP
    -- Ensure profile exists before applying overdue penalty.
    INSERT INTO public.user_profiles (id, first_name, last_name, phone, address, library_id, role, credit_score)
    VALUES (r.user_id, '', '', '', '', '', 'user', 100)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.user_profiles
    SET credit_score = GREATEST(0, LEAST(200, COALESCE(credit_score, 100) - 20))
    WHERE id = r.user_id;

    -- Mark borrowing as penalized so we don't repeat the penalty
    UPDATE public.borrowings
    SET overdue_penalized = TRUE
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. REQUIRED: allow return_pending status (fixes "borrowings_status_check" on return request)
ALTER TABLE public.borrowings DROP CONSTRAINT IF EXISTS borrowings_status_check;
ALTER TABLE public.borrowings ADD CONSTRAINT borrowings_status_check
  CHECK (status IN ('pending', 'active', 'return_pending', 'returned'));

-- 7. Promote a user to admin (replace the email before running)
-- UPDATE public.user_profiles
--   SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL_HERE');

-- 8. Verify deployment (optional)
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_handle_borrowing_return';
-- SELECT proname FROM pg_proc WHERE proname IN ('handle_borrowing_return', 'penalize_overdue_borrowings');
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'borrowings_status_check';
