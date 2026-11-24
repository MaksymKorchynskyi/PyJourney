import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { Bell, Search } from "lucide-react";
import { useState } from "react";
import { Dropdown } from "@/components/ui/dropdown";
import { Logo } from "@/components/ui/logo";
import { ProfileMenu } from "@/features/profile/profile-menu";

function SearchBox() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const current = useSearch({ strict: false, select: (search) => search.q ?? "" });
  const [draft, setDraft] = useState(current);
  const [synced, setSynced] = useState(current);
  const target =
    (["/notes", "/topics", "/saved"] as const).find((path) => path === pathname) ?? "/";

  if (current !== synced) {
    setSynced(current);
    setDraft(current);
  }

  const apply = (value: string, replace: boolean) =>
    navigate({
      to: target,
      search: (prev) => ({ ...prev, q: value || undefined }),
      replace,
    });

  return (
    <search className="order-last w-full md:order-0 md:ml-auto md:w-100">
      <form
        className="flex h-14 items-center rounded-full bg-panel py-1.5 pr-1.5 pl-6 ring-blue transition-shadow focus-within:ring-2"
        onSubmit={(event) => {
          event.preventDefault();
          apply(draft.trim(), false);
        }}
      >
        <input
          type="search"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (pathname === target) apply(event.target.value, true);
          }}
          placeholder="Search"
          aria-label={
            target === "/notes"
              ? "Search notes"
              : target === "/saved"
                ? "Search saved topics"
                : "Search topics"
          }
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          aria-label="Search"
          className="grid size-11 cursor-pointer place-items-center rounded-full bg-orange text-white shadow-md shadow-orange/30 transition-transform hover:scale-105"
        >
          <Search className="size-5" strokeWidth={2.4} />
        </button>
      </form>
    </search>
  );
}

function Notifications() {
  return (
    <Dropdown
      label="Notifications"
      button={<Bell className="size-6" strokeWidth={1.6} />}
      buttonClassName="grid size-12 place-items-center rounded-full bg-panel transition-colors hover:bg-mist aria-expanded:bg-mist"
      panelClassName="w-72 rounded-3xl bg-white p-5 shadow-xl shadow-ink/10"
    >
      {() => (
        <>
          <p className="font-medium">Notifications</p>
          <p className="mt-1 text-muted">You're all caught up.</p>
        </>
      )}
    </Dropdown>
  );
}

export function Header() {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <Logo />
      <SearchBox />
      <div className="ml-auto flex items-center gap-4 md:ml-0">
        <Notifications />
        <ProfileMenu />
      </div>
    </header>
  );
}
