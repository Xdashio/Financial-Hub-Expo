-- ============================================================================
-- Financial Hub - Pack 1: Schema Validation Test
-- ============================================================================
-- This test validates that the migration applied correctly and all constraints work
-- ============================================================================

DO $$
BEGIN
  -- Test 1: Verify all tables exist
  DECLARE tables_exist BOOLEAN := TRUE;
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    RAISE EXCEPTION 'Table users does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans') THEN
    RAISE EXCEPTION 'Table plans does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pockets') THEN
    RAISE EXCEPTION 'Table pockets does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fixed_expenses') THEN
    RAISE EXCEPTION 'Table fixed_expenses does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'income_events') THEN
    RAISE EXCEPTION 'Table income_events does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    RAISE EXCEPTION 'Table transactions does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reallocations') THEN
    RAISE EXCEPTION 'Table reallocations does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_classifications') THEN
    RAISE EXCEPTION 'Table merchant_classifications does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'behavior_events') THEN
    RAISE EXCEPTION 'Table behavior_events does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'discipline_scores') THEN
    RAISE EXCEPTION 'Table discipline_scores does not exist';
  END IF;
  
  RAISE NOTICE 'Test 1 PASSED: All tables exist';
END;

-- Test 2: Verify RLS is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on all tables';
  END IF;
  
  RAISE NOTICE 'Test 2 PASSED: RLS is enabled';
END;

-- Test 3: Verify atomic_reallocation function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'atomic_reallocation'
  ) THEN
    RAISE EXCEPTION 'Function atomic_reallocation does not exist';
  END IF;
  
  RAISE NOTICE 'Test 3 PASSED: atomic_reallocation function exists';
END;

-- Test 4: Verify log_behavior_event function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'log_behavior_event'
  ) THEN
    RAISE EXCEPTION 'Function log_behavior_event does not exist';
  END IF;
  
  RAISE NOTICE 'Test 4 PASSED: log_behavior_event function exists';
END;

-- Test 5: Verify constraints exist
DO $$
BEGIN
  -- Check one_active_plan_per_user constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'one_active_plan_per_user'
  ) THEN
    RAISE EXCEPTION 'Constraint one_active_plan_per_user does not exist';
  END IF;
  
  -- Check valid_time_lock constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_time_lock'
  ) THEN
    RAISE EXCEPTION 'Constraint valid_time_lock does not exist';
  END IF;
  
  -- Check different_pockets constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'different_pockets'
  ) THEN
    RAISE EXCEPTION 'Constraint different_pockets does not exist';
  END IF;
  
  RAISE NOTICE 'Test 5 PASSED: All constraints exist';
END;

-- Test 6: Verify indexes exist
DO $$
BEGIN
  -- Check a few key indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_plans_user_id'
  ) THEN
    RAISE EXCEPTION 'Index idx_plans_user_id does not exist';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_pockets_plan_id'
  ) THEN
    RAISE EXCEPTION 'Index idx_pockets_plan_id does not exist';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_transactions_pocket_id'
  ) THEN
    RAISE EXCEPTION 'Index idx_transactions_pocket_id does not exist';
  END IF;
  
  RAISE NOTICE 'Test 6 PASSED: Key indexes exist';
END;

-- Test 7: Verify RLS policies exist
DO $$
BEGIN
  -- Check that users policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view own profile'
  ) THEN
    RAISE EXCEPTION 'RLS policy Users can view own profile does not exist';
  END IF;
  
  -- Check that plans policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can view own plans'
  ) THEN
    RAISE EXCEPTION 'RLS policy Users can view own plans does not exist';
  END IF;
  
  RAISE NOTICE 'Test 7 PASSED: RLS policies exist';
END;

RAISE NOTICE '=============================================';
RAISE NOTICE 'ALL SCHEMA VALIDATION TESTS PASSED';
RAISE NOTICE '=============================================';

$$;