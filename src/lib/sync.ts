"use client";
import { useSettings } from "@/lib/store/settings";
import { useRunners } from "@/lib/store/characters";
import { useHouse } from "@/lib/house/store";
import { useBinder } from "@/lib/gm/binder";
import { useScreens } from "@/lib/gm/screen";

/**
 * Keeps windows of the deck in step on one device: the main window and a pop-out GM screen edit
 * the same binder, rules, runners and layouts. Local storage tells other windows when it changes;
 * the binder lives in IndexedDB, so it announces its changes on a broadcast channel.
 */

const LOCAL: Record<string, () => unknown> = {
  "sixthdeck.settings": () => useSettings.persist.rehydrate(),
  "sixthdeck.runners": () => useRunners.persist.rehydrate(),
  "sixthdeck.house": () => useHouse.persist.rehydrate(),
  "sixthdeck.screens": () => useScreens.persist.rehydrate(),
};

let started = false;

export function startWindowSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("storage", (e) => { if (e.key && LOCAL[e.key]) void LOCAL[e.key](); });

  if (typeof BroadcastChannel === "undefined") return;
  const bc = new BroadcastChannel("sixthdeck:stores");
  let applying = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  bc.onmessage = async (e) => {
    if (e.data !== "binder") return;
    applying = true;
    try { await useBinder.persist.rehydrate(); } finally { setTimeout(() => { applying = false; }, 50); }
  };
  useBinder.subscribe(() => {
    if (applying || !useBinder.persist.hasHydrated()) return;
    // wait for the IndexedDB write before telling the other windows to read it
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => bc.postMessage("binder"), 400);
  });
}

export const SCREEN_WINDOW = "sixthdeck-gm-screen";
let screenWin: Window | null = null;

/**
 * Open the GM screen in its own window. If it is already open it is brought forward (some browsers
 * will not raise a window, so the caller says where it is). "blocked" means the browser refused.
 */
export function openScreenWindow(): "opened" | "already" | "blocked" {
  if (screenWin && !screenWin.closed) { screenWin.focus(); return "already"; }
  let w: Window | null = null;
  try { w = window.open("/screen", SCREEN_WINDOW, "popup=yes,width=1440,height=900,resizable=yes,scrollbars=yes"); } catch { w = null; }
  if (!w) return "blocked";
  screenWin = w;
  try { w.focus(); } catch { /* cross-window focus can be refused */ }
  return "opened";
}
