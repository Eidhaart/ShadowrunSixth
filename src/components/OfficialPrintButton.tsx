"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Character } from "@/lib/sr6/character";
import type { Derived } from "@/lib/sr6/derive";
import { officialSheetReady, printOfficialSheet, rememberOfficialSheet } from "@/lib/sr6/officialSheet";

/** The book's two pages are kept privately in IndexedDB, never bundled with the site. */
export function OfficialPrintButton({ character, derived }: { character: Character; derived: Derived }) {
  const input = useRef<HTMLInputElement>(null);
  const [hasTemplate, setHasTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void officialSheetReady().then((ready) => {
      if (active) setHasTemplate(ready);
    }).catch(() => {
      if (active) setHasTemplate(false);
    });
    return () => { active = false; };
  }, []);

  const print = async () => {
    setBusy(true); setMessage("");
    try {
      await printOfficialSheet(character, derived);
      setMessage("Print dialog opened. Choose your printer or Save as PDF.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not print the official sheet.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMessage("Finding the official sheet in your PDF...");
    try {
      await rememberOfficialSheet(file);
      setHasTemplate(true);
      setMessage("");
      await printOfficialSheet(character, derived);
      setMessage("Print dialog opened. Choose your printer or Save as PDF.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not prepare the official sheet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="btn small"
        type="button"
        disabled={busy}
        title={hasTemplate ? "Fill and print the official two-page Sixth World character sheet" : "First choose your own Sixth World rulebook PDF. The two blank sheet pages are cached only on this device."}
        onClick={() => hasTemplate ? void print() : input.current?.click()}
      >
        <Icon name="print" size={14} /> {busy ? "Preparing..." : "Print official sheet"}
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        aria-label="Choose your Sixth World core rulebook PDF"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {message && <span role="status" className="max-w-xs text-xs text-dim">{message}</span>}
    </>
  );
}
