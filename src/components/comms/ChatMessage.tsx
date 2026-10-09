"use client";
import clsx from "clsx";
import { RollBody } from "@/components/comms/RollBody";
import { CallCard } from "@/components/comms/CallCard";
import { useComms } from "@/lib/store/comms";
import type { WireMsg } from "@/lib/comms";

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Who({ m, mine }: { m: Extract<WireMsg, { type: "chat" | "roll" | "init" }>; mine: boolean }) {
  const as = "as" in m ? m.as : undefined;
  const gm = "gm" in m && m.gm;
  return (
    <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs text-dim">
      <b className={clsx("text-sm font-semibold", gm ? "text-astral" : mine ? "text-accent" : "text-cyan")}>{as ?? m.from}</b>
      {as && <span>{m.from}</span>}
      {gm && <span className="chip !py-0">GM</span>}
      {m.source === "foundry" && <span className="chip !py-0">Foundry</span>}
      <span className="ml-auto font-mono text-faint">{time(m.at)}</span>
    </div>
  );
}

export function ChatMessage({ m, mine, hasCall }: { m: WireMsg; mine: boolean; hasCall: (id: string) => boolean }) {
  const fresh = useComms((s) => (m.id in s.fresh));
  if (m.type === "system")
    return <div className="py-1 text-center font-mono text-xs text-dim">— {m.text} · {time(m.at)} —</div>;
  if (m.type === "withdraw" || m.type === "decline") return null;
  if (m.type === "call") return <div id={`msg-${m.id}`} className="flex justify-center"><CallCard call={m} mine={mine} /></div>;
  // answers live inside their call card
  if (m.type === "roll" && m.callId && hasCall(m.callId)) return null;

  if (m.type === "chat") {
    if (m.ooc)
      return (
        <div className={clsx("msg-in flex", mine && "justify-end")}>
          <p className="max-w-[85%] break-words rounded-sm border border-dashed border-line px-3 py-1.5 text-sm text-dim">
            <span className="mr-2 font-mono text-xs text-faint">ooc</span><b className="mr-2 font-semibold">{m.from}</b>{m.text}
          </p>
        </div>
      );
    const narrator = m.gm && m.as;
    return (
      <div className={clsx("msg-in flex", mine && !narrator && "justify-end", narrator && "justify-center")}>
        <div
          className={clsx(
            "panel max-w-[92%] px-3 py-2 md:max-w-[75%]",
            narrator && "w-full max-w-2xl border-astral/50 bg-astral/5",
            !narrator && mine && "border-accent/50",
          )}
        >
          <Who m={m} mine={mine} />
          <p className={clsx("whitespace-pre-wrap break-words", narrator && "italic")}>{m.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("msg-in flex", mine && "justify-end")}>
      <div className={clsx("panel max-w-[92%] px-3 py-2 md:max-w-[75%]", mine && "border-accent/50")}>
        <Who m={m} mine={mine} />
        {m.type === "roll" && (
          <div>
            <p className="mb-2 font-semibold">{m.label}</p>
            <RollBody m={m} animate={fresh} compact />
          </div>
        )}
        {m.type === "init" && (
          <div className="font-mono">
            <span className="font-sans font-semibold">{m.label}</span> — {m.base} + [{m.dice.join(", ")}] = <b className="text-xl text-accent">{m.score}</b>
          </div>
        )}
      </div>
    </div>
  );
}
