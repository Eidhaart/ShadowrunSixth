import type { ComponentType } from "react";
import type { ModuleId } from "@/lib/academy/types";
import { MATRIX_WIDGETS } from "./widgets/matrix";
import { MAGIC_WIDGETS } from "./widgets/magic";

export const WIDGETS: Record<ModuleId, Record<string, ComponentType>> = {
  matrix: MATRIX_WIDGETS,
  magic: MAGIC_WIDGETS,
};
