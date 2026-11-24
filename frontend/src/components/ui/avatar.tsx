import clsx from "clsx";

const PALETTE = [
  ["#FFD6C9", "#B8391B"],
  ["#D6E2FF", "#1F47B3"],
  ["#F1FAD0", "#4D6A00"],
  ["#FFE9B8", "#8A5A00"],
  ["#F4D9FF", "#7A2A99"],
  ["#D2F5EC", "#11705A"],
] as const;

function hash(value: string) {
  let result = 0;
  for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

export function initials(name: string) {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]?.[0]}${parts[1]?.[0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

type AvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-14 text-base",
};

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const [background, foreground] = PALETTE[hash(name) % PALETTE.length] ?? PALETTE[0];
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-grid shrink-0 place-items-center rounded-full font-bold tracking-tight select-none",
        SIZES[size],
        className,
      )}
      style={{ background, color: foreground }}
    >
      {initials(name)}
    </span>
  );
}

type AvatarStackProps = {
  items: { id: number; title: string }[];
  total: number;
  ring: string;
  size?: "md" | "lg";
  label: string;
};

export function AvatarStack({ items, total, ring, size = "md", label }: AvatarStackProps) {
  const visible = items.slice(0, 3);
  const rest = total - visible.length;
  return (
    <div role="img" aria-label={label} className="flex items-center">
      {visible.map((item) => (
        <Avatar
          key={item.id}
          name={item.title}
          size={size}
          className={clsx("-ml-3 ring-[3px] first:ml-0", ring)}
        />
      ))}
      {rest > 0 && (
        <span
          className={clsx(
            "-ml-3 inline-grid place-items-center rounded-full bg-white font-medium text-ink ring-[3px] first:ml-0",
            ring,
            size === "lg" ? "size-14 text-base" : "size-12 text-sm",
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
