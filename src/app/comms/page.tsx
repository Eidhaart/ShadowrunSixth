"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { DieFace } from "@/components/Dice";
import { useComms } from "@/lib/store/comms";
import { useSettings } from "@/lib/store/settings";
import { whoAmI } from "@/lib/actions";
import type { WireMsg } from "@/lib/comms";

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Msg({ m, mine }: { m: WireMsg; mine: boolean }) {
  if (m.type === "system")
    return <div className="py-1 text-center font-mono text-xs text-dim">— {m.text} · {time(m.at)} —</div>;
  const head = (
    <div className="mb-1 flex items-center gap-2 text-xs text-dim">
      <b className={clsx("font-semibold", mine ? "text-accent" : "text-cyan")}>{m.from}</b>
      {m.source === "foundry" && <span className="chip">Foundry</span>}
      <span className="font-mono">{time(m.at)}</span>
    </div>
  );
  return (
    <div className={clsx("flex", mine && "justify-end")}>
      <div className={clsx("panel max-w-[92%] px-3 py-2 md:max-w-[75%]", mine && "border-accent/50")}>
        {head}
        {m.type === "chat" && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
        {m.type === "roll" && (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold">{m.label}</span>
              <span className="font-mono text-sm text-dim">pool {m.pool}{m.edgeSpent ? ` · Edge ${m.edgeSpent}` : ""}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.dice.map((d, i) => (
                <DieFace key={i} value={d.v} size="2rem" state={{ hit: d.hit, one: d.v === 1, boom: d.boom, ghost: d.gone }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm">
              <b className="text-lg text-accent">{m.hits}</b> hits
              {m.threshold !== undefined && <span className={m.success ? "text-ok" : "text-danger"}>{m.success ? "success" : "failed"} (needs {m.threshold})</span>}
              {m.critGlitch ? <span className="text-danger">CRITICAL GLITCH</span> : m.glitch ? <span className="text-accent">glitch</span> : null}
            </div>
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

export default function CommsPage() {
  const c = useComms();
  const s = useSettings();
  const [text, setText] = useState("");
  const [url, setUrl] = useState(s.chatUrl);
  const [room, setRoom] = useState(s.room || "lobby");
  const [handle, setHandle] = useState(s.handle);
  useEffect(() => {
    // persisted settings arrive just after hydration
    /* eslint-disable react-hooks/set-state-in-effect */
    setUrl(s.chatUrl);
    setRoom(s.room || "lobby");
    setHandle(s.handle);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [s.chatUrl, s.room, s.handle]);
  const end = useRef<HTMLDivElement>(null);
  const me = whoAmI("");

  useEffect(() => { c.markRead(); }, [c.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [c.messages.length]);

  const join = () => {
    s.set({ chatUrl: url.trim(), room: room.trim() || "lobby", handle: handle.trim() });
    c.connect({ url: url.trim(), room: room.trim() || "lobby", handle: handle.trim() || "runner" });
  };
  const send = () => {
    const t = text.trim();
    if (!t) return;
    c.send({ type: "chat", id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, from: handle.trim() || me || "runner", text: t, at: Date.now(), source: "deck" });
    setText("");
  };
  const live = c.status === "online" || c.status === "local";

  return (
    <Page wide title="Comms" kicker="Table chat. Rolls and initiative you make anywhere in the deck can be shared here, and the Foundry bridge relays them both ways.">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <section className="panel space-y-3 p-4">
            <div>
              <label className="mb-1 block text-sm" htmlFor="h">Handle</label>
              <input id="h" className="field" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Name shown at the table" />
            </div>
            <div>
              <label className="mb-1 block text-sm" htmlFor="r">Room</label>
              <input id="r" className="field" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="lobby" />
            </div>
            <div>
              <label className="mb-1 block text-sm" htmlFor="u">Relay address</label>
              <input id="u" className="field font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ws://192.168.1.20:8787" />
              <p className="mt-1 text-xs text-dim">Leave empty to chat between tabs on this device. Run <code>npm run chat</code> on the GM&apos;s machine for a shared table.</p>
            </div>
            <div className="flex gap-2">
              <button className="btn primary" onClick={join}><Icon name="link" size={16} /> {live ? "Rejoin" : "Jack in"}</button>
              {c.status !== "off" && <button className="btn ghost" onClick={c.disconnect}>Leave</button>}
            </div>
            <p className="font-mono text-xs text-dim">
              status: {c.status === "online" ? `online · room ${c.room}` : c.status === "local" ? "local tabs only" : c.status === "connecting" ? "linking…" : "offline"}
            </p>
          </section>
          <section className="panel p-4">
            <h2 className="mb-2 text-lg font-semibold">Present ({c.users.length})</h2>
            {c.users.length === 0 ? <p className="text-sm text-dim">Nobody yet.</p> : (
              <ul className="space-y-1">
                {c.users.map((u, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span>{u.handle}</span><span className="chip">{u.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="panel flex h-[70vh] min-h-[28rem] flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto p-3 md:p-4" aria-live="polite">
            {c.messages.length === 0 && (
              <p className="m-auto max-w-sm text-center text-dim">{live ? "Quiet line. Say something or roll some dice." : "You are offline. Pick a handle and room, then jack in."}</p>
            )}
            {c.messages.map((m) => <Msg key={m.id} m={m} mine={m.type !== "system" && m.from === (c.handle || me)} />)}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input className="field flex-1" disabled={!live} value={text} onChange={(e) => setText(e.target.value)} placeholder={live ? "Message the table" : "Jack in to chat"} aria-label="Message" />
            <button className="btn primary" disabled={!live || !text.trim()}>Send</button>
          </form>
        </section>
      </div>
    </Page>
  );
}
