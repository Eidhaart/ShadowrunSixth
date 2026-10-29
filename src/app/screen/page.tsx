import type { Metadata } from "next";
import { ScreenWindow } from "./ScreenWindow";

export const metadata: Metadata = { title: "GM screen" };

export default function ScreenPage() {
  return <ScreenWindow />;
}
