import { Box, Text } from "ink";
import { useCallback, useMemo, useState } from "react";
import { CommandPalette, CommandPaletteSelection } from "./command-palette.js";
import { LoginForm } from "./login-form.js";

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
  const [sessionData, setSessionData] = useState<{
    session: unknown;
    user: unknown;
  } | null>(null);

  const commands = useMemo(
    () => [
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
    ],
    [],
  );

  const handlePaletteSubmit = useCallback(
    (selection: CommandPaletteSelection) => {
      if (selection.type === "known") {
        const commandId = selection.command.id;

        switch (commandId) {
          case "/login":
            setCurrentView("login");
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

  const handleLoginSuccess = useCallback(
    (data: { session: unknown; user: unknown }) => {
      setSessionData(data);
      console.log("Login successful!", data);
      // Return to command palette
      setTimeout(() => {
        setCurrentView("palette");
      }, 2000);
    },
    [],
  );

  const handleLoginCancel = useCallback(() => {
    setCurrentView("palette");
  }, []);

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
          <Text color="green">✓ Authenticated</Text>
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
