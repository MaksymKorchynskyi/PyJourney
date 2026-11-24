import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type DeleteButtonProps = { label: string; onConfirm: () => void; className?: string };

export function DeleteButton({ label, onConfirm, className }: DeleteButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      aria-label={armed ? `Confirm deleting ${label}` : `Delete ${label}`}
      className={clsx(
        "relative z-10 inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl transition-colors",
        armed
          ? "bg-orange px-3 text-base font-medium text-white"
          : "w-10 text-muted hover:bg-orange/10 hover:text-orange",
        className,
      )}
    >
      <Trash2 className="size-5" />
      {armed && "Delete?"}
    </button>
  );
}
