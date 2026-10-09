"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";
import { RollView } from "@/components/Dice";
import { useSettings } from "@/lib/store/settings";
import { useRulebook } from "@/lib/store/rulebook";
import { useRunners } from "@/lib/store/characters";
import { useRolls } from "@/lib/store/rolls";
import { useUi } from "@/lib/store/ui";
import { useComms } from "@/lib/store/comms";
import { MODULE_LIST } from "@/lib/academy/modules";
import { useAcademy } from "@/lib/academy/progress";
import { doRoll } from "@/lib/actions";

const NAV = [
  { href: "/", label: "Deck", icon: "deck" },
  { href: "/rules", label: "Library", icon: "library" },
  { href: "/dice", label: "Dice", icon: "dice" },
  { href: "/forge", label: "Forge", icon: "forge" },
  { href: "/learn", label: "Academy", icon: "learn" },
  { href: "/runners", label: "Runners", icon: "runners" },
  { href: "/comms", label: "Comms", icon: "comms" },
  { href: "/link", label: "Foundry", icon: "link" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

/** The phone tab bar shows these; everything else lives under More. */
const MOBILE_PRIMARY: string[] = ["/", "/dice", "/forge", "/runners", "/comms"];

function hexInk(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#111";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#0b0b0b" : "#ffffff";
}

function ApplySettings() {
  const s = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = s.theme;
    el.dataset.motion = s.motion;
    el.dataset.font = s.font;
    el.dataset.corners = s.corners;
    el.dataset.density = s.density;
    el.dataset.backdrop = s.backdrop;
    el.dataset.brackets = s.brackets ? "on" : "off";
    el.style.setProperty("--scan", String(s.scanlines));
    el.style.setProperty("--vig", String(s.vignette));
    el.style.setProperty("--glow", String(s.glow));
    el.style.setProperty("--font-scale", String(s.fontScale));
    if (s.customAccent) {
      el.style.setProperty("--accent", s.customAccent);
      el.style.setProperty("--accent-ink", hexInk(s.customAccent));
    } else {
      el.style.removeProperty("--accent");
      el.style.removeProperty("--accent-ink");
    }
  }, [s.theme, s.motion, s.font, s.corners, s.density, s.backdrop, s.brackets, s.scanlines, s.vignette, s.glow, s.fontScale, s.customAccent]);
  return null;
}

function Boot() {
  const { skipBoot, motion } = useSettings();
  const status = useRulebook((s) => s.status);
  const sections = useRulebook((s) => s.book?.sections.length ?? 0);
  const [show, setShow] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("sd.booted") === "1"; } catch { /* ignore */ }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!seen && !skipBoot && motion === "full" && !reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
    } else if (skipBoot) {
      // the persisted setting arrives just after hydration
      setShow(false);
    }
    try { sessionStorage.setItem("sd.booted", "1"); } catch { /* ignore */ }
  }, [skipBoot, motion]);

  const lines = useMemo(
    () => [
      "SIXTHDECK BIOS 6.0.80  //  cyberdeck cold start",
      "seating datajack ........................ ok",
      "loading ICE-breaker stubs ............... ok",
      status === "ready"
        ? `mounting rulebook ..................... ${sections.toLocaleString()} sections indexed`
        : "mounting rulebook ..................... waiting for a book chip",
      "forging fake SIN ........................ rating 4",
      "jacking in",
    ],
    [status, sections],
  );

  useEffect(() => {
    if (!show) return;
    if (n >= lines.length) {
      const t = setTimeout(() => setShow(false), 380);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN(n + 1), 170);
    return () => clearTimeout(t);
  }, [show, n, lines.length]);

  useEffect(() => {
    if (!show) return;
    const off = () => setShow(false);
    window.addEventListener("keydown", off);
    return () => window.removeEventListener("keydown", off);
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-bg" onClick={() => setShow(false)} role="presentation">
      <div className="w-[min(92vw,640px)] font-mono text-sm text-dim">
        {lines.slice(0, n).map((l, i) => (
          <div key={i} className={clsx("boot-line", i === lines.length - 1 && "glow text-accent")}>
            {i === lines.length - 1 ? "> " : "  "}
            {l}
          </div>
        ))}
        <div className="mt-6 text-xs text-faint">Press any key to skip</div>
      </div>
    </div>
  );
}

