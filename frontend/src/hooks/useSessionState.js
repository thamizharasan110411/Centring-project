import { useEffect, useState } from 'react';

/**
 * useState that survives a page refresh via sessionStorage.
 * - Values are JSON-serialized per key (prefix keys per page, e.g. 'rf:assets').
 * - sessionStorage is per-tab and non-sensitive (filters/tabs/page numbers),
 *   so this is a safe place for transient UI state — never credentials.
 * - Silently falls back to the initial value if storage is unavailable.
 */
export function useSessionState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw === null) return typeof initial === 'function' ? initial() : initial;
      return JSON.parse(raw);
    } catch {
      return typeof initial === 'function' ? initial() : initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode / quota) — keep in-memory state.
    }
  }, [key, state]);

  return [state, setState];
}