import type { WireMsg } from "@/lib/comms";

type Call = Extract<WireMsg, { type: "call" }>;
type Roll = Extract<WireMsg, { type: "roll" }>;
type Decline = Extract<WireMsg, { type: "decline" }>;

export type Response = { kind: "roll"; msg: Roll } | { kind: "decline"; msg: Decline };

export interface CallView {
  call: Call;
  withdrawn: boolean;
  /** First answer per handle. */
  responses: Record<string, Response>;
  /** Everyone who has been asked: named handles, or every non-GM player present. */
  targets: string[];
}

/** Rebuild what happened to a call from the message log. Works after a history replay too. */
export function callView(messages: WireMsg[], call: Call, users: { handle: string; role?: string }[]): CallView {
  const responses: Record<string, Response> = {};
  let withdrawn = false;
  for (const m of messages) {
    if (m.type === "withdraw" && m.callId === call.id) withdrawn = true;
    else if (m.type === "roll" && m.callId === call.id && !responses[m.from]) responses[m.from] = { kind: "roll", msg: m };
    else if (m.type === "decline" && m.callId === call.id && !responses[m.from]) responses[m.from] = { kind: "decline", msg: m };
  }
  const base = call.to.length ? [...call.to] : users.filter((u) => u.role !== "gm").map((u) => u.handle);
  for (const h of Object.keys(responses)) if (!base.includes(h)) base.push(h);
  return { call, withdrawn, responses, targets: base };
}

/** Calls still waiting on this handle. */
export function pendingFor(messages: WireMsg[], handle: string, role: "gm" | "player"): Call[] {
  if (role === "gm" || !handle) return [];
  const out: Call[] = [];
  for (const m of messages) {
    if (m.type !== "call") continue;
    if (m.to.length && !m.to.includes(handle)) continue;
    const v = callView(messages, m, []);
    if (v.withdrawn || v.responses[handle]) continue;
    out.push(m);
  }
  return out;
}

export type Outcome = "success" | "fail" | "tie" | "none";

export function rollOutcome(r: Roll): Outcome {
  if (r.opposed) return r.hits > r.opposed.hits ? "success" : r.hits === r.opposed.hits ? "tie" : "fail";
  if (r.threshold) return r.hits >= r.threshold ? "success" : "fail";
  return "none";
}