function DiceTray() {
  const open = useUi((s) => s.trayOpen);
  const setOpen = useUi((s) => s.setTray);
  const last = useRolls((s) => s.log[0]);
  const handle = useSettings((s) => s.handle);
  const pathname = usePathname();
  if (pathname === "/dice") return null;
  return (
    <div className={clsx("no-print fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2 md:bottom-5 md:right-5", (pathname.startsWith("/forge") || pathname.startsWith("/comms")) && "max-md:hidden")}>
      {open && last && (
        <div className="panel w-[min(94vw,460px)] p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm text-dim">Last roll</span>
            <button className="btn small ghost" onClick={() => setOpen(false)} aria-label="Close roll tray"><Icon name="x" size={14} /></button>
          </div>
          {last.kind === "roll" ? (
            <RollView result={last.result} who={last.who || handle || "Runner"} />
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-display">{last.result.label}</span>
              <span className="num text-dim">{last.result.base + last.result.bonus} + [{last.result.dice.join(" + ")}]</span>
              <span className="font-display text-3xl glow num">{last.result.score}</span>
            </div>
          )}
        </div>
      )}
      <button
        className="btn primary max-md:!h-12 max-md:!min-w-12 max-md:!rounded-full max-md:!px-3 max-md:![clip-path:none] max-md:shadow-lg"
        onClick={() => (last ? setOpen(!open) : doRoll({ label: "Quick roll", pool: 6 }))}
        title="Quick roll"
      >
        <Icon name="dice" size={18} /> <span className={clsx(!(last && open) && "max-md:sr-only")}>{last && open ? "Hide" : "Roll"}</span>
      </button>
    </div>
  );
}

type PaletteItem = { id: string; label: string; hint?: string; run: () => void; group: string };

