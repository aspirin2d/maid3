import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";

import Fuse from "fuse.js";

import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

const guestCommands = [
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

const adminCommands = [
  {
    id: "/admin/users",
    desc: "users management",
  },
];

const authedCommands = [
  {
    id: "/story",
    desc: "browse your stories",
  },
  {
    id: "/update/name",
    desc: "update your name",
  },
  {
    id: "/update/password",
    desc: "update your password",
  },
  {
    id: "/clear",
    desc: "clear screen",
  },
  {
    id: "/logout",
    desc: "logout of your current session",
  },
  {
    id: "/exit",
    desc: "exit Maid3",
  },
];

export default function Commander() {
  const addViews = useAddViews();
  const [session] = useSession();

  const availableCommands = useMemo(() => {
    if (!session) return guestCommands;
    const commands = [...authedCommands];
    if (session.isAdmin) {
      commands.unshift(...adminCommands);
    }
    return commands;
  }, [session]);

  const commandFuse = useMemo(() => {
    return new Fuse(availableCommands, { keys: ["id"] });
  }, [availableCommands]);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchList = useMemo(() => {
    return commandFuse.search(query); // Perform search based on the current query
  }, [query, commandFuse]);

  useEffect(() => {
    if (!searchList.length) {
      setSelectedIndex(0);
      return;
    }
    setSelectedIndex(0);
  }, [searchList]);

  useInput((_input, key) => {
    if (!searchList.length) return;
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev + 1) % searchList.length);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev - 1 < 0 ? searchList.length - 1 : prev - 1,
      );
      return;
    }
  });

  const onSubmit = useCallback(() => {
    const q = searchList.length > 0 ? searchList[selectedIndex] : null;
    if (!q) return;

    switch (q.item.id) {
      case "/login":
      case "/signup":
      case "/logout":
      case "/admin/users":
      case "/story":
      case "/update/name":
      case "/update/password":
        addViews(
          [
            { kind: "text", option: { label: q.item.id, dimColor: true } },
            { kind: q.item.id },
          ],
          1,
        );
        break;
      case "/clear":
        process.stdout.write("\x1b[2J\x1b[0;0H");
        setTimeout(() => addViews([{ kind: "commander" }], -1), 100);
        break;
      case "/exit":
        addViews([
          {
            kind: "text",
            option: { label: "Bye!", color: "green" },
          },
        ]);
        setTimeout(() => process.exit(0), 100);
    }
  }, [searchList, selectedIndex, addViews]);

  return (
    <Box flexDirection="column">
      <Box columnGap={1}>
        <Text color="green">{"›"}</Text>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={onSubmit}
          placeholder="Use '/' to input the commands"
        />
      </Box>
      {query.length > 0 &&
        searchList.map((res, index) => (
          <Box flexDirection="column" key={index} marginX={2}>
            <Box>
              <Box width={18}>
                <Text
                  color={index === selectedIndex ? "cyan" : undefined}
                  bold={index === selectedIndex}
                >
                  {res.item.id}
                </Text>
              </Box>
              <Text
                color={index === selectedIndex ? "cyan" : undefined}
                dimColor
                bold={index === selectedIndex}
              >
                {res.item.desc}
              </Text>
            </Box>
          </Box>
        ))}
    </Box>
  );
}
