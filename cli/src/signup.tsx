import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useState } from "react";
import { useAddViews, useSession } from "./context.js";

export default function Signup({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "email" | "password">("name");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [active, setActive] = useState(true);
  const [, setSession] = useSession();
  const addViews = useAddViews();

  useInput(
    (_input, key) => {
      if (!active) return;

      if (key.shift && key.tab) {
        setError("");
        if (step === "password") {
          setStep("email");
        } else if (step === "email") {
          setStep("name");
        }
        return;
      }

      if (key.escape) {
        addViews(
          {
            kind: "text",
            option: { label: "Signup canceled", dimColor: true },
          },
          { kind: "commander" },
        );

        setActive(false);
      }
    },
    { isActive: active },
  );

  const signup = useCallback(async () => {
    try {
      if (!name) {
        setError("Name is required");
        setStep("name");
        return;
      }
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
      // Password validation
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        setStep("password");
        return;
      }

      setLoading(true);
      setError("");

      const res = await fetch(`${url}/auth/sign-up/email`, {
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
      if (!res.ok) {
        let message = "Failed to signup";
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
      addViews(
        {
          kind: "text",
          option: {
            label: "Signed up as " + json.user.email,
          },
        },
        { kind: "commander" },
      );
      setActive(false);
    } catch (e: any) {
      if (e instanceof TypeError) {
        setError("Network error: Cannot connect to server");
      } else {
        setError(e.message ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, [url, name, email, password, setSession, addViews, setStep, setError]);

  if (!active) return null;

  if (loading) {
    return <Text color="gray">Loading...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box columnGap={1}>
        <Text bold dimColor>
          Name:
        </Text>
        {step === "name" ? (
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Your Name"
            focus
            onSubmit={() => {
              if (!name) {
                setError("Name is required");
                return;
              }
              setError("");
              setStep("email");
            }}
          />
        ) : (
          <Text>{name}</Text>
        )}
      </Box>

      {(step === "email" || step === "password") && (
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
      )}

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
            onSubmit={signup}
          />
        </Box>
      )}

      {step !== "name" && (
        <Text dimColor>Press Shift+Tab to go back, Esc to cancel.</Text>
      )}

      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