function Palette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPalette);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useRulebook((s) => s.search);
  const status = useRulebook((s) => s.status);
  const lenses = useSettings((s) => s.lenses);
  const runners = useRunners((s) => s.runners);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUi.getState().paletteOpen);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const go = (href: string) => () => { router.push(href); setOpen(false); };
    const out: PaletteItem[] = [];
    const rollM = /^\/?(?:r|roll)\s+(\d{1,2})(?:\s+(e|edge))?(?:\s+(.+))?$/i.exec(q.trim());
    if (rollM) {
      const pool = Number(rollM[1]);
      const ex = !!rollM[2];
      out.push({
        id: "roll", group: "Dice",
        label: `Roll ${pool} dice${ex ? " with exploding 6s" : ""}${rollM[3] ? `: ${rollM[3]}` : ""}`,
        hint: "Enter",
        run: () => { doRoll({ label: rollM[3] ?? "Quick roll", pool, explode: ex }, ex ? 3 : 0); setOpen(false); },
      });
    }
    const ql = q.trim().toLowerCase();
    for (const n of NAV) {
      if (!ql || n.label.toLowerCase().includes(ql)) out.push({ id: `nav-${n.href}`, label: `Go to ${n.label}`, group: "Navigate", run: go(n.href) });
    }
    if (ql.length >= 2) {
      for (const m of MODULE_LIST) {
        for (const l of m.lessons) {
          if (`${m.title} ${l.title} ${l.blurb}`.toLowerCase().includes(ql))
            out.push({ id: `learn-${m.id}-${l.id}`, label: l.title, hint: m.title, group: "Academy", run: go(`/learn/${m.id}/${l.id}`) });
        }
      }
    }
    for (const r of Object.values(runners)) {
      const nm = r.alias || r.name || "Unnamed runner";
      if (ql && nm.toLowerCase().includes(ql)) out.push({ id: `run-${r.id}`, label: `Open sheet: ${nm}`, group: "Runners", run: go(`/runners/${r.id}`) });
    }
    if (ql.length >= 2 && status === "ready") {
      for (const h of search(q, lenses, 8)) {
        out.push({
          id: `rule-${h.section.id}`, group: "Rules",
          label: h.section.title,
          hint: `${h.section.chapter} · p.${h.section.page}`,
          run: go(`/rules?s=${encodeURIComponent(h.section.id)}`),
        });
      }
    }
    return out.slice(0, 18);
  }, [q, runners, router, setOpen, search, status, lenses]);

  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[95] grid place-items-start bg-black/60 px-3 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)} role="presentation">
      <div className="panel mx-auto w-full max-w-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command bar">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" size={18} className="text-dim" />
          <input
            ref={inputRef}
            className="h-12 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-faint"
            placeholder="Search rules, jump somewhere, or type: roll 12"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); items[sel]?.run(); }
            }}
            aria-label="Command input"
          />
          <span className="kbd">esc</span>
        </div>
        <ul className="max-h-[50vh] overflow-auto py-1" role="listbox">
          {items.length === 0 && <li className="px-4 py-6 text-sm text-dim">Nothing matches. Try a rules term like &ldquo;drain&rdquo;, or <span className="font-mono text-fg">roll 10</span>.</li>}
          {items.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === sel}>
              <button
                className={clsx("flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm", i === sel ? "bg-panelhi text-accent" : "text-fg")}
                onMouseEnter={() => setSel(i)}
                onClick={() => it.run()}
              >
                <span className="truncate">{it.label}</span>
                <span className="shrink-0 text-xs text-faint">{it.hint ?? it.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatusDot({ on, warn }: { on: boolean; warn?: boolean }) {
  return <span className={clsx("inline-block h-2 w-2 rounded-full", on ? (warn ? "bg-accent" : "bg-ok") : "bg-faint")} />;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const init = useRulebook((s) => s.init);
  const rb = useRulebook((s) => s.status);
  const setPalette = useUi((s) => s.setPalette);
  const { flicker, handle, chatUrl, room, role } = useSettings();
  const comms = useComms();

  useEffect(() => { void init(); }, [init]);
  useEffect(() => { void useAcademy.persist.rehydrate(); }, []);
  // Hydrate persisted stores after mount.
  useEffect(() => {
    useSettings.persist.rehydrate();
    useRunners.persist.rehydrate();
    useRolls.persist.rehydrate();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      const st = useSettings.getState();
      if (st.chatUrl && st.handle) useComms.getState().connect({ url: st.chatUrl, room: st.room, handle: st.handle, role: st.role });
    }, 250);
    return () => clearTimeout(t);
  }, [chatUrl, room, handle, role]);

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const [more, setMore] = useState(false);
  const moreActive = NAV.some((n) => !MOBILE_PRIMARY.includes(n.href) && active(n.href));
  useEffect(() => { setMore(false); }, [pathname]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="flex min-h-dvh">
      <ApplySettings />
      <Boot />
      <Palette />

      {/* rail (desktop) */}
      <nav className="no-print sticky top-0 hidden h-dvh w-[78px] shrink-0 flex-col items-center gap-1 border-r border-line bg-bg2/80 py-4 backdrop-blur md:flex" aria-label="Modules">
        <Link href="/" className="mb-3 grid h-11 w-11 place-items-center border border-accent font-display text-lg font-bold text-accent glow" aria-label="Sixthdeck home">
          S6
        </Link>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={clsx(
              "relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-display tracking-wide transition-colors",
              active(n.href) ? "text-accent" : "text-dim hover:text-fg",
            )}
          >
            {active(n.href) && <span className="absolute left-0 top-2 h-[calc(100%-1rem)] w-[3px] bg-accent" />}
            <Icon name={n.icon} size={22} />
            {n.label}
            {n.href === "/comms" && comms.unread > 0 && !active("/comms") && (
              <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-danger" />
            )}
          </Link>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-bg/85 px-3 backdrop-blur md:px-5">
          <span className="font-display text-sm font-semibold tracking-wide md:hidden">SIXTHDECK</span>
          <div className="hidden items-center gap-4 text-xs text-dim md:flex">
            <span className="flex items-center gap-1.5"><StatusDot on={rb === "ready"} warn={rb !== "ready"} /> Rulebook {rb === "ready" ? "mounted" : rb === "loading" ? "loading" : "not loaded"}</span>
            <span className="flex items-center gap-1.5">
              <StatusDot on={comms.status === "online" || comms.status === "local"} warn={comms.status === "connecting"} />
              Comms {comms.status === "online" ? `room ${comms.room}` : comms.status === "local" ? "local tabs" : comms.status === "connecting" ? "linking" : "off"}
            </span>
          </div>
          <div className="flex-1" />
          <button className="btn small ghost" onClick={() => setPalette(true)} aria-label="Open command bar">
            <Icon name="search" size={15} /> <span className="hidden sm:inline">Search or command</span> <span className="kbd hidden md:inline">Ctrl K</span>
          </button>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* tab bar (mobile) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-bg2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Modules">
        {NAV.filter((n) => MOBILE_PRIMARY.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} onClick={() => setMore(false)}
            className={clsx("relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-display", active(n.href) ? "text-accent" : "text-dim")}>
            <Icon name={n.icon} size={22} />
            {n.label}
            {n.href === "/comms" && comms.unread > 0 && !active("/comms") && <span className="absolute right-[28%] top-2 h-2 w-2 rounded-full bg-danger" />}
          </Link>
        ))}
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore(!more)}
          className={clsx("flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-display", more || moreActive ? "text-accent" : "text-dim")}
        >
          <Icon name="menu" size={22} />
          More
        </button>
      </nav>
      {more && (
        <div className="no-print fixed inset-0 z-[39] md:hidden" onClick={() => setMore(false)} role="presentation">
          <div className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] border-t border-line bg-bg2 p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-4 gap-2">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href)).map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setMore(false)} aria-current={active(n.href) ? "page" : undefined}
                  className={clsx("flex flex-col items-center gap-1 border py-3 text-xs font-display", active(n.href) ? "border-accent text-accent" : "border-line text-dim")}>
                  <Icon name={n.icon} size={22} />
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <DiceTray />
      <div className="fx fx-scan" aria-hidden />
      <div className="fx fx-vignette" aria-hidden />
      {flicker && <div className="fx fx-flicker" aria-hidden />}
    </div>
  );
}
