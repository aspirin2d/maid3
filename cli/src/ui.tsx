import { Box, Text } from "ink";
import { ReactNode } from "react";

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
    <Box flexDirection="column" rowGap={1}>
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
