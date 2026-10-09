"use client";
import { Icon } from "@/components/Icon";

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${n} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name="star" size={22} className={i < n ? "text-accent" : "text-line-hi"} />
      ))}
    </span>
  );
}
