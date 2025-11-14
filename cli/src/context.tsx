import React, { createContext, useCallback, useContext } from "react";

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

export type LogoutView = {
  kind: "/logout";
  option?: never;
};

export type AdminUsersView = {
  kind: "/admin/users";
  option?: never;
};

export type View =
  | TextView
  | CommanderView
  | LoginView
  | SignupView
  | LogoutView
  | AdminUsersView;

export type Session = {
  bearerToken: string;
  email: string;
  isAdmin: boolean;
};

interface ViewContextType {
  views: View[];
  setViews: React.Dispatch<React.SetStateAction<View[]>>;

  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
}

export function useAddViews() {
  const context = useContext(viewContext);
  if (!context) throw new Error("viewContext is not available");

  return useCallback(
    (views: View[], remove: number = 0) => {
      context.setViews((prev) => {
        let next = prev;

        if (remove === -1) {
          next = [];
        } else if (remove > 0) {
          next = prev.slice(0, Math.max(0, prev.length - remove));
        }

        if (views.length === 0) return next;
        return [...next, ...views];
      });
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
