import type { Metadata } from "next";
import { Table } from "./Table";

export const metadata: Metadata = { title: "Table" };

export default function TablePage() {
  return <Table />;
}
