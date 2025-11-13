import React, { createContext, useCallback, useContext } from "react";

export type TextView = {
  id: string;
  kind: "text";
  option: {
    label: string;
    color?: string;
    dimColor?: boolean;
  };
};

export type CommanderView = {
  id: string;
  kind: "commander";
  option?: { url: string };
};

export type LoginView = {
  id: string;
  kind: "/login";
  option?: never;
};

export type SignupView = {
  id: string;
  kind: "/signup";
  option?: never;
};

export type LogoutView = {
  id: string;
  kind: "/logout";
  option?: never;
};

export type View =
  | TextView
  | CommanderView
  | LoginView
  | SignupView
  | LogoutView;

export type Session = {
  bearerToken: string;
  email: string;
};

interface ViewContextType {
  views: View[];
  setViews: React.Dispatch<React.SetStateAction<View[]>>;

  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;

  generateViewId: () => string;
}

export function useAddViews() {
  const context = useContext(viewContext);
  if (!context) throw new Error("viewContext is not available");

  return useCallback(
    (...views: View[]) => {
      if (views.length === 0) return;
      context.setViews((prev) => [...prev, ...views]);
    },
    [context],
  );
}

export function useSession() {
  const context = useContext(viewContext);
  if (!context) throw new Error("viewContext is not available");

  return [context.session, context.setSession] as const;
}

export const viewContext = createContext<ViewContextType | null>(null);
