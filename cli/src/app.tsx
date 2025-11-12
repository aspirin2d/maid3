import { Box, Text } from "ink";
import { useCallback, useMemo } from "react";
import { CommandPalette, CommandPaletteSelection } from "./command-palette.js";

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

export default function App({ url }: { url: string }) {
  const commands = useMemo(
    () => [
      {
        id: "/login",
        label: "/login",
        description: "Authenticate with your Maid account",
        category: "Auth",
        shortcut: "⌘L",
      },
      {
        id: "/signup",
        label: "/signup",
        description: "Create a new Maid account",
        category: "Auth",
        shortcut: "⌘S",
      },
      {
        id: "/logout",
        label: "/logout",
        description: "Sign out of your account",
        category: "Auth",
      },
      {
        id: "/memory/search",
        label: "/memory/search",
        description: "Search through your memories",
        category: "Memory",
        shortcut: "⌘F",
      },
      {
        id: "/help",
        label: "/help",
        description: "Show help and documentation",
        category: "General",
        shortcut: "?",
      },
      {
        id: "/quit",
        label: "/quit",
        description: "Exit the application",
        category: "General",
        shortcut: "⌘Q",
      },
    ],
    [],
  );

  const handlePaletteSubmit = useCallback(
    (selection: CommandPaletteSelection) => {
      if (selection.type === "known") {
        // TODO: Implement command handlers
        console.log("Command selected:", selection.command.id);
        return;
      }

      // Custom input (not a predefined command)
      console.log("Custom input:", selection.value);
    },
    [],
  );

  return (
    <Box flexDirection="column" rowGap={1}>
      <Header url={url} />
      <CommandPalette options={commands} onSubmit={handlePaletteSubmit} />
    </Box>
  );
}
