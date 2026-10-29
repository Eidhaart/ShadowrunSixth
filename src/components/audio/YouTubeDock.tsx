"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icon";

/**
 * YouTube through its official player API, in a small visible player. Browsers throttle or refuse
 * hidden cross-site players, and many videos only report problems through the API, so the player is
 * on screen (it can be shrunk) and every failure is said in words.
 */

interface YTPlayer {
  playVideo(): void; pauseVideo(): void; seekTo(s: number, allow: boolean): void; setVolume(v: number): void;
  mute(): void; unMute(): void; getPlayerState(): number; getDuration(): number; destroy(): void;
  loadVideoById(o: { videoId: string; startSeconds?: number }): void;
}
interface YTNamespace { Player: new (el: HTMLElement, o: Record<string, unknown>) => YTPlayer }
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((ok, bad) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); if (window.YT) ok(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => { apiPromise = null; bad(new Error("YouTube could not be reached")); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const ERRORS: Record<number, string> = {
  2: "That link does not point to a YouTube video.",
  5: "This browser cannot play that video.",
  100: "The video was removed or is private.",
  101: "The video's owner does not allow it to play outside YouTube. Try another upload of the track.",
  150: "The video's owner does not allow it to play outside YouTube. Try another upload of the track.",
};

const PLAYING = 1, BUFFERING = 3, ENDED = 0;

export function YouTubeDock({ videoId, startedAt, paused, pos, volume, onBlocked, onError, playRef }: {
  videoId: string; startedAt: number; paused: boolean; pos: number; volume: number;
  onBlocked: (b: boolean) => void; onError: (msg: string | null) => void;
  /** Lets the page start playback from a click (a user gesture). */
  playRef: React.MutableRefObject<(() => void) | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const [small, setSmall] = useState(false);
  // where the player sits; drag its bar to move it out of the way
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem("sixthdeck.ytdock") ?? "null"); if (v && typeof v.x === "number") setSpot(v); } catch { /* none saved */ } // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  const clamp = (x: number, y: number) => ({ x: Math.max(0, Math.min(window.innerWidth - 140, x)), y: Math.max(0, Math.min(window.innerHeight - 60, y)) });
  const [err, setErr] = useState<string | null>(null);
  const live = useRef({ startedAt, paused, pos, volume, videoId });
  // keep the latest table values for player callbacks (declared first so it runs before the others)
  useEffect(() => { live.current = { startedAt, paused, pos, volume, videoId }; });

  const at = () => {
    const l = live.current;
    const t = l.paused ? l.pos : Math.max(0, (Date.now() - l.startedAt) / 1000);
    const d = player.current?.getDuration?.() ?? 0;
    return d > 0 ? t % d : t;
  };
  const apply = () => {
    const p = player.current; if (!p || !ready.current) return;
    const l = live.current;
    p.setVolume(Math.round(l.volume * 100));
    if (l.volume <= 0) p.mute(); else p.unMute();
    p.seekTo(at(), true);
    if (l.paused) p.pauseVideo(); else p.playVideo();
  };

  // build the player once
  useEffect(() => {
    let dead = false;
    loadApi().then((YT) => {
      if (dead || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        width: "100%", height: "100%", videoId: live.current.videoId,
        playerVars: { autoplay: 1, start: Math.floor(at()), playsinline: 1, rel: 0, controls: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            ready.current = true;
            apply();
            // browsers that wait for a click leave the player paused
            setTimeout(() => {
              const s = player.current?.getPlayerState?.();
              if (!live.current.paused && s !== PLAYING && s !== BUFFERING) onBlocked(true);
            }, 2000);
          },
          onStateChange: (e: { data: number }) => {
            if (e.data === PLAYING) { onBlocked(false); setErr(null); onError(null); }
            if (e.data === ENDED && !live.current.paused) { player.current?.seekTo(0, true); player.current?.playVideo(); }
          },
          onError: (e: { data: number }) => { const m = ERRORS[e.data] ?? `YouTube refused to play it (error ${e.data}).`; setErr(m); onError(m); },
        },
      });
    }).catch((e: Error) => { setErr(e.message); onError(e.message); });
    playRef.current = () => { player.current?.playVideo(); apply(); };
    return () => { dead = true; playRef.current = null; try { player.current?.destroy(); } catch { /* already gone */ } player.current = null; ready.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a new video, a restart, pause or resume, or a volume change
  const lastVideo = useRef(videoId);
  useEffect(() => {
    const p = player.current; if (!p || !ready.current) return;
    if (lastVideo.current !== videoId) {
      lastVideo.current = videoId;
      setErr(null); onError(null);
      p.loadVideoById({ videoId, startSeconds: Math.floor(at()) });
      if (paused) setTimeout(() => p.pauseVideo(), 300);
      return;
    }
    apply();
  }, [videoId, startedAt, paused]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = player.current; if (!p || !ready.current) return;
    p.setVolume(Math.round(volume * 100));
    if (volume <= 0) p.mute(); else p.unMute();
  }, [volume]);

  return (
    <div className={clsx("yt-dock fixed z-40 flex flex-col", !spot && "right-3 top-[3.4rem]", small ? "w-[136px]" : "w-[232px]")} style={spot ? { left: spot.x, top: spot.y } : undefined}>
      <div className="flex h-6 cursor-grab touch-none items-center gap-1 px-1.5 text-[10px] text-dim" title="Drag to move"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => { if (drag.current) setSpot(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy)); }}
        onPointerUp={() => { drag.current = null; try { localStorage.setItem("sixthdeck.ytdock", JSON.stringify(spot)); } catch { /* private mode */ } }}>
        <Icon name="spark" size={11} className="text-accent" />
        <span className="flex-1 truncate">Table music</span>
        <button className="screen-btn !size-5" onClick={() => setSmall(!small)} aria-label={small ? "Bigger player" : "Smaller player"} title={small ? "Bigger" : "Smaller"}><Icon name={small ? "plus" : "minus"} size={11} /></button>
      </div>
      <div ref={host} className={clsx("yt-frame w-full bg-black", small ? "h-[76px]" : "h-[130px]")} />
      {err && <p className="bg-panel p-1.5 text-[11px] leading-snug text-danger">{err}</p>}
    </div>
  );
}
