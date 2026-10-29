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

/** Open the GM screen in its own window, or bring it forward if it is already open. */
export function openScreenWindow(): boolean {
  const w = window.open("/screen", "sixthdeck-gm-screen", "popup,width=1440,height=900");
  if (!w) return false;
  w.focus();
  return true;
}
