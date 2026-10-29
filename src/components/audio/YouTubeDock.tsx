"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * YouTube as sound only: the video plays in an invisible player through YouTube's own player API,
 * which syncs start, pause and volume and tells us in words when a video cannot be played.
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
  153: "YouTube would not start the player for this site. Reload the page; if it keeps happening, your browser may be hiding which site is asking (a privacy setting).",
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
      // our own iframe: YouTube refuses embeds that arrive without a referrer (error 153)
      const f = document.createElement("iframe");
      const q = new URLSearchParams({ enablejsapi: "1", autoplay: "1", start: String(Math.floor(at())), playsinline: "1", controls: "0", rel: "0", origin: window.location.origin });
      f.src = `https://www.youtube.com/embed/${live.current.videoId}?${q}`;
      f.allow = "autoplay; encrypted-media";
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      f.title = "Table music";
      f.tabIndex = -1;
      f.setAttribute("aria-hidden", "true");
      host.current.appendChild(f);
      player.current = new YT.Player(f, {
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
            if (e.data === PLAYING) { onBlocked(false); onError(null); }
            if (e.data === ENDED && !live.current.paused) { player.current?.seekTo(0, true); player.current?.playVideo(); }
          },
          onError: (e: { data: number }) => { const m = ERRORS[e.data] ?? `YouTube refused to play it (error ${e.data}).`; onError(m); },
        },
      });
    }).catch((e: Error) => { onError(e.message); });
    playRef.current = () => { player.current?.playVideo(); apply(); };
    return () => { dead = true; playRef.current = null; try { player.current?.destroy(); } catch { /* already gone */ } player.current = null; ready.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a new video, a restart, pause or resume, or a volume change
  const lastVideo = useRef(videoId);
  useEffect(() => {
    const p = player.current; if (!p || !ready.current) return;
    if (lastVideo.current !== videoId) {
      lastVideo.current = videoId;
      onError(null);
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

  // invisible but in the viewport: browsers throttle or block players that are off-screen
  // rendered on <body> so no sticky header or blur moves it out of the viewport
  return typeof document === "undefined" ? null : createPortal(<div ref={host} className="yt-sound" aria-hidden="true" />, document.body);
}
