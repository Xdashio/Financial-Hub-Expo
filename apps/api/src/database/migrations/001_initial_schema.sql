-- ============================================================================
-- Financial Hub - Pack 1: Initial Schema Migration
-- ============================================================================
-- This migration creates the core data model for Financial Hub
-- All tables use UUID primary keys and proper foreign key relationships
-- Row Level Security (RLS) is enabled for multi-tenant data isolation
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Users Table (extends Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL CHECK (char_length(full_name) >= 1 AND char_length(full_name) <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reassigned_at TIMESTAMPTZ
);

-- Ensure only one active plan per user via unique constraint
CREATE UNIQUE INDEX one_active_plan_per_user ON public.plans(user_id) WHERE status = 'active';

-- ============================================================================
-- Pockets Table (per plan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pockets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('savings', 'fixed', 'spendable')),
  category TEXT CHECK (category IN ('food', 'transport', 'leisure', 'personal', 'utilities', 'healthcare', 'education', 'other')),
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
  category TEXT NOT NULL CHECK (category IN ('food', 'transport', 'leisure', 'personal', 'utilities', 'healthcare', 'education', 'other')),
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
  label TEXT NOT NULL CHECK (char_length(label) <= 200),
  date DATE NOT NULL,
  run_allocation BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  recipient_key TEXT NOT NULL, -- e.g. till number, paybill, phone number
  category TEXT NOT NULL CHECK (category IN ('grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified')),
  remember BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_recipient UNIQUE (recipient_key)
);

-- ============================================================================
-- Behavior Events Table (single event log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.behavior_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Discipline Scores Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.discipline_scores (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
  delta NUMERIC NOT NULL,
  period TEXT NOT NULL, -- e.g. '2024-01', 'week-3'
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_merchant_classifications_recipient_key ON public.merchant_classifications(recipient_key);
CREATE INDEX IF NOT EXISTS idx_merchant_classifications_category ON public.merchant_classifications(category);

-- Behavior Events
CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON public.behavior_events(type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_created_at ON public.behavior_events(created_at);

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

-- Merchant Classifications: Read-only for users, write via service layer
CREATE POLICY "Anyone can view merchant classifications" ON public.merchant_classifications
  FOR SELECT USING (true);

-- Behavior Events: Read-only for users, write via service layer
CREATE POLICY "Anyone can view behavior events" ON public.behavior_events
  FOR SELECT USING (true);

-- Discipline Scores: Users can only read/write their own scores
CREATE POLICY "Users can view own discipline scores" ON public.discipline_scores
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own discipline scores" ON public.discipline_scores
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own discipline scores" ON public.discipline_scores
  FOR UPDATE USING (user_id = auth.uid());

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
  p_event_type TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.behavior_events (type, payload)
  VALUES (p_event_type, p_payload)
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

-- Create trigger on auth.users (requires Supabase auth setup)
-- This will be set up in Supabase dashboard, not in migration