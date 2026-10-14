import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client.
 * Defaults: 5 min stale time, 1 retry, no refetch on window focus in dev.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
