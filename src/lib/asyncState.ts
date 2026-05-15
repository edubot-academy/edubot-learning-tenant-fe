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
    setState((current) => {
      if (current.loading && !current.failed && current.failureCount === 0) return current;
      return {
        ...current,
        loading: true,
        failed: false,
        failureCount: 0,
      };
    });
  }, []);

  const succeed = useCallback((failureCount = 0) => {
    setState((current) => {
      const failed = failureCount > 0;
      if (!current.loading && current.failed === failed && current.failureCount === failureCount) return current;
      return {
        ...current,
        loading: false,
        failed,
        failureCount,
      };
    });
  }, []);

  const fail = useCallback((failureCount = 1) => {
    setState((current) => {
      if (!current.loading && current.failed && current.failureCount === failureCount) return current;
      return {
        ...current,
        loading: false,
        failed: true,
        failureCount,
      };
    });
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
