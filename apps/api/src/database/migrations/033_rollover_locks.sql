-- H2: duplicate rollover sweeps were previously prevented by an in-process
-- `Set<string>` (rollover.service.ts `activeUsers`). Under horizontal scaling
-- (Railway runs multiple API instances) the set only guarded one process, so
-- two instances could both pass the same-year "has ledger rows" idempotency
-- check and sweep the same date twice — double credits into Savings and a
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