import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useCallback } from "react";

export type LoginFormProps = {
  apiUrl: string;
  onSuccess?: (data: { session: unknown; user: unknown }) => void;
  onCancel?: () => void;
};

type FormState = "editing" | "submitting" | "success" | "error";
type FocusedField = "email" | "password" | "submit";

export function LoginForm({ apiUrl, onSuccess, onCancel }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<FocusedField>("email");
  const [state, setState] = useState<FormState>("editing");
  const [errorMessage, setErrorMessage] = useState("");

  // Handle keyboard navigation
  useInput(
    useCallback(
      (_input, key) => {
        if (state !== "editing") return;

        // Tab to move forward through fields
        if (key.tab && !key.shift) {
          if (focusedField === "email") {
            setFocusedField("password");
          } else if (focusedField === "password") {
            setFocusedField("submit");
          } else {
            setFocusedField("email");
          }
          return;
        }

        // Shift+Tab to move backward through fields
        if (key.tab && key.shift) {
          if (focusedField === "email") {
            setFocusedField("submit");
          } else if (focusedField === "password") {
            setFocusedField("email");
          } else {
            setFocusedField("password");
          }
          return;
        }

        // Escape to cancel
        if (key.escape) {
          onCancel?.();
          return;
        }

        // Enter on submit button
        if (key.return && focusedField === "submit") {
          handleSubmit();
          return;
        }
      },
      [focusedField, state, onCancel],
    ),
  );

  const handleSubmit = useCallback(async () => {
    if (!email || !password) {
      setErrorMessage("Email and password are required");
      return;
    }

    setState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Login failed");
      }

      setState("success");
      onSuccess?.(data);
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
      // Reset to editing state after a delay
      setTimeout(() => {
        setState("editing");
      }, 2000);
    }
  }, [apiUrl, email, password, onSuccess]);

  // Auto-submit when pressing Enter on password field
  const handlePasswordSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  return (
    <Box flexDirection="column" rowGap={1}>
      {/* Header */}
      <Box
        borderStyle="round"
        borderColor="blue"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color="blue">
          🔐 Login to Maid
        </Text>
        <Text dimColor>Enter your credentials to authenticate</Text>
      </Box>

      {/* Form Fields */}
      <Box flexDirection="column" paddingX={2} rowGap={1}>
        {/* Email Field */}
        <Box flexDirection="column">
          <Text
            bold={focusedField === "email"}
            color={focusedField === "email" ? "cyan" : "white"}
          >
            Email:
          </Text>
          <Box
            paddingX={1}
            borderStyle="single"
            borderColor={focusedField === "email" ? "cyan" : "gray"}
          >
            {focusedField === "email" ? (
              <TextInput
                value={email}
                onChange={setEmail}
                placeholder="user@example.com"
              />
            ) : (
              <Text dimColor={!email}>{email || "user@example.com"}</Text>
            )}
          </Box>
        </Box>

        {/* Password Field */}
        <Box flexDirection="column">
          <Text
            bold={focusedField === "password"}
            color={focusedField === "password" ? "cyan" : "white"}
          >
            Password:
          </Text>
          <Box
            paddingX={1}
            borderStyle="single"
            borderColor={focusedField === "password" ? "cyan" : "gray"}
          >
            {focusedField === "password" ? (
              <TextInput
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                mask="•"
                onSubmit={handlePasswordSubmit}
              />
            ) : (
              <Text dimColor={!password}>
                {password ? "••••••••" : "••••••••"}
              </Text>
            )}
          </Box>
        </Box>

        {/* Submit Button */}
        <Box marginTop={1}>
          <Box
            paddingX={2}
            paddingY={0}
            borderStyle="round"
            borderColor={focusedField === "submit" ? "green" : "gray"}
            backgroundColor={focusedField === "submit" ? "#1a1a1a" : undefined}
          >
            <Text
              bold={focusedField === "submit"}
              color={focusedField === "submit" ? "green" : "white"}
            >
              {state === "submitting" ? "⏳ Logging in..." : "✓ Login"}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Status Messages */}
      {state === "error" && errorMessage && (
        <Box paddingX={2}>
          <Text color="red">❌ {errorMessage}</Text>
        </Box>
      )}

      {state === "success" && (
        <Box paddingX={2}>
          <Text color="green">✓ Login successful!</Text>
        </Box>
      )}

      {/* Footer with help */}
      {state === "editing" && (
        <Box paddingX={2} marginTop={1}>
          <Text dimColor>
            Tab: Next field • Shift+Tab: Previous field • Enter: Submit • Esc:
            Cancel
          </Text>
        </Box>
      )}
    </Box>
  );
}
