import type { ModuleDef, ModuleId } from "./types";
import { MATRIX } from "./matrix/content";
import { MAGIC } from "./magic/content";

export const MODULES: Record<ModuleId, ModuleDef> = { matrix: MATRIX, magic: MAGIC };
export const MODULE_LIST: ModuleDef[] = [MATRIX, MAGIC];

export function nextStep(mod: ModuleDef, lessonId: string): { href: string; label: string } {
  const i = mod.lessons.findIndex((l) => l.id === lessonId);
  const n = mod.lessons[i + 1];
  if (n) return { href: `/learn/${mod.id}/${n.id}`, label: n.title };
  return { href: `/learn/${mod.id}/sim`, label: mod.sim.title };
}
