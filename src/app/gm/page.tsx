import { Suspense } from "react";
import type { Metadata } from "next";
import { Hub } from "./Hub";

export const metadata: Metadata = { title: "GM" };

export default function GmPage() {
  return (
    <Suspense fallback={<div className="p-8 text-dim">Opening your binder…</div>}>
      <Hub />
    </Suspense>
  );
}
