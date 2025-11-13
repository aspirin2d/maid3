import { useEffect } from "react";
import { useAddViews, useSession } from "./context.js";

export default function Logout() {
  const [, setSession] = useSession();
  const addViews = useAddViews();

  useEffect(() => {
    setSession(null);
    addViews(
      { removeLast: true },
      {
        kind: "text",
        option: { label: "Logged out", dimColor: true },
      },
      { kind: "commander" },
    );
  }, []);

  return null;
}
