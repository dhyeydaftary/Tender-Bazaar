import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// QueryClient — shared across the app
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Data is considered fresh for 5 minutes before re-fetching */
      staleTime: 5 * 60 * 1000,
      /** Unused data is garbage-collected after 30 minutes */
      gcTime: 30 * 60 * 1000,
      /** Retry failed queries up to 2 times */
      retry: 2,
      /** Don't refetch when window regains focus (mobile doesn't have "window") */
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
