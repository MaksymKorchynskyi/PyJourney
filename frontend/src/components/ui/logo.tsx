import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link
      to="/"
      className="rounded-lg text-[1.75rem] leading-none font-medium tracking-tight"
      aria-label="PyJourney home"
    >
      <span className="text-orange">Py</span>
      <span>Journey</span>
    </Link>
  );
}
