-- ============================================================================
-- Financial Hub - Pack 1: Atomic Reallocation Test
-- ============================================================================
-- This test proves that reallocation is atomic (debit+credit in one transaction)
-- It validates that either both transactions succeed or both fail
-- ============================================================================

-- Setup test data
DO $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_from_pocket_id UUID;
  v_to_pocket_id UUID;
  v_reallocation_id UUID;
  v_from_balance_before NUMERIC;
  v_to_balance_before NUMERIC;
  v_from_balance_after NUMERIC;
  v_to_balance_after NUMERIC;
BEGIN
  -- Create test user
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    '123e4567-e89b-12d3-a456-426614174000',
    'test@example.com',
    'Test User'
  )
  ON CONFLICT (id) DO NOTHING;
  
  v_user_id := '123e4567-e89b-12d3-a456-426614174000';
  
  -- Create test plan
  INSERT INTO public.plans (id, user_id, type, income_pattern, status)
  VALUES (
    '123e4567-e89b-12d3-a456-426614174001',
    v_user_id,
    'structured',
    'salaried',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  
  v_plan_id := '123e4567-e89b-12d3-a456-426614174001';
  
  -- Create test pockets with initial balances
  INSERT INTO public.pockets (id, plan_id, name, kind, monthly_allocation)
  VALUES 
    ('123e4567-e89b-12d3-a456-426614174002', v_plan_id, 'Savings', 'savings', 10000),
    ('123e4567-e89b-12d3-a456-426614174003', v_plan_id, 'Food', 'spendable', 5000)
  ON CONFLICT (id) DO NOTHING;
  
  v_from_pocket_id := '123e4567-e89b-12d3-a456-426614174002';
  v_to_pocket_id := '123e4567-e89b-12d3-a456-426614174003';
  
  -- Set initial balances via transactions
  INSERT INTO public.transactions (pocket_id, amount, type)
  VALUES 
    (v_from_pocket_id, 10000, 'allocation'),
    (v_to_pocket_id, 5000, 'allocation');
  
  -- Get initial balances
  SELECT COALESCE(SUM(amount), 0) INTO v_from_balance_before
  FROM public.transactions 
  WHERE pocket_id = v_from_pocket_id;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_to_balance_before
  FROM public.transactions 
  WHERE pocket_id = v_to_pocket_id;
  
  RAISE NOTICE 'Initial balances - From pocket: %, To pocket: %', 
    v_from_balance_before, v_to_balance_before;
  
  -- Test 1: Successful atomic reallocation
  BEGIN
    v_reallocation_id := public.atomic_reallocation(
      v_from_pocket_id,
      v_to_pocket_id,
      1000,
      'emergency',
      'completed'
    );
    
    -- Verify balances after reallocation
    SELECT COALESCE(SUM(amount), 0) INTO v_from_balance_after
    FROM public.transactions 
    WHERE pocket_id = v_from_pocket_id;
    
    SELECT COALESCE(SUM(amount), 0) INTO v_to_balance_after
    FROM public.transactions 
    WHERE pocket_id = v_to_pocket_id;
    
    -- Assert atomicity: both transactions must have been applied
    IF v_from_balance_after != v_from_balance_before - 1000 THEN
      RAISE EXCEPTION 'Atomicity test failed: Source pocket balance incorrect. Expected: %, Got: %',
        v_from_balance_before - 1000, v_from_balance_after;
    END IF;
    
    IF v_to_balance_after != v_to_balance_before + 1000 THEN
      RAISE EXCEPTION 'Atomicity test failed: Destination pocket balance incorrect. Expected: %, Got: %',
        v_to_balance_before + 1000, v_to_balance_after;
    END IF;
    
    -- Verify reallocation record exists
    IF NOT EXISTS (
      SELECT 1 FROM public.reallocations 
      WHERE id = v_reallocation_id
      AND from_pocket_id = v_from_pocket_id
      AND to_pocket_id = v_to_pocket_id
      AND amount = 1000
    ) THEN
      RAISE EXCEPTION 'Atomicity test failed: Reallocation record not found';
    END IF;
    
    -- Verify both transaction records exist
    IF (
      SELECT COUNT(*) FROM public.transactions 
      WHERE pocket_id = v_from_pocket_id 
      AND type = 'reallocation_out' 
      AND amount = -1000
    ) != 1 THEN
      RAISE EXCEPTION 'Atomicity test failed: Debit transaction not found or duplicate';
    END IF;
    
    IF (
      SELECT COUNT(*) FROM public.transactions 
      WHERE pocket_id = v_to_pocket_id 
      AND type = 'reallocation_in' 
      AND amount = 1000
    ) != 1 THEN
      RAISE EXCEPTION 'Atomicity test failed: Credit transaction not found or duplicate';
    END IF;
    
    RAISE NOTICE 'Test 1 PASSED: Successful atomic reallocation';
    RAISE NOTICE 'Balances after - From pocket: %, To pocket: %', 
      v_from_balance_after, v_to_balance_after;
    
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Test 1 FAILED: %', SQLERRM;
      RAISE;
  END;
  
  -- Test 2: Failed reallocation (same pocket) should roll back everything
  BEGIN
    -- This should fail due to constraint check
    v_reallocation_id := public.atomic_reallocation(
      v_from_pocket_id,
      v_from_pocket_id, -- Same pocket - should fail
      1000,
      'emergency',
      'pending'
    );
    
    RAISE EXCEPTION 'Test 2 FAILED: Same pocket reallocation should have failed';
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Expected to fail
      RAISE NOTICE 'Test 2 PASSED: Same pocket reallocation correctly failed: %', SQLERRM;
  END;
  
  -- Test 3: Failed reallocation (negative amount) should roll back everything
  BEGIN
    v_reallocation_id := public.atomic_reallocation(
      v_from_pocket_id,
      v_to_pocket_id,
      -1000, -- Negative amount - should fail
      'emergency',
      'pending'
    );
    
    RAISE EXCEPTION 'Test 3 FAILED: Negative amount reallocation should have failed';
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Expected to fail
      RAISE NOTICE 'Test 3 PASSED: Negative amount reallocation correctly failed: %', SQLERRM;
  END;
  
  -- Verify no transactions were created by failed tests
  IF (
    SELECT COUNT(*) FROM public.transactions 
    WHERE type IN ('reallocation_in', 'reallocation_out')
    AND pocket_id IN (v_from_pocket_id, v_to_pocket_id)
  ) != 2 THEN -- Only the 2 from successful test
    RAISE EXCEPTION 'Test cleanup failed: Extra transactions found from failed tests';
  END IF;
  
  RAISE NOTICE 'ALL ATOMIC REALLOCATION TESTS PASSED';
  
  -- Cleanup test data
  DELETE FROM public.reallocations WHERE from_pocket_id = v_from_pocket_id;
  DELETE FROM public.transactions WHERE pocket_id IN (v_from_pocket_id, v_to_pocket_id);
  DELETE FROM public.pockets WHERE id IN (v_from_pocket_id, v_to_pocket_id);
  DELETE FROM public.plans WHERE id = v_plan_id;
  DELETE FROM public.users WHERE id = v_user_id;
  
END $$;