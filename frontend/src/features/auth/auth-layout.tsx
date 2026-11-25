import { Outlet } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export function AuthLayout() {
  const t = useT();
  return (
    <div className="grid min-h-dvh p-3 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col rounded-[2.5rem] bg-surface px-6 py-8 sm:px-12 lg:px-16 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <LanguageSwitch />
        </div>
        <main className="my-auto w-full max-w-md self-center py-12 animate-rise">
          <Outlet />
        </main>
      </div>
      <aside
        aria-hidden
        className="relative hidden overflow-hidden rounded-[2.5rem] bg-blue p-12 text-white lg:flex lg:flex-col"
      >
        <p className="text-xl text-white/80">{t.auth.tagline}</p>
        <h2 className="mt-4 max-w-lg text-6xl leading-[1.05] font-medium tracking-tight">
          {t.auth.headline}
        </h2>
        <div className="relative mt-auto h-96">
          <div className="absolute right-28 bottom-36 w-80 rotate-[-7deg] rounded-card bg-orange p-7 shadow-2xl">
            <div className="flex justify-between">
              <Badge>{t.auth.sampleBadge}</Badge>
              <Bookmark className="size-8" strokeWidth={1.6} fill="currentColor" />
            </div>
            <p className="mt-5 text-2xl font-medium">{t.auth.sampleTitle}</p>
            <div className="mt-6 h-2.5 rounded-full bg-white/25">
              <div className="h-full w-3/5 rounded-full bg-white" />
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-96 rotate-[5deg] overflow-hidden rounded-card bg-white text-ink shadow-2xl">
            <div className="flex items-center justify-between border-mist border-b bg-surface px-6 py-3">
              <span className="font-mono text-sm font-medium text-blue">python</span>
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-mist" />
                <span className="size-2.5 rounded-full bg-mist" />
                <span className="size-2.5 rounded-full bg-mist" />
              </span>
            </div>
            <pre className="px-6 py-5 font-mono text-[0.95rem] leading-7 text-[#393a34]">
              <span className="text-[#998418]">@</span>
              <span className="text-[#59873a]">timer</span>
              {"\n"}
              <span className="text-[#1e754f]">def</span>{" "}
              <span className="text-[#59873a]">train</span>
              {"(epochs):\n    "}
              <span className="text-[#1e754f]">with</span>{" "}
              <span className="text-[#59873a]">open</span>
              {"("}
              <span className="text-[#b56959]">"log.txt"</span>
              {") "}
              <span className="text-[#1e754f]">as</span>
              {" log:\n        ...\n"}
            </pre>
          </div>
          <div className="absolute bottom-16 left-0 size-40 rounded-full bg-lime" />
        </div>
      </aside>
    </div>
  );
}
