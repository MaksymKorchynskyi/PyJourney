import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Badge({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "glass" }) {
  return (
    <span
      className={clsx(
        "inline-flex h-9 items-center rounded-xl px-3 text-[0.95rem] font-medium",
        tone === "ink" ? "bg-ink text-white" : "bg-white/15 text-white/90",
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ value, track }: { value: number; track: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={clsx("h-2.5 overflow-hidden rounded-full", track)}
    >
      <div
        className="h-full rounded-full bg-white transition-[width] duration-700 ease-out-soft"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function Chip({
  active,
  className,
  ...props
}: ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={clsx(
        "h-12 shrink-0 cursor-pointer rounded-xl border-2 px-4 text-lg font-medium transition-colors",
        active
          ? "border-blue bg-blue text-white"
          : "border-blue/70 text-blue hover:border-blue hover:bg-blue/5",
        className,
      )}
      {...props}
    />
  );
}

export function Pill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-orange px-4 text-base font-medium text-white/95 [&_svg]:size-5">
      {icon}
      {children}
    </span>
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "lime" | "ghost" | "danger";
};

const BUTTON_VARIANTS = {
  primary: "bg-orange text-white hover:bg-orange-600",
  lime: "bg-lime text-ink hover:bg-lime-600",
  ghost: "bg-white text-ink ring-1 ring-mist hover:bg-panel",
  danger: "bg-transparent text-orange hover:bg-orange/10",
};

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl px-6 text-lg font-medium transition-[background-color,scale] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export const inputClass = (surface: "panel" | "white" = "panel") =>
  clsx(
    "rounded-2xl px-5 text-lg outline-none ring-blue transition-shadow placeholder:text-muted/70 focus:ring-2 user-invalid:ring-2 user-invalid:ring-orange",
    surface === "panel" ? "bg-panel" : "bg-white",
  );

type FieldProps = ComponentProps<"input"> & { label: string; surface?: "panel" | "white" };

export function Field({ label, className, surface, ...props }: FieldProps) {
  return (
    <label className={clsx("grid gap-2", className)}>
      <span className="text-sm font-medium text-muted">{label}</span>
      <input className={clsx("h-14", inputClass(surface))} {...props} />
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-card bg-mist/70", className)} />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-orange/10 px-4 py-3 whitespace-pre-line text-orange">
      {children}
    </p>
  );
}
