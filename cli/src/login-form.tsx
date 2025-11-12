import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useCallback } from "react";
import { saveSession, type SessionData } from "./session.js";
import { useAddView } from "./view-context.js";

export type LoginFormProps = {
  apiUrl: string;
  onSuccess?: (data: SessionData) => void;
  isActive?: boolean;
  onDismiss?: () => void;
};

type FormState = "editing" | "submitting" | "success" | "error";

export function LoginForm({
  apiUrl,
  onSuccess,
  isActive = true,
  onDismiss,
}: LoginFormProps) {
  const addView = useAddView();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [field, setField] = useState<"email" | "password">("email");
  const [state, setState] = useState<FormState>("editing");
  const [errorMessage, setErrorMessage] = useState("");

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

      const sessionData: SessionData = {
        token: data.session?.token || data.token,
        user: {
          id: data.user?.id || "",
          email: data.user?.email || email,
          name: data.user?.name,
          role: data.user?.role,
        },
        expiresAt:
          data.session?.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      await saveSession(sessionData);
      setState("success");
      onSuccess?.(sessionData);
      const label = sessionData.user.email || sessionData.user.name || "User";
      addView({ kind: "text", message: `Login successful: ${label}` });
      addView({ kind: "palette" });
      onDismiss?.();
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
      setTimeout(() => {
        setState("editing");
      }, 2000);
    }
  }, [addView, apiUrl, email, password, onSuccess, onDismiss]);

  useInput(
    useCallback(
      (_input, key) => {
        if (state !== "editing") return;
        if (key.escape) {
          addView({ kind: "palette" });
          onDismiss?.();
        } else if (key.return) {
          if (field === "email" && email) {
            setField("password");
          } else if (field === "password" || (email && password)) {
            handleSubmit();
          }
        } else if (key.tab || key.rightArrow) {
          // Navigate forward: email -> password
          if (field === "email") {
            setField("password");
          }
        } else if (key.leftArrow) {
          // Navigate backward: password -> email
          if (field === "password") {
            setField("email");
          }
        }
      },
      [addView, state, field, email, password, handleSubmit, onDismiss],
    ),
    { isActive },
  );

  return (
    <Box flexDirection="column" rowGap={1}>
      <Box flexDirection="row" paddingX={2} columnGap={2}>
        <Text>Email:</Text>
        {field === "email" ? (
          <TextInput
            value={email}
            onChange={setEmail}
            placeholder="user@example.com"
            focus={isActive}
          />
        ) : (
          <Text color="cyan">{email}</Text>
        )}
        <Text>Password:</Text>
        {field === "password" ? (
          <TextInput
            value={password}
            onChange={setPassword}
            mask="•"
            focus={isActive}
          />
        ) : (
          <Text dimColor>{password ? "••••••••" : ""}</Text>
        )}
        {state === "submitting" && <Text dimColor>[Loading...]</Text>}
      </Box>
      {state === "error" && errorMessage && (
        <Box paddingX={2}>
          <Text color="red">[Error] {errorMessage}</Text>
        </Box>
      )}
      {state === "editing" && (
        <Box paddingX={2}>
          <Text dimColor>
            Tab/Arrows: Navigate • Enter: Next/Submit • Esc: Cancel
          </Text>
        </Box>
      )}
    </Box>
  );
}
