import { Box, Text } from "ink";
import { useCallback, useMemo, useState, useEffect } from "react";
import { CommandPalette, CommandPaletteSelection } from "./command-palette.js";
import { LoginForm } from "./login-form.js";
import {
  loadSession,
  clearSession,
  verifySession,
  type SessionData,
} from "./session.js";

function Header({ url }: { url: string }) {
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
    </Box>
  );
}

type View = "palette" | "login" | "signup";

export default function App({ url }: { url: string }) {
  const [currentView, setCurrentView] = useState<View>("palette");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

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

  const handlePaletteSubmit = useCallback(
    async (selection: CommandPaletteSelection) => {
      if (selection.type === "known") {
        const commandId = selection.command.id;

        switch (commandId) {
          case "/login":
            setCurrentView("login");
            break;
          case "/logout":
            await clearSession();
            setSessionData(null);
            console.log("Logged out successfully");
            break;
          case "/signup":
            setCurrentView("signup");
            break;
          case "/help":
            // TODO: Implement help view
            console.log("Help command - coming soon!");
            break;
          case "/quit":
            process.exit(0);
            break;
          default:
            console.log("Unknown command:", commandId);
        }
        return;
      }

      // Custom input (not a predefined command)
      console.log("Custom input:", selection.value);
    },
    [],
  );

  const handleLoginSuccess = useCallback((data: SessionData) => {
    setSessionData(data);
    console.log("Login successful!", data.user);
    // Return to command palette
    setTimeout(() => {
      setCurrentView("palette");
    }, 2000);
  }, []);

  const handleLoginCancel = useCallback(() => {
    setCurrentView("palette");
  }, []);

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
    <Box flexDirection="column" rowGap={1}>
      <Header url={url} />

      {/* Show session info if logged in */}
      {sessionData && (
        <Box
          paddingX={2}
          paddingY={1}
          borderStyle="round"
          borderColor="green"
          alignSelf="flex-start"
        >
          <Text color="green">
            ✓ Authenticated as {sessionData.user.name || sessionData.user.email}
          </Text>
        </Box>
      )}

      {/* Render current view */}
      {currentView === "palette" && (
        <CommandPalette options={commands} onSubmit={handlePaletteSubmit} />
      )}

      {currentView === "login" && (
        <LoginForm
          apiUrl={url}
          onSuccess={handleLoginSuccess}
          onCancel={handleLoginCancel}
        />
      )}

      {currentView === "signup" && (
        <Box paddingX={2}>
          <Text color="yellow">Signup form - coming soon!</Text>
          <Text dimColor>Press Esc to go back</Text>
        </Box>
      )}
    </Box>
  );
}
