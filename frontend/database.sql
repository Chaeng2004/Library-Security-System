-- Run this in the Supabase SQL editor (Project > SQL Editor)

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

-- 4. Trigger to adjust user credit score on book return
CREATE OR REPLACE FUNCTION public.handle_borrowing_return()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credit_change INTEGER := 0;
  v_current_credit INTEGER;
  v_new_credit INTEGER;
BEGIN
  -- Only trigger when status changes to 'returned' from 'active'
  IF NEW.status = 'returned' AND OLD.status = 'active' THEN
    -- Check if returned early (3+ days before due_date), on-time, or late
    IF NEW.returned_date <= NEW.due_date THEN
      IF (NEW.due_date::date - NEW.returned_date::date) >= 3 THEN
        v_credit_change := 15; -- Early return bonus
      ELSE
        v_credit_change := 10; -- On-time return bonus
      END IF;
    ELSE
      v_credit_change := -20; -- Late return penalty
    END IF;

    -- Fetch user's current credit score
    SELECT credit_score INTO v_current_credit FROM public.user_profiles WHERE id = NEW.user_id;
    IF v_current_credit IS NULL THEN
      v_current_credit := 100;
    END IF;

    v_new_credit := v_current_credit + v_credit_change;
    
    -- Clamp score between 0 and 200
    IF v_new_credit < 0 THEN
      v_new_credit := 0;
    ELSIF v_new_credit > 200 THEN
      v_new_credit := 200;
    END IF;

    -- Update the user's profile
    UPDATE public.user_profiles
    SET credit_score = v_new_credit
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
  v_current_credit INTEGER;
  v_new_credit INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  FOR r IN 
    SELECT id, user_id FROM public.borrowings 
    WHERE status = 'active' AND due_date < v_now AND overdue_penalized = FALSE
  LOOP
    -- Get user's current credit
    SELECT credit_score INTO v_current_credit FROM public.user_profiles WHERE id = r.user_id;
    IF v_current_credit IS NULL THEN
      v_current_credit := 100;
    END IF;

    v_new_credit := v_current_credit - 20; -- Overdue penalty
    IF v_new_credit < 0 THEN
      v_new_credit := 0;
    END IF;

    -- Update user profile
    UPDATE public.user_profiles
    SET credit_score = v_new_credit
    WHERE id = r.user_id;

    -- Mark borrowing as penalized so we don't repeat the penalty
    UPDATE public.borrowings
    SET overdue_penalized = TRUE
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. Promote a user to admin (replace the email before running)
-- UPDATE public.user_profiles
--   SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL_HERE');
