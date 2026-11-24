import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { buildRouter } from "@/router";
import "./styles.css";

const handleError = (error: Error) => {
  if (!(error instanceof ApiError) || error.status !== 401 || !auth.token) return;
  auth.signOut();
  queryClient.clear();
  router.navigate({ to: "/login", search: { redirect: router.state.location.href } });
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

const router = buildRouter({ queryClient, auth });

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root is missing");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
