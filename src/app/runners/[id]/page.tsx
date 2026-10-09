"use client";
import { useParams } from "next/navigation";
import { Sheet } from "./Sheet";

export default function RunnerPage() {
  const { id } = useParams<{ id: string }>();
  return <Sheet id={id} />;
}
