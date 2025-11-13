import { useCallback, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";

import Fuse from "fuse.js";

import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

type Command = {
  id: string;
  desc: string;
  handler?: string;
  params?: string[];
};

type ParsedCommand = {
  command: Command;
  params: Record<string, string>;
};

function parseCommand(input: string, commands: Command[]): ParsedCommand | null {
  const inputParts = input.trim().split(/\s+/);

  for (const command of commands) {
    const commandParts = command.id.split(/\s+/);
    const paramNames: string[] = [];
    const paramValues: Record<string, string> = {};

    let matches = true;
    let inputIndex = 0;

    for (let i = 0; i < commandParts.length; i++) {
      const part = commandParts[i];

      if (!part) {
        continue;
      }

      if (part.startsWith("<") && part.endsWith(">")) {
        const paramName = part.slice(1, -1);
        paramNames.push(paramName);

        if (inputIndex >= inputParts.length) {
          matches = false;
          break;
        }

        const value = inputParts[inputIndex];
        if (!value) {
          matches = false;
          break;
        }

        paramValues[paramName] = value;
        inputIndex++;
      } else {
        if (inputIndex >= inputParts.length || inputParts[inputIndex] !== part) {
          matches = false;
          break;
        }
        inputIndex++;
      }
    }

    if (matches && inputIndex === inputParts.length) {
      return {
        command: { ...command, params: paramNames },
        params: paramValues,
      };
    }
  }

  return null;
}

const guestCommands: Command[] = [
  {
    id: "/login",
    desc: "login with your email and password",
  },
  {
    id: "/signup",
    desc: "signup with your email",
  },
  {
    id: "/exit",
    desc: "exit Maid3",
  },
];

const authedCommands: Command[] = [
  {
    id: "/logout",
    desc: "logout of your current session",
  },
  {
    id: "/admin users list",
    desc: "list all users (admin only)",
    handler: "/admin/users/list",
  },
  {
    id: "/admin users delete <user_id>",
    desc: "delete a user by ID (admin only)",
    handler: "/admin/users/delete",
  },
  {
    id: "/exit",
    desc: "exit Maid3",
  },
];

const EXIT_DELAY_MS = 100; // Allow final render before exiting

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
    (command: Command, params: Record<string, string> = {}) => {
      // Route command based on ID or handler
      const commandId = command.handler || command.id;

      if (commandId === "/login" || commandId === "/signup" || commandId === "/logout") {
        addViews(
          { kind: "text", option: { label: command.id, dimColor: true } },
          { kind: commandId as any },
        );
        return;
      }

      if (commandId === "/exit") {
        addViews({
          kind: "text",
          option: { label: "Bye!", color: "green" },
        });
        setTimeout(() => process.exit(0), EXIT_DELAY_MS);
        return;
      }

      if (commandId === "/admin/users/list") {
        addViews(
          { kind: "text", option: { label: command.id, dimColor: true } },
          { kind: "/admin/users/list" },
        );
        return;
      }

      if (commandId === "/admin/users/delete") {
        const userId = params["user_id"];
        if (!userId) {
          addViews({
            kind: "text",
            option: { label: "Error: user_id is required", color: "red" },
          });
          addViews({ kind: "commander" });
          setTimeout(() => setActive(true), 50);
          return;
        }
        addViews(
          { kind: "text", option: { label: `/admin users delete ${userId}`, dimColor: true } },
          { kind: "/admin/users/delete", option: { userId } },
        );
        return;
      }

      // Default case: unknown command
      addViews({
        kind: "text",
        option: { label: `Unknown command: ${command.id}`, color: "red" },
      });
    },
    [addViews],
  );

  const onSubmit = useCallback(() => {
    setActive(false);

    // First, try to parse the query as a command with parameters
    const parsed = parseCommand(query, availableCommands);
    if (parsed) {
      executeCommand(parsed.command, parsed.params);
      return;
    }

    // Fall back to fuzzy search selection
    if (searchList.length === 0) {
      addViews({
        kind: "text",
        option: { label: "No command found", color: "red" },
      });
      addViews({ kind: "commander" });
      setTimeout(() => setActive(true), 50);
      return;
    }

    const selectedCommand = searchList[selectedIndex];
    if (!selectedCommand) {
      addViews({
        kind: "text",
        option: { label: "No command selected", color: "red" },
      });
      addViews({ kind: "commander" });
      setTimeout(() => setActive(true), 50);
      return;
    }

    // Check if command requires parameters
    const commandId = selectedCommand.item.id;
    if (commandId.includes("<") && commandId.includes(">")) {
      addViews({
        kind: "text",
        option: { label: `Command requires parameters: ${commandId}`, color: "yellow" },
      });
      addViews({ kind: "commander" });
      setTimeout(() => setActive(true), 50);
      return;
    }

    executeCommand(selectedCommand.item);
  }, [query, availableCommands, searchList, selectedIndex, addViews, executeCommand]);

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
