import { Text } from "ink";
import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { homedir } from "node:os";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import Commander from "./commander.js";
import { Session, type View, viewContext } from "./context.js";
import Login from "./login.js";
import Signup from "./signup.js";
import Logout from "./logout.js";
import { AdminUsers } from "./admin.js";
import UpdateName from "./update-name.js";
import UpdatePassword from "./update-password.js";
import { Stories } from "./story.js";

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
    writeFileSync(sessionFilePath, JSON.stringify(session), {
      mode: 0o600, // Read/write for owner only
      encoding: "utf-8",
    });
  } catch (err) {
    console.error(
      "[Warning] Failed to save session:",
      err instanceof Error ? err.message : String(err),
    );
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
        label: session
          ? `Login as ${session.email} [${session.isAdmin ? "admin" : ""}]`
          : "Please '/login' first",
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

  // Validate session on startup
  useEffect(() => {
    if (!session) return;

    fetch(`${url}/auth/get-session`, {
      headers: { Authorization: `Bearer ${session.bearerToken}` },
    })
      .then((res) => {
        if (!res.ok) {
          setSession(null);
          setViews((prev) => [
            ...prev,
            {
              kind: "text",
              option: {
                label: "Session expired, please login again",
                color: "yellow",
              },
            },
          ]);
          return null; // Stop the promise chain
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return; // Guard clause for failed validation
        setSession((prev) => {
          if (!prev) return null; // Guard against race condition
          return {
            ...prev,
            isAdmin: data.user.role === "admin",
          };
        });
      })
      .catch(() => {
        // Network error - keep session, will fail on next request
      });
  }, [url]); // Run once on mount, re-run if URL changes

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
          case "/admin/users":
            return <AdminUsers key={index} url={url} />;
          case "/update/name":
            return <UpdateName key={index} url={url} />;
          case "/update/password":
            return <UpdatePassword key={index} url={url} />;
          case "/story":
            return <Stories key={index} url={url} />;
        }
      })}
    </viewContext.Provider>
  );
}
