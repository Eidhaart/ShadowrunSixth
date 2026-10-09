import clsx from "clsx";
import { isPortrait } from "@/lib/portrait";

/** A runner's portrait, or their initials on a hatched plate when none is set. */
export function Portrait({ src, name, className }: { src?: string; name: string; className?: string }) {
  const ok = isPortrait(src);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <div className={clsx("portrait relative shrink-0 overflow-hidden border border-line-hi bg-bg2", className)} style={{ aspectRatio: "4 / 5" }}>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Portrait of ${name || "runner"}`} className="size-full object-cover" draggable={false} />
      ) : (
        <div className="portrait-empty grid size-full place-items-center font-display font-bold text-faint" aria-hidden>{initials}</div>
      )}
    </div>
  );
}
