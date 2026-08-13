import type { Href } from 'expo-router';

type BackCapableRouter = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

/**
 * Back navigation that won't throw Expo Router's
 * "The action 'GO_BACK' was not handled by any navigator" warning
 * when the screen was opened with an empty history stack (common on
 * web refresh / deep link / replace).
 */
export function safeGoBack(
  router: BackCapableRouter,
  fallback: Href = '/(tabs)',
): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
