import { Text } from "ink";
import { useCallback, useState, type SetStateAction } from "react";
import { homedir } from "node:os";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import Commander from "./commander.js";
import { Session, type View, viewContext } from "./context.js";
import Login from "./login.js";
import Signup from "./signup.js";
import Logout from "./logout.js";

const sessionFilePath = path.join(homedir(), ".maid_session");

function isSession(data: any): data is Session {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.email === "string" &&
    typeof data.bearerToken === "string"
  );
}

function loadSessionFromFile(): Session | null {
  try {
    if (!existsSync(sessionFilePath)) return null;
    const raw = readFileSync(sessionFilePath, "utf-8");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistSessionToFile(session: Session | null) {
  try {
    if (!session) {
      if (existsSync(sessionFilePath)) unlinkSync(sessionFilePath);
      return;
    }
    writeFileSync(sessionFilePath, JSON.stringify(session), "utf-8");
  } catch {
    // best-effort persistence; ignore errors
  }
}

export default function App({ url }: { url: string }) {
  const [session, setSessionState] = useState<Session | null>(() =>
    loadSessionFromFile(),
  );

  const [views, setViews] = useState<View[]>([
    {
      kind: "text",
      option: {
        label: session ? `Login as ${session.email}` : "Please '/login' first",
        dimColor: true,
      },
    },
    { kind: "commander", option: { url: url } },
  ]);

  const setSession = useCallback((value: SetStateAction<Session | null>) => {
    setSessionState((prev) => {
      const next =
        typeof value === "function"
          ? (value as (prev: Session | null) => Session | null)(prev)
          : value;
      persistSessionToFile(next);
      return next;
    });
  }, []);

  return (
    <viewContext.Provider value={{ views, setViews, session, setSession }}>
      {views.map((view, index) => {
        switch (view.kind) {
          case "text":
            return (
              <Text
                key={index}
                color={view.option.color}
                dimColor={view.option.dimColor ?? false}
              >
                {view.option.label}
              </Text>
            );
          case "commander":
            return <Commander key={index} />;
          case "/login":
            return <Login key={index} url={url} />;
          case "/signup":
            return <Signup key={index} url={url} />;
          case "/logout":
            return <Logout key={index} />;
        }
      })}
    </viewContext.Provider>
  );
}
