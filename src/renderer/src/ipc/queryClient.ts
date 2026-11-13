import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // IPC failures are deterministic (missing PAT, bad credentials, offline);
      // retrying just delays the error the user needs to see.
      retry: false,
      // Desktop windows lose and regain focus constantly — refetching on every
      // focus would hammer the Azure API for data that changes by the hour.
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000
    }
  }
})
