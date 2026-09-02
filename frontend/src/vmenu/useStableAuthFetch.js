import { useCallback, useRef } from "react";

/** Stable wrapper so Vmenu effects don't re-run on every App re-render (authFetch is recreated each time). */
export function useStableAuthFetch(authFetch) {
  const ref = useRef(authFetch);
  ref.current = authFetch;
  return useCallback((...args) => ref.current(...args), []);
}
