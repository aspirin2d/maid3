import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

export type CommandPaletteOption = {
  id: string;
  label: string;
  description?: string;
  category?: string;
  shortcut?: string;
};

export type CommandPaletteSelection =
  | { type: "known"; command: CommandPaletteOption }
  | { type: "custom"; value: string };

export type CommandPaletteProps = {
  options: CommandPaletteOption[];
  placeholder?: string;
  emptyLabel?: string;
  showHelp?: boolean;
  onSubmit: (selection: CommandPaletteSelection) => void;
};

/**
 * Fuzzy match scorer - gives higher scores for better matches
 */
function fuzzyScore(haystack: string, needle: string): number {
  const haystackLower = haystack.toLowerCase();
  const needleLower = needle.toLowerCase();

  // Exact match gets highest score
  if (haystackLower === needleLower) return 1000;

  // Starts with gets high score
  if (haystackLower.startsWith(needleLower)) return 500;

  // Contains gets medium score
  if (haystackLower.includes(needleLower)) return 100;

  // Fuzzy character matching
  let score = 0;
  let haystackIndex = 0;

  for (const char of needleLower) {
    const charIndex = haystackLower.indexOf(char, haystackIndex);
    if (charIndex === -1) return 0; // No match

    // Closer characters get better scores
    score += 10 - (charIndex - haystackIndex);
    haystackIndex = charIndex + 1;
  }

  return score;
}

export function CommandPalette({
  options,
  placeholder = "Type '/' to search commands…",
  emptyLabel = "No matching commands",
  showHelp = true,
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

    const normalized = query.trim();
    if (!normalized) {
      return options;
    }

    // Score each option and filter out non-matches
    const scored = options
      .map((option) => {
        const labelScore = fuzzyScore(option.label, normalized);
        const descScore = fuzzyScore(option.description ?? "", normalized);
        const categoryScore = fuzzyScore(option.category ?? "", normalized);
        const maxScore = Math.max(labelScore, descScore, categoryScore);

        return { option, score: maxScore };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score); // Sort by score descending

    return scored.map((item) => item.option);
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
    <Box flexDirection="column" rowGap={0}>
      {/* Input area with prompt */}
      <Box
        paddingX={1}
        paddingY={1}
        borderStyle="round"
        borderColor="cyan"
        flexDirection="row"
        columnGap={1}
      >
        <Text color="cyan" bold>
          {"›"}
        </Text>
        <TextInput
          value={rawInput}
          placeholder={placeholder}
          onChange={setRawInput}
          onSubmit={handleSubmit}
        />
      </Box>

      {/* Results area */}
      <Box flexDirection="column" marginTop={1}>
        {!isCommandMode ? (
          <Box flexDirection="column" paddingX={1} rowGap={0}>
            <Text dimColor>💡 Press "/" to search available commands</Text>
            {showHelp && (
              <Box marginTop={1} flexDirection="column">
                <Text dimColor bold>
                  Keyboard shortcuts:
                </Text>
                <Text dimColor>  ↑/↓  Navigate commands</Text>
                <Text dimColor>  ⏎   Select command</Text>
                <Text dimColor>  ⎋   Clear input</Text>
              </Box>
            )}
          </Box>
        ) : filtered.length === 0 ? (
          <Box paddingX={1}>
            <Text color="yellow">⚠ {emptyLabel}</Text>
          </Box>
        ) : (
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
            paddingY={0}
          >
            {filtered.map((option, index) => {
              const isActive = index === cursor;

              return (
                <Box
                  key={option.id}
                  paddingX={1}
                  paddingY={0}
                  backgroundColor={isActive ? "#1a1a1a" : undefined}
                >
                  <Box minWidth={2}>
                    <Text color={isActive ? "cyan" : "transparent"}>
                      {isActive ? "▶" : " "}
                    </Text>
                  </Box>
                  <Box minWidth={20}>
                    <Text
                      color={isActive ? "cyan" : "white"}
                      bold={isActive}
                    >
                      {option.label}
                    </Text>
                  </Box>
                  <Box flexGrow={1}>
                    <Text
                      color={isActive ? "white" : "gray"}
                      dimColor={!isActive}
                    >
                      {option.description}
                    </Text>
                  </Box>
                  {option.category && (
                    <Box marginLeft={1}>
                      <Text color="magenta" dimColor>
                        [{option.category}]
                      </Text>
                    </Box>
                  )}
                  {option.shortcut && (
                    <Box marginLeft={1}>
                      <Text color="yellow" dimColor>
                        {option.shortcut}
                      </Text>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Footer with hints */}
      {isCommandMode && filtered.length > 0 && showHelp && (
        <Box paddingX={1} marginTop={1}>
          <Text dimColor>
            {filtered.length} {filtered.length === 1 ? "command" : "commands"}{" "}
            • Use ↑↓ to navigate • ⏎ to select
          </Text>
        </Box>
      )}
    </Box>
  );
}
