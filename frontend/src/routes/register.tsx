import { Link, useRouter } from "@tanstack/react-router";
import { type SubmitEvent, useState, useTransition } from "react";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";
import { auth } from "@/lib/auth";
import { login, register } from "@/lib/queries";

export function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const input = {
      username: data.username?.trim() ?? "",
      email: data.email?.trim() ?? "",
      first_name: data.first_name?.trim() ?? "",
      last_name: data.last_name?.trim() ?? "",
      password: data.password ?? "",
    };
    startTransition(async () => {
      try {
        await register(input);
        const { access_token } = await login(input.username, input.password);
        auth.signIn(access_token, input.username);
        await router.invalidate();
        await router.navigate({ to: "/" });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Registration failed.");
      }
    });
  };

  return (
    <>
      <h1 className="text-5xl font-medium tracking-tight">Create account</h1>
      <p className="mt-3 text-xl text-muted">Start learning Python in under a minute.</p>
      <form onSubmit={onSubmit} className="mt-10 grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" name="first_name" autoComplete="given-name" required />
          <Field label="Last name" name="last_name" autoComplete="family-name" required />
        </div>
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={50}
        />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-8 text-lg text-muted">
        Already have an account?{" "}
        <Link to="/login" className="text-orange hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
