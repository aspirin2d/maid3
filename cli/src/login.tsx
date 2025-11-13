import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import { validateEmail, validatePassword } from "./validation.js";

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

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const res = await fetch(`${url}/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          // Generic error to avoid information leakage
          throw new Error("Invalid email or password");
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
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          setError('Request timeout - server not responding');
        } else if (e instanceof TypeError) {
          setError("Network error: Cannot connect to server");
        } else {
          setError(e.message);
        }
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
    }
  }, [url, email, password, setSession, addViews]);

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
