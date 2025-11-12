import { Box, Text } from "ink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette, CommandPaletteSelection } from "./command-palette.js";
import { LoginForm } from "./login-form.js";
import {
  clearSession,
  loadSession,
  verifySession,
  type SessionData,
} from "./session.js";
import { SignupForm } from "./signup-form.js";
import { AddViewProvider } from "./view-context.js";
import type { ViewInstance, ViewPayload } from "./view-types.js";
import { LogoutView } from "./logout-view.js";

function Header({ url, email }: { url: string; email?: string }) {
  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
      columnGap={2}
      alignSelf="flex-start"
    >
      <Text color="green" bold>
        Maid CLI
      </Text>
      <Text dimColor>{url}</Text>
      {email && <Text>{email}</Text>}
    </Box>
  );
}

export default function App({ url }: { url: string }) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const nextViewId = useRef(1);
  const [views, setViews] = useState<ViewInstance[]>([
    { id: 0, kind: "palette" },
  ]);

  // Load and verify session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await loadSession();
        if (session) {
          // Verify session with API
          const { valid } = await verifySession(url, session.token);
          if (valid) {
            setSessionData(session);
          } else {
            // Session invalid, clear it
            await clearSession();
          }
        }
      } catch (error) {
        console.error("Failed to initialize session:", error);
      } finally {
        setIsLoadingSession(false);
      }
    };

    initSession();
  }, [url]);

  const commands = useMemo(() => {
    const authCommands = sessionData
      ? [
          {
            id: "/logout",
            label: "/logout",
            description: "Sign out of your account",
            category: "Auth",
          },
        ]
      : [
          {
            id: "/login",
            label: "/login",
            description: "Authenticate with your Maid account",
            category: "Auth",
          },
          {
            id: "/signup",
            label: "/signup",
            description: "Create a new Maid account",
            category: "Auth",
          },
        ];

    return [
      ...authCommands,
      {
        id: "/help",
        label: "/help",
        description: "Show help and documentation",
        category: "General",
      },
      {
        id: "/quit",
        label: "/quit",
        description: "Exit the application",
        category: "General",
      },
    ];
  }, [sessionData]);

  const addView = useCallback((view: ViewPayload) => {
    setViews((current) => [
      ...current,
      {
        ...view,
        id: nextViewId.current++,
      },
    ]);
  }, []);

  const addTextView = useCallback(
    (message: string) => {
      addView({ kind: "text", message });
    },
    [addView],
  );

  const handlePaletteSubmit = useCallback(
    async (selection: CommandPaletteSelection) => {
      if (selection.type === "known") {
        const commandId = selection.command.id;

        switch (commandId) {
          case "/login":
            addView({ kind: "login" });
            break;
          case "/logout":
            addView({ kind: "logout" });
            break;
          case "/signup":
            addView({ kind: "signup" });
            break;
          case "/help":
            // TODO: Implement help view
            addTextView("Help command - coming soon!");
            break;
          case "/quit":
            process.exit(0);
          default:
            addTextView(`Unknown command: ${commandId}`);
        }
        return;
      }

      // Custom input (not a predefined command)
      addTextView(`Custom input: ${selection.value}`);
    },
    [addTextView, addView],
  );

  const handleLoginSuccess = useCallback(
    (data: SessionData) => {
      setSessionData(data);
      // View updates handled by LoginForm through context
    },
    [],
  );

  const handleSignupSuccess = useCallback(
    (data: SessionData) => {
      setSessionData(data);
      // View updates handled by SignupForm through context
    },
    [],
  );

  const activeInteractiveIndex = useMemo(() => {
    for (let i = views.length - 1; i >= 0; i -= 1) {
      const view = views[i];
      if (!view) {
        continue;
      }
      const kind = view.kind;
      if (kind === "palette" || kind === "login" || kind === "signup") {
        return i;
      }
    }
    return -1;
  }, [views]);

  // Show loading state while verifying session
  if (isLoadingSession) {
    return (
      <Box flexDirection="column" rowGap={1}>
        <Header url={url} />
        <Box paddingX={2}>
          <Text dimColor>Loading session...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <AddViewProvider addView={addView}>
      <Box flexDirection="column" rowGap={1}>
        <Header
          url={url}
          email={sessionData ? sessionData.user.email : undefined}
        />

        {views.map((view, index) => {
          const isActive = index === activeInteractiveIndex;

          switch (view.kind) {
            case "palette":
              return (
                <CommandPalette
                  key={view.id}
                  options={commands}
                  onSubmit={handlePaletteSubmit}
                  isActive={isActive}
                />
              );
            case "login":
              return (
                <LoginForm
                  key={view.id}
                  apiUrl={url}
                  onSuccess={handleLoginSuccess}
                  isActive={isActive}
                />
              );
            case "signup":
              return (
                <SignupForm
                  key={view.id}
                  apiUrl={url}
                  onSuccess={handleSignupSuccess}
                  isActive={isActive}
                />
              );
            case "logout":
              return (
                <LogoutView
                  key={view.id}
                  onLoggedOut={() => setSessionData(null)}
                />
              );
            case "text":
              return (
                <Box
                  key={view.id}
                  paddingX={1}
                  paddingY={0}
                  borderStyle="round"
                  borderColor="yellow"
                  flexDirection="row"
                >
                  <Text color="yellow">{view.message}</Text>
                </Box>
              );
            default:
              return null;
          }
        })}
      </Box>
    </AddViewProvider>
  );
}
