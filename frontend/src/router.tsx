import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { NotFound, PageError, PageSkeleton } from "@/components/layout/fallbacks";
import { AuthLayout } from "@/features/auth/auth-layout";
import { ApiError } from "@/lib/api";
import type { Auth } from "@/lib/auth";
import { categoriesQuery, myNotesQuery, roleQuery, topicQuery, topicsQuery } from "@/lib/queries";
import { FILTERS } from "@/lib/topic";
import { HomePage, type HomeSearch } from "@/routes/home";
import { LoginPage, type LoginSearch } from "@/routes/login";
import type { NotesSearch } from "@/routes/notes";
import { RegisterPage } from "@/routes/register";
import { SavedPage, type SavedSearch } from "@/routes/saved";
import { TopicsPage, type TopicsSearch } from "@/routes/topics";

type RouterContext = { queryClient: QueryClient; auth: Auth };

const text = (value: unknown) =>
  typeof value === "string" && value.length
    ? value
    : typeof value === "number"
      ? String(value)
      : undefined;

const loadCatalog = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.ensureQueryData(topicsQuery),
    queryClient.ensureQueryData(categoriesQuery),
    queryClient.ensureQueryData(myNotesQuery),
  ]);

async function loadTopic(queryClient: QueryClient, topicId: string) {
  const id = Number(topicId);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  try {
    return await queryClient.ensureQueryData(topicQuery(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound();
    throw error;
  }
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
});

const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public",
  component: AuthLayout,
  beforeLoad: ({ context }) => {
    if (context.auth.token) throw redirect({ to: "/" });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "login",
  validateSearch: (search): LoginSearch => ({ redirect: text(search.redirect) }),
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "register",
  validateSearch: (search): LoginSearch => ({ redirect: text(search.redirect) }),
  component: RegisterPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
  beforeLoad: ({ context, location }) => {
    if (!context.auth.token) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  pendingComponent: PageSkeleton,
  errorComponent: PageError,
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  validateSearch: (search): HomeSearch => ({ q: text(search.q) }),
  loader: ({ context: { queryClient } }) => loadCatalog(queryClient),
  component: HomePage,
});

const topicsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "topics",
  validateSearch: (search): TopicsSearch => ({
    q: text(search.q),
    show: FILTERS.find((filter) => filter === search.show),
    category: text(search.category),
  }),
  loader: ({ context: { queryClient } }) => loadCatalog(queryClient),
  component: TopicsPage,
});

const requireAdmin = async ({ context }: { context: RouterContext }) => {
  const role = await context.queryClient.ensureQueryData(roleQuery);
  if (role !== "admin") throw redirect({ to: "/topics" });
};

const newTopicRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "topics/new",
  beforeLoad: requireAdmin,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(categoriesQuery),
  component: lazyRouteComponent(() => import("@/routes/topic-editor"), "NewTopicPage"),
});

const editTopicRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "topics/$topicId/edit",
  beforeLoad: requireAdmin,
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([
      queryClient.ensureQueryData(categoriesQuery),
      loadTopic(queryClient, params.topicId),
    ]),
  component: lazyRouteComponent(() => import("@/routes/topic-editor"), "EditTopicPage"),
});

const topicRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "topics/$topicId",
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([loadCatalog(queryClient), loadTopic(queryClient, params.topicId)]),
  component: lazyRouteComponent(() => import("@/routes/topic"), "TopicPage"),
});

const savedRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "saved",
  validateSearch: (search): SavedSearch => ({ q: text(search.q) }),
  loader: ({ context: { queryClient } }) => loadCatalog(queryClient),
  component: SavedPage,
});

const notesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "notes",
  validateSearch: (search): NotesSearch => ({ q: text(search.q) }),
  loader: ({ context: { queryClient } }) => loadCatalog(queryClient),
  component: lazyRouteComponent(() => import("@/routes/notes"), "NotesPage"),
});

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([loginRoute, registerRoute]),
  appRoute.addChildren([
    homeRoute,
    topicsRoute,
    newTopicRoute,
    topicRoute,
    editTopicRoute,
    savedRoute,
    notesRoute,
  ]),
]);

export function buildRouter(context: RouterContext) {
  return createRouter({
    routeTree,
    context,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 300,
    scrollRestoration: true,
    defaultStructuralSharing: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof buildRouter>;
  }
}
