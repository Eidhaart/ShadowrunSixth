import type { Metadata } from "next";
import { House } from "./House";

export const metadata: Metadata = { title: "House rules" };

export default function HousePage() {
  return <House />;
}
