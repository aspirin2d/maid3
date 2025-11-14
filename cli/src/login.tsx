import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import { validateEmail, validatePassword } from "./validation.js";
import { createApiClient } from "./api.js";

export default function Login({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [, setSession] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  useInput((_input, key) => {
    if (key.tab && !key.shift && step === "email") {
      const emailError = validateEmail(email);
      if (emailError) {
        setError(emailError);
      } else {
        setError("");
        setStep("password");
      }
      return;
    }

    if (key.shift && key.tab && step === "password") {
      setStep("email");
      setError("");
      return;
    }

    if (key.escape) {
      addViews(
        [
          {
            kind: "text",
            option: { label: "Login canceled", dimColor: true },
          },
          { kind: "commander" },
        ],
        -1,
      );
    }
  });

  const login = useCallback(async () => {
    try {
      const emailError = validateEmail(email);
      if (emailError) {
        setError(emailError);
        setStep("email");
        return;
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        setStep("password");
        return;
      }

      setLoading(true);
      setError("");

      const { token, user } = await apiClient.login({ email, password });
      const sessionData = await apiClient.getSession(token);
      const sessionUser = sessionData?.user ?? user;

      setSession({
        email: sessionUser.email,
        bearerToken: token,
        isAdmin: sessionUser.role === "admin",
      });

      const loginLabel = `Login as ${sessionUser.email}${
        sessionUser.role === "admin" ? " [admin]" : ""
      }`;

      addViews(
        [
          {
            kind: "text",
            option: {
              label: loginLabel,
              dimColor: true,
            },
          },
          { kind: "commander" },
        ],
        -1,
      );
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, email, password, setSession, addViews]);

  if (loading) {
    return <Text color="gray">Loading...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box columnGap={1}>
        <Text bold dimColor>
          Email:
        </Text>
        {step === "email" ? (
          <TextInput
            value={email}
            onChange={setEmail}
            placeholder="abc@abc.com"
            focus
            onSubmit={() => {
              const emailError = validateEmail(email);
              if (emailError) {
                setError(emailError);
                return;
              }
              setError("");
              setStep("password");
            }}
          />
        ) : (
          <Text>{email}</Text>
        )}
      </Box>

      {step === "password" && (
        <Box columnGap={1}>
          <Text bold dimColor>
            Password:
          </Text>
          <TextInput
            value={password}
            onChange={setPassword}
            mask="*"
            focus
            onSubmit={login}
          />
        </Box>
      )}

      {step === "email" && (
        <Text dimColor>Press Tab to continue, Esc to cancel.</Text>
      )}

      {step === "password" && (
        <Text dimColor>Press Shift+Tab to edit email, Esc to cancel.</Text>
      )}

      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
