import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useState } from "react";
import { useAddViews, useSession } from "./context.js";

export default function Login({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [active, setActive] = useState(true);
  const [, setSession] = useSession();
  const addViews = useAddViews();

  useInput(
    (_input, key) => {
      if (!active) return;

      if (key.shift && key.tab && step === "password") {
        setStep("email");
        setError("");
        return;
      }

      if (key.escape) {
        setActive(false);
        addViews(
          {
            kind: "text",
            option: { label: "Login canceled", dimColor: true },
          },
          { kind: "commander" },
        );
      }
    },
    { isActive: active },
  );

  const login = useCallback(async () => {
    try {
      if (!email) {
        setError("Email is required");
        setStep("email");
        return;
      }
      // Email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Invalid email format");
        setStep("email");
        return;
      }
      if (!password) {
        setError("Password is required");
        setStep("password");
        return;
      }
      // Password length check
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        setStep("password");
        return;
      }

      setLoading(true);
      setError("");

      const res = await fetch(`${url}/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      if (!res.ok) {
        let message = "Failed to login";
        try {
          const json = await res.json();
          if (json.message) message += ": " + json.message;
        } catch {}
        throw new Error(message);
      }
      const json = await res.json();
      const token = res.headers.get("set-auth-token");

      setSession({
        email: json.user.email,
        bearerToken: token ?? "",
      });
      setActive(false);
      addViews(
        {
          kind: "text",
          option: {
            label: "Login as " + json.user.email,
          },
        },
        { kind: "commander" },
      );
    } catch (e: any) {
      if (e instanceof TypeError) {
        setError("Network error: Cannot connect to server");
      } else {
        setError(e.message ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, [url, email, password, setStep, setError, setSession, addViews]);

  if (!active) return null;

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
              if (!email) {
                setError("Email is required");
                return;
              }
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                setError("Invalid email format");
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

      {step === "password" && (
        <Text dimColor>Press Shift+Tab to edit email, Esc to cancel.</Text>
      )}

      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
