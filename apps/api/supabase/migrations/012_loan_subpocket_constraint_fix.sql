-- ============================================================================
-- Fix: sub-pockets of a Loan pocket 500 on creation
-- ============================================================================
-- Root cause (see PocketsService.createSubPocket): a sub-pocket inherits
-- its parent's `kind` so pocket-rules.ts / spend checks treat it exactly
-- like any other pocket of that kind. For a Loan pocket's purpose
-- sub-pockets (audit_team.md item 9 — "sub-pockets for repayment vs.
-- purpose allocation"), that means the insert gets kind = 'loan' but never
-- sets `repayment_schedule` or `due_day` — those belong to the top-level
-- loan, not its purpose sub-pockets.
--
-- 008_loans.sql's `loan_schedule_only_for_loans` / `loan_due_day_only_for_loans`
-- constraints didn't anticipate sub-pockets: they required *every* row with
-- kind = 'loan' to carry a repayment_schedule and a due_day. So the insert
-- above violates both CHECK constraints, Postgres raises a constraint
-- violation, and — since nothing in PocketsService.createSubPocket or
-- SupabaseRepository.createPocket catches it — NestJS's default exception
-- filter turns the raw driver error into an unhandled 500. This is the
-- "Internal Server Error on sub-pocket creation" bug: reproducible for any
-- sub-pocket whose parent is a Loan pocket (kind = 'loan'), not just a bad
-- `category` value (category null/omitted was already valid — see
-- pockets_category_check in 001_initial_schema.sql — so that path never
-- 500s on its own).
--
-- Fix: scope both constraints to top-level pockets only
-- (parent_pocket_id IS NULL). A loan sub-pocket (parent_pocket_id NOT NULL,
-- kind = 'loan') is now explicitly allowed to have repayment_schedule/
-- due_day NULL; a top-level loan pocket still requires both, unchanged.

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS loan_schedule_only_for_loans;
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_schedule_only_for_loans CHECK (
    (kind = 'loan' AND parent_pocket_id IS NULL AND repayment_schedule IS NOT NULL) OR
    (kind = 'loan' AND parent_pocket_id IS NOT NULL) OR
    (kind != 'loan' AND repayment_schedule IS NULL)
  );

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS loan_due_day_only_for_loans;
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_due_day_only_for_loans CHECK (
    (kind = 'loan' AND parent_pocket_id IS NULL AND due_day IS NOT NULL) OR
    (kind = 'loan' AND parent_pocket_id IS NOT NULL) OR
    (kind != 'loan' AND due_day IS NULL)
  );