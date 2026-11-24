import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { ChevronDown, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown } from "@/components/ui/dropdown";
import { auth, useSession } from "@/lib/auth";
import { useIsAdmin, useMe } from "@/lib/queries";

function RoleBadge({ admin, size = "sm" }: { admin: boolean; size?: "sm" | "md" }) {
  return (
    <span
      className={clsx(
        "rounded-md font-bold tracking-wide uppercase",
        admin ? "bg-lime text-ink" : "bg-blue/10 text-blue",
        size === "sm" ? "px-1.5 py-px text-xs" : "px-2 py-0.5 text-sm",
      )}
    >
      {admin ? "Admin" : "Student"}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid h-13 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 border-white border-t-2 px-6">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right font-medium">{children}</dd>
    </div>
  );
}

const Placeholder = ({ loading }: { loading: boolean }) =>
  loading ? (
    <span className="inline-block h-4 w-24 animate-pulse rounded-md bg-mist align-middle" />
  ) : (
    <span className="font-normal text-muted">—</span>
  );

export function ProfileMenu() {
  const session = useSession();
  const { data: me, isPending } = useMe();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const username = me?.username ?? session?.username ?? "Guest";
  const fullName = [me?.first_name, me?.last_name].filter(Boolean).join(" ");
  const displayName = fullName || username;
  const field = (text: string | undefined) => text || <Placeholder loading={isPending} />;

  const signOut = () => {
    auth.signOut();
    queryClient.clear();
    navigate({ to: "/login" });
  };

  return (
    <Dropdown
      label={`Profile of ${displayName}`}
      buttonClassName="group flex items-center gap-3 rounded-full py-1 pr-3 pl-1 text-left transition-colors hover:bg-panel aria-expanded:bg-panel"
      panelClassName="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] bg-panel text-ink shadow-2xl shadow-ink/15"
      button={
        <>
          <Avatar name={displayName} />
          <span className="hidden leading-tight sm:block">
            <span className="block text-lg font-medium">{displayName}</span>
            <span className="flex items-center gap-2 text-muted">
              @{username.toLowerCase()}
              {isAdmin && <RoleBadge admin />}
            </span>
          </span>
          <ChevronDown
            className="hidden size-5 text-muted transition-transform duration-200 group-aria-expanded:rotate-180 sm:block"
            strokeWidth={1.8}
          />
        </>
      }
    >
      {() => (
        <>
          <div className="flex items-center gap-4 bg-white px-6 py-6">
            <Avatar name={displayName} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-xl font-medium">{displayName}</p>
              <p className="truncate text-muted">@{username.toLowerCase()}</p>
            </div>
          </div>

          <dl>
            <Row label="First name">{field(me?.first_name)}</Row>
            <Row label="Last name">{field(me?.last_name)}</Row>
            <Row label="Email">
              {me?.email ? (
                <a href={`mailto:${me.email}`} className="hover:text-orange" title={me.email}>
                  {me.email}
                </a>
              ) : (
                field(undefined)
              )}
            </Row>
            <Row label="Role">
              <RoleBadge admin={isAdmin} size="md" />
            </Row>
          </dl>

          <div className="border-white border-t-2 p-2">
            <button
              type="button"
              onClick={signOut}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left font-medium text-orange transition-colors hover:bg-white"
            >
              <LogOut className="size-5" />
              Sign out
            </button>
          </div>
        </>
      )}
    </Dropdown>
  );
}
