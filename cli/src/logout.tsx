import { useContext, useEffect } from "react";
import { useAddViews, useSession, viewContext } from "./context.js";

export default function Logout() {
  const [, setSession] = useSession();
  const addViews = useAddViews();

  const context = useContext(viewContext);
  if (!context) throw new Error("viewContext is not available");
  const { generateViewId } = context;

  useEffect(() => {
    setSession(null);
    addViews(
      {
        id: generateViewId(),
        kind: "text",
        option: { label: "Logged out", dimColor: true },
      },
      { id: generateViewId(), kind: "commander" },
    );
  }, []);

  return null;
}
