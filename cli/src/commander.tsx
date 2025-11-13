import { useCallback, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";

import Fuse from "fuse.js";

import { Box, Text } from "ink";
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

const authedCommands = [
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
  const availableCommands = session ? authedCommands : guestCommands;

  const commandFuse = useMemo(
    () => new Fuse(availableCommands, { keys: ["id"] }),
    [availableCommands],
  );

  const [active, setActive] = useState(true);
  const [query, setQuery] = useState("");

  const searchList = useMemo(() => {
    return commandFuse.search(query); // Perform search based on the current query
  }, [query, commandFuse]);

  const onSubmit = useCallback(() => {
    setActive(false);

    const q = searchList.length > 0 ? searchList[0] : null;
    if (!q) return;
    console.log(q.item.id);

    switch (q.item.id) {
      case "/login":
      case "/signup":
      case "/logout":
        addViews(
          { kind: "text", option: { label: q.item.id, dimColor: true } },
          { kind: q.item.id },
        );
        return;
      case "/exit":
        addViews({
          kind: "text",
          option: { label: "Bye!", color: "green" },
        });
        setTimeout(() => process.exit(0), 100);
    }
  }, [searchList, addViews]);

  if (!active) return null;

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
          <Box flexDirection="column" key={index}>
            <Box>
              <Box width={10}>
                <Text
                  color={index === 0 ? "cyan" : undefined}
                  bold={index === 0}
                >
                  {res.item.id}
                </Text>
              </Box>
              <Text
                color={index === 0 ? "cyan" : undefined}
                dimColor
                bold={index === 0}
              >
                {res.item.desc}
              </Text>
            </Box>
          </Box>
        ))}
    </Box>
  );
}
