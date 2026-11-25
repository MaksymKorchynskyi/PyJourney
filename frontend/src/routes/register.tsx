import { Link, useRouter } from "@tanstack/react-router";
import { type SubmitEvent, useState, useTransition } from "react";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";
import { auth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { login, register } from "@/lib/queries";

export function RegisterPage() {
  const router = useRouter();
  const t = useT();
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
        setError(cause instanceof Error ? cause.message : t.register.failed);
      }
    });
  };

  return (
    <>
      <h1 className="text-5xl font-medium tracking-tight">{t.register.title}</h1>
      <p className="mt-3 text-xl text-muted">{t.register.subtitle}</p>
      <form onSubmit={onSubmit} className="mt-10 grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t.register.firstName}
            name="first_name"
            autoComplete="given-name"
            required
          />
          <Field label={t.register.lastName} name="last_name" autoComplete="family-name" required />
        </div>
        <Field
          label={t.register.username}
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={50}
        />
        <Field label={t.register.email} name="email" type="email" autoComplete="email" required />
        <Field
          label={t.register.password}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? t.register.submitting : t.register.submit}
        </Button>
      </form>
      <p className="mt-8 text-lg text-muted">
        {t.register.haveAccount}{" "}
        <Link to="/login" className="text-orange hover:underline">
          {t.register.signIn}
        </Link>
      </p>
    </>
  );
}
