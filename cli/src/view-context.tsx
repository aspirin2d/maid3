import { createContext, useContext, type ReactNode } from "react";
import type { ViewPayload } from "./view-types.js";

type AddViewFn = (view: ViewPayload) => void;

const AddViewContext = createContext<AddViewFn | null>(null);

export function AddViewProvider({
  addView,
  children,
}: {
  addView: AddViewFn;
  children: ReactNode;
}) {
  return (
    <AddViewContext.Provider value={addView}>
      {children}
    </AddViewContext.Provider>
  );
}

export function useAddView() {
  const context = useContext(AddViewContext);
  if (!context) {
    throw new Error("useAddView must be used within an AddViewProvider");
  }
  return context;
}
