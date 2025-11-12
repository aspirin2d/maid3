import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState, useCallback } from "react";
import { saveSession, type SessionData } from "./session.js";
import { useAddView } from "./view-context.js";

export type SignupFormProps = {
  apiUrl: string;
  onSuccess?: (data: SessionData) => void;
  isActive?: boolean;
};

type FormState = "editing" | "submitting" | "success" | "error";

export function SignupForm({
  apiUrl,
  onSuccess,
  isActive = true,
}: SignupFormProps) {
  const addView = useAddView();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [field, setField] = useState<"name" | "email" | "password">("name");
  const [state, setState] = useState<FormState>("editing");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!name || !email || !password) {
      setErrorMessage("Name, email, and password are required");
      return;
    }

    setState("submitting");
    setErrorMessage("");

    try {
      const response = await fetch(`${apiUrl}/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Signup failed");
      }

      const sessionData: SessionData = {
        token: data.session?.token || data.token,
        user: {
          id: data.user?.id || "",
          email: data.user?.email || email,
          name: data.user?.name || name,
          role: data.user?.role,
        },
        expiresAt: data.session?.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      await saveSession(sessionData);
      setState("success");
      onSuccess?.(sessionData);
      const label =
        sessionData.user.email || sessionData.user.name || sessionData.user.id;
      addView({ kind: "text", message: `Signup successful: ${label}` });
      addView({ kind: "palette" });
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
      setTimeout(() => {
        setState("editing");
      }, 2000);
    }
  }, [addView, apiUrl, name, email, password, onSuccess]);

  useInput(
    useCallback(
      (_input, key) => {
        if (state !== "editing") return;
        if (key.escape) {
          addView({ kind: "palette" });
        } else if (key.return) {
          if (field === "name" && name) {
            setField("email");
          } else if (field === "email" && email) {
            setField("password");
          } else if (field === "password" || (name && email && password)) {
            handleSubmit();
          }
        } else if (key.tab || key.rightArrow) {
          // Navigate forward: name -> email -> password
          if (field === "name") {
            setField("email");
          } else if (field === "email") {
            setField("password");
          }
        } else if (key.leftArrow) {
          // Navigate backward: password -> email -> name
          if (field === "password") {
            setField("email");
          } else if (field === "email") {
            setField("name");
          }
        }
      },
      [addView, state, field, name, email, password, handleSubmit],
    ),
    { isActive },
  );

  return (
    <Box flexDirection="column" rowGap={1}>
      <Box flexDirection="row" paddingX={2} columnGap={2}>
        <Text>Name:</Text>
        {field === "name" ? (
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Jane Doe"
            focus={isActive}
          />
        ) : (
          <Text color="cyan">{name}</Text>
        )}
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
      {state === "success" && (
        <Box paddingX={2}>
          <Text color="green">[Success] Account created successfully!</Text>
        </Box>
      )}
      {state === "editing" && (
        <Box paddingX={2}>
          <Text dimColor>Tab/Arrows: Navigate • Enter: Next/Submit • Esc: Cancel</Text>
        </Box>
      )}
    </Box>
  );
}
