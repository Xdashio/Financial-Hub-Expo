import { create } from 'zustand';

/**
 * Every screen that shows pocket balances (Home, Pocket Detail, Insights)
 * previously relied entirely on expo-router's useFocusEffect to know when
 * to refetch — i.e. "the user navigated back to this screen, so re-pull
 * data." That works when the mutating screen sits directly underneath in
 * the stack, but several flows (reallocation, income) close out with
 * `router.replace('/(tabs)')`, which can skip past intermediate screens
 * (e.g. the Pocket Detail screen the user actually started from) without
 * ever giving them a focus event — so they never refetch, and the balance
 * looks unchanged even though the backend ledger updated correctly.
 *
 * This store is a small, screen-agnostic "something changed" signal.
 * Any action that moves money (spend, reallocation, unlock/extend-lock,
 * income) calls `bump()` right after the request succeeds. Screens that
 * display balances read `version` and refetch when it changes, in
 * addition to (not instead of) their existing focus-based refetch — so
 * correctness no longer depends on exactly which screen happens to be
 * mounted underneath when a flow finishes.
 */
interface DataSyncState {
  version: number;
  bump: () => void;
}

export const useDataSync = create<DataSyncState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));