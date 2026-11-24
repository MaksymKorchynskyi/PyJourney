import { useLocation } from "@tanstack/react-router";
import clsx from "clsx";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

type DropdownProps = {
  label: string;
  button: ReactNode;
  buttonClassName?: string;
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
};

export function Dropdown({
  label,
  button,
  buttonClassName,
  panelClassName,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={clsx("cursor-pointer", buttonClassName)}
      >
        {button}
      </button>
      <div
        id={panelId}
        role="dialog"
        aria-label={label}
        inert={!open}
        className={clsx(
          "absolute top-full right-0 z-50 mt-3 origin-top-right transition-[opacity,translate,scale] duration-200 ease-out-soft",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0",
          panelClassName,
        )}
      >
        {children(() => setOpen(false))}
      </div>
    </div>
  );
}
