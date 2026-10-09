/** Wire protocol shared by the browser, the chat server and the Foundry bridge. */
export interface WireDie {
  v: number;
  hit?: boolean;
  boom?: boolean;
  gone?: boolean;
}

export type WireMsg =
  | { type: "chat"; id: string; from: string; text: string; at: number; source?: "deck" | "foundry" }
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
    }
  | { type: "init"; id: string; from: string; at: number; label: string; base: number; dice: number[]; score: number; source?: "deck" | "foundry" }
  | { type: "system"; id: string; at: number; text: string };

export type ServerMsg =
  | { type: "history"; messages: WireMsg[] }
  | { type: "presence"; users: { handle: string; source: string }[] }
  | WireMsg;

export type ClientHello = { type: "hello"; room: string; handle: string; source: "deck" | "foundry" };
