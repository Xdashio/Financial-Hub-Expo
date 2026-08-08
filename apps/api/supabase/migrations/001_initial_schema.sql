-- Initial schema for Financial Hub
-- This migration creates all tables needed for the MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced with Supabase Auth)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    biometric_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans table
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('structured', 'daily')),
    income_pattern TEXT NOT NULL CHECK (income_pattern IN ('salaried', 'freelancer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'reassigned')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reassigned_at TIMESTAMPTZ
);

-- Pockets table
CREATE TABLE public.pockets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('savings', 'fixed', 'spendable')),
    category TEXT CHECK (category IN ('food', 'transport', 'leisure', 'personal', 'utilities', 'healthcare', 'education', 'other')),
    is_time_locked BOOLEAN DEFAULT FALSE,
    lock_until TIMESTAMPTZ,
    monthly_allocation NUMERIC(12, 2) NOT NULL DEFAULT 0,
    daily_cap NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fixed expenses table
CREATE TABLE public.fixed_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    category TEXT NOT NULL CHECK (category IN ('food', 'transport', 'leisure', 'personal', 'utilities', 'healthcare', 'education', 'other')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Income events table
CREATE TABLE public.income_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    source TEXT NOT NULL,
    label TEXT,
    date DATE NOT NULL,
    run_allocation BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL, -- positive for credit, negative for debit
    type TEXT NOT NULL CHECK (type IN ('allocation', 'spend', 'reallocation_in', 'reallocation_out', 'rollover')),
    merchant TEXT,
    category TEXT CHECK (category IN ('grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reallocations table
CREATE TABLE public.reallocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
    to_pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('emergency', 'unexpected_expense', 'income_change', 'priority_shift', 'other')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cooling_off', 'completed', 'skipped')),
    cooling_off_ends_at TIMESTAMPTZ,
    discipline_cost INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Merchant classifications table
CREATE TABLE public.merchant_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_key TEXT NOT NULL, -- till/paybill number
    category TEXT NOT NULL CHECK (category IN ('grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'gambling_betting', 'personal_care', 'other', 'unclassified')),
    remember BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recipient_key)
);

-- Behavior events table
CREATE TABLE public.behavior_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discipline scores table
CREATE TABLE public.discipline_scores (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    delta INTEGER NOT NULL DEFAULT 0,
    period TEXT NOT NULL, -- e.g., '2024-01', 'week-3'
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_plans_user_id ON public.plans(user_id);
CREATE INDEX idx_pockets_plan_id ON public.pockets(plan_id);
CREATE INDEX idx_fixed_expenses_user_id ON public.fixed_expenses(user_id);
CREATE INDEX idx_income_events_user_id ON public.income_events(user_id);
CREATE INDEX idx_transactions_pocket_id ON public.transactions(pocket_id);
CREATE INDEX idx_reallocations_from_pocket_id ON public.reallocations(from_pocket_id);
CREATE INDEX idx_reallocations_to_pocket_id ON public.reallocations(to_pocket_id);
CREATE INDEX idx_merchant_classifications_user_id ON public.merchant_classifications(user_id);
CREATE INDEX idx_behavior_events_user_id ON public.behavior_events(user_id);

-- Row Level Security (RLS) policies
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

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Plans policies
CREATE POLICY "Users can view own plans" ON public.plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans" ON public.plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans" ON public.plans
    FOR UPDATE USING (auth.uid() = user_id);

-- Pockets policies
CREATE POLICY "Users can view own pockets" ON public.pockets
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.plans WHERE plans.id = pockets.plan_id AND plans.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own pockets" ON public.pockets
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.plans WHERE plans.id = pockets.plan_id AND plans.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own pockets" ON public.pockets
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.plans WHERE plans.id = pockets.plan_id AND plans.user_id = auth.uid()
    ));

-- Fixed expenses policies
CREATE POLICY "Users can view own fixed expenses" ON public.fixed_expenses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fixed expenses" ON public.fixed_expenses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fixed expenses" ON public.fixed_expenses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fixed expenses" ON public.fixed_expenses
    FOR DELETE USING (auth.uid() = user_id);

-- Income events policies
CREATE POLICY "Users can view own income events" ON public.income_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income events" ON public.income_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.pockets 
        JOIN public.plans ON plans.id = pockets.plan_id 
        WHERE pockets.id = transactions.pocket_id AND plans.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own transactions" ON public.transactions
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.pockets 
        JOIN public.plans ON plans.id = pockets.plan_id 
        WHERE pockets.id = transactions.pocket_id AND plans.user_id = auth.uid()
    ));

-- Reallocations policies
CREATE POLICY "Users can view own reallocations" ON public.reallocations
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.pockets 
        JOIN public.plans ON plans.id = pockets.plan_id 
        WHERE pockets.id = reallocations.from_pocket_id AND plans.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own reallocations" ON public.reallocations
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.pockets 
        JOIN public.plans ON plans.id = pockets.plan_id 
        WHERE pockets.id = reallocations.from_pocket_id AND plans.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own reallocations" ON public.reallocations
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.pockets 
        JOIN public.plans ON plans.id = pockets.plan_id 
        WHERE pockets.id = reallocations.from_pocket_id AND plans.user_id = auth.uid()
    ));

-- Merchant classifications policies
CREATE POLICY "Users can view own merchant classifications" ON public.merchant_classifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own merchant classifications" ON public.merchant_classifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Behavior events policies
CREATE POLICY "Users can view own behavior events" ON public.behavior_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own behavior events" ON public.behavior_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Discipline scores policies
CREATE POLICY "Users can view own discipline scores" ON public.discipline_scores
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discipline scores" ON public.discipline_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pockets_updated_at BEFORE UPDATE ON public.pockets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fixed_expenses_updated_at BEFORE UPDATE ON public.fixed_expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();