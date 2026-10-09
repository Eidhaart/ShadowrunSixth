import { Suspense } from "react";
import { Forge } from "./Forge";

export default function ForgePage() {
  return (
    <Suspense fallback={<div className="p-8 text-dim">Warming up the forge</div>}>
      <Forge />
    </Suspense>
  );
}
