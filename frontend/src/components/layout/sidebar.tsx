import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import {
  Bookmark,
  FilePlus2,
  FolderClosed,
  LayoutGrid,
  LogOut,
  type LucideIcon,
  NotebookPen,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import type { Messages } from "@/lib/messages";
import { useIsAdmin } from "@/lib/queries";

type NavItem = {
  to: "/" | "/topics" | "/saved" | "/notes" | "/topics/new";
  label: keyof Messages["nav"];
  icon: LucideIcon;
  matches: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "home", icon: LayoutGrid, matches: (path) => path === "/" },
  {
    to: "/topics",
    label: "topics",
    icon: FolderClosed,
    matches: (path) =>
      path === "/topics" || (path.startsWith("/topics/") && path !== "/topics/new"),
  },
  {
    to: "/saved",
    label: "saved",
    icon: Bookmark,
    matches: (path) => path.startsWith("/saved"),
  },
  {
    to: "/notes",
    label: "notes",
    icon: NotebookPen,
    matches: (path) => path.startsWith("/notes"),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    to: "/topics/new",
    label: "newTopic",
    icon: FilePlus2,
    matches: (path) => path === "/topics/new",
  },
];

const itemClass =
  "group relative grid size-14 place-items-center rounded-2xl transition-colors lg:size-[68px] [&_svg]:size-7 [&_svg]:stroke-[1.6]";

function Tooltip({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-10 ml-3 hidden rounded-lg bg-ink px-2.5 py-1 text-sm whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block">
      {children}
    </span>
  );
}

export function Sidebar() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();
  const pathname = useLocation({ select: (location) => location.pathname });
  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  const signOut = () => {
    auth.signOut();
    queryClient.clear();
    navigate({ to: "/login" });
  };

  return (
    <nav
      aria-label={t.nav.label}
      className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-3xl bg-white/90 p-2 shadow-lg shadow-ink/5 backdrop-blur lg:sticky lg:top-0 lg:inset-x-auto lg:bottom-auto lg:h-dvh lg:w-[116px] lg:flex-col lg:justify-start lg:gap-3 lg:rounded-none lg:bg-transparent lg:px-0 lg:py-28 lg:shadow-none lg:backdrop-blur-none"
    >
      {items.map(({ to, label, icon: Icon, matches }) => {
        const active = matches(pathname);
        return (
          <Link
            key={to}
            to={to}
            aria-label={t.nav[label]}
            aria-current={active ? "page" : undefined}
            activeOptions={{ exact: true, includeSearch: false }}
            className={clsx(
              itemClass,
              active
                ? "bg-orange text-white shadow-lg shadow-orange/25"
                : "text-ink hover:bg-white",
            )}
          >
            <Icon />
            <Tooltip>{t.nav[label]}</Tooltip>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={signOut}
        aria-label={t.nav.signOut}
        className={clsx(itemClass, "cursor-pointer text-ink hover:bg-white lg:mt-auto")}
      >
        <LogOut />
        <Tooltip>{t.nav.signOut}</Tooltip>
      </button>
    </nav>
  );
}
