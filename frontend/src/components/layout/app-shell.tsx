import { Outlet } from "@tanstack/react-router";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1 lg:py-3 lg:pr-3">
        <div className="min-h-full bg-surface px-4 pt-6 pb-32 sm:px-8 lg:rounded-[2.5rem] lg:px-10 lg:py-10">
          <Header />
          <main className="mt-8 lg:mt-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
