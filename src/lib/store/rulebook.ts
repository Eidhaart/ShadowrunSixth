"use client";
import { create } from "zustand";
import MiniSearch from "minisearch";
import type { Rulebook, RuleCategory, RuleSection } from "@/lib/rules/types";

const DB = "sixthdeck";
const STORE = "kv";
const KEY = "rulebook";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function buildIndex(book: Rulebook): MiniSearch<RuleSection> {
  const ms = new MiniSearch<RuleSection>({
    fields: ["title", "parent", "chapter", "text"],
    storeFields: ["id"],
    idField: "id",
    searchOptions: {
      boost: { title: 6, parent: 2, chapter: 1.5 },
      prefix: true,
      fuzzy: 0.18,
      combineWith: "AND",
    },
  });
  ms.addAll(book.sections);
  return ms;
}

export interface SearchHit {
  section: RuleSection;
  score: number;
}

interface RulebookState {
  status: "idle" | "loading" | "ready" | "empty" | "importing" | "error";
  error?: string;
  progress: { page: number; total: number } | null;
  book: Rulebook | null;
  byId: Map<string, RuleSection>;
  index: MiniSearch<RuleSection> | null;
  init: () => Promise<void>;
  importPdf: (file: File) => Promise<void>;
  clear: () => Promise<void>;
  search: (q: string, lenses: RuleCategory[], limit?: number) => SearchHit[];
}

function adopt(book: Rulebook) {
  return {
    book,
    byId: new Map(book.sections.map((s) => [s.id, s])),
    index: buildIndex(book),
    status: "ready" as const,
    progress: null,
    error: undefined,
  };
}

export const useRulebook = create<RulebookState>((set, get) => ({
  status: "idle",
  progress: null,
  book: null,
  byId: new Map(),
  index: null,
  init: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    try {
      const stored = await idbGet<Rulebook>(KEY);
      if (stored?.version === 1) {
        set(adopt(stored));
        return;
      }
    } catch {
      /* storage unavailable, fall through */
    }
    try {
      const res = await fetch("/api/rulebook", { cache: "no-store" });
      if (res.ok) {
        const book = (await res.json()) as Rulebook;
        if (book?.version === 1) {
          set(adopt(book));
          try { await idbSet(KEY, book); } catch { /* ignore */ }
          return;
        }
      }
    } catch {
      /* no local copy */
    }
    set({ status: "empty" });
  },
  importPdf: async (file) => {
    set({ status: "importing", progress: { page: 0, total: 1 }, error: undefined });
    try {
      const [pdfjs, { extractRulebook }] = await Promise.all([
        import("pdfjs-dist"),
        import("@/lib/rules/extract"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      const book = await extractRulebook(pdf, {
        title: file.name,
        onProgress: (p) => set({ progress: p }),
      });
      if (book.sections.length < 40) throw new Error("This does not look like the Sixth World core rulebook.");
      try { await idbSet(KEY, book); } catch { /* still usable this session */ }
      set(adopt(book));
    } catch (e) {
      set({ status: "error", error: e instanceof Error ? e.message : String(e), progress: null });
    }
  },
  clear: async () => {
    try { await idbDel(KEY); } catch { /* ignore */ }
    set({ book: null, index: null, byId: new Map(), status: "empty" });
  },
  search: (q, lenses, limit = 40) => {
    const { index, byId } = get();
    if (!index || !q.trim()) return [];
    let res = index.search(q);
    if (res.length === 0) res = index.search(q, { combineWith: "OR" });
    const out: SearchHit[] = [];
    for (const r of res) {
      const s = byId.get(r.id as string);
      if (!s) continue;
      if (lenses.length && !s.tags.some((t) => lenses.includes(t))) continue;
      out.push({ section: s, score: r.score });
      if (out.length >= limit) break;
    }
    return out;
  },
}));
