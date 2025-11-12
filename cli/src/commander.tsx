import { useCallback, useContext, useState, useMemo } from "react";
import { viewContext } from "./context.js";

import Fuse from "fuse.js";

import TextInput from "ink-text-input";
import { Box, Text } from "ink";

const commandsA = [
  {
    id: "/login",
    desc: "login with your email and password",
  },
  {
    id: "/signup",
    desc: "signup with your email",
  },
];

const commandsC = [
  {
    id: "/exit",
    desc: "exit Maid3",
  },
];

const fuseA = new Fuse([...commandsA, ...commandsC], { keys: ["id"] });

export default function Commander() {
  const context = useContext(viewContext);

  const [active, setActive] = useState(true);
  const [query, setQuery] = useState("");

  const onSubmit = useCallback(() => {
    setActive(false);

    const q = searchList.length > 0 ? searchList[0] : null;
    if (context && q) {
      switch (q.item.id) {
        case "/login":
        case "/signup":
          context.setViews([...context.views, { kind: q.item.id }]);
          return;
        case "/exit":
          context.setViews([
            ...context.views,
            { kind: "text", option: "Bye!" },
          ]);
          setTimeout(() => process.exit(), 50);
      }
    }
  }, [query, context, setActive]);

  const searchList = useMemo(() => {
    return fuseA.search(query); // Perform search based on the current query
  }, [query]);

  if (!active)
    return (
      <Text bold color="magenta">
        {searchList[0]?.item.id ?? ""}
      </Text>
    );

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
