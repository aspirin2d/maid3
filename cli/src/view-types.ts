export type ViewInstance =
  | { id: number; kind: "palette" }
  | { id: number; kind: "login" }
  | { id: number; kind: "signup" }
  | { id: number; kind: "logout" }
  | { id: number; kind: "text"; message: string };

export type ViewPayload =
  | { kind: "palette" }
  | { kind: "login" }
  | { kind: "signup" }
  | { kind: "logout" }
  | { kind: "text"; message: string };
