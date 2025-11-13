import { useCallback, useMemo, useState } from "react";
import { useAddViews, useSession, type View } from "./context.js";
import { guestCommands, authedCommands, registry } from "./commands.js";
import { parseCommand, requiresParams } from "./commandParser.js";

import Fuse from "fuse.js";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

const COMMANDER_RESTART_DELAY_MS = 50;

export default function Commander() {
  const addViews = useAddViews();
  const [session] = useSession();
  const availableCommands = session ? authedCommands : guestCommands;

  const commandFuse = useMemo(
    () => new Fuse(availableCommands, { keys: ["id", "desc"] }),
    [availableCommands],
  );

  const [active, setActive] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchList = useMemo(() => {
    if (query === "") {
      return availableCommands.map((item, index) => ({
        item,
        refIndex: index,
      }));
    }
    return commandFuse.search(query);
  }, [query, commandFuse, availableCommands]);

  // Reset selection when search results change
  useMemo(() => {
    setSelectedIndex(0);
  }, [searchList]);

  // Handle arrow key navigation
  useInput(
    (_input, key) => {
      if (!active) return;

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(searchList.length - 1, prev + 1));
      }
    },
    { isActive: active },
  );

  const executeCommand = useCallback(
    (
      handler: string,
      params: Record<string, string> = {},
      displayedCommand?: string
    ) => {
      // Wrapper to match CommandContext signature
      const addViewsWrapper = (view: View, ...views: View[]) => {
        addViews(view, ...views);
      };

      const executed = registry.execute(handler, params, {
        addViews: addViewsWrapper,
        setActive,
        displayedCommand,
      });

      if (!executed) {
        addViews({
          kind: "text",
          option: { label: `Unknown command handler: ${handler}`, color: "red" },
        });
      }
    },
    [addViews],
  );

  const handleError = useCallback(
    (message: string, color: "red" | "yellow" = "red") => {
      addViews(
        { kind: "text", option: { label: message, color } },
        { kind: "commander" }
      );
      setTimeout(() => setActive(true), COMMANDER_RESTART_DELAY_MS);
    },
    [addViews]
  );

  const onSubmit = useCallback(() => {
    setActive(false);

    // Try exact command parsing first (handles parameters)
    const parsed = parseCommand(query, availableCommands);
    if (parsed) {
      executeCommand(parsed.command.handler, parsed.params, parsed.displayedCommand);
      return;
    }

    // Fall back to fuzzy search selection
    if (searchList.length === 0) {
      handleError("No command found");
      return;
    }

    const selectedCommand = searchList[selectedIndex];
    if (!selectedCommand) {
      handleError("No command selected");
      return;
    }

    // Check if command requires parameters
    if (requiresParams(selectedCommand.item.id)) {
      handleError(
        `Command requires parameters: ${selectedCommand.item.id}`,
        "yellow"
      );
      return;
    }

    executeCommand(selectedCommand.item.handler, {}, selectedCommand.item.id);
  }, [
    query,
    availableCommands,
    searchList,
    selectedIndex,
    executeCommand,
    handleError,
  ]);

  if (!active) return null;

  return (
    <Box flexDirection="column">
      <Box columnGap={1}>
        <Text color="green">{"›"}</Text>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={onSubmit}
          placeholder="Type a command or press ↑↓ to navigate"
        />
      </Box>
      {searchList.length > 0 &&
        searchList.map((res, index) => (
          <Box key={index} columnGap={1}>
            <Text color={index === selectedIndex ? "cyan" : undefined}>
              {index === selectedIndex ? "›" : " "}
            </Text>
            <Box minWidth={20}>
              <Text
                color={index === selectedIndex ? "cyan" : undefined}
                bold={index === selectedIndex}
              >
                {res.item.id}
              </Text>
            </Box>
            <Text
              color={index === selectedIndex ? "cyan" : undefined}
              dimColor={index !== selectedIndex}
              bold={index === selectedIndex}
            >
              {res.item.desc}
            </Text>
          </Box>
        ))}
      {query === "" && searchList.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            Press ↑↓ to navigate, Enter to select, or type to search
          </Text>
        </Box>
      )}
    </Box>
  );
}
