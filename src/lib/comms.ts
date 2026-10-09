/** Wire protocol shared by the browser, the chat server and the Foundry bridge. */
export interface WireDie {
  v: number;
  hit?: boolean;
  boom?: boolean;
  gone?: boolean;
}

/** A check the GM asks one or more runners to make. */
export interface CheckSpec {
  label: string;
  /** Skill id from the skill list. Leave out for an attribute-only check. */
  skill?: string;
  /** Attribute key (agility, logic, magic ...). */
  attr: string;
  /** Second attribute for attribute-only checks, e.g. composure is willpower + charisma. */
  attr2?: string;
  threshold?: number;
  /** The other side rolls this many dice. Most hits wins; a tie goes to the GM. */
  opposed?: { label: string; pool: number };
  note?: string;
}

export interface WireOpposed {
  label: string;
  pool: number;
  dice: WireDie[];
  hits: number;
}

export type WireMsg =
  | { type: "chat"; id: string; from: string; text: string; at: number; source?: "deck" | "foundry"; as?: string; gm?: boolean; ooc?: boolean }
  | { type: "call"; id: string; from: string; at: number; to: string[]; check: CheckSpec; gm?: boolean }
  | { type: "decline"; id: string; callId: string; from: string; as?: string; at: number }
  | { type: "withdraw"; id: string; callId: string; from: string; at: number }
  | {
      type: "roll";
      id: string;
      from: string;
      at: number;
      label: string;
      pool: number;
      dice: WireDie[];
      hits: number;
      glitch: boolean;
      critGlitch: boolean;
      edgeSpent: number;
      threshold?: number;
      success?: boolean;
      source?: "deck" | "foundry";
      as?: string;
      gm?: boolean;
      /** Set when this roll answers a GM call. */
      callId?: string;
      breakdown?: string;
      opposed?: WireOpposed;
    }
  | { type: "init"; id: string; from: string; at: number; label: string; base: number; dice: number[]; score: number; source?: "deck" | "foundry" }
  | { type: "system"; id: string; at: number; text: string };

export type ServerMsg =
  | { type: "history"; messages: WireMsg[] }
  | { type: "presence"; users: { handle: string; source: string; role?: "gm" | "player" }[] }
  | WireMsg;

export type ClientHello = { type: "hello"; room: string; handle: string; source: "deck" | "foundry"; role?: "gm" | "player" };
