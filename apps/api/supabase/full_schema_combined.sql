-- ============================================================================
-- Migration: 001_initial_schema.sql
-- ============================================================================

-- ============================================================================
-- Financial Hub - Pack 1: Initial Schema Migration
-- ============================================================================
-- This migration creates the core data model for Financial Hub
-- All tables use UUID primary keys and proper foreign key relationships
-- Row Level Security (RLS) is enabled for multi-tenant data isolation
-- ============================================================================

-- Enable UUID extensions. 001 uses uuid_generate_v4() (uuid-ossp) but
-- later migrations (011,013,020,021,022) use gen_random_uuid() (pgcrypto).
-- Enable both so a fresh DB can apply all migrations without 42883.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Users Table (extends Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL CHECK (char_length(full_name) >= 1 AND char_length(full_name) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- email is optional: this product's settled auth flow is phone OTP only
  -- (see ui-mockups/auth-otp.html), so auth.users.email is NULL for real
  -- accounts. Only validate the format when an email is actually present.
  CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ============================================================================
-- Plans Table (one per user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('structured', 'daily')),
  income_pattern TEXT NOT NULL CHECK (income_pattern IN ('salaried', 'freelancer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'reassigned')),
  expected_income_amount NUMERIC CHECK (expected_income_amount IS NULL OR expected_income_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reassigned_at TIMESTAMPTZ
);

-- Ensure only one active plan per user via unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS one_active_plan_per_user ON public.plans(user_id) WHERE status = 'active';

-- ============================================================================
-- Pockets Table (per plan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pockets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('savings', 'fixed', 'spendable')),
  category TEXT CHECK (category IN ('food', 'transport', 'leisure', 'personal', 'utilities', 'healthcare', 'education', 'housing', 'family', 'other')),
  is_time_locked BOOLEAN NOT NULL DEFAULT FALSE,
  lock_until TIMESTAMPTZ,
  monthly_allocation NUMERIC NOT NULL DEFAULT 0 CHECK (monthly_allocation >= 0),
  daily_cap NUMERIC CHECK (daily_cap >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_lock CHECK (
    (is_time_locked = TRUE AND lock_until IS NOT NULL) OR 
    (is_time_locked = FALSE)
  )
);

-- ============================================================================
-- Fixed Expenses Table (per user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  category TEXT NOT NULL CHECK (category IN ('food', 'transport', 'leisure', 'personal', 'utilities', 'healthcare', 'education', 'housing', 'family', 'other')),
  -- Real status column: previously simulated by appending " (inactive)" to
  -- `name`, which corrupted user-entered data. See BACKEND_FRONTEND_AUDIT.md.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Income Events Table (manual income entry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.income_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (char_length(source) >= 1 AND char_length(source) <= 100),
  -- Optional per API_SPECIFICATION.md Â§1.2 and CreateIncomeDto; was wrongly
  -- NOT NULL, which crashed every manual income entry submitted without a
  -- label with "null value in column label violates not-null constraint".
  label TEXT CHECK (label IS NULL OR char_length(label) <= 200),
  date DATE NOT NULL,
  run_allocation BOOLEAN NOT NULL DEFAULT TRUE,
  unallocated_surplus NUMERIC CHECK (unallocated_surplus IS NULL OR unallocated_surplus >= 0),
  surplus_allocation_status TEXT CHECK (surplus_allocation_status IN ('pending', 'allocated', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Belt-and-braces: CREATE TABLE IF NOT EXISTS above is a no-op against a
-- database that already has this table from an older run of this file, so
-- it can't fix a stale NOT NULL constraint on `label` by itself. This ALTER
-- is idempotent (safe to run repeatedly, including on a freshly-created
-- table) and guarantees a full re-run always converges the live schema to
-- match this file, even for projects migrated before this fix existed.
ALTER TABLE public.income_events ALTER COLUMN label DROP NOT NULL;

-- ============================================================================
-- Transactions Table (ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL, -- signed: positive for credit, negative for debit
  type TEXT NOT NULL CHECK (type IN ('allocation', 'spend', 'reallocation_in', 'reallocation_out', 'rollover')),
  merchant TEXT,
  category TEXT CHECK (category IN ('grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Reallocations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reallocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
  to_pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (reason IN ('emergency', 'unexpected_expense', 'income_change', 'priority_shift', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cooling_off', 'completed', 'skipped')),
  cooling_off_ends_at TIMESTAMPTZ,
  discipline_cost NUMERIC NOT NULL DEFAULT 0 CHECK (discipline_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT different_pockets CHECK (from_pocket_id != to_pocket_id),
  CONSTRAINT valid_cooling_off CHECK (
    (status = 'cooling_off' AND cooling_off_ends_at IS NOT NULL) OR 
    (status != 'cooling_off')
  ),
  CONSTRAINT valid_completion CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR 
    (status != 'completed')
  )
);

-- ============================================================================
-- Merchant Classifications Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.merchant_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_key TEXT NOT NULL, -- e.g. till number, paybill, phone number
  category TEXT NOT NULL CHECK (category IN ('grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified')),
  -- Preferred pocket for this recipient (Batch 5). Nullable so legacy rows
  -- and ON DELETE SET NULL after pocket removal stay valid.
  pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL,
  remember BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Scoped per-user: two different users classifying the same till/paybill
  -- number must not collide with (or leak into) each other's records.
  CONSTRAINT unique_user_recipient UNIQUE (user_id, recipient_key)
);

-- Belt-and-braces (see the income_events ALTER above for why): a database
-- migrated before this fix existed has this table without `user_id` at all
-- (an early version scoped classifications globally by `recipient_key`
-- alone). CREATE TABLE IF NOT EXISTS can't add a missing column to an
-- existing table, so do it explicitly. Every read/write in
-- supabase.repository.ts filters on `user_id` (see
-- getMerchantClassificationsByUserId), so its absence throws "column
-- user_id does not exist" â€” the exact 500 behind GET /pockets/:id/merchant-scope
-- on a database that predates this column.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merchant_classifications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.merchant_classifications ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  -- The pre-user_id version of this table had a single global
  -- UNIQUE(recipient_key) constraint. Replace it with the per-user version
  -- so two different users classifying the same till/paybill number don't
  -- collide with (or overwrite) each other's records.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_recipient' AND conrelid = 'public.merchant_classifications'::regclass
  ) THEN
    ALTER TABLE public.merchant_classifications DROP CONSTRAINT unique_recipient;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_recipient' AND conrelid = 'public.merchant_classifications'::regclass
  ) THEN
    ALTER TABLE public.merchant_classifications ADD CONSTRAINT unique_user_recipient UNIQUE (user_id, recipient_key);
  END IF;

  -- Batch 5: preferred pocket for this recipient. CREATE TABLE IF NOT EXISTS
  -- cannot add a column to an existing table, so mirror the user_id pattern.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'merchant_classifications' AND column_name = 'pocket_id'
  ) THEN
    ALTER TABLE public.merchant_classifications
      ADD COLUMN pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- Behavior Events Table (per-user event log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.behavior_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Discipline Scores Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.discipline_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
  delta NUMERIC NOT NULL,
  period TEXT NOT NULL, -- e.g. '2024-01', 'week-3'
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One score row per user per period (was `user_id PRIMARY KEY` alone,
  -- which could only ever hold one row per user total and broke every
  -- upsert that targeted (user_id, period) â€” see BACKEND_FRONTEND_AUDIT.md).
  CONSTRAINT unique_user_period UNIQUE (user_id, period)
);

-- Belt-and-braces: a database migrated before this fix existed has this
-- table shaped as `user_id UUID PRIMARY KEY` alone (no separate `id`
-- column), which can hold only one row per user, ever. ReallocationsService
-- and DisciplineScoreService both upsert with
-- `onConflict: 'user_id,period'` (see supabase.repository.ts
-- upsertDisciplineScore), which has no matching constraint on that shape â€”
-- Postgres error 42P10, surfacing as a 500 on anything that touches
-- discipline score (e.g. POST /pockets/:id/unlock). CREATE TABLE IF NOT
-- EXISTS is a no-op here since the table already exists, so fix the shape
-- explicitly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'discipline_scores' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.discipline_scores ADD COLUMN id UUID DEFAULT uuid_generate_v4();

    -- Drop whatever the old `user_id UUID PRIMARY KEY` constraint was
    -- named (Postgres's default naming for an inline column-level PK is
    -- `<table>_pkey`) before user_id can be reused as a plain FK column
    -- with repeat values across periods.
    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'discipline_scores_pkey' AND conrelid = 'public.discipline_scores'::regclass
    ) THEN
      ALTER TABLE public.discipline_scores DROP CONSTRAINT discipline_scores_pkey;
    END IF;

    UPDATE public.discipline_scores SET id = uuid_generate_v4() WHERE id IS NULL;
    ALTER TABLE public.discipline_scores ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.discipline_scores ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_period' AND conrelid = 'public.discipline_scores'::regclass
  ) THEN
    ALTER TABLE public.discipline_scores ADD CONSTRAINT unique_user_period UNIQUE (user_id, period);
  END IF;
END $$;

-- ============================================================================
-- Notification Preferences Table (per user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reallocation_confirms BOOLEAN NOT NULL DEFAULT TRUE,
  cooling_off_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  savings_milestones BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_insights BOOLEAN NOT NULL DEFAULT FALSE,
  tips_nudges BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_notification_preferences_user UNIQUE (user_id)
);

-- ============================================================================
-- Merchant Reports Table (user-submitted classification disputes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.merchant_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_key TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('wrong_category', 'not_gambling', 'wrong_amount', 'unknown_payee')),
  description TEXT,
  suggested_category TEXT CHECK (suggested_category IS NULL OR suggested_category IN ('grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Plans
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON public.plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON public.plans(status);

-- Pockets
CREATE INDEX IF NOT EXISTS idx_pockets_plan_id ON public.pockets(plan_id);
CREATE INDEX IF NOT EXISTS idx_pockets_kind ON public.pockets(kind);
CREATE INDEX IF NOT EXISTS idx_pockets_is_time_locked ON public.pockets(is_time_locked);

-- Fixed Expenses
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_id ON public.fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_due_day ON public.fixed_expenses(due_day);

-- Income Events
CREATE INDEX IF NOT EXISTS idx_income_events_user_id ON public.income_events(user_id);
CREATE INDEX IF NOT EXISTS idx_income_events_date ON public.income_events(date);
CREATE INDEX IF NOT EXISTS idx_income_events_surplus_status ON public.income_events(surplus_allocation_status) WHERE surplus_allocation_status = 'pending';

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_pocket_id ON public.transactions(pocket_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

-- Reallocations
CREATE INDEX IF NOT EXISTS idx_reallocations_from_pocket ON public.reallocations(from_pocket_id);
CREATE INDEX IF NOT EXISTS idx_reallocations_to_pocket ON public.reallocations(to_pocket_id);
CREATE INDEX IF NOT EXISTS idx_reallocations_status ON public.reallocations(status);
CREATE INDEX IF NOT EXISTS idx_reallocations_created_at ON public.reallocations(created_at);

-- Merchant Classifications
CREATE INDEX IF NOT EXISTS idx_merchant_classifications_user_id ON public.merchant_classifications(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_classifications_recipient_key ON public.merchant_classifications(recipient_key);
CREATE INDEX IF NOT EXISTS idx_merchant_classifications_category ON public.merchant_classifications(category);
CREATE INDEX IF NOT EXISTS idx_merchant_classifications_pocket_id ON public.merchant_classifications(pocket_id);

-- Behavior Events
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_id ON public.behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON public.behavior_events(type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_created_at ON public.behavior_events(created_at);

-- Discipline Scores
CREATE INDEX IF NOT EXISTS idx_discipline_scores_user_id ON public.discipline_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_discipline_scores_calculated_at ON public.discipline_scores(calculated_at);

-- Notification Preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- Merchant Reports
CREATE INDEX IF NOT EXISTS idx_merchant_reports_user_id ON public.merchant_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_reports_status ON public.merchant_reports(status);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reallocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_reports ENABLE ROW LEVEL SECURITY;

-- Users: Users can only read/write their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Plans: Users can only read/write their own plans via user_id
CREATE POLICY "Users can view own plans" ON public.plans
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own plans" ON public.plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own plans" ON public.plans
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own plans" ON public.plans
  FOR DELETE USING (user_id = auth.uid());

-- Pockets: Users can only read/write pockets via their plans
CREATE POLICY "Users can view own pockets" ON public.pockets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plans 
      WHERE plans.id = pockets.plan_id 
      AND plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own pockets" ON public.pockets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plans 
      WHERE plans.id = pockets.plan_id 
      AND plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own pockets" ON public.pockets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.plans 
      WHERE plans.id = pockets.plan_id 
      AND plans.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own pockets" ON public.pockets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.plans 
      WHERE plans.id = pockets.plan_id 
      AND plans.user_id = auth.uid()
    )
  );

-- Fixed Expenses: Users can only read/write their own expenses
CREATE POLICY "Users can view own fixed expenses" ON public.fixed_expenses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own fixed expenses" ON public.fixed_expenses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own fixed expenses" ON public.fixed_expenses
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own fixed expenses" ON public.fixed_expenses
  FOR DELETE USING (user_id = auth.uid());

-- Income Events: Users can only read/write their own income events
CREATE POLICY "Users can view own income events" ON public.income_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own income events" ON public.income_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own income events" ON public.income_events
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own income events" ON public.income_events
  FOR DELETE USING (user_id = auth.uid());

-- Transactions: Users can only read/write transactions via their pockets
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pockets 
      WHERE pockets.id = transactions.pocket_id 
      AND EXISTS (
        SELECT 1 FROM public.plans 
        WHERE plans.id = pockets.plan_id 
        AND plans.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pockets 
      WHERE pockets.id = transactions.pocket_id 
      AND EXISTS (
        SELECT 1 FROM public.plans 
        WHERE plans.id = pockets.plan_id 
        AND plans.user_id = auth.uid()
      )
    )
  );

-- Reallocations: Users can only read/write reallocations via their pockets
CREATE POLICY "Users can view own reallocations" ON public.reallocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pockets 
      WHERE pockets.id = reallocations.from_pocket_id 
      AND EXISTS (
        SELECT 1 FROM public.plans 
        WHERE plans.id = pockets.plan_id 
        AND plans.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert own reallocations" ON public.reallocations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pockets 
      WHERE pockets.id = reallocations.from_pocket_id 
      AND EXISTS (
        SELECT 1 FROM public.plans 
        WHERE plans.id = pockets.plan_id 
        AND plans.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own reallocations" ON public.reallocations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.pockets 
      WHERE pockets.id = reallocations.from_pocket_id 
      AND EXISTS (
        SELECT 1 FROM public.plans 
        WHERE plans.id = pockets.plan_id 
        AND plans.user_id = auth.uid()
      )
    )
  );

-- Merchant Classifications: users can only read/write their own (this used
-- to be `USING (true)`, i.e. every user could read every other user's
-- merchant/recipient history â€” fixed now that user_id exists on the table)
CREATE POLICY "Users can view own merchant classifications" ON public.merchant_classifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own merchant classifications" ON public.merchant_classifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own merchant classifications" ON public.merchant_classifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own merchant classifications" ON public.merchant_classifications
  FOR DELETE USING (user_id = auth.uid());

-- Behavior Events: users can only read their own; writes happen via service layer
CREATE POLICY "Users can view own behavior events" ON public.behavior_events
  FOR SELECT USING (user_id = auth.uid());

-- Discipline Scores: Users can only read/write their own scores
CREATE POLICY "Users can view own discipline scores" ON public.discipline_scores
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own discipline scores" ON public.discipline_scores
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own discipline scores" ON public.discipline_scores
  FOR UPDATE USING (user_id = auth.uid());

-- Notification Preferences: users can only read/write their own row
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- Merchant Reports: users can view/create their own reports; review status
-- transitions are performed via the service layer (no client-side UPDATE policy)
CREATE POLICY "Users can view own merchant reports" ON public.merchant_reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own merchant reports" ON public.merchant_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Functions and Triggers for Business Rules
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pockets_updated_at BEFORE UPDATE ON public.pockets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fixed_expenses_updated_at BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Function for Atomic Reallocation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.atomic_reallocation(
  p_from_pocket_id UUID,
  p_to_pocket_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_status TEXT DEFAULT 'pending'
)
RETURNS UUID AS $$
DECLARE
  v_reallocation_id UUID;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Validate amount is positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  -- Validate pockets are different
  IF p_from_pocket_id = p_to_pocket_id THEN
    RAISE EXCEPTION 'Source and destination pockets must be different';
  END IF;
  
  -- Create reallocation record
  INSERT INTO public.reallocations (
    from_pocket_id,
    to_pocket_id,
    amount,
    reason,
    status
  ) VALUES (
    p_from_pocket_id,
    p_to_pocket_id,
    p_amount,
    p_reason,
    p_status
  ) RETURNING id INTO v_reallocation_id;
  
  -- Debit from source pocket
  INSERT INTO public.transactions (
    pocket_id,
    amount,
    type
  ) VALUES (
    p_from_pocket_id,
    -p_amount, -- negative for debit
    'reallocation_out'
  );
  
  -- Credit to destination pocket
  INSERT INTO public.transactions (
    pocket_id,
    amount,
    type
  ) VALUES (
    p_to_pocket_id,
    p_amount, -- positive for credit
    'reallocation_in'
  );
  
  RETURN v_reallocation_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically on exception
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Helper Function to Log Behavior Events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_behavior_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.behavior_events (user_id, type, payload)
  VALUES (p_user_id, p_event_type, p_payload)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger to create user profile on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users so every new signup gets a matching
-- public.users profile row automatically (required by plans.user_id FK
-- and every other table that references public.users).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- Migration: 002_freelancer_runway.sql
-- ============================================================================

-- ============================================================================
-- Freelancer adaptive runway â€” see docs/FREELANCER_RUNWAY.md
-- ============================================================================
-- Self-reported pay-cadence estimate captured at onboarding (banded: weekly
-- /biweekly/monthly/irregular, mapped to a day count in
-- packages/shared/src/schemas/index.ts's IncomeIntervalDaysByBand). Used by
-- RunwayService as a fallback until the user has >= 2 real income_events to
-- derive a historical cadence from. NULL for salaried/mix plans â€” the CHECK
-- constraint only enforces positivity when the value is present, it doesn't
-- require it.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS income_interval_days INTEGER CHECK (income_interval_days IS NULL OR income_interval_days > 0);

COMMENT ON COLUMN public.plans.income_interval_days IS
  'Freelancer-only. Onboarding-time estimate (days) of the gap between payments, used as a fallback by RunwayService before real income_events history exists. NULL for salaried/mix plans.';

-- ============================================================================
-- Migration: 003_pocket_categories_housing_family.sql
-- ============================================================================

-- ============================================================================
-- Expand pocket / fixed-expense category enums
-- ============================================================================
-- Adds `housing` and `family` so rent/mortgage and dependents/family-support
-- lines are first-class categories (see ONBOARDING_AND_SCORING_REDESIGN.md
-- Part 6 #5 and Part 3). Postgres CHECK constraints must be dropped and
-- recreated to widen the allowed set.

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS pockets_category_check;
ALTER TABLE public.pockets
  ADD CONSTRAINT pockets_category_check
  CHECK (category IS NULL OR category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family', 'other'
  ));

ALTER TABLE public.fixed_expenses DROP CONSTRAINT IF EXISTS fixed_expenses_category_check;
ALTER TABLE public.fixed_expenses
  ADD CONSTRAINT fixed_expenses_category_check
  CHECK (category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family', 'other'
  ));


-- ============================================================================
-- Migration: 004_merchant_classification_pocket_id.sql
-- ============================================================================

-- ============================================================================
-- Merchant classifications: persist preferred pocket
-- ============================================================================
-- Batch 5 / ONBOARDING_AND_SCORING_REDESIGN.md Part 6 #1:
-- the classify UI asks which pocket a merchant belongs to, but the column
-- never existed â€” answers were silently dropped. ON DELETE SET NULL so
-- deleting a pocket (e.g. plan retake) does not cascade-delete the user's
-- recipient memory; they can re-point it later.

ALTER TABLE public.merchant_classifications
  ADD COLUMN IF NOT EXISTS pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_classifications_pocket_id
  ON public.merchant_classifications(pocket_id);


-- ============================================================================
-- Migration: 005_push_tokens_and_deliveries.sql
-- ============================================================================

-- ============================================================================
-- Batch 7: Expo push tokens + delivery idempotency
-- ============================================================================
-- Preferences already exist (notification_preferences). This migration adds:
-- 1. push_tokens â€” devices that can receive Expo push payloads
-- 2. notification_deliveries â€” dedupe so schedulers / event hooks don't
--    double-send the same cooling-off / milestone / monthly insight

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_push_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_notification_delivery UNIQUE (user_id, kind, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_id
  ON public.notification_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_kind_sent
  ON public.notification_deliveries(kind, sent_at);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push tokens" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own push tokens" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notification deliveries" ON public.notification_deliveries
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- Migration: 006_idempotency_records.sql
-- ============================================================================

-- ============================================================================
-- Idempotency keys for income + spend writes
-- ============================================================================
-- Prevents double-recording when a mobile client times out and retries
-- (common on flaky connections). Scoped per user so keys never collide
-- across accounts.

CREATE TABLE IF NOT EXISTS public.idempotency_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Scoped per user+operation+segment so retries in one segment cannot collide
  -- with another. Pre-023 values 'income'/'spend' are kept for migration compat.
  scope TEXT NOT NULL CHECK (
    scope IN ('income', 'spend', 'loan_reminder')
    OR scope ~ '^(income|spend):(individual|msme)$'
    OR scope ~ '^invoice_pay:(individual|msme)$'
    OR scope ~ '^stock:(individual|msme)$'
  ),
  idempotency_key TEXT NOT NULL,
  resource_id UUID,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_idempotency_record UNIQUE (user_id, scope, idempotency_key),
  CONSTRAINT idempotency_key_length CHECK (
    char_length(idempotency_key) >= 8 AND char_length(idempotency_key) <= 128
  )
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_user_scope
  ON public.idempotency_records(user_id, scope);

ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own idempotency records" ON public.idempotency_records
  FOR SELECT USING (auth.uid() = user_id);


-- ============================================================================
-- Migration: 007_sub_pockets.sql
-- ============================================================================

-- ============================================================================
-- Sub-pockets: parent_pocket_id on the existing pockets table
-- ============================================================================
-- audit_team.md item 10 (second half) / FLUTTER_TO_EXPO_PORT_GUIDE.md Â§5:
-- a `parent_pocket_id` FK on `pockets` rather than a separate `sub_pockets`
-- table, so sub-pockets are ordinary pockets that reuse every existing
-- ledger/cap/rollover/merchant-scope code path unmodified â€” a sub-pocket
-- IS a pocket, just one with a parent.
--
-- ON DELETE CASCADE: deleting a parent pocket (e.g. a future plan retake
-- that drops it) takes its sub-pockets with it, same as deleting a plan
-- already cascades to its pockets. The application layer (see
-- pockets.service.ts deleteSubPocket) additionally refuses to delete a
-- sub-pocket that still holds ledger balance, so this cascade path is only
-- ever hit alongside a parent that's already being torn down deliberately.
--
-- Depth is capped at one level (no sub-pockets of sub-pockets) â€” that's
-- enforced in the application layer (pockets.service.ts), not in SQL,
-- because a CHECK constraint can't see other rows to verify a parent has no
-- parent of its own.

ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS parent_pocket_id UUID REFERENCES public.pockets(id) ON DELETE CASCADE;

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS pocket_not_own_parent;
ALTER TABLE public.pockets
  ADD CONSTRAINT pocket_not_own_parent CHECK (parent_pocket_id IS NULL OR parent_pocket_id != id);

CREATE INDEX IF NOT EXISTS idx_pockets_parent_pocket_id ON public.pockets(parent_pocket_id);

-- ============================================================================
-- Migration: 008_income_surplus_columns.sql
-- ============================================================================

-- Add income surplus columns missing from production
-- (001_initial_schema defined them, but older projects never received them
-- because CREATE TABLE IF NOT EXISTS is a no-op on existing tables.)

ALTER TABLE public.income_events
  ADD COLUMN IF NOT EXISTS unallocated_surplus NUMERIC
  CHECK (unallocated_surplus IS NULL OR unallocated_surplus >= 0);

ALTER TABLE public.income_events
  ADD COLUMN IF NOT EXISTS surplus_allocation_status TEXT
  CHECK (surplus_allocation_status IN ('pending', 'allocated', 'skipped'));

ALTER TABLE public.income_events ALTER COLUMN label DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_events_surplus_status
  ON public.income_events(surplus_allocation_status)
  WHERE surplus_allocation_status = 'pending';


-- ============================================================================
-- Migration: 009_money_personality.sql
-- ============================================================================

-- ============================================================================
-- Money personality as a modifier layer (audit_team.md item 2 batch 2 /
-- ONBOARDING_AND_SCORING_REDESIGN.md Â§2.3)
-- ============================================================================
-- `moneyPersonality` was captured at onboarding (rules-engine.ts) but never
-- persisted anywhere past the initial plan-assignment call â€” every later
-- read of it (reallocations cooling-off, notification cadence, insights
-- ordering) had nothing to read. This adds it to `plans` so it survives
-- past onboarding and is available to the modifier-layer consumers.
--
-- Defaults to 'saver' (same fallback rules-engine.ts already used for a
-- missing answer: `input.moneyPersonality ?? 'saver'`) so existing rows and
-- clients that don't send the field keep the same effective behavior as
-- before this migration.
-- ============================================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS money_personality TEXT NOT NULL DEFAULT 'saver'
    CHECK (money_personality IN ('spender', 'saver', 'avoider'));

-- ============================================================================
-- Migration: 010_sub_pocket_split_percentage.sql
-- ============================================================================

-- ============================================================================
-- Sub-pocket percentage splits (replaces the flat-amount sub-pocket model)
-- ============================================================================
-- 007_sub_pockets.sql gave sub-pockets a flat `monthly_allocation` capped at
-- the parent's total, but nothing ever moved money into them â€” income
-- allocation only ever credits top-level pockets (getTopLevelPocketsByPlanId
-- filters parent_pocket_id IS NULL), so a sub-pocket's ledger balance sat at
-- zero forever. This migration switches sub-pockets to a percentage-of-
-- parent model instead: `split_percentage` is the source of truth for a
-- sub-pocket's share, and its `monthly_allocation` becomes a derived/cached
-- value (parent.monthly_allocation * split_percentage / 100), recomputed by
-- the application layer whenever the parent's plan changes.
--
-- Clean cutover, no backfill: no sub-pockets exist in production yet (team
-- testing only, confirmed 2026-08-14) â€” this feature was effectively
-- unused, so there's nothing to migrate data for.
--
-- NULL for top-level pockets (parent_pocket_id IS NULL) â€” the constraint
-- below only fires for rows that are themselves sub-pockets.
-- ============================================================================

ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS split_percentage NUMERIC;

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS sub_pocket_split_percentage_range;
ALTER TABLE public.pockets
  ADD CONSTRAINT sub_pocket_split_percentage_range
    CHECK (
      split_percentage IS NULL
      OR (parent_pocket_id IS NOT NULL AND split_percentage > 0 AND split_percentage <= 100)
    );

-- Sibling SUM(split_percentage) <= 100 needs sibling context a CHECK
-- constraint can't see (no cross-row CHECKs in Postgres) â€” enforced in
-- pockets.service.ts, same posture as the depth-cap-at-one-level rule in
-- 007_sub_pockets.sql.

-- ============================================================================
-- Migration: 011_emergency_unlocks.sql
-- ============================================================================

-- ============================================================================
-- Emergency unlock tracking (once-per-month limit for savings withdrawals)
-- ============================================================================
-- This table tracks when users unlock emergency funds from their savings
-- pocket. The unique constraint on (user_id, month) enforces the once-per-month
-- limit at the database level.
--
-- Related change: transactions table gets emergency_unlock_id FK to link
-- unlock transactions to their parent unlock event.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.emergency_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  days_calculated INTEGER NOT NULL CHECK (days_calculated > 0),
  least_daily_spend NUMERIC NOT NULL CHECK (least_daily_spend >= 0),
  average_daily_spend NUMERIC NOT NULL CHECK (average_daily_spend >= 0),
  reserve_kept NUMERIC NOT NULL CHECK (reserve_kept >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enforce the once-per-month limit at the database level.
--
-- A table-level UNIQUE constraint can only reference plain columns, not
-- expressions â€” `UNIQUE (user_id, DATE_TRUNC('month', created_at))` is
-- invalid syntax (Postgres: "syntax error at or near ..."), which made this
-- migration fail outright on a from-scratch run (nothing after it in this
-- file, or in any later migration, ever applied either).
--
-- The fix needs two things, not just moving to CREATE UNIQUE INDEX:
-- 1. An index on an expression requires that expression to be IMMUTABLE.
--    date_trunc(text, timestamptz) is only STABLE â€” its result depends on
--    the session's `TimeZone` setting, so Postgres refuses it in an index
--    ("functions in index expression must be marked IMMUTABLE").
-- 2. Pinning the conversion to UTC explicitly (rather than trusting
--    whatever TimeZone happens to be set) makes the result genuinely
--    deterministic, so wrapping it in a same-signature IMMUTABLE SQL
--    function is safe, not just silencing the check â€” this is the
--    standard pattern for indexing timestamptz by calendar bucket. Matches
--    the UTC-anchoring convention already used elsewhere in this codebase
--    (see InsightsService.getActivityHeatmap's Date.UTC/getUTC* comment).
CREATE OR REPLACE FUNCTION public.immutable_utc_month(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (DATE_TRUNC('month', ts AT TIME ZONE 'UTC'))::date;
$$;

DROP INDEX IF EXISTS public.emergency_unlocks_one_per_month;
CREATE UNIQUE INDEX emergency_unlocks_one_per_month
  ON public.emergency_unlocks (user_id, public.immutable_utc_month(created_at));

-- Add comment to explain the table
COMMENT ON TABLE public.emergency_unlocks IS 'Tracks emergency unlock events from savings to enforce once-per-month usage limit';

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emergency_unlocks_user_id ON public.emergency_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_unlocks_plan_id ON public.emergency_unlocks(plan_id);
CREATE INDEX IF NOT EXISTS idx_emergency_unlocks_created_at ON public.emergency_unlocks(created_at DESC);

-- Add emergency_unlock_id to transactions table to link unlock transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS emergency_unlock_id UUID REFERENCES public.emergency_unlocks(id) ON DELETE SET NULL;

-- Add index for finding all transactions in an unlock
CREATE INDEX IF NOT EXISTS idx_transactions_emergency_unlock_id ON public.transactions(emergency_unlock_id) WHERE emergency_unlock_id IS NOT NULL;


-- ============================================================================
-- Migration: 012_loan_subpocket_constraint_fix.sql
-- ============================================================================

-- ============================================================================
-- Fix: sub-pockets of a Loan pocket 500 on creation
-- ============================================================================
-- Root cause (see PocketsService.createSubPocket): a sub-pocket inherits
-- its parent's `kind` so pocket-rules.ts / spend checks treat it exactly
-- like any other pocket of that kind. For a Loan pocket's purpose
-- sub-pockets (audit_team.md item 9 â€” "sub-pockets for repayment vs.
-- purpose allocation"), that means the insert gets kind = 'loan' but never
-- sets `repayment_schedule` or `due_day` â€” those belong to the top-level
-- loan, not its purpose sub-pockets.
--
-- 008_loans.sql's `loan_schedule_only_for_loans` / `loan_due_day_only_for_loans`
-- constraints didn't anticipate sub-pockets: they required *every* row with
-- kind = 'loan' to carry a repayment_schedule and a due_day. So the insert
-- above violates both CHECK constraints, Postgres raises a constraint
-- violation, and â€” since nothing in PocketsService.createSubPocket or
-- SupabaseRepository.createPocket catches it â€” NestJS's default exception
-- filter turns the raw driver error into an unhandled 500. This is the
-- "Internal Server Error on sub-pocket creation" bug: reproducible for any
-- sub-pocket whose parent is a Loan pocket (kind = 'loan'), not just a bad
-- `category` value (category null/omitted was already valid â€” see
-- pockets_category_check in 001_initial_schema.sql â€” so that path never
-- 500s on its own).
--
-- Fix: scope both constraints to top-level pockets only
-- (parent_pocket_id IS NULL). A loan sub-pocket (parent_pocket_id NOT NULL,
-- kind = 'loan') is now explicitly allowed to have repayment_schedule/
-- due_day NULL; a top-level loan pocket still requires both, unchanged.

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS loan_schedule_only_for_loans;
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_schedule_only_for_loans CHECK (
    (kind = 'loan' AND parent_pocket_id IS NULL AND repayment_schedule IS NOT NULL) OR
    (kind = 'loan' AND parent_pocket_id IS NOT NULL) OR
    (kind != 'loan' AND repayment_schedule IS NULL)
  );

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS loan_due_day_only_for_loans;
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_due_day_only_for_loans CHECK (
    (kind = 'loan' AND parent_pocket_id IS NULL AND due_day IS NOT NULL) OR
    (kind = 'loan' AND parent_pocket_id IS NOT NULL) OR
    (kind != 'loan' AND due_day IS NULL)
  );

-- ============================================================================
-- Migration: 013_reserve_and_daily_allocations.sql
-- ============================================================================

-- ============================================================================
-- Ensure pgcrypto for gen_random_uuid() on fresh DBs (see 001).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reserve logical layer, daily allocation lifecycle, monthly planning cycle
-- and fixed-expense obligation protection.
--
-- Design principle: the Reserve Pocket is a LOGICAL layer â€” Financial HUB is
-- an intelligence layer that sits above existing financial institutions, not a
-- wallet. No real money moves; the ledger is the source of truth.
--
-- See: docs/FREELANCER_RUNWAY.md and the ChatGPT â†” Viktor Cliff architecture
-- conversation committed alongside this migration.
-- ============================================================================

-- ============================================================================
-- 1. Reserve logical layer on plans
-- ============================================================================
-- reserve_balance: the logical pool that income flows into after savings.
--   Income â†’ 10%+ Savings â†’ 90% Reserve.
--   Reserve is then earmarked to fixed obligations + daily runway.
--   This is a ledger value, not a bank balance.
--
-- monthly_planning_day: 1â€“28, the day of the month the Monthly Planning Cycle
--   fires for this user's plan (cron reads this; user configures in Profile).
--   Default 1 (first of month). Capped at 28 to avoid Feb edge cases.
--
-- last_planning_cycle_at: timestamp of the most recent Monthly Planning Cycle
--   run, used by the cron to avoid double-firing within the same calendar day.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS reserve_balance NUMERIC NOT NULL DEFAULT 0
    CHECK (reserve_balance >= 0),
  ADD COLUMN IF NOT EXISTS monthly_planning_day INTEGER NOT NULL DEFAULT 1
    CHECK (monthly_planning_day BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS last_planning_cycle_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.plans.reserve_balance IS
  'Logical reserve pool (not a real bank balance). Income â†’ 10%+ savings â†’ remainder here. Fixed obligations and daily runway are earmarked against this value.';
COMMENT ON COLUMN public.plans.monthly_planning_day IS
  'Day of month (1â€“28) when the Monthly Planning Cycle cron fires for this plan. User-configurable in Profile. Default: 1.';
COMMENT ON COLUMN public.plans.last_planning_cycle_at IS
  'Timestamp of the last successfully completed Monthly Planning Cycle. Null if never run.';

-- ============================================================================
-- 2. Fixed-expense obligation protection
-- ============================================================================
-- Extend fixed_expenses with:
--   funded_amount: how much of this month's obligation is already earmarked
--     in the Reserve (updated by income allocation and planning cycle).
--   carry_forward: whether a surplus (funded > actual spend) rolls to next
--     month's pocket or returns to Reserve. Configurable per expense.
--   funded_at: when the current cycle's funding was last updated.
--   notification_day_offset: how many days before due_day to send the
--     payment reminder push notification. Default: 1 (day before).

ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS funded_amount NUMERIC NOT NULL DEFAULT 0
    CHECK (funded_amount >= 0),
  ADD COLUMN IF NOT EXISTS carry_forward BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS funded_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS notification_day_offset INTEGER NOT NULL DEFAULT 1
    CHECK (notification_day_offset BETWEEN 0 AND 7);

COMMENT ON COLUMN public.fixed_expenses.funded_amount IS
  'Amount earmarked from Reserve for the current planning cycle. Reduced when the user marks the obligation as paid.';
COMMENT ON COLUMN public.fixed_expenses.carry_forward IS
  'If true, surplus (funded_amount > actual spend) carries to next month. If false, surplus returns to Reserve at month-end reconciliation.';
COMMENT ON COLUMN public.fixed_expenses.notification_day_offset IS
  'Days before due_day to fire the payment reminder push notification. 1 = day before (default). 0 = on the due date.';

-- ============================================================================
-- 3. Daily allocations table
-- ============================================================================
-- One row per plan per calendar day (UTC midnight-to-midnight, EAT cron).
-- Tracks what was authorized for today vs what was actually spent, and whether
-- unused funds were swept back to Reserve.
--
-- status lifecycle:  open â†’ closed
--   open:   today's allocation is active (cron creates at 00:00 EAT)
--   closed: end-of-day sweep completed (cron closes at 23:59 EAT / next 00:00)

CREATE TABLE IF NOT EXISTS public.daily_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Calendar date this allocation covers (UTC date of EAT midnight)
  allocation_date DATE NOT NULL,

  -- Amount released from Reserve for today's variable spending
  planned_amount NUMERIC NOT NULL CHECK (planned_amount >= 0),

  -- Actual spend recorded during the day (updated by spend events)
  actual_spend NUMERIC NOT NULL DEFAULT 0 CHECK (actual_spend >= 0),

  -- Amount swept back to Reserve at end-of-day (planned - actual, floored 0)
  returned_amount NUMERIC NOT NULL DEFAULT 0 CHECK (returned_amount >= 0),

  -- Overspend above the planned cap (actual - planned, floored 0).
  -- Overspend reduces the reserve_balance directly (shrinks runway).
  overspend_amount NUMERIC NOT NULL DEFAULT 0 CHECK (overspend_amount >= 0),

  -- Runway days at open (snapshot for insight reporting / delta display)
  runway_days_at_open NUMERIC NULL CHECK (runway_days_at_open >= 0),

  -- Runway days after close (shows extension from underspend, compression
  -- from overspend). Null until the allocation is closed.
  runway_days_at_close NUMERIC NULL CHECK (runway_days_at_close >= 0),

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL
);

COMMENT ON TABLE public.daily_allocations IS
  'One row per plan per day. Tracks the amount released from Reserve for variable spending, actual spend, and the end-of-day sweep back to Reserve. Runway delta is derived from planned vs actual.';

-- Unique: only one open allocation per plan per day
CREATE UNIQUE INDEX IF NOT EXISTS daily_allocations_plan_date_unique
  ON public.daily_allocations (plan_id, allocation_date);

CREATE INDEX IF NOT EXISTS idx_daily_allocations_user_id
  ON public.daily_allocations (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_allocations_plan_id_status
  ON public.daily_allocations (plan_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_allocations_date
  ON public.daily_allocations (allocation_date DESC);

-- ============================================================================
-- 4. Monthly planning cycle event log
-- ============================================================================
-- Audit trail of every Monthly Planning Cycle run. Used by behavioral analysis
-- to compare plan vs actual across cycles and surface allocation recommendations.

CREATE TABLE IF NOT EXISTS public.planning_cycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The calendar month this cycle covers (first day of month, UTC)
  cycle_month DATE NOT NULL,

  -- Reserve balance at the start of this cycle
  reserve_balance_at_start NUMERIC NOT NULL DEFAULT 0,

  -- Total fixed obligations identified and earmarked this cycle
  total_fixed_obligations NUMERIC NOT NULL DEFAULT 0,

  -- Reserve remaining for daily runway after obligations are earmarked
  discretionary_reserve NUMERIC NOT NULL DEFAULT 0,

  -- Daily budget and runway calculated at start of cycle
  daily_budget NUMERIC NOT NULL DEFAULT 0,
  runway_days NUMERIC NOT NULL DEFAULT 0,

  -- JSON snapshot of per-expense allocation decisions for this cycle
  -- e.g. [{ expense_id, name, amount, funded_amount, carry_forward_amount }]
  allocation_snapshot JSONB NULL,

  -- JSON snapshot of behavioral recommendations surfaced this cycle
  -- e.g. [{ expense_id, name, current_allocation, recommended_allocation, reason }]
  recommendations_snapshot JSONB NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.planning_cycle_events IS
  'Audit log of Monthly Planning Cycle runs. One row per cycle per plan. Behavioral analysis reads this to generate allocation recommendations.';

CREATE UNIQUE INDEX IF NOT EXISTS planning_cycle_plan_month_unique
  ON public.planning_cycle_events (plan_id, cycle_month);

CREATE INDEX IF NOT EXISTS idx_planning_cycle_user_id
  ON public.planning_cycle_events (user_id);
CREATE INDEX IF NOT EXISTS idx_planning_cycle_created_at
  ON public.planning_cycle_events (created_at DESC);

-- ============================================================================
-- 5. Transaction type extensions
-- ============================================================================
-- Add 'reserve_release' and 'reserve_return' to track the daily allocation
-- lifecycle in the transaction ledger.
-- 'daily_overspend_debit' marks when overspend directly reduces Reserve.

-- Postgres doesn't support DROP/ADD for enum values cleanly; we use ALTER TYPE
-- ... ADD VALUE which is safe and idempotent in Postgres 14+.

DO $$
BEGIN
  -- reserve_release: Reserve â†’ spendable pocket (daily allocation open)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'reserve_release'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'reserve_release';
  END IF;

  -- reserve_return: spendable pocket â†’ Reserve (end-of-day sweep, unused funds)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'reserve_return'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'reserve_return';
  END IF;

  -- daily_overspend_debit: Reserve debited for overspend (reduces runway)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'daily_overspend_debit'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'daily_overspend_debit';
  END IF;

  -- fixed_expense_earmark: Reserve â†’ fixed obligation pocket (planning cycle)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'fixed_expense_earmark'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'fixed_expense_earmark';
  END IF;

  -- fixed_expense_carry_forward: surplus carried forward to next cycle
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'fixed_expense_carry_forward'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'fixed_expense_carry_forward';
  END IF;
EXCEPTION
  WHEN invalid_schema_name THEN
    -- enum type doesn't exist yet (first-run schema has it as a text column)
    NULL;
END
$$;

-- ============================================================================
-- 6. Link daily_allocations to transactions
-- ============================================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS daily_allocation_id UUID
    REFERENCES public.daily_allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_daily_allocation_id
  ON public.transactions(daily_allocation_id)
  WHERE daily_allocation_id IS NOT NULL;

-- ============================================================================
-- 7. Emergency unlock redesign: freelancer-only, runway-impact model
-- ============================================================================
-- Add runway_impact columns to emergency_unlocks so each unlock records
-- the before/after runway days for display and insight reporting.
-- The 'plan_pattern' column lets service-layer guards enforce freelancer-only.

ALTER TABLE public.emergency_unlocks
  ADD COLUMN IF NOT EXISTS runway_days_before NUMERIC NULL CHECK (runway_days_before >= 0),
  ADD COLUMN IF NOT EXISTS runway_days_after NUMERIC NULL CHECK (runway_days_after >= 0),
  ADD COLUMN IF NOT EXISTS runway_reduction_days NUMERIC NULL CHECK (runway_reduction_days >= 0);

COMMENT ON COLUMN public.emergency_unlocks.runway_days_before IS
  'Discretionary runway days available before the emergency allocation was taken.';
COMMENT ON COLUMN public.emergency_unlocks.runway_days_after IS
  'Discretionary runway days remaining after the emergency allocation.';
COMMENT ON COLUMN public.emergency_unlocks.runway_reduction_days IS
  'runway_days_before âˆ’ runway_days_after. The number the UI shows to make the cost conscious.';

-- ============================================================================
-- Migration: 014_msme_segment.sql
-- ============================================================================

-- ============================================================================
-- 014_msme_segment.sql â€” MSME segment discriminator on plans (ADR-001 D1,
-- MSME_PHASED_BUILD_PLAN Â§5.1)
-- ============================================================================
-- A user may hold *two* active plans simultaneously â€” one `individual`, one
-- `msme` â€” so the "one active plan per user" guarantee becomes per-segment.
-- The default `'individual'` keeps every existing query (which passes no
-- segment) working unchanged.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'individual'
  CHECK (segment IN ('individual', 'msme'));

-- Replace the one-active-plan-per-user index with a per-segment variant.
DROP INDEX IF EXISTS one_active_plan_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_plan_per_segment_per_user
  ON public.plans(user_id, segment) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_plans_segment ON public.plans(segment);

COMMENT ON COLUMN public.plans.segment IS
  'Individual vs MSME â€” see docs/MSME_PHASED_BUILD_PLAN.md Â§5.1';

-- ============================================================================
-- Migration: 015_msme_pocket_categories.sql
-- ============================================================================

-- ============================================================================
-- 015_msme_pocket_categories.sql â€” widen pocket category enums (ADR-001 D2,
-- MSME_PHASED_BUILD_PLAN Â§5.2)
-- ============================================================================
-- Adds the 12 MSME business categories (stock, supplier, licence, tax,
-- salary, rent, operations, profit, owner_draw, growth, marketing,
-- equipment). Individual categories stay valid â€” the change is additive.
-- Same drop/recreate pattern as 003_pocket_categories_housing_family.sql.

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS pockets_category_check;
ALTER TABLE public.pockets
  ADD CONSTRAINT pockets_category_check
  CHECK (category IS NULL OR category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family',
    'stock', 'supplier', 'licence', 'tax', 'salary', 'rent',
    'operations', 'profit', 'owner_draw', 'growth', 'marketing', 'equipment',
    'other'
  ));

ALTER TABLE public.fixed_expenses DROP CONSTRAINT IF EXISTS fixed_expenses_category_check;
ALTER TABLE public.fixed_expenses
  ADD CONSTRAINT fixed_expenses_category_check
  CHECK (category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family',
    'stock', 'supplier', 'licence', 'tax', 'salary', 'rent',
    'operations', 'profit', 'owner_draw', 'growth', 'marketing', 'equipment',
    'other'
  ));

-- ============================================================================
-- Migration: 016_msme_phase2_segment_isolation.sql
-- ============================================================================

-- ============================================================================
-- 016_msme_phase2_segment_isolation.sql â€” Phase 2 segment isolation fixes
-- (known limits from Phase 1)
-- ============================================================================
-- 1. fixed_expenses is per-user/shared across segments â€” add segment discriminator
--    so Individual and MSME recurring costs do not overwrite each other.
-- 2. income_events likewise gains segment so surplus allocation can target the
--    correct segment's savings pocket (ADR-001 D1 + MSME_PHASED_BUILD_PLAN Â§5.1).
-- Both default to 'individual' so existing queries without a segment keep
-- working unchanged; MSME onboarding sets segment='msme' explicitly.
-- ============================================================================

-- fixed_expenses.segment
ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'individual'
  CHECK (segment IN ('individual', 'msme'));

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_segment ON public.fixed_expenses(segment);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_segment ON public.fixed_expenses(user_id, segment);

COMMENT ON COLUMN public.fixed_expenses.segment IS
  'Individual vs MSME recurring bill â€” see 016_msme_phase2_segment_isolation.sql / docs/MSME_PHASED_BUILD_PLAN.md Â§5.1';

-- income_events.segment â€” mirrors the plan that produced the surplus
ALTER TABLE public.income_events
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'individual'
  CHECK (segment IN ('individual', 'msme'));

CREATE INDEX IF NOT EXISTS idx_income_events_segment ON public.income_events(segment);
CREATE INDEX IF NOT EXISTS idx_income_events_user_segment ON public.income_events(user_id, segment);

COMMENT ON COLUMN public.income_events.segment IS
  'Which segment plan this income fed â€” see 016 / ADR-001';


-- ============================================================================
-- Migration: 017_msme_projects.sql
-- ============================================================================

-- 017_msme_projects.sql â€” Funding Cascade domain (Â§11â€“Â§15)
-- Phase 3 migration for MSME project funding cascade tables
-- Supports the core differentiator: forward cascade through Priorities/Needs/Wants tiers

CREATE TABLE IF NOT EXISTS public.msme_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  kind TEXT NOT NULL CHECK (kind IN ('catering','wedding','trip','tour','contract','construction','agri','other')),
  contract_value NUMERIC NOT NULL CHECK (contract_value > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  is_active_cascade BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT msme_projects_active_cascade_only_when_active
    CHECK (is_active_cascade = FALSE OR status = 'active')
);

-- Exactly one active cascade per user (satisfies Â§11.1)
CREATE UNIQUE INDEX msme_projects_one_active_cascade_per_user
  ON public.msme_projects(user_id) WHERE is_active_cascade = TRUE;
CREATE INDEX idx_msme_projects_user_id ON public.msme_projects(user_id);
CREATE INDEX idx_msme_projects_plan_id ON public.msme_projects(plan_id);
CREATE INDEX idx_msme_projects_status ON public.msme_projects(status);

CREATE TABLE IF NOT EXISTS public.msme_project_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('priorities','needs','wants')),
  sort_order SMALLINT NOT NULL CHECK (sort_order IN (1,2,3)),
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  allocated_amount NUMERIC NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  spent_amount NUMERIC NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  -- funding_status is derived: complete when allocated >= target. Stored as generated or computed in service.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msme_project_tiers_one_per_tier_per_project UNIQUE (project_id, tier),
  CONSTRAINT msme_project_tiers_sort_matches_tier
    CHECK ((tier='priorities' AND sort_order=1) OR (tier='needs' AND sort_order=2) OR (tier='wants' AND sort_order=3)),
  CONSTRAINT msme_project_tiers_allocated_lte_target_plus_excess
    CHECK (allocated_amount >= 0) -- allow over-target only via explicit excess flow (Phase 5)
);
CREATE INDEX idx_msme_project_tiers_project_id ON public.msme_project_tiers(project_id);

-- Income that feeds the cascade (Â§16)
CREATE TABLE IF NOT EXISTS public.msme_project_income_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (char_length(source) >=1 AND char_length(source) <=100),
  label TEXT CHECK (label IS NULL OR char_length(label) <=200),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msme_project_income_project_id ON public.msme_project_income_events(project_id);
CREATE INDEX idx_msme_project_income_date ON public.msme_project_income_events(date);

-- Atomic cascade allocations (audit trail for Â§17 example flow)
CREATE TABLE IF NOT EXISTS public.msme_project_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.msme_project_tiers(id) ON DELETE CASCADE,
  income_event_id UUID NOT NULL REFERENCES public.msme_project_income_events(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msme_alloc_tier_id ON public.msme_project_allocations(tier_id);
CREATE INDEX idx_msme_alloc_income_id ON public.msme_project_allocations(income_event_id);

-- Spending against a tier (Â§14:286) â€” separate from funding
CREATE TABLE IF NOT EXISTS public.msme_project_spends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_id UUID NOT NULL REFERENCES public.msme_project_tiers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  merchant TEXT,
  category TEXT,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msme_spends_tier_id ON public.msme_project_spends(tier_id);
CREATE INDEX idx_msme_spends_project_id ON public.msme_project_spends(project_id);

-- Excess prompts audit (Â§21)
CREATE TABLE IF NOT EXISTS public.msme_project_excess_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  income_event_id UUID NOT NULL REFERENCES public.msme_project_income_events(id) ON DELETE CASCADE,
  excess_amount NUMERIC NOT NULL CHECK (excess_amount > 0),
  chosen_target TEXT CHECK (chosen_target IN ('needs','wants','savings','keep')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- RLS â€” same pattern as 001_initial_schema.sql:372
ALTER TABLE public.msme_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_income_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_spends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_excess_prompts ENABLE ROW LEVEL SECURITY;

-- Policies: user_id = auth.uid() directly, or via project â†’ user_id join for tiers/allocations/spends
CREATE POLICY "Users can view their own projects" ON public.msme_projects
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own projects" ON public.msme_projects
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own projects" ON public.msme_projects
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can view tiers for their projects" ON public.msme_project_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view income events for their projects" ON public.msme_project_income_events
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert income events for their projects" ON public.msme_project_income_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view allocations for their projects" ON public.msme_project_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view spends for their projects" ON public.msme_project_spends
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view excess prompts for their projects" ON public.msme_project_excess_prompts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- updated_at trigger reuse
CREATE TRIGGER update_msme_projects_updated_at BEFORE UPDATE ON public.msme_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_msme_project_tiers_updated_at BEFORE UPDATE ON public.msme_project_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.msme_projects IS 'MSME project funding cascade â€” the core differentiator (Â§27:692)';
COMMENT ON TABLE public.msme_project_tiers IS 'Project funding tiers: Priorities(1) â†’ Needs(2) â†’ Wants(3) (Â§12:223)';
COMMENT ON TABLE public.msme_project_income_events IS 'Income that feeds the cascade (Â§16:356)';
COMMENT ON TABLE public.msme_project_allocations IS 'Audit trail of cascade allocations (Â§17:385)';
COMMENT ON TABLE public.msme_project_spends IS 'Spending against tiers, separate from funding (Â§14:270)';
COMMENT ON TABLE public.msme_project_excess_prompts IS 'Excess resolution prompts (Â§21:515)';


-- ============================================================================
-- Migration: 018_msme_phase5_spending_controls_and_completion.sql
-- ============================================================================

-- ============================================================================
-- 018_msme_phase5_spending_controls_and_completion.sql â€” Phase 5 polish
-- MSME spending controls, completion audit, and excess â†’ savings plumbing.
-- (MSME_PHASED_BUILD_PLAN.md Â§ Phase 5: Â§20 spending controls, Â§21 excess,
--  Â§22 completed handling). No new tables; only additive columns on
--  msme_projects so RLS and the per-user cascade index stay intact.
-- ============================================================================

-- Spending controls JSONB (Â§20:500) â€” optional friction stored per-project.
-- { lockWantsUntilPrioritiesAndNeedsFunded: bool,
--   warnOnLowPrioritySpend: bool }
-- Defaults to both off so existing Phase 3/4 projects keep their current
-- spend behaviour until the owner opts in via PATCH :id/spending-controls.
ALTER TABLE public.msme_projects
  ADD COLUMN IF NOT EXISTS spending_controls JSONB
    NOT NULL DEFAULT '{"lockWantsUntilPrioritiesAndNeedsFunded": false, "warnOnLowPrioritySpend": false}'::jsonb;

COMMENT ON COLUMN public.msme_projects.spending_controls IS
  'MSME optional spending controls (Â§20:500): lockWantsUntilPrioritiesAndNeedsFunded + warnOnLowPrioritySpend â€” see docs/MSME_PHASED_BUILD_PLAN.md Phase 5';

-- Completion audit (Â§22:534) â€” capture where the leftover cash was sent
-- when a completed project was resolved. Null until the user acts; either
-- resolved_to='savings' (funds moved) or 'keep' (left in tiers) mirrors the
-- excess prompt target set. Purely audit/UX, never a money-movement trigger
-- itself â€” the ledger rows in `transactions` are the source of truth.
ALTER TABLE public.msme_projects
  ADD COLUMN IF NOT EXISTS completion_resolved_at TIMESTAMPTZ;

ALTER TABLE public.msme_projects
  ADD COLUMN IF NOT EXISTS completion_resolved_to TEXT
    CHECK (completion_resolved_to IN ('savings', 'keep'));

COMMENT ON COLUMN public.msme_projects.completion_resolved_to IS
  'Phase 5 Â§22 â€” where remaining cash was directed after completion (savings|keep), null until resolved';

-- Defensive shape check: ensure spending_controls stays a JSON object when present.
-- Full key/value validation is enforced in the API (Zod schema) rather than here
-- to keep the migration forgiving of forward-compatible additions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'msme_projects_spending_controls_shape'
  ) THEN
    ALTER TABLE public.msme_projects
      ADD CONSTRAINT msme_projects_spending_controls_shape
        CHECK (spending_controls IS NULL OR jsonb_typeof(spending_controls) = 'object');
  END IF;
END $$;


-- ============================================================================
-- Migration: 019_msme_phase6_rls_audit_and_feature_flags.sql
-- ============================================================================

-- ============================================================================
-- 019_msme_phase6_rls_audit_and_feature_flags.sql â€” Phase 6 RLS Audit & Rollout
-- Complete Row Level Security policies for MSME tables and add feature_flags JSONB on users.
-- ============================================================================

-- 1. Feature flags column on users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS feature_flags JSONB
    NOT NULL DEFAULT '{"msme_segment": true}'::jsonb;

COMMENT ON COLUMN public.users.feature_flags IS
  'User remote config and feature flags (Phase 6) â€” supports staged rollout (pilot -> 10% -> GA)';

-- Defensive shape check: ensure feature_flags stays a JSON object when present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_feature_flags_shape'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_feature_flags_shape
        CHECK (feature_flags IS NULL OR jsonb_typeof(feature_flags) = 'object');
  END IF;
END $$;

-- 2. Additional RLS Policies for MSME Tables

-- msme_projects (DELETE policy)
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.msme_projects;
CREATE POLICY "Users can delete their own projects" ON public.msme_projects
  FOR DELETE USING (user_id = auth.uid());

-- msme_project_tiers (INSERT, UPDATE, DELETE policies)
DROP POLICY IF EXISTS "Users can insert tiers for their projects" ON public.msme_project_tiers;
CREATE POLICY "Users can insert tiers for their projects" ON public.msme_project_tiers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update tiers for their projects" ON public.msme_project_tiers;
CREATE POLICY "Users can update tiers for their projects" ON public.msme_project_tiers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete tiers for their projects" ON public.msme_project_tiers;
CREATE POLICY "Users can delete tiers for their projects" ON public.msme_project_tiers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- msme_project_income_events (UPDATE, DELETE policies)
DROP POLICY IF EXISTS "Users can update income events for their projects" ON public.msme_project_income_events;
CREATE POLICY "Users can update income events for their projects" ON public.msme_project_income_events
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete income events for their projects" ON public.msme_project_income_events;
CREATE POLICY "Users can delete income events for their projects" ON public.msme_project_income_events
  FOR DELETE USING (user_id = auth.uid());

-- msme_project_allocations (INSERT, UPDATE, DELETE policies)
DROP POLICY IF EXISTS "Users can insert allocations for their projects" ON public.msme_project_allocations;
CREATE POLICY "Users can insert allocations for their projects" ON public.msme_project_allocations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update allocations for their projects" ON public.msme_project_allocations;
CREATE POLICY "Users can update allocations for their projects" ON public.msme_project_allocations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete allocations for their projects" ON public.msme_project_allocations;
CREATE POLICY "Users can delete allocations for their projects" ON public.msme_project_allocations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- msme_project_spends (INSERT, UPDATE, DELETE policies)
DROP POLICY IF EXISTS "Users can insert spends for their projects" ON public.msme_project_spends;
CREATE POLICY "Users can insert spends for their projects" ON public.msme_project_spends
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update spends for their projects" ON public.msme_project_spends;
CREATE POLICY "Users can update spends for their projects" ON public.msme_project_spends
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete spends for their projects" ON public.msme_project_spends;
CREATE POLICY "Users can delete spends for their projects" ON public.msme_project_spends
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- msme_project_excess_prompts (INSERT, UPDATE, DELETE policies)
DROP POLICY IF EXISTS "Users can insert excess prompts for their projects" ON public.msme_project_excess_prompts;
CREATE POLICY "Users can insert excess prompts for their projects" ON public.msme_project_excess_prompts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update excess prompts for their projects" ON public.msme_project_excess_prompts;
CREATE POLICY "Users can update excess prompts for their projects" ON public.msme_project_excess_prompts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete excess prompts for their projects" ON public.msme_project_excess_prompts;
CREATE POLICY "Users can delete excess prompts for their projects" ON public.msme_project_excess_prompts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.msme_projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );


-- ============================================================================
-- Migration: 020_msme_invoices.sql
-- ============================================================================

-- ============================================================================
-- 020_msme_invoices.sql â€” MSME Invoicing & Receivables Ledger (Phase 1)
-- eTIMS-ready customer invoices with full RLS and payâ†’income linkage.
-- Spec: Financial_HUB_MSME_Feature_Requirements Â§4, livelife.ke eTIMS 2026
-- ============================================================================

-- 1. Feature flag for staged rollout (pilot â†’ GA)
ALTER TABLE public.users
  ALTER COLUMN feature_flags SET DEFAULT '{"msme_segment": true, "msme_invoices": true}'::jsonb;

-- Backfill existing rows missing the new key (idempotent)
UPDATE public.users
SET feature_flags = feature_flags || '{"msme_invoices": true}'::jsonb
WHERE NOT (feature_flags ? 'msme_invoices');

-- Ensure pgcrypto for gen_random_uuid() on fresh DBs (see 001).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Invoices table
CREATE TABLE IF NOT EXISTS public.msme_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL CHECK (char_length(customer_name) >= 1 AND char_length(customer_name) <= 100),
  -- KRA PIN: e.g. P051234567A (11 chars, letter + 9 digits + letter). Nullable for non-KRA customers.
  customer_pin TEXT CHECK (customer_pin IS NULL OR customer_pin ~ '^[A-Z][0-9]{9}[A-Z]$'),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  -- 'overdue' is derived (due_date < today AND status IN ('draft','sent')), not stored.
  description TEXT CHECK (description IS NULL OR char_length(description) <= 200),
  -- eTIMS submission tracking (future OSCU integration)
  etims_status TEXT CHECK (etims_status IS NULL OR etims_status IN ('pending', 'submitted', 'accepted')),
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msme_invoices_paid_at_only_when_paid CHECK (
    (status = 'paid' AND paid_at IS NOT NULL) OR (status != 'paid' AND paid_at IS NULL)
  ),
  CONSTRAINT msme_invoices_voided_at_only_when_void CHECK (
    (status = 'void' AND voided_at IS NOT NULL) OR (status != 'void' AND voided_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_msme_invoices_user_id ON public.msme_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_msme_invoices_plan_id ON public.msme_invoices(plan_id);
CREATE INDEX IF NOT EXISTS idx_msme_invoices_status ON public.msme_invoices(status);
CREATE INDEX IF NOT EXISTS idx_msme_invoices_due_date ON public.msme_invoices(due_date);
-- NOTE: intentionally NOT UNIQUE â€” two legitimate invoices can have same customer+due+amount
-- (see review D-03). Use an application-level idempotency key if dedup is needed.
CREATE INDEX IF NOT EXISTS idx_msme_invoices_user_customer_due ON public.msme_invoices(user_id, customer_name, due_date, amount);
-- Prod: CREATE INDEX CONCURRENTLY

-- updated_at trigger (reuse existing function from 001)
DROP TRIGGER IF EXISTS update_msme_invoices_updated_at ON public.msme_invoices;
CREATE TRIGGER update_msme_invoices_updated_at BEFORE UPDATE ON public.msme_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.msme_invoices IS 'MSME customer invoices â€” draft/sent/paid/void; overdue is derived (due_date < today AND status in draft/sent). Links to income_events on pay (020).';
COMMENT ON COLUMN public.msme_invoices.customer_pin IS 'KRA PIN, 11 chars A + 9 digits + A, nullable for non-KRA customers â€” eTIMS ready';
COMMENT ON COLUMN public.msme_invoices.etims_status IS 'eTIMS OSCU submission state â€” pending/submitted/accepted, null until submitted';

-- 3. RLS
ALTER TABLE public.msme_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can view their own invoices" ON public.msme_invoices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can insert their own invoices" ON public.msme_invoices
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can update their own invoices" ON public.msme_invoices
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can delete their own invoices" ON public.msme_invoices
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================================
-- Migration: 021_msme_stock.sql
-- ============================================================================

-- ============================================================================
-- 021_msme_stock.sql â€” MSME Stock & Inventory Tracker (Phase 3)
-- Real qty ledger (no mocks): items + movements (in/out/adjust) with RLS.
-- Links to pockets via pocket_id on movements (optional) for spend traceability.
-- ============================================================================

-- Ensure pgcrypto for gen_random_uuid() on fresh DBs (see 001).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Feature flag
ALTER TABLE public.users
  ALTER COLUMN feature_flags SET DEFAULT '{"msme_segment": true, "msme_invoices": true, "msme_stock": true}'::jsonb;

UPDATE public.users
SET feature_flags = feature_flags || '{"msme_stock": true}'::jsonb
WHERE NOT (feature_flags ? 'msme_stock');

-- Items
CREATE TABLE IF NOT EXISTS public.msme_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  sku TEXT CHECK (sku IS NULL OR char_length(sku) <= 30),
  qty_on_hand NUMERIC NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  low_stock_threshold NUMERIC NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  location TEXT CHECK (location IS NULL OR char_length(location) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msme_stock_items_user_id ON public.msme_stock_items(user_id);
CREATE INDEX IF NOT EXISTS idx_msme_stock_items_plan_id ON public.msme_stock_items(plan_id);
-- Case-insensitive SKU uniqueness per user (D-04). lower() prevents CEM50 vs cem50 dup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_msme_stock_items_user_sku ON public.msme_stock_items(user_id, lower(sku)) WHERE sku IS NOT NULL;
-- Prod: CREATE INDEX CONCURRENTLY

DROP TRIGGER IF EXISTS update_msme_stock_items_updated_at ON public.msme_stock_items;
CREATE TRIGGER update_msme_stock_items_updated_at BEFORE UPDATE ON public.msme_stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.msme_stock_items IS 'MSME stock items â€” qty_on_hand is denormalized sum of movements (in - out Â± adjust). 021.';

-- Movements
CREATE TABLE IF NOT EXISTS public.msme_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.msme_stock_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjust')),
  qty NUMERIC NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC CHECK (unit_cost IS NULL OR unit_cost >= 0),
  total_cost NUMERIC NOT NULL CHECK (total_cost >= 0),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_item_id ON public.msme_stock_movements(item_id);
-- Composite for history pagination (D-07)
CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_item_created ON public.msme_stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_user_id ON public.msme_stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_type ON public.msme_stock_movements(type);
-- Prod: CREATE INDEX CONCURRENTLY

COMMENT ON TABLE public.msme_stock_movements IS 'Stock movements â€” in (purchase/restock) adds, out (sale) subtracts, adjust is signed correction via qty. Links to pocket spend optionally.';

-- RLS
ALTER TABLE public.msme_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own stock items" ON public.msme_stock_items;
CREATE POLICY "Users can view their own stock items" ON public.msme_stock_items
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own stock items" ON public.msme_stock_items;
CREATE POLICY "Users can insert their own stock items" ON public.msme_stock_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own stock items" ON public.msme_stock_items;
CREATE POLICY "Users can update their own stock items" ON public.msme_stock_items
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own stock items" ON public.msme_stock_items;
CREATE POLICY "Users can delete their own stock items" ON public.msme_stock_items
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own stock movements" ON public.msme_stock_movements;
CREATE POLICY "Users can view their own stock movements" ON public.msme_stock_movements
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own stock movements" ON public.msme_stock_movements;
CREATE POLICY "Users can insert their own stock movements" ON public.msme_stock_movements
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own stock movements" ON public.msme_stock_movements;
CREATE POLICY "Users can delete their own stock movements" ON public.msme_stock_movements
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================================
-- Migration: 022_loans.sql
-- ============================================================================

-- ============================================================================
-- 022_loans.sql â€” Loans Feature (renumbered from 008_loans.sql on 2026-09-03)
-- Loan pocket type and repayment schedule support
-- ============================================================================
-- audit_team.md item 9: Loans as a pocket type with repayment schedules
-- and sub-pockets for repayment vs. purpose allocation.
-- Renumbered: original 008_loans.sql collided with 008_income_surplus_columns.sql
-- (duplicate version prefix). Content unchanged; version bump only.
--
-- This migration adds:
-- 1. 'loan' as a valid pocket kind
-- 2. repayment_schedule JSONB field for loan repayment terms
-- 3. loan_provider and loan_purpose fields for loan metadata
-- 4. due_day field for loan repayment due date (reusing fixed expense pattern)
--
-- The repayment_schedule JSONB structure:
-- {
--   "total_amount": number,
--   "repayment_amount": number,
--   "cadence": "weekly" | "biweekly" | "monthly",
--   "start_date": "ISO date string",
--   "end_date": "ISO date string",
--   "next_due_date": "ISO date string",
--   "total_payments": number,
--   "payments_made": number
-- }

-- Add 'loan' to the pocket kind constraint
ALTER TABLE public.pockets 
  DROP CONSTRAINT IF EXISTS pockets_kind_check;

ALTER TABLE public.pockets 
  ADD CONSTRAINT pockets_kind_check 
  CHECK (kind IN ('savings', 'fixed', 'spendable', 'loan'));

-- Add loan-specific fields to pockets table
ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS repayment_schedule JSONB,
  ADD COLUMN IF NOT EXISTS loan_provider TEXT,
  ADD COLUMN IF NOT EXISTS loan_purpose TEXT,
  ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

-- Add index for loan pockets to enable efficient querying
CREATE INDEX IF NOT EXISTS idx_pockets_kind_loan ON public.pockets(kind) WHERE kind = 'loan';

-- Add index for due_day to support upcoming payment queries
CREATE INDEX IF NOT EXISTS idx_pockets_due_day ON public.pockets(due_day) WHERE due_day IS NOT NULL;

-- Add comment to document the repayment_schedule structure
COMMENT ON COLUMN public.pockets.repayment_schedule IS 
'Repayment schedule for loan pockets. JSONB structure: {
  "total_amount": number,
  "repayment_amount": number,
  "cadence": "weekly" | "biweekly" | "monthly",
  "start_date": "ISO date string",
  "end_date": "ISO date string", 
  "next_due_date": "ISO date string",
  "total_payments": number,
  "payments_made": number
}';

-- Add constraint to ensure repayment_schedule is only set for loan pockets
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_schedule_only_for_loans CHECK (
    (kind = 'loan' AND repayment_schedule IS NOT NULL) OR 
    (kind != 'loan' AND repayment_schedule IS NULL)
  );

-- Add constraint to ensure due_day is only set for loan pockets
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_due_day_only_for_loans CHECK (
    (kind = 'loan' AND due_day IS NOT NULL) OR 
    (kind != 'loan' AND due_day IS NULL)
  );


-- ============================================================================
-- Migration: 023_fix_db_review_findings.sql
-- ============================================================================

-- ============================================================================
-- 023_fix_db_review_findings.sql â€” post-review DB fixes (D-03..D-08)
-- ============================================================================
-- This migration repairs DB objects that were already created by earlier
-- migrations on existing databases. For fresh DBs the canonical source files
-- (020,021,006, etc.) already contain the corrected definitions, so the
-- operations below are idempotent no-ops there â€” they only fix already-migrated
-- databases.
--
-- Fixes:
--  D-08 idempotency scope CHECK widening
--  D-03 invoice unique â†’ plain index
--  D-04 SKU lower(sku) uniqueness
--  D-05 FORCE RLS where missing
--  D-07 stock movements composite index
-- ============================================================================

-- D-08: widen idempotency_records.scope CHECK (allow segment-qualified values)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'idempotency_records_scope_check'
      AND conrelid = 'public.idempotency_records'::regclass
  ) THEN
    ALTER TABLE public.idempotency_records DROP CONSTRAINT idempotency_records_scope_check;
  END IF;
  -- pg_constraint name may be auto-generated; drop by definition if still tight
  -- Fallback: drop any scope check and recreate with widened rule
  BEGIN
    ALTER TABLE public.idempotency_records DROP CONSTRAINT IF EXISTS idempotency_records_scope_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Recreate widened check idempotently
  DO $inner$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.idempotency_records'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%scope~%'
    ) THEN
      ALTER TABLE public.idempotency_records
        ADD CONSTRAINT idempotency_records_scope_check CHECK (
          scope IN ('income', 'spend', 'loan_reminder')
          OR scope ~ '^(income|spend):(individual|msme)$'
          OR scope ~ '^invoice_pay:(individual|msme)$'
          OR scope ~ '^stock:(individual|msme)$'
        );
    END IF;
  END $inner$;
END $$;

-- D-03: invoice user_customer_due should NOT be UNIQUE
DROP INDEX IF EXISTS public.idx_msme_invoices_user_customer_due;
CREATE INDEX IF NOT EXISTS idx_msme_invoices_user_customer_due
  ON public.msme_invoices(user_id, customer_name, due_date, amount);
-- Prod: this is CONCURRENTLY in a real deploy; handled here inside tx for review.

-- D-04: SKU uniqueness must be case-insensitive (lower)
DROP INDEX IF EXISTS public.idx_msme_stock_items_user_sku;
CREATE UNIQUE INDEX IF NOT EXISTS idx_msme_stock_items_user_sku
  ON public.msme_stock_items(user_id, lower(sku)) WHERE sku IS NOT NULL;

-- D-07: composite index for movement history pagination
CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_item_created
  ON public.msme_stock_movements(item_id, created_at DESC);

-- D-05: FORCE RLS on all user-data tables so service_role cannot bypass.
-- Idempotent â€” if already forced, ALTER is no-op.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'public.users','public.plans','public.pockets','public.fixed_expenses',
    'public.income_events','public.transactions','public.reallocations',
    'public.merchant_classifications','public.behavior_events','public.discipline_scores',
    'public.notification_preferences','public.merchant_reports',
    'public.push_tokens','public.notification_deliveries','public.idempotency_records',
    'public.msme_projects','public.msme_project_tiers','public.msme_project_income_events',
    'public.msme_project_allocations','public.msme_project_spends','public.msme_project_excess_prompts',
    'public.msme_invoices','public.msme_stock_items','public.msme_stock_movements',
    'public.daily_allocations','public.planning_cycle_events','public.emergency_unlocks'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN undefined_table THEN
      -- Table not yet created on this DB (e.g. older branch) â€” skip.
      NULL;
    WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- D-06: index creation note â€” prod should recreate heavy indexes CONCURRENTLY.
-- No automated CONCURRENTLY here (requires outside tx); this comment is the fix.
COMMENT ON INDEX public.idx_msme_invoices_user_customer_due IS 'Prod: recreate CONCURRENTLY outside transaction if table is large';
COMMENT ON INDEX public.idx_msme_stock_items_user_sku IS 'Case-insensitive per-user SKU uniqueness via lower(sku)';


-- ============================================================================
-- Migration: 024_stock_atomic_helpers.sql
-- ============================================================================

-- ============================================================================
-- 024_stock_atomic_helpers.sql â€” atomic stock helpers (B-02)
-- ============================================================================
-- Helpers to make qty adjustments atomic and race-safe without requiring the
-- API to do read-modify-write in two round-trips. The service layer should
-- prefer these helpers; the CHECK (qty_on_hand >=0) remains as defense-in-depth.
-- ============================================================================

-- pgcrypto already enabled in 001 for gen_random_uuid; ensure present.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Atomic adjust: adds delta (positive or negative) to qty_on_hand, guards >=0.
-- Returns the updated row. Raises 23514 if would go negative.
CREATE OR REPLACE FUNCTION public.adjust_stock_qty(
  p_item_id UUID,
  p_delta NUMERIC
) RETURNS public.msme_stock_items AS $$
DECLARE
  v_row public.msme_stock_items;
BEGIN
  UPDATE public.msme_stock_items
     SET qty_on_hand = qty_on_hand + p_delta,
         updated_at = NOW()
   WHERE id = p_item_id
     AND qty_on_hand + p_delta >= 0
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    -- Distinguish not-found vs would-go-negative for better API error mapping.
    IF NOT EXISTS (SELECT 1 FROM public.msme_stock_items WHERE id = p_item_id) THEN
      RAISE EXCEPTION 'stock item % not found', p_item_id USING ERRCODE = 'P0002';
    ELSE
      RAISE EXCEPTION 'insufficient stock for item % delta %', p_item_id, p_delta USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.adjust_stock_qty(UUID, NUMERIC) IS 'Atomic stock qty adjust (B-02). Positive delta = in, negative = out. Guards qty_on_hand >=0 in one statement.';

-- Invoice pay helper is intentionally NOT added here â€” payInvoice is a multi-table
-- flow (invoice status + income_event + transactions) that is correctly handled
-- with compensation in the service layer (B-01) until a proper DB transaction
-- (supabase.rpc or PostgREST transaction) is introduced. Stock is the hot race.


-- ============================================================================
-- Migration: 025_atomic_parent_borrow.sql
-- ============================================================================

-- Serialize and validate a parent-reserve transfer in the database. This is
-- intentionally one function: application-process locks do not protect users
-- when requests land on separate API instances.
CREATE OR REPLACE FUNCTION public.atomic_parent_borrow(
  p_parent_pocket_id UUID,
  p_child_pocket_id UUID,
  p_amount NUMERIC,
  p_reason TEXT DEFAULT 'other'
) RETURNS public.reallocations AS $$
DECLARE
  v_parent_available NUMERIC;
  v_children_available NUMERIC;
  v_reallocation public.reallocations;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Borrow amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Row locks serialize every borrow from this family, including requests to
  -- different children. They are held until all ledger rows are committed.
  PERFORM 1
  FROM public.pockets
  WHERE id = p_parent_pocket_id OR parent_pocket_id = p_parent_pocket_id
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.pockets
    WHERE id = p_child_pocket_id AND parent_pocket_id = p_parent_pocket_id
  ) THEN
    RAISE EXCEPTION 'Child pocket does not belong to parent' USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_parent_available
  FROM public.transactions t WHERE t.pocket_id = p_parent_pocket_id;

  SELECT COALESCE(SUM(balance), 0) INTO v_children_available
  FROM (
    SELECT COALESCE(SUM(CASE
      WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
      WHEN t.type = 'spend' THEN -t.amount
      WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
      ELSE 0
    END), 0) AS balance
    FROM public.pockets c
    LEFT JOIN public.transactions t ON t.pocket_id = c.id
    WHERE c.parent_pocket_id = p_parent_pocket_id
    GROUP BY c.id
  ) children;

  IF v_parent_available - v_children_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient parent reserve' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reallocations (
    from_pocket_id, to_pocket_id, amount, reason, status, completed_at
  ) VALUES (
    p_parent_pocket_id, p_child_pocket_id, p_amount, p_reason, 'completed', NOW()
  ) RETURNING * INTO v_reallocation;

  INSERT INTO public.transactions (pocket_id, amount, type) VALUES
    (p_parent_pocket_id, -p_amount, 'reallocation_out'),
    (p_child_pocket_id, p_amount, 'reallocation_in');

  RETURN v_reallocation;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_parent_borrow(UUID, UUID, NUMERIC, TEXT) IS
  'Atomically checks a parent reserve and transfers funds to one direct child.';


-- ============================================================================
-- Migration: 026_atomic_complete_reallocation.sql
-- ============================================================================

-- Complete a requested reallocation exactly once. The status transition and
-- both ledger rows share one transaction, so neither retries nor failures can
-- leave a completed transfer without its money movement.
CREATE OR REPLACE FUNCTION public.atomic_complete_reallocation(
  p_reallocation_id UUID,
  p_discipline_cost NUMERIC DEFAULT 0
) RETURNS public.reallocations AS $$
DECLARE
  v_reallocation public.reallocations;
  v_available NUMERIC;
BEGIN
  SELECT * INTO v_reallocation
  FROM public.reallocations
  WHERE id = p_reallocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reallocation not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_reallocation.status NOT IN ('pending', 'cooling_off') THEN
    RAISE EXCEPTION 'Reallocation has already been resolved' USING ERRCODE = 'P0001';
  END IF;
  IF p_discipline_cost < 0 THEN
    RAISE EXCEPTION 'Discipline cost cannot be negative' USING ERRCODE = '22023';
  END IF;

  -- Lock both pockets in a stable order before checking the source ledger.
  PERFORM 1 FROM public.pockets
  WHERE id IN (v_reallocation.from_pocket_id, v_reallocation.to_pocket_id)
  ORDER BY id FOR UPDATE;

  SELECT COALESCE(SUM(CASE
    WHEN type IN ('allocation', 'reallocation_in') THEN amount
    WHEN type = 'spend' THEN -amount
    WHEN type IN ('reallocation_out', 'rollover') THEN amount
    ELSE 0
  END), 0) INTO v_available
  FROM public.transactions WHERE pocket_id = v_reallocation.from_pocket_id;

  IF v_available < v_reallocation.amount THEN
    RAISE EXCEPTION 'Insufficient balance in the source pocket' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.transactions (pocket_id, amount, type) VALUES
    (v_reallocation.from_pocket_id, -v_reallocation.amount, 'reallocation_out'),
    (v_reallocation.to_pocket_id, v_reallocation.amount, 'reallocation_in');

  UPDATE public.reallocations
  SET status = 'completed', completed_at = NOW(), discipline_cost = p_discipline_cost
  WHERE id = p_reallocation_id
  RETURNING * INTO v_reallocation;

  RETURN v_reallocation;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_complete_reallocation(UUID, NUMERIC) IS
  'Exactly-once, atomic requested-reallocation completion with a locked source-balance check.';


-- ============================================================================
-- Migration: 027_atomic_pay_msme_invoice.sql
-- ============================================================================

-- Pay an invoice exactly once. Invoice state, the income event, and every
-- allocation row commit together so retries cannot create duplicate income.
CREATE OR REPLACE FUNCTION public.atomic_pay_msme_invoice(
  p_invoice_id UUID,
  p_user_id UUID,
  p_source TEXT,
  p_label TEXT,
  p_date DATE,
  p_allocations JSONB DEFAULT '[]'::jsonb
) RETURNS public.msme_invoices AS $$
DECLARE
  v_invoice public.msme_invoices;
  v_allocation JSONB;
BEGIN
  SELECT * INTO v_invoice FROM public.msme_invoices
  WHERE id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002'; END IF;
  IF v_invoice.user_id <> p_user_id THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
  IF v_invoice.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Invoice already paid or cannot be paid' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.income_events (user_id, amount, source, label, date, run_allocation, segment)
  VALUES (p_user_id, v_invoice.amount, p_source, p_label, p_date, TRUE, 'msme');

  FOR v_allocation IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF (v_allocation->>'amount')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Allocation amount must be positive' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.transactions (pocket_id, amount, type)
    VALUES ((v_allocation->>'pocket_id')::UUID, (v_allocation->>'amount')::NUMERIC, 'allocation');
  END LOOP;

  UPDATE public.msme_invoices SET status = 'paid', paid_at = NOW()
  WHERE id = p_invoice_id RETURNING * INTO v_invoice;
  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_pay_msme_invoice(UUID, UUID, TEXT, TEXT, DATE, JSONB) IS
  'Atomically creates invoice income and allocations, then marks the invoice paid.';


-- ============================================================================
-- Migration: 028_atomic_allocate_surplus.sql
-- ============================================================================

-- C3: allocate an income surplus exactly once. All target-pocket creation,
-- ledger rows, and income-event state changes share one transaction.
CREATE OR REPLACE FUNCTION public.atomic_allocate_surplus(
  p_income_event_id UUID,
  p_user_id UUID,
  p_allocations JSONB,
  p_new_pocket JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_income public.income_events;
  v_new_pocket public.pockets;
  v_allocation JSONB;
  v_total NUMERIC := 0;
BEGIN
  SELECT * INTO v_income FROM public.income_events WHERE id = p_income_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Income event not found' USING ERRCODE = 'P0002'; END IF;
  IF v_income.user_id <> p_user_id THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
  IF v_income.surplus_allocation_status <> 'pending' OR v_income.unallocated_surplus IS NULL THEN
    RAISE EXCEPTION 'Income event has no pending surplus' USING ERRCODE = 'P0001';
  END IF;

  IF p_new_pocket IS NOT NULL THEN
    INSERT INTO public.pockets (plan_id, name, kind, category, is_time_locked, monthly_allocation)
    VALUES ((p_new_pocket->>'plan_id')::UUID, p_new_pocket->>'name', 'spendable', 'other', FALSE, 0)
    RETURNING * INTO v_new_pocket;
  END IF;

  FOR v_allocation IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF (v_allocation->>'amount')::NUMERIC <= 0 THEN RAISE EXCEPTION 'Allocation amount must be positive' USING ERRCODE = '22023'; END IF;
    v_total := v_total + (v_allocation->>'amount')::NUMERIC;
    INSERT INTO public.transactions (pocket_id, amount, type)
    VALUES (
      COALESCE((v_allocation->>'pocket_id')::UUID, v_new_pocket.id),
      (v_allocation->>'amount')::NUMERIC,
      'allocation'
    );
  END LOOP;

  IF v_total <> v_income.unallocated_surplus THEN
    RAISE EXCEPTION 'Allocation total must equal pending surplus' USING ERRCODE = '22023';
  END IF;

  UPDATE public.income_events SET surplus_allocation_status = 'allocated', unallocated_surplus = NULL
  WHERE id = p_income_event_id;
  RETURN jsonb_build_object('new_pocket', CASE WHEN v_new_pocket.id IS NULL THEN NULL ELSE to_jsonb(v_new_pocket) END);
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Migration: 029_atomic_fund_loan_repayment.sql
-- ============================================================================

-- C5: claim the next loan repayment slot exactly once. Locks the loan row,
-- validates the schedule, writes the repayment ledger credit, and advances
-- paymentsMade in one transaction so concurrent fundRepayment calls cannot
-- mint unbounded balance or completion points.
CREATE OR REPLACE FUNCTION public.atomic_fund_loan_repayment(
  p_loan_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_repayment_pocket_id UUID,
  p_next_due_date TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_loan public.pockets;
  v_schedule JSONB;
  v_payments_made INT;
  v_total_payments INT;
  v_repayment_amount NUMERIC;
  v_previous_next_due_date TEXT;
  v_completed BOOLEAN := FALSE;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Repayment amount must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_loan FROM public.pockets WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_loan.kind <> 'loan' THEN
    RAISE EXCEPTION 'Can only fund repayment for loan pockets' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.plans WHERE id = v_loan.plan_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  v_schedule := v_loan.repayment_schedule;
  IF v_schedule IS NULL THEN
    RAISE EXCEPTION 'Loan has no repayment schedule' USING ERRCODE = 'P0001';
  END IF;

  v_payments_made := COALESCE((v_schedule->>'paymentsMade')::INT, 0);
  v_total_payments := COALESCE((v_schedule->>'totalPayments')::INT, 0);
  v_repayment_amount := COALESCE((v_schedule->>'repaymentAmount')::NUMERIC, 0);
  v_previous_next_due_date := v_schedule->>'nextDueDate';

  IF v_payments_made >= v_total_payments OR COALESCE((v_schedule->>'fullyRepaid')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Loan already fully repaid' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <> v_repayment_amount THEN
    RAISE EXCEPTION 'Repayment amount mismatch' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pockets
    WHERE id = p_repayment_pocket_id
      AND parent_pocket_id = p_loan_id
      AND name = 'Repayment'
  ) THEN
    RAISE EXCEPTION 'Repayment sub-pocket not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.transactions (pocket_id, amount, type, merchant, category)
  VALUES (p_repayment_pocket_id, p_amount, 'allocation', 'Loan Repayment', 'other');

  v_payments_made := v_payments_made + 1;
  v_schedule := jsonb_set(v_schedule, '{paymentsMade}', to_jsonb(v_payments_made));

  IF v_payments_made >= v_total_payments THEN
    v_completed := TRUE;
    v_schedule := jsonb_set(v_schedule, '{fullyRepaid}', 'true'::jsonb);
  ELSIF p_next_due_date IS NOT NULL THEN
    v_schedule := jsonb_set(v_schedule, '{nextDueDate}', to_jsonb(p_next_due_date));
  END IF;

  UPDATE public.pockets
  SET repayment_schedule = v_schedule, updated_at = NOW()
  WHERE id = p_loan_id;

  RETURN jsonb_build_object(
    'payments_made', v_payments_made,
    'total_payments', v_total_payments,
    'completed', v_completed,
    'previous_next_due_date', v_previous_next_due_date,
    'schedule', v_schedule
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_fund_loan_repayment(UUID, UUID, NUMERIC, UUID, TEXT) IS
  'Atomically records one loan repayment credit and advances the schedule exactly once.';


-- ============================================================================
-- Migration: 030_atomic_rebalance_sub_pockets.sql
-- ============================================================================

-- H5: rebalance sub-pockets atomically. Two concurrent rebalances of the same
-- family previously both read the same parent available balance, then both
-- funded the same growing siblings from it â€” double-funding and a deeply
-- negative parent (returns empty siblings for a no-op, like the old code).
-- This function locks the whole family (parent + children), recomputes every
-- balance from the ledger inside the lock, does the decrease-then-fund math
-- the service used to do across unguarded reads, writes all ledger rows, and
-- persists the new percentages in one transaction.
CREATE OR REPLACE FUNCTION public.atomic_rebalance_sub_pockets(
  p_parent_pocket_id UUID,
  p_splits JSONB,
  p_confirm_partial BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_parent public.pockets;
  v_parent_available NUMERIC;
  v_total_needed NUMERIC := 0;
  v_funding_scale NUMERIC;
  v_partial BOOLEAN;
  v_plan_row RECORD;
BEGIN
  -- Defensive input guards (the service's zod schema already enforces these,
  -- but the RPC is the last line of defense against direct callers).
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_splits) item
    WHERE (item->>'split_percentage')::NUMERIC <= 0
       OR (item->>'split_percentage')::NUMERIC > 100
  ) THEN
    RAISE EXCEPTION 'Split percentage must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  -- Every split must reference a direct child before we touch money. (The
  -- service pre-validates this too, but a concurrent family change can slip
  -- past a stale pre-flight read â€” this is the check that always holds.)
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) item
    LEFT JOIN public.pockets c
      ON c.id = (item->>'pocket_id')::UUID
     AND c.parent_pocket_id = p_parent_pocket_id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Split references a pocket that is not a sub-pocket of this parent' USING ERRCODE = '23503';
  END IF;

  -- Row locks serialize every rebalance of this family, including concurrent
  -- parent-borrow flows (atomic_parent_borrow locks the same row set). Held
  -- until the whole transaction commits.
  PERFORM 1
  FROM public.pockets
  WHERE id = p_parent_pocket_id OR parent_pocket_id = p_parent_pocket_id
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_parent FROM public.pockets WHERE id = p_parent_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent pocket not found' USING ERRCODE = 'P0002';
  END IF;

  -- Per-sibling plan: current stored percentage, requested percentage (last
  -- split wins for a duplicated pocket, matching the old Map), and the
  -- ledger-derived available balance. The balance CASE mirrors
  -- supabase.repository getPocketSummary: allocation + reallocation_in land,
  -- spend debits, reallocation_out and rollover are signed amounts.
  CREATE TEMP TABLE tmp_rebalance_plan ON COMMIT DROP AS
  SELECT
    c.id AS pocket_id,
    COALESCE(c.split_percentage, 0) AS old_pct,
    COALESCE(
      (SELECT (item->>'split_percentage')::NUMERIC
       FROM jsonb_array_elements(p_splits) item
       WHERE (item->>'pocket_id')::UUID = c.id),
      COALESCE(c.split_percentage, 0)
    ) AS new_pct,
    COALESCE(SUM(CASE
      WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
      WHEN t.type = 'spend' THEN -t.amount
      WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
      ELSE 0
    END), 0) AS available,
    0::NUMERIC AS freed,
    0::NUMERIC AS needed
  FROM public.pockets c
  LEFT JOIN public.transactions t ON t.pocket_id = c.id
  WHERE c.parent_pocket_id = p_parent_pocket_id
  GROUP BY c.id;

  -- Total percentage ceiling â€” siblings NOT part of this request still count
  -- toward the 100% cap via old_pct. NULL (no rows) means no-op, allowed.
  IF (SELECT SUM(new_pct) FROM tmp_rebalance_plan) > 100.01 THEN
    RAISE EXCEPTION 'Sub-pockets would total more than 100 percent of the parent pocket' USING ERRCODE = '22023';
  END IF;

  -- Parent's own ledger available balance, read inside the family lock.
  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_parent_available
  FROM public.transactions t WHERE t.pocket_id = p_parent_pocket_id;

  -- Free up money from shrinking siblings first: target falls to
  -- (parent.monthly_allocation * newPct / 100), the excess above it flows
  -- back to the parent's balance.
  UPDATE tmp_rebalance_plan SET
    freed = GREATEST(0, ROUND(available - ROUND((v_parent.monthly_allocation * new_pct) / 100, 2), 2))
  WHERE new_pct < old_pct - 0.001;

  SELECT v_parent_available + COALESCE(SUM(freed), 0) INTO v_parent_available
  FROM tmp_rebalance_plan;

  -- Growth needs for increasing siblings, funded from the parent's fresh total.
  UPDATE tmp_rebalance_plan SET
    needed = GREATEST(0, ROUND(ROUND((v_parent.monthly_allocation * new_pct) / 100, 2) - available, 2))
  WHERE new_pct > old_pct + 0.001;

  SELECT COALESCE(SUM(needed), 0) INTO v_total_needed FROM tmp_rebalance_plan;

  -- Dry-run under-funding: nothing has been written yet, so report the
  -- shortfall and require the client to confirm a partial fill.
  IF v_total_needed > v_parent_available + 0.01 AND NOT p_confirm_partial THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'shortfall', ROUND(v_total_needed - v_parent_available, 2),
      'requires_confirmation', TRUE
    );
  END IF;

  v_funding_scale := CASE WHEN v_total_needed > 0 THEN LEAST(1, v_parent_available / v_total_needed) ELSE 1 END;
  v_partial := v_total_needed > v_parent_available + 0.01;

  -- Write every ledger row in one multi-row insert: freed amounts leave the
  -- sibling and land on the parent; funded amounts leave the parent and land
  -- on the growing siblings (proportional fill when partial).
  INSERT INTO public.transactions (pocket_id, amount, type)
  SELECT pocket_id, -freed, 'reallocation_out'::TEXT FROM tmp_rebalance_plan WHERE freed > 0
  UNION ALL
  SELECT p_parent_pocket_id, freed, 'reallocation_in'::TEXT FROM tmp_rebalance_plan WHERE freed > 0
  UNION ALL
  SELECT p_parent_pocket_id, -ROUND(needed * v_funding_scale, 2), 'reallocation_out'::TEXT FROM tmp_rebalance_plan WHERE needed > 0
  UNION ALL
  SELECT pocket_id, ROUND(needed * v_funding_scale, 2), 'reallocation_in'::TEXT FROM tmp_rebalance_plan WHERE needed > 0;

  -- Persist the requested percentages (and the derived monthly_allocation
  -- cache) even for partial fills â€” the remaining gap closes over later
  -- income events, which always split toward the stored percentage.
  UPDATE public.pockets c
  SET split_percentage = p.new_pct,
      monthly_allocation = ROUND((v_parent.monthly_allocation * p.new_pct) / 100, 2)
  FROM tmp_rebalance_plan p
  WHERE c.id = p.pocket_id
    AND ABS(p.new_pct - p.old_pct) > 0.001;

  RETURN jsonb_build_object(
    'applied', TRUE,
    'partial', v_partial,
    'funded_amount', ROUND(LEAST(v_total_needed, v_parent_available), 2),
    'shortfall', GREATEST(0, ROUND(v_total_needed - v_parent_available, 2))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_rebalance_sub_pockets(UUID, JSONB, BOOLEAN) IS
  'Atomically recomputes sub-pocket balances under a family lock and moves money for a rebalance exactly once.';

-- ============================================================================
-- Migration: 031_atomic_execute_emergency_unlock.sql
-- ============================================================================

-- H1: emergency unlock used to write three separate rows in three separate
-- requests:
--   1. INSERT emergency_unlocks (record the unlock event)
--   2. INSERT transactions   (the savings debit)
--   3. UPDATE plans          (reserve_balance shrink)
-- If any of steps 2/3 failed after step 1, the unlock record persisted with
-- no money actually moving â€” orphaned data and a silently-broken once-a-month
-- limit. This function does all of it in one transaction.
--
-- It also locks the owning plan row FOR UPDATE, so two concurrent unlocks of
-- the same plan serialize their reserve_balance writes, and the existing
-- `emergency_unlocks_one_per_month` unique index (010/011) rejects a same-
-- month duplicate inside the same transaction (rolling everything back).
CREATE OR REPLACE FUNCTION public.atomic_execute_emergency_unlock(
  p_id UUID,
  p_user_id UUID,
  p_plan_id UUID,
  p_amount NUMERIC,
  p_days_calculated INT,
  p_least_daily_spend NUMERIC,
  p_average_daily_spend NUMERIC,
  p_reserve_kept NUMERIC,
  p_runway_days_before NUMERIC,
  p_runway_days_after NUMERIC,
  p_runway_reduction_days NUMERIC,
  p_savings_pocket_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_unlock public.emergency_unlocks;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Emergency amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Serialize every unlock against this plan so the reserve_balance update
  -- below always applies to a fresh value (READ COMMITTED would otherwise
  -- let two concurrent unlocks both compute from the same pre-debit value).
  PERFORM 1 FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002';
  END IF;

  -- Step 1: the unlock event. The one-per-month unique index (011) rejects a
  -- same-month duplicate here, rolling back the entire function.
  INSERT INTO public.emergency_unlocks (
    id, user_id, plan_id, amount, days_calculated, least_daily_spend,
    average_daily_spend, reserve_kept,
    runway_days_before, runway_days_after, runway_reduction_days
  ) VALUES (
    p_id, p_user_id, p_plan_id, p_amount, p_days_calculated, p_least_daily_spend,
    p_average_daily_spend, p_reserve_kept,
    p_runway_days_before, p_runway_days_after, p_runway_reduction_days
  ) RETURNING * INTO v_unlock;

  -- Step 2: the savings debit (signed negative).
  INSERT INTO public.transactions (pocket_id, amount, type, emergency_unlock_id)
  VALUES (p_savings_pocket_id, -p_amount, 'reallocation_out', p_id);

  -- Step 3: shrink the plan reserve by the unlocked amount.
  UPDATE public.plans
  SET reserve_balance = GREATEST(0, reserve_balance - p_amount)
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'id', v_unlock.id,
    'created_at', v_unlock.created_at
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_execute_emergency_unlock IS
  'Atomically records an emergency unlock event, debits the savings pocket ledger, and shrinks the plan reserve in one transaction.';

-- ============================================================================
-- Migration: 032_atomic_create_manual_income.sql
-- ============================================================================

-- H1: manual income entry used to write three separate rows in three
-- separate requests:
--   1. INSERT income_events            (the income event)
--   2. UPDATE income_events            (surplus columns, when the amount
--                                       exceeds expected income)
--   3. INSERT transactions             (the per-pocket allocation credits)
-- A failure at 2 or 3 left an income event on the ledger with no allocation
-- rows ("Income saved but allocation ledger failed" â€” money silently stuck),
-- or surplus flags that never got written. This function does all of it in
-- one transaction.
--
-- The surplus UPDATE is wrapped in a sub-block that swallows
-- `undefined_column`: production databases that predate the surplus columns
-- (008) must still record the income event itself, matching the graceful
-- degradation the old split-request code had.
CREATE OR REPLACE FUNCTION public.atomic_create_manual_income(
  p_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_source TEXT,
  p_label TEXT,
  p_date DATE,
  p_run_allocation BOOLEAN,
  p_segment TEXT,
  p_unallocated_surplus NUMERIC DEFAULT NULL,
  p_surplus_allocation_status TEXT DEFAULT NULL,
  p_allocations JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_event public.income_events;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Income amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Step 1: the income event. '' is passed as NULL (older DBs still have
  -- label NOT NULL historically, so a real '' would violate it; matching the
  -- service which trims to '' but the ALTER made NULL the canonical empty).
  INSERT INTO public.income_events (
    id, user_id, amount, source, label, date, run_allocation, segment
  ) VALUES (
    p_id, p_user_id, p_amount, p_source, NULLIF(p_label, ''), p_date,
    p_run_allocation, p_segment
  ) RETURNING * INTO v_event;

  -- Step 2: surplus columns, best-effort against pre-008 databases.
  IF p_unallocated_surplus IS NOT NULL THEN
    BEGIN
      UPDATE public.income_events
      SET unallocated_surplus = p_unallocated_surplus,
          surplus_allocation_status = p_surplus_allocation_status
      WHERE id = p_id
      RETURNING * INTO v_event;
    EXCEPTION WHEN undefined_column THEN
      NULL; -- income still recorded; surplus tracking unavailable on this DB
    END;
  END IF;

  -- Step 3: allocation credits, only when run_allocation and there is
  -- something to write (matches the service's empty-array guard).
  IF p_run_allocation AND p_allocations IS NOT NULL
     AND jsonb_array_length(p_allocations) > 0 THEN
    INSERT INTO public.transactions (pocket_id, amount, type)
    SELECT
      (item->>'pocket_id')::UUID,
      ROUND((item->>'amount')::NUMERIC * 100) / 100,
      'allocation'
    FROM jsonb_array_elements(p_allocations) item;
  END IF;

  RETURN to_jsonb(v_event);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_create_manual_income IS
  'Atomically records an income event, applies surplus flags (when supported), and writes allocation credits in one transaction.';

-- ============================================================================
-- Migration: 033_rollover_locks.sql
-- ============================================================================

-- H2: duplicate rollover sweeps were previously prevented by an in-process
-- `Set<string>` (rollover.service.ts `activeUsers`). Under horizontal scaling
-- (Railway runs multiple API instances) the set only guarded one process, so
-- two instances could both pass the same-year "has ledger rows" idempotency
-- check and sweep the same date twice â€” double credits into Savings and a
-- corrupt daily-history.
--
-- This table is the cross-instance replacement: claiming a lock is a plain
-- `INSERT ... ON CONFLICT (user_id) DO NOTHING`, which the single PRIMARY
-- KEY makes atomic across every API instance. A stale claim (crashed sweep)
-- is reclaimed after ROLLOVER_LOCK_TTL by a DELETE that clears claims older
-- than the TTL before the INSERT, so a crashed worker does not permanently
-- wedge rollover for that user.
CREATE TABLE IF NOT EXISTS public.rollover_locks (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.rollover_locks IS
  'Cross-instance lock that prevents concurrent rollover sweeps for the same user (H2)';

ALTER TABLE public.rollover_locks ENABLE ROW LEVEL SECURITY;

-- Service role bypasses; these mirror the per-user RLS convention used by
-- every data table so a future user-scoped client cannot read/forge locks.
CREATE POLICY "Users can view own rollover lock" ON public.rollover_locks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own rollover lock" ON public.rollover_locks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own rollover lock" ON public.rollover_locks
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- Migration: 034_atomic_commit_spend.sql
-- ============================================================================

-- H2: the plain (non-borrow) spend path used to be guarded only by an
-- in-process `Set<string>` (spend.service.ts `activeSpends`). Under horizontal
-- scaling two API instances could both pass checkSpend with the same
-- available balance and both insert a `spend` ledger row â€” double debiting the
-- pocket. The borrow path had the same gap at the ledger level until
-- atomic_parent_borrow (025) serialized it; this function closes the race for
-- every spend path.
--
-- Behavior contract (mirrors commitSpend's decision logic, but re-verified
-- under row locks so a stale pre-flight read cannot commit a double debit):
--   * Locks the target pocket row; when the pocket belongs to a sub-pocket
--     family it also locks the whole family (same set atomic_parent_borrow /
--     atomic_rebalance_sub_pockets lock), serializing spends against sibling
--     borrows and rebalances.
--   * Recomputes the pocket's ledger-derived available balance under the lock.
--   * If the spend exceeds the balance and p_borrow_from_parent is set, it
--     borrows the true gap from the parent in the same transaction (delegating
--     to atomic_parent_borrow, which re-raises the reserve check and family
--     lock). Only the real gap is borrowed â€” never the stale shortfall figure
--     computed outside the lock.
--   * If p_override is set, the spend is allowed through even when the balance
--     is short (an emergency overspend can legitimately push a pocket
--     negative, see getPocketSummary's no-clamp note).
--   * Otherwise the function raises, rolling back nothing (nothing written).
CREATE OR REPLACE FUNCTION public.atomic_commit_spend(
  p_pocket_id UUID,
  p_amount NUMERIC,
  p_merchant TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_borrow_from_parent BOOLEAN DEFAULT FALSE,
  p_override BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_pocket public.pockets;
  v_available NUMERIC;
  v_needed NUMERIC;
  v_borrowed NUMERIC := 0;
  v_tx_id UUID;
  v_available_after NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Spend amount must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pocket FROM public.pockets WHERE id = p_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pocket not found' USING ERRCODE = 'P0002';
  END IF;

  -- Belongs to a sub-pocket family? Lock the whole family (ordering by id,
  -- the same order atomic_parent_borrow uses, to keep lock acquisition
  -- cycle-free). This also covers serializing the parent rows that a borrow
  -- below will touch.
  IF v_pocket.parent_pocket_id IS NOT NULL THEN
    PERFORM 1
    FROM public.pockets
    WHERE id = v_pocket.parent_pocket_id OR parent_pocket_id = v_pocket.parent_pocket_id
    ORDER BY id
    FOR UPDATE;
  END IF;

  -- Ledger-derived balance, identical formula to
  -- SupabaseRepository.getPocketSummary and atomic_parent_borrow:
  -- allocation / reallocation_in credit; spend debits; reallocation_out and
  -- rollover amounts are stored signed in the ledger so summing them already
  -- reduces the balance (migration 001 note, getPocketSummary comment).
  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_available
  FROM public.transactions t
  WHERE t.pocket_id = p_pocket_id;

  v_needed := ROUND(p_amount::numeric * 100) / 100 - v_available;

  IF v_needed > 0 THEN
    IF p_borrow_from_parent AND v_pocket.parent_pocket_id IS NOT NULL THEN
      -- Borrow exactly the true gap under the family lock. atomic_parent_borrow
      -- re-locks the family (same lock we already hold â€” same transaction, so
      -- re-entrant), enforces the parent-reserve rule, and writes the parent
      -- reallocation_out + child reallocation_in ledger pair.
      v_borrowed := v_needed;
      PERFORM public.atomic_parent_borrow(v_pocket.parent_pocket_id, v_pocket.id, v_borrowed, 'other');
    ELSIF NOT p_override THEN
      RAISE EXCEPTION 'Insufficient funds' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.transactions (pocket_id, amount, type, merchant, category)
  VALUES (p_pocket_id, ROUND(p_amount::numeric * 100) / 100, 'spend', p_merchant, p_category)
  RETURNING id INTO v_tx_id;

  -- Post-commit balance, recomputed under the same transaction so the caller
  -- returns the true figure (the service re-reads getPocketSummary today and
  -- this stays in agreement with it).
  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_available_after
  FROM public.transactions t
  WHERE t.pocket_id = p_pocket_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'borrowed_amount', v_borrowed,
    'available_after', v_available_after
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_commit_spend IS
  'Atomically checks a pocket balance under row locks, optionally borrows the parent reserve, and writes the spend ledger row (H2).';

-- ============================================================================
-- Migration: 035_atomic_complete_reallocation_side_effects.sql
-- ============================================================================

-- H1: extend atomic_complete_reallocation so the behavior event and the
-- SKIP_COOLING_OFF_COST discipline delta commit with the ledger + status
-- flip. A concurrent loser still cannot double-move money, and now also
-- cannot double-apply the cooling-off skip cost or insert a second
-- reallocation_completed event.
--
-- Adding parameters creates a new PostgreSQL signature, so drop the C1
-- two-argument form first. Named-arg callers that only pass
-- p_reallocation_id / p_discipline_cost keep working via DEFAULTs.

DROP FUNCTION IF EXISTS public.atomic_complete_reallocation(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.atomic_complete_reallocation(
  p_reallocation_id UUID,
  p_discipline_cost NUMERIC DEFAULT 0,
  p_user_id UUID DEFAULT NULL,
  p_from_pocket_name TEXT DEFAULT NULL,
  p_to_pocket_name TEXT DEFAULT NULL
) RETURNS public.reallocations AS $$
DECLARE
  v_reallocation public.reallocations;
  v_available NUMERIC;
  v_prev NUMERIC;
  v_new NUMERIC;
BEGIN
  SELECT * INTO v_reallocation
  FROM public.reallocations
  WHERE id = p_reallocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reallocation not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_reallocation.status NOT IN ('pending', 'cooling_off') THEN
    RAISE EXCEPTION 'Reallocation has already been resolved' USING ERRCODE = 'P0001';
  END IF;
  IF p_discipline_cost < 0 THEN
    RAISE EXCEPTION 'Discipline cost cannot be negative' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.pockets
  WHERE id IN (v_reallocation.from_pocket_id, v_reallocation.to_pocket_id)
  ORDER BY id FOR UPDATE;

  SELECT COALESCE(SUM(CASE
    WHEN type IN ('allocation', 'reallocation_in') THEN amount
    WHEN type = 'spend' THEN -amount
    WHEN type IN ('reallocation_out', 'rollover') THEN amount
    ELSE 0
  END), 0) INTO v_available
  FROM public.transactions WHERE pocket_id = v_reallocation.from_pocket_id;

  IF v_available < v_reallocation.amount THEN
    RAISE EXCEPTION 'Insufficient balance in the source pocket' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.transactions (pocket_id, amount, type) VALUES
    (v_reallocation.from_pocket_id, -v_reallocation.amount, 'reallocation_out'),
    (v_reallocation.to_pocket_id, v_reallocation.amount, 'reallocation_in');

  UPDATE public.reallocations
  SET status = 'completed', completed_at = NOW(), discipline_cost = p_discipline_cost
  WHERE id = p_reallocation_id
  RETURNING * INTO v_reallocation;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.behavior_events (user_id, type, payload)
    VALUES (
      p_user_id,
      'reallocation_completed',
      jsonb_build_object(
        'reallocationId', v_reallocation.id,
        'fromPocket', COALESCE(p_from_pocket_name, ''),
        'toPocket', COALESCE(p_to_pocket_name, ''),
        'amount', v_reallocation.amount,
        'disciplineCost', p_discipline_cost
      )
    );
  END IF;

  -- Match DisciplineScoreService.applyDelta: start from the latest score
  -- (any period), default 0 when none exists, clamp to [0, 100], persist
  -- against the current UTC month period with a negative delta.
  IF p_discipline_cost > 0 AND p_user_id IS NOT NULL THEN
    PERFORM 1 FROM public.discipline_scores
    WHERE user_id = p_user_id
    FOR UPDATE;

    SELECT score INTO v_prev
    FROM public.discipline_scores
    WHERE user_id = p_user_id
    ORDER BY calculated_at DESC
    LIMIT 1;

    v_new := GREATEST(0, LEAST(100, COALESCE(v_prev, 0) - p_discipline_cost));

    INSERT INTO public.discipline_scores (user_id, score, delta, period, calculated_at)
    VALUES (
      p_user_id,
      v_new,
      -p_discipline_cost,
      to_char((timezone('utc', now())), 'YYYY-MM'),
      NOW()
    )
    ON CONFLICT (user_id, period)
    DO UPDATE SET
      score = EXCLUDED.score,
      delta = EXCLUDED.delta,
      calculated_at = EXCLUDED.calculated_at;
  END IF;

  RETURN v_reallocation;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_complete_reallocation(UUID, NUMERIC, UUID, TEXT, TEXT) IS
  'Exactly-once reallocation completion: ledger, status, behavior event, and skip-cooling-off discipline delta in one transaction.';


-- ============================================================================
-- Migration: 036_atomic_commit_onboarding.sql
-- ============================================================================

-- H1: onboarding commit used to deactivate the prior plan, insert the new
-- plan, insert pockets, optionally replace fixed expenses, and write the
-- plan_created behavior event as separate requests. A failure mid-way left
-- an inactive prior plan with no active replacement, or a plan with no
-- pockets. This function does the whole persist in one transaction.
--
-- Concurrent commits for the same user+segment serialize on the users row.
-- A unique-violation on one_active_plan_per_segment_per_user (the race
-- loser) raises a clean business error so the API can return 409 without
-- leaving a partial plan.

CREATE OR REPLACE FUNCTION public.atomic_commit_onboarding(
  p_user_id UUID,
  p_segment TEXT,
  p_plan JSONB,
  p_pockets JSONB,
  p_replace_fixed_expenses BOOLEAN,
  p_fixed_expenses JSONB,
  p_behavior_type TEXT,
  p_behavior_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID;
  p_item JSONB;
  v_pockets JSONB;
BEGIN
  IF p_segment NOT IN ('individual', 'msme') THEN
    RAISE EXCEPTION 'Invalid segment' USING ERRCODE = '22023';
  END IF;
  IF p_plan IS NULL OR p_pockets IS NULL THEN
    RAISE EXCEPTION 'Plan and pockets are required' USING ERRCODE = '22023';
  END IF;

  -- Serialize every onboarding persist for this user so deactivate+insert
  -- cannot interleave with a sibling commit of the same segment.
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.plans
  WHERE user_id = p_user_id AND segment = p_segment
  FOR UPDATE;

  UPDATE public.plans
  SET status = 'inactive'
  WHERE user_id = p_user_id
    AND segment = p_segment
    AND status = 'active';

  v_plan_id := COALESCE((p_plan->>'id')::UUID, gen_random_uuid());

  BEGIN
    INSERT INTO public.plans (
      id, user_id, segment, type, income_pattern, income_interval_days,
      expected_income_amount, status, money_personality
    ) VALUES (
      v_plan_id,
      p_user_id,
      p_segment,
      p_plan->>'type',
      p_plan->>'income_pattern',
      NULLIF(p_plan->>'income_interval_days', '')::INTEGER,
      NULLIF(p_plan->>'expected_income_amount', '')::NUMERIC,
      COALESCE(NULLIF(p_plan->>'status', ''), 'active'),
      COALESCE(NULLIF(p_plan->>'money_personality', ''), 'saver')
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Onboarding commit conflict' USING ERRCODE = 'P0001';
  END;

  FOR p_item IN SELECT value FROM jsonb_array_elements(p_pockets)
  LOOP
    INSERT INTO public.pockets (
      id, plan_id, name, kind, category, is_time_locked, lock_until,
      monthly_allocation, daily_cap
    ) VALUES (
      COALESCE(NULLIF(p_item->>'id', '')::UUID, gen_random_uuid()),
      v_plan_id,
      p_item->>'name',
      p_item->>'kind',
      NULLIF(p_item->>'category', ''),
      COALESCE((p_item->>'is_time_locked')::BOOLEAN, FALSE),
      NULLIF(p_item->>'lock_until', '')::TIMESTAMPTZ,
      COALESCE((p_item->>'monthly_allocation')::NUMERIC, 0),
      CASE
        WHEN p_item->>'daily_cap' IS NULL OR p_item->>'daily_cap' = '' THEN NULL
        ELSE (p_item->>'daily_cap')::NUMERIC
      END
    );
  END LOOP;

  IF p_replace_fixed_expenses THEN
    DELETE FROM public.fixed_expenses
    WHERE user_id = p_user_id AND segment = p_segment;

    IF p_fixed_expenses IS NOT NULL AND jsonb_array_length(p_fixed_expenses) > 0 THEN
      INSERT INTO public.fixed_expenses (
        user_id, name, amount, due_day, category, segment
      )
      SELECT
        p_user_id,
        item->>'name',
        (item->>'amount')::NUMERIC,
        (item->>'due_day')::INTEGER,
        NULLIF(item->>'category', ''),
        p_segment
      FROM jsonb_array_elements(p_fixed_expenses) item;
    END IF;
  END IF;

  INSERT INTO public.behavior_events (user_id, type, payload)
  VALUES (
    p_user_id,
    COALESCE(NULLIF(p_behavior_type, ''), 'plan_created'),
    COALESCE(p_behavior_payload, '{}'::jsonb)
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at), '[]'::jsonb)
  INTO v_pockets
  FROM public.pockets p
  WHERE p.plan_id = v_plan_id;

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'pockets', v_pockets
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_commit_onboarding IS
  'Atomically deactivates the prior same-segment plan, inserts the new plan + pockets + optional fixed-expense replace, and records plan_created.';


-- ============================================================================
-- Migration: 037_atomic_daily_allocation.sql
-- ============================================================================

-- H1: daily allocation create/close used to write the daily_allocations row
-- and then (in a second request, or in parallel) insert reserve ledger rows
-- against a sentinel pocket id `_reserve_pool`. That sentinel is not a UUID
-- and cannot satisfy transactions.pocket_id -> pockets(id), so those ledger
-- inserts cannot commit. The durable state that *can* land is the
-- daily_allocations row itself (unique on plan_id + allocation_date).
--
-- These RPCs lock the plan / allocation row, insert or close that row in
-- one transaction, and return the existing row on a same-day retry so the
-- midnight cron cannot open or close the same day twice.

CREATE OR REPLACE FUNCTION public.atomic_create_daily_allocation(
  p_plan_id UUID,
  p_user_id UUID,
  p_allocation_date DATE,
  p_planned_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_existing public.daily_allocations;
  v_plan public.plans;
  v_runway NUMERIC;
  v_created public.daily_allocations;
BEGIN
  IF p_planned_amount < 0 THEN
    RAISE EXCEPTION 'Planned amount cannot be negative' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_plan.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.daily_allocations
  WHERE plan_id = p_plan_id AND allocation_date = p_allocation_date
  FOR UPDATE;

  IF FOUND THEN
    RETURN to_jsonb(v_existing);
  END IF;

  IF COALESCE(v_plan.reserve_balance, 0) > 0 AND p_planned_amount > 0 THEN
    v_runway := GREATEST(1, FLOOR(v_plan.reserve_balance / p_planned_amount));
  ELSE
    v_runway := 1;
  END IF;

  BEGIN
    INSERT INTO public.daily_allocations (
      plan_id, user_id, allocation_date, planned_amount, actual_spend,
      returned_amount, overspend_amount, runway_days_at_open,
      runway_days_at_close, status, created_at, closed_at
    ) VALUES (
      p_plan_id, p_user_id, p_allocation_date, p_planned_amount, 0,
      0, 0, v_runway,
      NULL, 'open', NOW(), NULL
    )
    RETURNING * INTO v_created;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_created
    FROM public.daily_allocations
    WHERE plan_id = p_plan_id AND allocation_date = p_allocation_date;
    RETURN to_jsonb(v_created);
  END;

  RETURN to_jsonb(v_created);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.atomic_close_daily_allocation(
  p_allocation_id UUID,
  p_actual_spend NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_alloc public.daily_allocations;
  v_unused NUMERIC;
  v_overspend NUMERIC;
  v_returned NUMERIC := 0;
  v_overspend_amount NUMERIC := 0;
  v_runway_close NUMERIC;
BEGIN
  IF p_actual_spend < 0 THEN
    RAISE EXCEPTION 'Actual spend cannot be negative' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_alloc
  FROM public.daily_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily allocation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_alloc.status = 'closed' THEN
    RETURN to_jsonb(v_alloc);
  END IF;

  v_unused := v_alloc.planned_amount - p_actual_spend;
  v_overspend := p_actual_spend - v_alloc.planned_amount;

  IF v_unused > 0 THEN
    v_returned := v_unused;
  END IF;
  IF v_overspend > 0 THEN
    v_overspend_amount := v_overspend;
  END IF;

  IF v_unused > 0 AND v_alloc.runway_days_at_open IS NOT NULL THEN
    v_runway_close := v_alloc.runway_days_at_open;
  ELSIF v_overspend > 0 AND v_alloc.runway_days_at_open IS NOT NULL THEN
    v_runway_close := GREATEST(1, v_alloc.runway_days_at_open - 1);
  ELSE
    v_runway_close := NULL;
  END IF;

  UPDATE public.daily_allocations
  SET actual_spend = p_actual_spend,
      returned_amount = v_returned,
      overspend_amount = v_overspend_amount,
      status = 'closed',
      closed_at = NOW(),
      runway_days_at_close = v_runway_close
  WHERE id = p_allocation_id
    AND status = 'open'
  RETURNING * INTO v_alloc;

  IF NOT FOUND THEN
    SELECT * INTO v_alloc FROM public.daily_allocations WHERE id = p_allocation_id;
  END IF;

  RETURN to_jsonb(v_alloc);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_create_daily_allocation IS
  'Creates today''s daily allocation exactly once under a plan row lock. Same-day retries return the existing row.';
COMMENT ON FUNCTION public.atomic_close_daily_allocation IS
  'Closes a daily allocation exactly once under a row lock. Already-closed rows are returned unchanged.';


-- ============================================================================
-- Migration: 038_biometric_enabled.sql
-- ============================================================================

-- ============================================================================
-- H13: users.biometric_enabled was typed in database.types.ts but never
-- migrated. The mobile app keys biometric locking off device-local storage
-- (storageAdapter 'biometricEnabled' â€” see mobile/src/services/auth.ts), so
-- this column is currently write-once/unused by the API, but the DB must match
-- the typed contract. boolean + default false exactly as typed.
-- (Numbered 038 because 035 was already consumed by
--  atomic_complete_reallocation_side_effects.sql.)
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- Migration: 039_savings_goal.sql
-- ============================================================================

-- ============================================================================
-- 039_savings_goal.sql â€” real savings-goal field (M7)
--
-- The mobile savings UI used to fabricate its goal as
-- `monthly_allocation * 12` (see goal-set.tsx / detail.tsx before this
-- change): an arbitrary multiple of the funding rate, not a target the user
-- ever set. That made `goal_reached` â€” which waives the early-unlock
-- discipline cost â€” reachable via a fake target.
--
-- NOTE on numbering: the audit asked for `036_savings_goal.sql`, but 036
-- was already taken (036_atomic_commit_onboarding.sql), so this lands as
-- the next free number, 039.
--
-- This migration adds the stored goal. There is deliberately NO backfill
-- from monthly_allocation * 12: backfilling would re-persist the exact
-- fabrication the audit flagged, and every backfilled row would then pass
-- the server-side goal check below. Pockets start with no goal (the client
-- shows its existing "Set a savings target" empty state); the user sets a
-- real one through the goal-set modal, which now writes these columns
-- instead of editing monthly_allocation.
-- ============================================================================

ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS savings_target_amount NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS savings_target_date DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pockets_savings_target_amount_check'
      AND conrelid = 'public.pockets'::regclass
  ) THEN
    ALTER TABLE public.pockets
      ADD CONSTRAINT pockets_savings_target_amount_check
      CHECK (
        savings_target_amount IS NULL
        OR (
          savings_target_amount > 0
          AND savings_target_amount <= 100000000
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.pockets.savings_target_amount IS
  'User-set savings goal for this pocket (KSh). Null = no goal set. The early-unlock goal_reached waiver (pockets.service unlockPocket) only applies when this is set AND the ledger balance covers it â€” never against a derived monthly_allocation multiple.';
COMMENT ON COLUMN public.pockets.savings_target_date IS
  'Optional target date for the savings goal. Display-only; no server logic keys off it.';

-- ============================================================================
-- Carry the goal through onboarding commit
-- ============================================================================
-- atomic_commit_onboarding (036) inserts pockets with an explicit column
-- list, so without this the savings_target_* built by pocket-provisioning
-- (from the onboarding savingsGoal the user actually stated) would be
-- silently dropped on every commit. This replaces the function in place â€”
-- same signature and semantics as 036, plus the two goal columns. If 036 is
-- ever changed, mirror the change here (or supersede this copy).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atomic_commit_onboarding(
  p_user_id UUID,
  p_segment TEXT,
  p_plan JSONB,
  p_pockets JSONB,
  p_replace_fixed_expenses BOOLEAN,
  p_fixed_expenses JSONB,
  p_behavior_type TEXT,
  p_behavior_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID;
  p_item JSONB;
  v_pockets JSONB;
BEGIN
  IF p_segment NOT IN ('individual', 'msme') THEN
    RAISE EXCEPTION 'Invalid segment' USING ERRCODE = '22023';
  END IF;
  IF p_plan IS NULL OR p_pockets IS NULL THEN
    RAISE EXCEPTION 'Plan and pockets are required' USING ERRCODE = '22023';
  END IF;

  -- Serialize every onboarding persist for this user so deactivate+insert
  -- cannot interleave with a sibling commit of the same segment.
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.plans
  WHERE user_id = p_user_id AND segment = p_segment
  FOR UPDATE;

  UPDATE public.plans
  SET status = 'inactive'
  WHERE user_id = p_user_id
    AND segment = p_segment
    AND status = 'active';

  v_plan_id := COALESCE((p_plan->>'id')::UUID, gen_random_uuid());

  BEGIN
    INSERT INTO public.plans (
      id, user_id, segment, type, income_pattern, income_interval_days,
      expected_income_amount, status, money_personality
    ) VALUES (
      v_plan_id,
      p_user_id,
      p_segment,
      p_plan->>'type',
      p_plan->>'income_pattern',
      NULLIF(p_plan->>'income_interval_days', '')::INTEGER,
      NULLIF(p_plan->>'expected_income_amount', '')::NUMERIC,
      COALESCE(NULLIF(p_plan->>'status', ''), 'active'),
      COALESCE(NULLIF(p_plan->>'money_personality', ''), 'saver')
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Onboarding commit conflict' USING ERRCODE = 'P0001';
  END;

  FOR p_item IN SELECT value FROM jsonb_array_elements(p_pockets)
  LOOP
    INSERT INTO public.pockets (
      id, plan_id, name, kind, category, is_time_locked, lock_until,
      monthly_allocation, daily_cap,
      savings_target_amount, savings_target_date
    ) VALUES (
      COALESCE(NULLIF(p_item->>'id', '')::UUID, gen_random_uuid()),
      v_plan_id,
      p_item->>'name',
      p_item->>'kind',
      NULLIF(p_item->>'category', ''),
      COALESCE((p_item->>'is_time_locked')::BOOLEAN, FALSE),
      NULLIF(p_item->>'lock_until', '')::TIMESTAMPTZ,
      COALESCE((p_item->>'monthly_allocation')::NUMERIC, 0),
      CASE
        WHEN p_item->>'daily_cap' IS NULL OR p_item->>'daily_cap' = '' THEN NULL
        ELSE (p_item->>'daily_cap')::NUMERIC
      END,
      CASE
        WHEN p_item->>'savings_target_amount' IS NULL OR p_item->>'savings_target_amount' = '' THEN NULL
        ELSE (p_item->>'savings_target_amount')::NUMERIC
      END,
      CASE
        WHEN p_item->>'savings_target_date' IS NULL OR p_item->>'savings_target_date' = '' THEN NULL
        ELSE (p_item->>'savings_target_date')::DATE
      END
    );
  END LOOP;

  IF p_replace_fixed_expenses THEN
    DELETE FROM public.fixed_expenses
    WHERE user_id = p_user_id AND segment = p_segment;

    IF p_fixed_expenses IS NOT NULL AND jsonb_array_length(p_fixed_expenses) > 0 THEN
      INSERT INTO public.fixed_expenses (
        user_id, name, amount, due_day, category, segment
      )
      SELECT
        p_user_id,
        item->>'name',
        (item->>'amount')::NUMERIC,
        (item->>'due_day')::INTEGER,
        NULLIF(item->>'category', ''),
        p_segment
      FROM jsonb_array_elements(p_fixed_expenses) item;
    END IF;
  END IF;

  INSERT INTO public.behavior_events (user_id, type, payload)
  VALUES (
    p_user_id,
    COALESCE(NULLIF(p_behavior_type, ''), 'plan_created'),
    COALESCE(p_behavior_payload, '{}'::jsonb)
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at), '[]'::jsonb)
  INTO v_pockets
  FROM public.pockets p
  WHERE p.plan_id = v_plan_id;

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'pockets', v_pockets
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_commit_onboarding IS
  'Atomically deactivates the prior same-segment plan, inserts the new plan + pockets + optional fixed-expense replace, and records plan_created. 039 extension: persists pockets.savings_target_amount/savings_target_date (M7).';


-- ============================================================================
-- Migration: 040_transaction_type_check_widening.sql
-- ============================================================================

-- ============================================================================
-- 040_transaction_type_check_widening.sql â€” M10
--
-- The transactions ledger's `type` column was created in 001 with an inline
-- CHECK limited to the original 5 values:
--   ('allocation', 'spend', 'reallocation_in', 'reallocation_out', 'rollover')
--
-- Migration 013 later added 5 more values â€” but via `ALTER TYPE
-- public.transaction_type ADD VALUE` (the Postgres ENUM of the same name)
-- and never widened this TEXT CHECK constraint. The result is drift:
-- database.types.ts and @financial-hub/shared's TransactionTypeSchema list
-- all 10 values, and the services write them (daily allocations, planning
-- cycle, reserve sweeps), yet any INSERT with one of the 5 newer values
-- would be rejected by this CHECK on a database where the constraint is
-- still the narrow 001 version.
--
-- This migration explicitly widens the CHECK (001 is never edited after the
-- fact â€” new migrations only). Constraint name: Postgres auto-names inline
-- column CHECKs `<table>_<column>_check`, i.e. transactions_type_check.
--
-- No backfill is required: rows that violate the CURRENT (narrow) constraint
-- cannot exist, and the widening only PERMITS the newer values â€” it removes
-- nothing. After this runs, the CHECK matches database.types.ts exactly.
-- ============================================================================

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'allocation',
    'spend',
    'reallocation_in',
    'reallocation_out',
    'rollover',
    'reserve_release',
    'reserve_return',
    'daily_overspend_debit',
    'fixed_expense_earmark',
    'fixed_expense_carry_forward'
  ));

COMMENT ON CONSTRAINT transactions_type_check ON public.transactions IS
  'Ledger entry types. Widened from the original 5 (001) to all 10 values (040) to match database.types.ts / TransactionTypeSchema â€” 013 added the newer values to the transaction_type ENUM but never widened this TEXT CHECK.';


-- ============================================================================
-- Migration: 041_user_id_fks_public_users.sql
-- ============================================================================

-- ============================================================================
-- 041_user_id_fks_public_users.sql â€” M12
--
-- FK inconsistency: tables created in 011 and later pointed their user_id
-- FKs at auth.users(id), while every other table in the schema (001, 005,
-- 006, 017, 033...) references public.users(id) â€” the app-level profile row
-- that the on_auth_user_created trigger creates on every signup.
--
-- This migration switches the post-011 tables' user_id FKs to
-- public.users(id) to match the rest of the schema. The
-- on_auth_user_created trigger keeps working unchanged: it inserts into
-- public.users BEFORE anything else can reference the user, so every auth
-- user still gets a profile row and every FK below still resolves.
--
-- Tables switched (all created 011+ with user_id REFERENCES auth.users):
--   emergency_unlocks        (011)
--   daily_allocations        (013)
--   planning_cycle_events    (013)
--   msme_invoices            (020)
--   msme_stock_items         (021)
--   msme_stock_movements     (021)
--
-- Constraint names: Postgres auto-names inline column FKs
-- `<table>_<column>_fkey`. ON DELETE CASCADE is preserved from the old
-- constraints. RLS policies key off auth.uid() and are unaffected.
--
-- No orphan risk either way: deleting an auth.users row cascades to both
-- public.users and these tables under either FK target, so no rows can
-- exist without an owner. The guarded cleanup below is defensive only â€”
-- a NOT VALID-free ADD CONSTRAINT would otherwise fail on a hypothetical
-- legacy database with orphaned rows.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  -- Defensive: remove (impossible-in-practice) orphaned rows so the
  -- validated FK re-add below can never fail. No-op on any healthy DB.
  FOREACH t IN ARRAY ARRAY[
    'emergency_unlocks',
    'daily_allocations',
    'planning_cycle_events',
    'msme_invoices',
    'msme_stock_items',
    'msme_stock_movements'
  ] LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE user_id NOT IN (SELECT id FROM public.users)',
      t
    );
  END LOOP;
END
$$;

ALTER TABLE public.emergency_unlocks
  DROP CONSTRAINT IF EXISTS emergency_unlocks_user_id_fkey;
ALTER TABLE public.emergency_unlocks
  ADD CONSTRAINT emergency_unlocks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.daily_allocations
  DROP CONSTRAINT IF EXISTS daily_allocations_user_id_fkey;
ALTER TABLE public.daily_allocations
  ADD CONSTRAINT daily_allocations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.planning_cycle_events
  DROP CONSTRAINT IF EXISTS planning_cycle_events_user_id_fkey;
ALTER TABLE public.planning_cycle_events
  ADD CONSTRAINT planning_cycle_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.msme_invoices
  DROP CONSTRAINT IF EXISTS msme_invoices_user_id_fkey;
ALTER TABLE public.msme_invoices
  ADD CONSTRAINT msme_invoices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.msme_stock_items
  DROP CONSTRAINT IF EXISTS msme_stock_items_user_id_fkey;
ALTER TABLE public.msme_stock_items
  ADD CONSTRAINT msme_stock_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.msme_stock_movements
  DROP CONSTRAINT IF EXISTS msme_stock_movements_user_id_fkey;
ALTER TABLE public.msme_stock_movements
  ADD CONSTRAINT msme_stock_movements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


-- ============================================================================
-- Migration: 042_emergency_unlock_savings_balance_guard.sql
-- ============================================================================

-- Review (Phase 7): migration 031 locked the plan and wrote the savings debit
-- without rechecking ledger availability under a pocket lock. A concurrent
-- atomic_commit_spend on the same savings pocket could pass its own balance
-- check and still lose to an unlock that used a stale pre-flight read â€”
-- driving savings negative. Replace the function so it:
--   1. locks plan + savings pocket FOR UPDATE
--   2. recomputes available with the same CASE as getPocketSummary / 034
--   3. raises if available < amount (clean rollback; no unlock row)
--   4. stores reserve_kept from the locked balance, not the client figure
CREATE OR REPLACE FUNCTION public.atomic_execute_emergency_unlock(
  p_id UUID,
  p_user_id UUID,
  p_plan_id UUID,
  p_amount NUMERIC,
  p_days_calculated INT,
  p_least_daily_spend NUMERIC,
  p_average_daily_spend NUMERIC,
  p_reserve_kept NUMERIC,
  p_runway_days_before NUMERIC,
  p_runway_days_after NUMERIC,
  p_runway_reduction_days NUMERIC,
  p_savings_pocket_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_unlock public.emergency_unlocks;
  v_available NUMERIC;
  v_amount NUMERIC;
  v_reserve_kept NUMERIC;
BEGIN
  v_amount := ROUND(p_amount::numeric * 100) / 100;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Emergency amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Serialize unlocks against this plan (reserve_balance) and this savings
  -- pocket (ledger). Lock order: plan first, then pocket by id â€” matches the
  -- single-pocket spend path which locks the pocket alone, so a spend that
  -- already holds the pocket blocks here until it commits.
  PERFORM 1 FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.pockets WHERE id = p_savings_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings pocket not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pockets
    WHERE id = p_savings_pocket_id AND plan_id = p_plan_id AND kind = 'savings'
  ) THEN
    RAISE EXCEPTION 'Savings pocket does not belong to plan' USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_available
  FROM public.transactions t
  WHERE t.pocket_id = p_savings_pocket_id;

  IF v_available < v_amount THEN
    RAISE EXCEPTION 'Insufficient savings balance' USING ERRCODE = 'P0001';
  END IF;

  -- Ignore client p_reserve_kept; persist the locked post-debit figure.
  v_reserve_kept := ROUND((v_available - v_amount)::numeric * 100) / 100;

  INSERT INTO public.emergency_unlocks (
    id, user_id, plan_id, amount, days_calculated, least_daily_spend,
    average_daily_spend, reserve_kept,
    runway_days_before, runway_days_after, runway_reduction_days
  ) VALUES (
    p_id, p_user_id, p_plan_id, v_amount, p_days_calculated, p_least_daily_spend,
    p_average_daily_spend, v_reserve_kept,
    p_runway_days_before, p_runway_days_after, p_runway_reduction_days
  ) RETURNING * INTO v_unlock;

  INSERT INTO public.transactions (pocket_id, amount, type, emergency_unlock_id)
  VALUES (p_savings_pocket_id, -v_amount, 'reallocation_out', p_id);

  UPDATE public.plans
  SET reserve_balance = GREATEST(0, reserve_balance - v_amount)
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'id', v_unlock.id,
    'created_at', v_unlock.created_at,
    'reserve_kept', v_reserve_kept,
    'available_before', v_available
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_execute_emergency_unlock IS
  'Atomically records an emergency unlock, debits savings under a pocket lock with a ledger balance recheck, and shrinks the plan reserve (H1 + Phase 7 race guard).';


-- ============================================================================
-- Migration: 043_atomic_retake_plan.sql
-- ============================================================================

-- H1 residual (Phase 7 review): plan retake used to deactivate the prior
-- plan, insert the new plan + pockets, write redistribution ledger rows,
-- optionally replace fixed expenses, and insert plan_retaken as separate
-- requests. A mid-flight failure could leave no active plan (or a new plan
-- with partial ledger moves); concurrent retakes could both pass the
-- application-level monthly gate. This function does the whole persist in
-- one transaction and claims the monthly retake under the user row lock.
--
-- Redistribution planning stays in TypeScript (planBalanceRedistribution);
-- the RPC rechecks each source pocket's ledger available under FOR UPDATE
-- so a concurrent spend cannot silently drive a source negative.

CREATE OR REPLACE FUNCTION public.atomic_retake_plan(
  p_user_id UUID,
  p_segment TEXT,
  p_previous_plan_id UUID,
  p_plan JSONB,
  p_pockets JSONB,
  p_ledger JSONB,
  p_replace_fixed_expenses BOOLEAN,
  p_fixed_expenses JSONB,
  p_behavior_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID;
  v_prev public.plans;
  p_item JSONB;
  v_tx JSONB;
  v_pocket_id UUID;
  v_amount NUMERIC;
  v_type TEXT;
  v_needed NUMERIC;
  v_available NUMERIC;
  v_pockets JSONB;
BEGIN
  IF p_segment NOT IN ('individual', 'msme') THEN
    RAISE EXCEPTION 'Invalid segment' USING ERRCODE = '22023';
  END IF;
  IF p_plan IS NULL OR p_pockets IS NULL THEN
    RAISE EXCEPTION 'Plan and pockets are required' USING ERRCODE = '22023';
  END IF;
  IF p_previous_plan_id IS NULL THEN
    RAISE EXCEPTION 'Previous plan is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize every retake for this user (monthly claim + deactivate/insert).
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  -- Exactly-once monthly claim (UTC month), matching sameUtcMonth() in TS.
  IF EXISTS (
    SELECT 1
    FROM public.behavior_events be
    WHERE be.user_id = p_user_id
      AND be.type = 'plan_retaken'
      AND date_trunc('month', be.created_at AT TIME ZONE 'UTC')
          = date_trunc('month', NOW() AT TIME ZONE 'UTC')
  ) THEN
    RAISE EXCEPTION 'Retake already used this month' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.plans
  WHERE user_id = p_user_id AND segment = p_segment
  FOR UPDATE;

  SELECT * INTO v_prev
  FROM public.plans
  WHERE id = p_previous_plan_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_prev.user_id <> p_user_id
     OR v_prev.segment <> p_segment
     OR v_prev.status <> 'active' THEN
    RAISE EXCEPTION 'No active plan to retake' USING ERRCODE = 'P0002';
  END IF;

  -- Lock every pocket on the previous plan (and hold until commit) so ledger
  -- rechecks below cannot race a concurrent spend/borrow on those ids.
  PERFORM 1
  FROM public.pockets
  WHERE plan_id = p_previous_plan_id
  ORDER BY id
  FOR UPDATE;

  -- Recheck planned source debits against locked ledger balances.
  IF p_ledger IS NOT NULL AND jsonb_array_length(p_ledger) > 0 THEN
    FOR v_pocket_id, v_needed IN
      SELECT (item->>'pocket_id')::UUID AS pocket_id,
             SUM(ABS((item->>'amount')::NUMERIC)) AS needed
      FROM jsonb_array_elements(p_ledger) item
      WHERE item->>'type' = 'reallocation_out'
      GROUP BY (item->>'pocket_id')::UUID
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.pockets
        WHERE id = v_pocket_id AND plan_id = p_previous_plan_id
      ) THEN
        RAISE EXCEPTION 'Source pocket does not belong to previous plan'
          USING ERRCODE = '23503';
      END IF;

      SELECT COALESCE(SUM(CASE
        WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
        WHEN t.type = 'spend' THEN -t.amount
        WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
        ELSE 0
      END), 0) INTO v_available
      FROM public.transactions t
      WHERE t.pocket_id = v_pocket_id;

      IF v_available < v_needed THEN
        RAISE EXCEPTION 'Insufficient source balance' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.plans
  SET status = 'inactive'
  WHERE id = p_previous_plan_id
    AND status = 'active';

  v_plan_id := COALESCE((p_plan->>'id')::UUID, gen_random_uuid());

  BEGIN
    INSERT INTO public.plans (
      id, user_id, segment, type, income_pattern, income_interval_days,
      expected_income_amount, status, money_personality
    ) VALUES (
      v_plan_id,
      p_user_id,
      p_segment,
      p_plan->>'type',
      p_plan->>'income_pattern',
      NULLIF(p_plan->>'income_interval_days', '')::INTEGER,
      NULLIF(p_plan->>'expected_income_amount', '')::NUMERIC,
      COALESCE(NULLIF(p_plan->>'status', ''), 'active'),
      COALESCE(NULLIF(p_plan->>'money_personality', ''), 'saver')
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Retake commit conflict' USING ERRCODE = 'P0001';
  END;

  FOR p_item IN SELECT value FROM jsonb_array_elements(p_pockets)
  LOOP
    INSERT INTO public.pockets (
      id, plan_id, name, kind, category, is_time_locked, lock_until,
      monthly_allocation, daily_cap,
      savings_target_amount, savings_target_date
    ) VALUES (
      COALESCE(NULLIF(p_item->>'id', '')::UUID, gen_random_uuid()),
      v_plan_id,
      p_item->>'name',
      p_item->>'kind',
      NULLIF(p_item->>'category', ''),
      COALESCE((p_item->>'is_time_locked')::BOOLEAN, FALSE),
      NULLIF(p_item->>'lock_until', '')::TIMESTAMPTZ,
      COALESCE((p_item->>'monthly_allocation')::NUMERIC, 0),
      CASE
        WHEN p_item->>'daily_cap' IS NULL OR p_item->>'daily_cap' = '' THEN NULL
        ELSE (p_item->>'daily_cap')::NUMERIC
      END,
      CASE
        WHEN p_item->>'savings_target_amount' IS NULL OR p_item->>'savings_target_amount' = '' THEN NULL
        ELSE (p_item->>'savings_target_amount')::NUMERIC
      END,
      CASE
        WHEN p_item->>'savings_target_date' IS NULL OR p_item->>'savings_target_date' = '' THEN NULL
        ELSE (p_item->>'savings_target_date')::DATE
      END
    );
  END LOOP;

  IF p_ledger IS NOT NULL AND jsonb_array_length(p_ledger) > 0 THEN
    FOR v_tx IN SELECT value FROM jsonb_array_elements(p_ledger)
    LOOP
      v_pocket_id := (v_tx->>'pocket_id')::UUID;
      v_amount := ROUND((v_tx->>'amount')::NUMERIC * 100) / 100;
      v_type := v_tx->>'type';

      IF v_type NOT IN ('reallocation_out', 'reallocation_in') THEN
        RAISE EXCEPTION 'Invalid retake ledger type' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.transactions (pocket_id, amount, type)
      VALUES (v_pocket_id, v_amount, v_type);
    END LOOP;
  END IF;

  IF p_replace_fixed_expenses THEN
    DELETE FROM public.fixed_expenses
    WHERE user_id = p_user_id AND segment = p_segment;

    IF p_fixed_expenses IS NOT NULL AND jsonb_array_length(p_fixed_expenses) > 0 THEN
      INSERT INTO public.fixed_expenses (
        user_id, name, amount, due_day, category, segment
      )
      SELECT
        p_user_id,
        item->>'name',
        (item->>'amount')::NUMERIC,
        (item->>'due_day')::INTEGER,
        NULLIF(item->>'category', ''),
        p_segment
      FROM jsonb_array_elements(p_fixed_expenses) item;
    END IF;
  END IF;

  INSERT INTO public.behavior_events (user_id, type, payload)
  VALUES (
    p_user_id,
    'plan_retaken',
    COALESCE(p_behavior_payload, '{}'::jsonb)
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at), '[]'::jsonb)
  INTO v_pockets
  FROM public.pockets p
  WHERE p.plan_id = v_plan_id;

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'pockets', v_pockets
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_retake_plan IS
  'Atomically claims a once-per-UTC-month plan retake, deactivates the prior plan, inserts the new plan + pockets, writes redistribution ledger rows under source pocket locks, optionally replaces fixed expenses, and records plan_retaken.';


