import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useContext, useState } from "react";
import { useAddViews, useSession, viewContext } from "./context.js";
import { validateEmail, validatePassword, validateName } from "./validation.js";

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

  const context = useContext(viewContext);
  if (!context) throw new Error("viewContext is not available");
  const { generateViewId } = context;

  useInput(
    (_input, key) => {
      if (!active) return;

      if (key.tab && !key.shift) {
        setError("");
        if (step === "name") {
          const nameError = validateName(name);
          if (nameError) {
            setError(nameError);
          } else {
            setStep("email");
          }
        } else if (step === "email") {
          const emailError = validateEmail(email);
          if (emailError) {
            setError(emailError);
          } else {
            setStep("password");
          }
        }
        return;
      }

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
            id: generateViewId(),
            kind: "text",
            option: { label: "Signup canceled", dimColor: true },
          },
          { id: generateViewId(), kind: "commander" },
        );

        setActive(false);
      }
    },
    { isActive: active },
  );

  const signup = useCallback(async () => {
    try {
      const nameError = validateName(name);
      if (nameError) {
        setError(nameError);
        setStep("name");
        return;
      }

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
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          let message = "Failed to signup";
          try {
            const json = await res.json();
            if (json.message) message = json.message;
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
            id: generateViewId(),
            kind: "text",
            option: {
              label: "Signed up as " + json.user.email,
            },
          },
          { id: generateViewId(), kind: "commander" },
        );
        setActive(false);
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
  }, [url, name, email, password, setSession, addViews, generateViewId]);

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
              const nameError = validateName(name);
              if (nameError) {
                setError(nameError);
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

      {step === "name" && (
        <Text dimColor>Press Tab to continue, Esc to cancel.</Text>
      )}

      {step === "email" && (
        <Text dimColor>Press Tab to continue, Shift+Tab to go back, Esc to cancel.</Text>
      )}

      {step === "password" && (
        <Text dimColor>Press Shift+Tab to go back, Esc to cancel.</Text>
      )}

      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
