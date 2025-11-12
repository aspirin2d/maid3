import type { CommandPaletteOption } from "./command-palette.js";

export type ViewInstance =
  | { id: number; kind: "palette" }
  | { id: number; kind: "login" }
  | { id: number; kind: "signup" }
  | { id: number; kind: "logout" }
  | { id: number; kind: "text"; message: string }
  | {
      id: number;
      kind: "help";
      commands: CommandPaletteOption[];
      sessionEmail?: string;
    };

export type ViewPayload =
  | { kind: "palette" }
  | { kind: "login" }
  | { kind: "signup" }
  | { kind: "logout" }
  | { kind: "text"; message: string }
  | {
      kind: "help";
      commands: CommandPaletteOption[];
      sessionEmail?: string;
    };
