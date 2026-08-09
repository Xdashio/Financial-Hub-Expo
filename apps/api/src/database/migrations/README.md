# Financial Hub Database Migrations

## Pack 1 - Initial Schema

This migration creates the core data model for Financial Hub with all entities defined in the Pack 1 specification.

> **This directory (`apps/api/src/database/migrations/`) is the single canonical source for the schema.**
> The previous `apps/api/supabase/migrations/001_initial_schema.sql` copy has been removed — it had
> diverged from this one (see `BACKEND_FRONTEND_AUDIT.md` §C1). If you use the Supabase CLI, run
> `npm run db:sync` from `apps/api/` first to regenerate `apps/api/supabase/migrations/` from this
> file before `supabase db push`; never hand-edit the generated copy.

### Tables Created

1. **users** - User profiles (extends Supabase Auth)
2. **plans** - One plan per user (structured/daily, salaried/freelancer)
3. **pockets** - Per plan pockets (savings/fixed/spendable)
4. **fixed_expenses** - Per user fixed expenses (includes a real `status` column)
5. **income_events** - Manual income entry
6. **transactions** - Transaction ledger
7. **reallocations** - Money reallocation records
8. **merchant_classifications** - Merchant category memory, scoped per-user
9. **behavior_events** - Single event log
10. **discipline_scores** - User discipline scores, one row per `(user_id, period)`
11. **notification_preferences** - Per-user notification settings
12. **merchant_reports** - User-submitted merchant classification disputes

### Key Features

- **Row Level Security (RLS)** enabled on all tables
- **Atomic reallocation** function ensures debit+credit happen together
- **Proper foreign key relationships** with CASCADE deletes
- **Indexes** for performance optimization
- **Constraints** for data integrity (10% savings rule, time-lock validation, etc.)

### Applying the Migration

#### Method 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `001_initial_schema.sql`
4. Paste and execute the SQL

#### Method 2: Via CLI (if using Supabase CLI)

```bash
npm run db:sync   # regenerates apps/api/supabase/migrations/ from this canonical directory
npm run db:push   # runs db:sync then `supabase db push`
```

### Testing the Migration

Run the atomic reallocation test to verify the schema works correctly:

```bash
# In Supabase SQL Editor, run:
-- Copy contents of 001_initial_schema.spec.sql
```

This test validates that:
- Reallocation is atomic (both debit and credit succeed or both fail)
- Constraints prevent invalid operations (same pocket, negative amounts)
- Transaction rollback works correctly

### Schema Validation

The zod schemas in `packages/shared/src/schemas/index.ts` match the SQL columns exactly. You can validate this by running:

```bash
cd packages/shared
npm test
```

### RLS Policies

All tables have Row Level Security policies ensuring:
- Users can only read/write their own data
- Pocket/transaction access is controlled via plan ownership
- Service-level operations for merchant classifications and behavior events

### Business Rules Encoded

1. **Minimum 10% savings** - enforced at service layer (not DB constraint)
2. **Savings never default reallocation source** - service layer rule
3. **Time-locked savings cannot be reallocation source** - service layer rule
4. **Atomic reallocation** - enforced via `atomic_reallocation()` function
5. **Single active plan per user** - enforced via exclusion constraint

### Rollback

If needed, you can rollback by dropping the tables:

```sql
DROP TABLE IF EXISTS public.merchant_reports CASCADE;
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.discipline_scores CASCADE;
DROP TABLE IF EXISTS public.behavior_events CASCADE;
DROP TABLE IF EXISTS public.merchant_classifications CASCADE;
DROP TABLE IF EXISTS public.reallocations CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.income_events CASCADE;
DROP TABLE IF EXISTS public.fixed_expenses CASCADE;
DROP TABLE IF EXISTS public.pockets CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
```

### Next Steps

After applying this migration:
1. Set up Supabase Auth
2. Configure the auth trigger for user profile creation
3. Test the API endpoints against the schema
4. Implement the service layer with business rule validation