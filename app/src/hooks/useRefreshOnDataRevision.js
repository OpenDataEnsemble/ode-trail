import { useEffect, useRef } from 'react';

/**
 * Silent refresh when another device syncs, following gbmis.
 *
 * Formulus exposes the synced data revision via `getCurrentDataRevisionCount()`
 * (Synkronus `current_version`); we refresh only when the counter increases.
 * Triggers: `document.visibilitychange` (to visible) and `window` focus.
 * Errors are swallowed so offline or never-synced devices just wait.
 */
export function useRefreshOnDataRevision(formulusApi, refresh) {
  const lastRevisionRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const getRevision = formulusApi?.getCurrentDataRevisionCount;
    if (typeof getRevision !== 'function') return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (typeof refresh !== 'function') return;

    let mounted = true;

    const readRevision = async () => {
      try {
        const rev = await getRevision.call(formulusApi);
        if (!mounted) return;
        if (typeof rev === 'number' && Number.isFinite(rev) && rev >= 0) {
          lastRevisionRef.current = rev;
        }
      } catch {
        // Offline or an API that doesn't report revisions just waits.
      }
    };

    const maybeRefresh = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const rev = await getRevision.call(formulusApi);
        if (!mounted) return;
        const last = lastRevisionRef.current ?? rev;
        if (typeof rev === 'number' && rev > last) {
          lastRevisionRef.current = rev;
          await Promise.resolve(refresh());
        }
      } catch {
        // Errors are swallowed; the next focus/sync is another chance.
      } finally {
        inFlightRef.current = false;
      }
    };

    // Baseline so the first focus doesn't immediately refresh.
    void readRevision();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void maybeRefresh();
    };
    const onFocus = () => {
      if (document.visibilityState === 'visible') void maybeRefresh();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
  }, [formulusApi, refresh]);
}
