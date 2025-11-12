import { createContext } from "react";

export type View = {
  kind: string;
  option?: any;
};
export const viewContext = createContext<((view: View) => void) | null>(null);
