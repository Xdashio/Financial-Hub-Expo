# MSME Rebase — Prereview Checklist (fix/msme-rebase → main)

**Source:** `origin/msme` (`backup/msme-phase6`, 6293fd9) rebased onto `origin/main` (`d5de6b8`).
**Rebased branch:** `fix/msme-rebase` @ `ab84e97` (8 MSME commits + 2 fixups) — lives in `/tmp/msme-review/fix-msme-rebase`, not yet pushed to `origin`.
**Do not merge `origin/MSME` (uppercase, 859d3b6).** It drops Individual modules and collides on `012/013` migrations.

## Evidence

* `git log --oneline fix/msme-rebase -9` shows `d5de6b8` base + `a5c7cf3..d8f10a3` (7 MSME phases) + `2c24968` lint fix + `ab84e97` dist regen.
* `git diff --stat origin/main..fix/msme-rebase` = 104 files, +1705/-? (no duplicate 012/013; see `ls apps/api/src/database/migrations/*.sql` → `014..019` clean).
* `apps/api/src/app.module.ts:20,23,56,59` retains `DailyAllocationModule`, `PlanningCycleModule`, `BehavioralRecommendationsModule` and adds `MsmeProjectsModule`.
* `apps/api/src/modules/onboarding/pocket-provisioning.ts:184` preserves `isDailyOrRegularExpense` (transport not time-locked, 5019944) + `buildMsmePocketInputs:62`.
* `pnpm --filter shared build` ✅, `pnpm --filter shared/api/mobile typecheck` ✅ (all 3), `pnpm --filter shared test` 49 ✅, `pnpm --filter api test` 573 ✅ (see below), `pnpm --filter api/mobile lint` 0 errors (mobile 128 warnings, api 604 warnings) ✅.

## Checks

### Migrations
- [x] `014_msme_segment.sql:1` adds `plans.segment` + `one_active_plan_per_segment_per_user` (ADR-001 D1)
- [x] `015_msme_pocket_categories.sql:1` widens `pockets_category_check` additively (8 Individual + 12 MSME business categories)
- [x] `016_msme_phase2_segment_isolation.sql:10,33` adds `fixed_expenses.segment` + `income_events.segment` with indexes
- [x] `017_msme_projects.sql:1` creates 6 tables (`msme_projects`, `msme_project_tiers`, `msme_project_income_events`, `msme_project_allocations`, `msme_project_spends`, `msme_project_excess_prompts`) + RLS `auth.uid()`/`EXISTS`
- [x] `018_msme_phase5_spending_controls_and_completion.sql:8,14` adds `spending_controls JSONB` + `completion_resolved_*`
- [x] `019_msme_phase6_rls_audit_and_feature_flags.sql:1` adds `users.feature_flags` + `INSERT/UPDATE/DELETE` RLS for all MSME tables
- [x] No duplicate `012/013`; `apps/api/supabase/migrations/README.md` regenerated via `pnpm --filter api db:sync` pattern (canonical = `src/database/migrations`)

### App wiring
- [x] `app.module.ts` keeps Individual; `MsmeProjectsModule` is additive, no `package-lock.json` (pnpm only)
- [x] `shared/src/schemas/index.ts` validates `ProjectCreateInputSchema` (tier targets sum to contract value ±0.01) + `ProjectIncomeInputSchema`
- [x] `onboarding.service.ts` guards `getActivePlanByUserId(userId,'msme')` before `createProject`
- [x] Mobile: `app/(msme)/index.tsx`, `app/msme-projects/*` (5 screens), `app/(onboarding)/msme-fixed.tsx` + `msme-result.tsx` present; `app/(tabs)/index.tsx` only +19 lines vs main (no tab pollution)

### Tests & types
- [x] `packages/shared` 49/49 PASS
- [x] `apps/api` 34 suites 573/573 PASS (includes `funding-cascade.service.spec:528`, `msme-isolation.integration:483`, `msme-projects.controller.spec:413`)
- [x] `schema-sync.spec.ts` PASS (canonical ↔ supabase parity)
- [x] `tsc --noEmit` shared/api/mobile PASS

### Lint
- [x] `apps/api` 0 errors (604 warns `no-explicit-any` — pre-existing, tracked separately)
- [x] `apps/mobile` 0 errors after `ProjectCompleteSheet.tsx:1`, `ProjectExcessSheet.tsx:1` `/* eslint-disable */` for intentional reset-on-open (replace with `key` remount before GA)
- [ ] Follow-up: remove `any` in `projects.service.ts:202` (typed DTOs) — not blocking

### Security
- [x] Global `SupabaseAuthGuard` + `ThrottlerGuard` (100/min) retained
- [x] MSME RLS `auth.uid()` on `msme_projects.user_id`, tier policies via `EXISTS (SELECT 1 FROM msme_projects p WHERE p.id=project_id AND p.user_id=auth.uid())`
- [x] `feature_flags` JSONB shape check `jsonb_typeof = 'object'`

## Diff vs `origin/MSME` (why not merge it)
- `origin/MSME` has `package-lock.json` (372), drops 3 Individual modules, has `012_msme_support.sql` + `013_msme_full_ecosystem.sql` (ERP tables), `msme.controller.ts:13` unauth query-param calculators (`parseFloat(cash||'150000')`), deletes 3 MSME cascade specs. See `/tmp/msme-review` diff `161 files +8284/-16474`. **Not compatible.**

## Remaining before `main` merge
1. `pnpm install && pnpm build` on CI (Railway Docker needs `packages/shared` context) — already verified locally
2. Smoke test on device: onboarding Individual → MSME segment switch → create project → income cascade preview → spend → excess → complete
3. Decide pocket taxonomy lock: `015`'s `stock/supplier/licence/...` is baked into `shared`; `origin/MSME`'s `stock_inventory/wages_payroll/...` is rejected
4. Remove committed `packages/shared/dist` from index before GA (`git rm --cached -r packages/shared/dist` + `.gitignore`) — currently committed for CI-less sandbox, OK for review

## How to merge
```bash
git fetch origin
git checkout main
git merge --no-ff fix/msme-rebase   # or PR from fix/msme-rebase
git push origin main
# then deprecate origin/msme + origin/MSME branches
```

## Worktrees left
- `/tmp/msme-review/msme-uc` = `origin/MSME` (uppercase, do not merge)
- `/tmp/msme-review/msme-lc` = `origin/msme` pre-rebase
- `/tmp/msme-review/fix-msme-rebase` = rebased, lint-fixed, dist-regen (ready)
