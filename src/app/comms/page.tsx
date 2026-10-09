"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Page } from "@/components/Page";
import { Icon } from "@/components/Icon";
import { ChatMessage } from "@/components/comms/ChatMessage";
import { CallComposer } from "@/components/comms/CallComposer";
import { useComms } from "@/lib/store/comms";
import { useSettings } from "@/lib/store/settings";
import { useRunners } from "@/lib/store/characters";
import { runnerName, sendChat, whoAmI } from "@/lib/actions";
import { pendingFor } from "@/lib/callState";
import { describeCheck } from "@/lib/checks";

export default function CommsPage() {
  const c = useComms();
  const s = useSettings();
  const runnersMap = useRunners((r) => r.runners);
  const runners = useMemo(() => Object.values(runnersMap), [runnersMap]);
  const [text, setText] = useState("");
  const [ooc, setOoc] = useState(false);
  const [composer, setComposer] = useState(false);
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
  const me = c.handle || whoAmI("");
  const isGm = c.role === "gm";

  useEffect(() => { c.markRead(); }, [c.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [c.messages.length]);

  const callIds = useMemo(() => new Set(c.messages.filter((m) => m.type === "call").map((m) => m.id)), [c.messages]);
  const hasCall = (id: string) => callIds.has(id);
  const pending = useMemo(() => pendingFor(c.messages, me, c.role), [c.messages, me, c.role]);

  const join = () => {
    const h = handle.trim();
    const r = room.trim() || "lobby";
    s.set({ chatUrl: url.trim(), room: r, handle: h });
    c.connect({ url: url.trim(), room: r, handle: h || "runner", role: s.role });
  };
  const setRole = (role: "gm" | "player") => {
    s.set({ role });
    if (c.status !== "off") c.connect({ url: c.url, room: c.room, handle: c.handle || "runner", role });
  };
  const send = () => {
    const t = text.trim();
    if (!t) return;
    sendChat(t, ooc);
    setText("");
  };
  const live = c.status === "online" || c.status === "local";
  const voiceLabel = ooc ? "Out of character" : s.speakAs === "npc" ? s.npcName.trim() || "Narrator" : runnersMap[s.speakAs] ? runnerName(runnersMap[s.speakAs]) : "Yourself";

  return (
    <Page wide title="Comms" kicker="Table chat. Speak as your runner, answer the GM's checks, and share rolls from anywhere in the deck. The Foundry bridge relays chat and rolls both ways.">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className={clsx("space-y-4 lg:order-1", live ? "order-2" : "order-1")}>
          <section className="panel space-y-3 p-4">
            <div>
              <label className="mb-1 block text-sm" htmlFor="h">Handle</label>
              <input id="h" className="field" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Your name at the table" />
            </div>
            <div>
              <label className="mb-1 block text-sm" htmlFor="r">Room</label>
              <input id="r" className="field" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="lobby" />
            </div>
            <div>
              <span className="mb-1 block text-sm">Seat</span>
              <div className="grid grid-cols-2 gap-2">
                <button className={clsx("btn small", s.role === "player" && "primary")} onClick={() => setRole("player")}>Player</button>
                <button className={clsx("btn small", s.role === "gm" && "primary")} onClick={() => setRole("gm")}>Game master</button>
              </div>
              <p className="mt-1 text-xs text-dim">The GM can call checks that players accept with one tap. One GM per room.</p>
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-dim">Relay address</summary>
              <input id="u" className="field mt-2 font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="wss://sixthdeck-relay.onrender.com" aria-label="Relay address" />
              <p className="mt-1 text-xs text-dim">Leave empty to chat between tabs on this device. Run <code>npm run chat</code> for your own relay.</p>
            </details>
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
                    <span className={u.role === "gm" ? "text-astral" : ""}>{u.handle}</span>
                    <span className="chip">{u.role === "gm" ? "GM" : u.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className={clsx("panel flex h-[80vh] min-h-[30rem] flex-col lg:order-2 lg:h-[75vh] max-md:h-[calc(100dvh-19rem)] max-md:min-h-[22rem]", live ? "order-1" : "order-2")}>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 md:p-4" aria-live="polite">
            {c.messages.length === 0 && (
              <p className="m-auto max-w-sm text-center text-dim">{live ? "Quiet line. Say something or roll some dice." : "You are offline. Pick a handle and room, then jack in."}</p>
            )}
            {c.messages.map((m) => (
              <ChatMessage key={m.id} m={m} hasCall={hasCall} mine={m.type !== "system" && m.from === me} />
            ))}
            <div ref={end} />
          </div>

          {pending.length > 0 && (
            <button
              className="call-live flex items-center gap-2 border-t border-accent bg-accent/10 px-3 py-2 text-left text-sm text-accent"
              onClick={() => document.getElementById(`msg-${pending[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            >
              <Icon name="bolt" size={16} />
              <span><b>{pending[0].check.label}</b> <span className="text-dim">{describeCheck(pending[0].check)}</span></span>
              {pending.length > 1 && <span className="chip">+{pending.length - 1}</span>}
              <span className="ml-auto font-mono text-xs">the GM is waiting</span>
            </button>
          )}

          {isGm && composer && <div className="border-t border-line p-3"><CallComposer onClose={() => setComposer(false)} /></div>}

          <form className="space-y-2 border-t border-line p-3 pb-3 lg:pb-14" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="voice">Speak as</label>
              <select id="voice" className="field !w-auto max-w-[14rem] flex-1 sm:flex-none" value={s.speakAs} onChange={(e) => s.set({ speakAs: e.target.value })}>
                <option value="">Yourself ({s.handle || "handle"})</option>
                {runners.map((r) => <option key={r.id} value={r.id}>{runnerName(r)}</option>)}
                {isGm && <option value="npc">Narrator / NPC</option>}
              </select>
              {isGm && s.speakAs === "npc" && (
                <input className="field !w-auto max-w-[11rem] flex-1 sm:flex-none" value={s.npcName} onChange={(e) => s.set({ npcName: e.target.value })} placeholder="Narrator" aria-label="NPC name" />
              )}
              <button type="button" className={clsx("btn small", ooc && "primary")} onClick={() => setOoc(!ooc)} aria-pressed={ooc} title="Out of character">OOC</button>
              {isGm && (
                <button type="button" className={clsx("btn small ml-auto", composer && "primary")} onClick={() => setComposer(!composer)} disabled={!live}>
                  <Icon name="bolt" size={14} /> Call a check
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input className="field flex-1" disabled={!live} value={text} onChange={(e) => setText(e.target.value)} placeholder={live ? (ooc ? "Out of character…" : `Say something as ${voiceLabel}`) : "Jack in to chat"} aria-label="Message" />
              <button className="btn primary" disabled={!live || !text.trim()}>Send</button>
            </div>
          </form>
        </section>
      </div>
    </Page>
  );
}
