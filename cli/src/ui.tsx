import { Box, Text, useInput } from "ink";
import { ReactNode, useEffect, useMemo, useState } from "react";

export function LoadingText({ children }: { children: string }) {
  return <Text dimColor>{children}</Text>;
}

export function ErrorText({ children }: { children: string }) {
  return <Text color="red">{children}</Text>;
}

export function SuccessText({ children }: { children: string }) {
  return <Text color="green">{children}</Text>;
}

export function WarningText({ children }: { children: string }) {
  return <Text color="yellow">{children}</Text>;
}

export function HelpText({ children }: { children: ReactNode }) {
  return <Text dimColor>{children}</Text>;
}

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text bold dimColor>
      {children}
    </Text>
  );
}

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Box columnGap={1}>
      <FieldLabel>{`${label}:`}</FieldLabel>
      {children}
    </Box>
  );
}

export function FormContainer({ children }: { children: ReactNode }) {
  return (
    <Box flexDirection="column" marginY={1}>
      {children}
    </Box>
  );
}

type KeyboardHint = {
  key: string;
  action: string;
};

export function KeyboardHelp({ hints }: { hints: KeyboardHint[] }) {
  const text = hints.map((h) => `${h.key} ${h.action}`).join(" • ");
  return <HelpText>{text}</HelpText>;
}

export type SelectOption = {
  label: string;
  value: string;
};

type SelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  isFocused?: boolean;
  placeholder?: string;
  onSubmit?: () => void;
};

export function Select({
  options,
  value,
  onChange,
  isFocused = false,
  placeholder,
  onSubmit,
}: SelectProps) {
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selectedOption = useMemo(() => {
    return options.find((option) => option.value === value) ?? null;
  }, [options, value]);

  useEffect(() => {
    const selectedIndex = options.findIndex((option) => option.value === value);
    setHighlightIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [options, value]);

  const moveHighlight = (direction: number) => {
    if (!options.length) return;
    setHighlightIndex((prev) => {
      const nextIndex = (prev + direction + options.length) % options.length;
      const nextOption = options[nextIndex];
      if (nextOption) {
        onChange(nextOption.value);
      }
      return nextIndex;
    });
  };

  useInput(
    (_input, key) => {
      if (!isFocused) return;

      if (key.upArrow) {
        moveHighlight(-1);
        return;
      }

      if (key.downArrow) {
        moveHighlight(1);
        return;
      }

      if (key.return) {
        onSubmit?.();
      }
    },
    { isActive: isFocused },
  );

  if (!isFocused) {
    return (
      <Text dimColor={!value}>{selectedOption?.label ?? placeholder ?? " "}</Text>
    );
  }

  return (
    <Box flexDirection="column">
      {options.map((option, index) => {
        const isHighlighted = index === highlightIndex;
        return (
          <Text
            key={`${option.value}-${index}`}
            color={isHighlighted ? "cyan" : undefined}
            bold={isHighlighted}
          >
            {isHighlighted ? "›" : " "} {option.label}
          </Text>
        );
      })}
      {options.length === 0 && placeholder && (
        <Text dimColor>{placeholder}</Text>
      )}
    </Box>
  );
}
