-- ============================================================================
-- 021_msme_stock.sql — MSME Stock & Inventory Tracker (Phase 3)
-- Real qty ledger (no mocks): items + movements (in/out/adjust) with RLS.
-- Links to pockets via pocket_id on movements (optional) for spend traceability.
-- ============================================================================

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_msme_stock_items_user_sku ON public.msme_stock_items(user_id, sku) WHERE sku IS NOT NULL;

DROP TRIGGER IF EXISTS update_msme_stock_items_updated_at ON public.msme_stock_items;
CREATE TRIGGER update_msme_stock_items_updated_at BEFORE UPDATE ON public.msme_stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.msme_stock_items IS 'MSME stock items — qty_on_hand is denormalized sum of movements (in - out ± adjust). 021.';

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
CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_user_id ON public.msme_stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_type ON public.msme_stock_movements(type);

COMMENT ON TABLE public.msme_stock_movements IS 'Stock movements — in (purchase/restock) adds, out (sale) subtracts, adjust is signed correction via qty. Links to pocket spend optionally.';

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
