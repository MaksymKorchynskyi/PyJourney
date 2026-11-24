import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/primitives";

export function PageSkeleton() {
  return (
    <div role="status" className="grid gap-6" aria-busy="true" aria-label="Loading">
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
  return (
    <div className="grid min-h-[50dvh] place-content-center justify-items-center gap-4 text-center">
      <p className="text-5xl font-medium tracking-tight">Something went wrong</p>
      <p className="max-w-md text-xl whitespace-pre-line text-muted">
        {error instanceof Error ? error.message : "Unexpected error"}
      </p>
      <button
        type="button"
        onClick={() => {
          reset();
          router.invalidate();
        }}
        className="h-14 cursor-pointer rounded-2xl bg-orange px-6 text-lg font-medium text-white hover:bg-orange-600"
      >
        Try again
      </button>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="grid min-h-[50dvh] place-content-center justify-items-center gap-4 p-6 text-center">
      <p className="text-8xl font-bold tracking-tighter text-orange">404</p>
      <p className="text-2xl">This page took a different path.</p>
      <Link
        to="/"
        className="inline-flex h-14 items-center rounded-2xl bg-lime px-6 text-lg font-medium"
      >
        Back to topics
      </Link>
    </div>
  );
}
