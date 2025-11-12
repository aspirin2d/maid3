import { Box, Text, useInput } from "ink";
import { useMemo } from "react";
import type { CommandPaletteOption } from "./command-palette.js";

type HelpViewProps = {
  commands: CommandPaletteOption[];
  sessionEmail?: string;
  isActive?: boolean;
  onDismiss?: () => void;
};

function buildSections(commands: CommandPaletteOption[]) {
  const grouped = commands.reduce<Record<string, CommandPaletteOption[]>>(
    (acc, command) => {
      const category = command.category ?? "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(command);
      return acc;
    },
    {},
  );

  return Object.entries(grouped).sort(([a], [b]) =>
    a.localeCompare(b),
  );
}

export function HelpView({
  commands,
  sessionEmail,
  isActive = false,
  onDismiss,
}: HelpViewProps) {
  const sections = useMemo(() => buildSections(commands), [commands]);

  useInput(
    (input, key) => {
      if (key.escape || key.return || input?.toLowerCase() === "q") {
        onDismiss?.();
      }
    },
    { isActive },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={2}
      paddingY={1}
      rowGap={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text color="magenta" bold>
          Help & Shortcuts
        </Text>
        <Text dimColor>Esc or q to close</Text>
      </Box>

      <Box flexDirection="column">
        {sessionEmail ? (
          <Text dimColor>Signed in as {sessionEmail}</Text>
        ) : (
          <Text dimColor>Not signed in • Run /login or /signup to get started</Text>
        )}
        <Text dimColor>Type / to open the palette • Enter to pick a command</Text>
      </Box>

      {sections.map(([category, items]) => (
        <Box key={category} flexDirection="column" rowGap={0}>
          <Text color="yellow">{category}</Text>
          {items.map((item) => (
            <Box
              key={item.id}
              flexDirection="row"
              columnGap={2}
              paddingX={1}
            >
              <Box minWidth={12}>
                <Text bold>{item.label}</Text>
              </Box>
              <Box flexGrow={1}>
                <Text dimColor>{item.description ?? "No description"}</Text>
              </Box>
              {item.shortcut && (
                <Text color="cyan" dimColor>
                  {item.shortcut}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      ))}

      {!sections.length && (
        <Text color="yellow">No commands available right now.</Text>
      )}
    </Box>
  );
}
