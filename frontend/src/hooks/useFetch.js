import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Lightweight data fetching hook.
 *   const { data, loading, error, refetch } = useFetch(() => api.getCustomers(params), [param1]);
 */
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    // Reset data too, so a stale value never renders while the new fetch is in flight.
    setState({ data: null, loading: true, error: null });
    Promise.resolve(fetcherRef.current())
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((error) => active && setState({ data: null, loading: false, error }));

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, refetch };
}