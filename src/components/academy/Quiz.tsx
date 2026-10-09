"use client";
import { useState } from "react";
import clsx from "clsx";
import { useAcademy } from "@/lib/academy/progress";
import type { QuizQ } from "@/lib/academy/types";
import { Prose } from "./Prose";

export function Quiz({ q, onAnswer }: { q: QuizQ; onAnswer?: (ok: boolean) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const record = useAcademy((s) => s.answer);
  const done = pick !== null;
  const ok = pick === q.answer;
  return (
    <div className="panel quiet space-y-3 p-4">
      <p className="font-semibold"><Prose text={q.q} /></p>
      <div className="grid gap-2">
        {q.options.map((o, i) => {
          const isAns = i === q.answer;
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              onClick={() => { setPick(i); record(q.id, i === q.answer); onAnswer?.(i === q.answer); }}
              className={clsx(
                "rounded border px-3 py-2 text-left text-sm transition-colors",
                !done && "border-line hover:border-accent hover:bg-panelhi",
                done && isAns && "border-ok bg-[color-mix(in_oklab,var(--ok)_14%,transparent)]",
                done && pick === i && !isAns && "border-danger bg-[color-mix(in_oklab,var(--danger)_14%,transparent)]",
                done && pick !== i && !isAns && "border-line opacity-60",
              )}
            >
              <Prose text={o} />
            </button>
          );
        })}
      </div>
      {done && (
        <p className={clsx("text-sm", ok ? "text-ok" : "text-danger")} role="status">
          <b>{ok ? "Correct. " : "Not quite. "}</b>
          <span className="text-dim"><Prose text={q.why} /></span>
        </p>
      )}
    </div>
  );
}
