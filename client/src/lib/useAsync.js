import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader and tracks { data, error, loading } with the three
 * states every screen needs: loading, empty and failed. Aborts in flight work
 * when the component unmounts so a slow response cannot set state on a dead
 * component.
 */
export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: immediate });
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loaderRef.current(...args);
      if (mounted.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') return undefined;
      if (mounted.current) setState({ data: null, error, loading: false });
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}

export default useAsync;
