import { useCallback, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";

import Fuse from "fuse.js";

import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

type Command = {
  id: string;
  desc: string;
  handler?: string;
};

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
    (command: Command) => {
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

    executeCommand(selectedCommand.item);
  }, [searchList, selectedIndex, addViews, executeCommand]);

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
