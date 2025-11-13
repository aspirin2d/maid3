import React, { createContext } from "react";

export type TextView = {
  kind: "text";
  option: {
    label: string;
    color?: string;
    dimColor?: boolean;
  };
};

export type CommanderView = {
  kind: "commander";
  option?: { url: string };
};

export type LoginView = {
  kind: "/login";
  option?: never;
};

export type SignupView = {
  kind: "/signup";
  option?: never;
};

export type View = TextView | CommanderView | LoginView | SignupView;

export type Session = {
  bearerToken: string;
  email: string;
};

interface ViewContextType {
  views: View[];
  setViews: React.Dispatch<React.SetStateAction<View[]>>;

  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
}

export const viewContext = createContext<ViewContextType | null>(null);

// Maximum number of text views to keep in history
const MAX_HISTORY_VIEWS = 5;

// Helper function to manage view stack properly
export function addViews(currentViews: View[], newViews: View[]): View[] {
  // Filter out the last interactive view (commander, login, signup)
  const historyViews = currentViews.filter(
    (v) => v.kind === "text"
  );

  // Keep only the most recent history views
  const trimmedHistory = historyViews.slice(-MAX_HISTORY_VIEWS);

  // Combine trimmed history with new views
  return [...trimmedHistory, ...newViews];
}
