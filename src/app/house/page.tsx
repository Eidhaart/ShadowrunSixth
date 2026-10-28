import { redirect } from "next/navigation";

/** House rules now live behind the GM screen. */
export default function HousePage() {
  redirect("/gm?tab=house");
}
