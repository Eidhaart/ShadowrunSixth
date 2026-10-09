"use client";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { RollBody } from "@/components/comms/RollBody";
import { callView, type CallView } from "@/lib/callState";
import { checkPool, describeCheck } from "@/lib/checks";
import { answerCall, declineCall, runnerName, withdrawCall } from "@/lib/actions";
import { useRunners } from "@/lib/store/characters";
import { useSettings } from "@/lib/store/settings";
import { useComms } from "@/lib/store/comms";
import type { WireMsg } from "@/lib/comms";

type Call = Extract<WireMsg, { type: "call" }>;

/** The player's side: pick who rolls, see the pool, accept. */
function Respond({ call }: { call: Call }) {
  const runnersMap = useRunners((s) => s.runners);
  const speakAs = useSettings((s) => s.speakAs);
  const runners = useMemo(() => Object.values(runnersMap), [runnersMap]);
  const [pick, setPick] = useState(speakAs && runnersMap[speakAs] ? speakAs : "");
  const [push, setPush] = useState(false);
  const [manual, setManual] = useState(6);
  const [busy, setBusy] = useState(false);
  const runnerId = pick || (runners.length ? runners[0].id : "");
  const runner = runnerId ? runnersMap[runnerId] : undefined;
  const info = runner ? checkPool(runner, call.check) : null;
  const canPush = !!runner && runner.edgeCurrent >= 4;
  const blocked = !!info?.blocked;
  const accept = () => {
    setBusy(true);
    answerCall(call.id, call.check, { runnerId: runner?.id, manualPool: manual, push: push && canPush });
  };
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {runners.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-xs text-dim">
            Roll as
            <select className="field mt-1" value={runnerId} onChange={(e) => { setPick(e.target.value); setPush(false); }}>
              {runners.map((r) => <option key={r.id} value={r.id}>{runnerName(r)}</option>)}
            </select>
          </label>
          <div className="font-mono text-sm">
            <span className="text-3xl font-bold tabular-nums text-accent">{info?.pool ?? 0}</span> <span className="text-dim">dice</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-dim">No runner saved on this device. Pool:</span>
          <button className="btn small" onClick={() => setManual((n) => Math.max(1, n - 1))} aria-label="Fewer dice"><Icon name="minus" size={14} /></button>
          <b className="w-6 text-center font-mono text-lg">{manual}</b>
          <button className="btn small" onClick={() => setManual((n) => Math.min(30, n + 1))} aria-label="More dice"><Icon name="plus" size={14} /></button>
        </div>
      )}
      {info && <p className="font-mono text-xs text-dim">{info.parts}</p>}
      {blocked && <p className="text-sm text-danger">This skill can&apos;t be rolled untrained. Decline, or ask the GM.</p>}
      {runner && (
        <label className={clsx("flex items-center gap-2 text-sm", !canPush && "opacity-50")}>
          <input type="checkbox" checked={push && canPush} disabled={!canPush} onChange={(e) => setPush(e.target.checked)} />
          <span>Push the Limit <span className="text-dim">· 4 Edge, exploding dice (you have {runner.edgeCurrent})</span></span>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn primary" onClick={accept} disabled={busy || blocked || (!!info && info.pool === 0)}>
          <Icon name="dice" size={16} /> Accept and roll
        </button>
        <button className="btn ghost" onClick={() => declineCall(call.id, runner ? runnerName(runner) : undefined)}>Decline</button>
      </div>
    </div>
  );
}

function Row({ handle, v, fresh, me }: { handle: string; v: CallView; fresh: Record<string, true>; me: boolean }) {
  const r = v.responses[handle];
  if (!r)
    return (
      <div className="flex items-center gap-2 py-1.5 font-mono text-xs text-dim">
        <span className={clsx("h-1.5 w-1.5 rounded-full", v.withdrawn ? "bg-faint" : "animate-pulse bg-accent")} />
        <span className={me ? "text-accent" : ""}>{handle}</span>
        <span>{v.withdrawn ? "called off" : "waiting…"}</span>
      </div>
    );
  if (r.kind === "decline")
    return (
      <div className="flex items-center gap-2 py-1.5 font-mono text-xs text-dim">
        <Icon name="x" size={12} /> <span>{r.msg.as ? `${r.msg.as} (${handle})` : handle}</span> <span>passed</span>
      </div>
    );
  const m = r.msg;
  return (
    <div className="msg-in rounded-sm border border-line bg-bg-2/60 p-3">
      <div className="mb-2 flex items-baseline gap-2 text-sm">
        <b className="text-cyan">{m.as ?? handle}</b>
        {m.as && <span className="text-xs text-dim">{handle}</span>}
        <span className="ml-auto font-mono text-xs text-faint">{m.pool} dice</span>
      </div>
      <RollBody m={m} animate={!!fresh[m.id]} compact />
    </div>
  );
}

export function CallCard({ call, mine }: { call: Call; mine: boolean }) {
  const messages = useComms((s) => s.messages);
  const users = useComms((s) => s.users);
  const fresh = useComms((s) => s.fresh);
  const handle = useComms((s) => s.handle);
  const role = useComms((s) => s.role);
  const v = useMemo(() => callView(messages, call, users), [messages, call, users]);
  const iAmTarget = role !== "gm" && v.targets.includes(handle);
  const open = iAmTarget && !v.responses[handle] && !v.withdrawn;
  const c = call.check;
  const done = v.targets.length > 0 && v.targets.every((t) => v.responses[t]);
  return (
    <div className={clsx("panel msg-in w-full max-w-2xl overflow-hidden", open && "call-live border-accent")}>
      <div className="flex items-center gap-2 border-b border-line bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent">
        <Icon name="bolt" size={14} />
        <span className="font-bold tracking-wide">{v.withdrawn ? "Check called off" : done ? "Check resolved" : "Check called"}</span>
        <span className="text-dim">GM {call.from}</span>
        {mine && !v.withdrawn && !done && (
          <button className="btn ghost small ml-auto" onClick={() => withdrawCall(call.id)}>Call off</button>
        )}
      </div>
      <div className={clsx("px-3 py-3", v.withdrawn && "opacity-60")}>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="text-xl font-semibold">{c.label}</h3>
          <span className="font-mono text-xs text-dim">{describeCheck(c)}</span>
        </div>
        {c.note && <p className="mt-1.5 border-l-2 border-accent/50 pl-3 italic text-dim">{c.note}</p>}
        <p className="mt-2 text-xs text-dim">
          {call.to.length ? `For ${call.to.join(", ")}` : "For everyone at the table"}
        </p>
        {open && <Respond call={call} />}
        {v.targets.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-line pt-2">
            {v.targets.map((t) => <Row key={t} handle={t} v={v} fresh={fresh} me={t === handle} />)}
          </div>
        )}
      </div>
    </div>
  );
}
