import { Suspense } from "react";
import { Library } from "./Library";

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-dim">Loading library</div>}>
      <Library />
    </Suspense>
  );
}
