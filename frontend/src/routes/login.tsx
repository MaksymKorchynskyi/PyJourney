import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { type SubmitEvent, useState, useTransition } from "react";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";
import { auth } from "@/lib/auth";
import { login } from "@/lib/queries";

const route = getRouteApi("/public/login");

export type LoginSearch = { redirect?: string };

export function LoginPage() {
  const { redirect } = route.useSearch();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username")).trim();
    const password = String(data.get("password"));
    startTransition(async () => {
      try {
        const { access_token } = await login(username, password);
        auth.signIn(access_token, username);
        await router.invalidate();
        await router.navigate({ to: redirect?.startsWith("/") ? redirect : "/" });
      } catch (cause) {
        setError(
          cause instanceof Error && !cause.message.startsWith("Could not")
            ? cause.message
            : "Wrong username or password.",
        );
      }
    });
  };

  return (
    <>
      <h1 className="text-5xl font-medium tracking-tight">Welcome back</h1>
      <p className="mt-3 text-xl text-muted">Sign in to continue your Python journey.</p>
      <form onSubmit={onSubmit} className="mt-10 grid gap-5">
        <Field label="Username" name="username" autoComplete="username" required autoFocus />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-8 text-lg text-muted">
        New to PyJourney?{" "}
        <Link to="/register" search={{ redirect }} className="text-orange hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
