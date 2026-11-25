import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";

export function Logo() {
  const t = useT();
  return (
    <Link
      to="/"
      className="rounded-lg text-[1.75rem] leading-none font-medium tracking-tight"
      aria-label={t.header.home}
    >
      <span className="text-orange">Py</span>
      <span>Journey</span>
    </Link>
  );
}
