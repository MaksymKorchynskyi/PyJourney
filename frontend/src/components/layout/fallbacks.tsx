import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n";

export function PageSkeleton() {
  const t = useT();
  return (
    <div role="status" className="grid gap-6" aria-busy="true" aria-label={t.fallback.loading}>
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-86" />
        <Skeleton className="hidden h-86 md:block" />
        <Skeleton className="hidden h-86 xl:block" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export function PageError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const t = useT();
  return (
    <div className="grid min-h-[50dvh] place-content-center justify-items-center gap-4 text-center">
      <p className="text-5xl font-medium tracking-tight">{t.fallback.errorTitle}</p>
      <p className="max-w-md text-xl whitespace-pre-line text-muted">
        {error instanceof Error ? error.message : t.fallback.unexpected}
      </p>
      <button
        type="button"
        onClick={() => {
          reset();
          router.invalidate();
        }}
        className="h-14 cursor-pointer rounded-2xl bg-orange px-6 text-lg font-medium text-white hover:bg-orange-600"
      >
        {t.fallback.retry}
      </button>
    </div>
  );
}

export function NotFound() {
  const t = useT();
  return (
    <div className="grid min-h-[50dvh] place-content-center justify-items-center gap-4 p-6 text-center">
      <p className="text-8xl font-bold tracking-tighter text-orange">404</p>
      <p className="text-2xl">{t.fallback.notFound}</p>
      <Link
        to="/"
        className="inline-flex h-14 items-center rounded-2xl bg-lime px-6 text-lg font-medium"
      >
        {t.fallback.back}
      </Link>
    </div>
  );
}
