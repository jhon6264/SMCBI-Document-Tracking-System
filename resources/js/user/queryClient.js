import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export const userQueryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            gcTime: THIRTY_MINUTES_MS,
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

export const userQueryPersister =
    typeof window !== "undefined"
        ? createSyncStoragePersister({
              storage: window.sessionStorage,
              key: "doc_track_query_cache_v1",
          })
        : null;

export const userQueryPersistMaxAgeMs = ONE_HOUR_MS;
