import { useCallback, useState } from 'react';

type AsyncLoadSnapshot = {
  loading: boolean;
  failed: boolean;
  failureCount: number;
  reloadToken: number;
};

export function useAsyncLoadState(initialLoading = false) {
  const [state, setState] = useState<AsyncLoadSnapshot>({
    loading: initialLoading,
    failed: false,
    failureCount: 0,
    reloadToken: 0,
  });

  const start = useCallback(() => {
    setState((current) => ({
      ...current,
      loading: true,
      failed: false,
      failureCount: 0,
    }));
  }, []);

  const succeed = useCallback((failureCount = 0) => {
    setState((current) => ({
      ...current,
      loading: false,
      failed: failureCount > 0,
      failureCount,
    }));
  }, []);

  const fail = useCallback((failureCount = 1) => {
    setState((current) => ({
      ...current,
      loading: false,
      failed: true,
      failureCount,
    }));
  }, []);

  const retry = useCallback(() => {
    setState((current) => ({
      ...current,
      failed: false,
      failureCount: 0,
      reloadToken: current.reloadToken + 1,
    }));
  }, []);

  return {
    ...state,
    start,
    succeed,
    fail,
    retry,
  };
}
