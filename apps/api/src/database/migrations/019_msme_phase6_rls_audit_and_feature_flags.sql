-- ============================================================================
-- 019_msme_phase6_rls_audit_and_feature_flags.sql — Phase 6 RLS Audit & Rollout
-- Complete Row Level Security policies for MSME tables and add feature_flags JSONB on users.
-- ============================================================================

-- 1. Feature flags column on users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS feature_flags JSONB
    NOT NULL DEFAULT '{"msme_segment": true}'::jsonb;

COMMENT ON COLUMN public.users.feature_flags IS
  'User remote config and feature flags (Phase 6) — supports staged rollout (pilot -> 10% -> GA)';

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
