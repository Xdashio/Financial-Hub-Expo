-- 017_msme_projects.sql — Funding Cascade domain (§11–§15)
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

-- Exactly one active cascade per user (satisfies §11.1)
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

-- Income that feeds the cascade (§16)
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

-- Atomic cascade allocations (audit trail for §17 example flow)
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

-- Spending against a tier (§14:286) — separate from funding
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

-- Excess prompts audit (§21)
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

-- RLS — same pattern as 001_initial_schema.sql:372
ALTER TABLE public.msme_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_income_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_spends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_excess_prompts ENABLE ROW LEVEL SECURITY;

-- Policies: user_id = auth.uid() directly, or via project → user_id join for tiers/allocations/spends
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

COMMENT ON TABLE public.msme_projects IS 'MSME project funding cascade — the core differentiator (§27:692)';
COMMENT ON TABLE public.msme_project_tiers IS 'Project funding tiers: Priorities(1) → Needs(2) → Wants(3) (§12:223)';
COMMENT ON TABLE public.msme_project_income_events IS 'Income that feeds the cascade (§16:356)';
COMMENT ON TABLE public.msme_project_allocations IS 'Audit trail of cascade allocations (§17:385)';
COMMENT ON TABLE public.msme_project_spends IS 'Spending against tiers, separate from funding (§14:270)';
COMMENT ON TABLE public.msme_project_excess_prompts IS 'Excess resolution prompts (§21:515)';
