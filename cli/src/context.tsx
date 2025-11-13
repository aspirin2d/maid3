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

export type AdminUsersListView = {
  kind: "/admin/users/list";
  option?: {
    page?: number;
    size?: number;
    search?: string;
    role?: string;
    sort?: string;
    direction?: "asc" | "desc";
  };
};

export type View =
  | TextView
  | CommanderView
  | LoginView
  | SignupView
  | LogoutView
  | AdminUsersListView;

type AddViewsOptions = {
  removeLast?: boolean;
};

type AddViewsArgs =
  | [View, ...View[]]
  | [AddViewsOptions, View, ...View[]];

function isViewArg(arg: AddViewsOptions | View): arg is View {
  return typeof arg === "object" && arg !== null && "kind" in arg;
}

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

export function useAddViews() {
  const context = useContext(viewContext);
  if (!context) throw new Error("viewContext is not available");

  return useCallback(
    (...args: AddViewsArgs) => {
      if (args.length === 0) return;

      const first = args[0];
      const options: AddViewsOptions = isViewArg(first) ? {} : first;
      const views = (isViewArg(first) ? args : args.slice(1)) as View[];
      if (views.length === 0) return;

      context.setViews((prev) => {
        const next = options.removeLast ? prev.slice(0, -1) : prev;
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
