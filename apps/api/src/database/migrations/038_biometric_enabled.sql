-- ============================================================================
-- H13: users.biometric_enabled was typed in database.types.ts but never
-- migrated. The mobile app keys biometric locking off device-local storage
-- (storageAdapter 'biometricEnabled' — see mobile/src/services/auth.ts), so
-- this column is currently write-once/unused by the API, but the DB must match
-- the typed contract. boolean + default false exactly as typed.
-- (Numbered 038 because 035 was already consumed by
--  atomic_complete_reallocation_side_effects.sql.)
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN NOT NULL DEFAULT FALSE;