import React, { createContext } from "react";

export type View = {
  kind: string;
  option?: any;
};

export type Session = {
  bearToken: string;
  email: string;
};

interface ViewContextType {
  views: View[];
  setViews: React.Dispatch<React.SetStateAction<View[]>>;

  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
}

export const viewContext = createContext<ViewContextType | null>(null);
