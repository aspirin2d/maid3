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
      },
      {
        id: "/signup",
        label: "/signup",
        description: "Create a new Maid account",
      },
    ],
    [],
  );

  const handlePaletteSubmit = useCallback(
    (selection: CommandPaletteSelection) => {
      if (selection.type === "known") {
        return;
      }
    },
    [],
  );

  return (
    <Box flexDirection="column" columnGap={1}>
      <Header url={url} />
      <CommandPalette options={commands} onSubmit={handlePaletteSubmit} />
    </Box>
  );
}
