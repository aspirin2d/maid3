import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

export type CommandPaletteOption = {
  id: string;
  label: string;
  description?: string;
};

export type CommandPaletteSelection =
  | { type: "known"; command: CommandPaletteOption }
  | { type: "custom"; value: string };

export type CommandPaletteProps = {
  options: CommandPaletteOption[];
  placeholder?: string;
  emptyLabel?: string;
  onSubmit: (selection: CommandPaletteSelection) => void;
};

export function CommandPalette({
  options,
  placeholder = "Type '/' to search commands…",
  emptyLabel = "No matching commands",
  onSubmit,
}: CommandPaletteProps) {
  const [rawInput, setRawInput] = useState("");
  const [cursor, setCursor] = useState(0);

  const isCommandMode = rawInput.startsWith("/");
  const query = isCommandMode ? rawInput.slice(1) : "";

  const filtered = useMemo(() => {
    if (!isCommandMode) {
      return [];
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }

    return options.filter((option) => {
      const haystacks = [option.label, option.description ?? ""];
      return haystacks.some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [isCommandMode, options, query]);

  useEffect(() => {
    if (!filtered.length) {
      setCursor(0);
      return;
    }
    if (cursor > filtered.length - 1) {
      setCursor(filtered.length - 1);
    }
  }, [cursor, filtered.length]);

  const handleSelect = useCallback(
    (option?: CommandPaletteOption) => {
      if (option) {
        onSubmit({ type: "known", command: option });
      } else if (rawInput.trim()) {
        onSubmit({ type: "custom", value: rawInput.trim() });
      }

      setRawInput("");
      setCursor(0);
    },
    [onSubmit, rawInput],
  );

  useInput((_, key) => {
    if (!isCommandMode || !filtered.length) {
      return;
    }

    if (key.upArrow) {
      setCursor((current) =>
        current === 0 ? filtered.length - 1 : current - 1,
      );
    }

    if (key.downArrow) {
      setCursor((current) => (current + 1) % filtered.length);
    }

    if (key.escape) {
      setRawInput("");
      setCursor(0);
    }
  });

  const handleSubmit = useCallback(() => {
    if (isCommandMode && filtered.length) {
      handleSelect(filtered[cursor]);
      return;
    }

    handleSelect(undefined);
  }, [cursor, filtered, handleSelect, isCommandMode]);

  return (
    <Box flexDirection="column">
      <Box paddingY={1} columnGap={1} backgroundColor="#101010">
        <Text color="green">{"›"}</Text>
        <TextInput
          value={rawInput}
          placeholder={placeholder}
          onChange={setRawInput}
          onSubmit={handleSubmit}
        />
      </Box>

      <Box flexDirection="column">
        {!isCommandMode ? (
          <Text dimColor>Press "/" to search available commands</Text>
        ) : filtered.length === 0 ? (
          <Text dimColor>{emptyLabel}</Text>
        ) : (
          filtered.map((option, index) => {
            const isActive = index === cursor;

            return (
              <Box key={option.id} paddingX={1}>
                <Box minWidth={10}>
                  <Text color={isActive ? "green" : "white"}>
                    {option.label}
                  </Text>
                </Box>
                <Text color={isActive ? "green" : "white"} dimColor bold>
                  {option.description}
                </Text>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
