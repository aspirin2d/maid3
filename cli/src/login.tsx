import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useState, useContext } from "react";
import { viewContext } from "./context.js";

export default function Login({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeField, setActiveField] = useState<"email" | "password">("email");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [active, setActive] = useState(true);

  const context = useContext(viewContext);

  useInput((_input, key) => {
    if (key.tab) {
      setActiveField((prev) => {
        if (key.shift) {
          return prev === "email" ? "password" : "email";
        }
        return prev === "password" ? "email" : "password";
      });
    }

    if (key.escape) {
      setActive(false);
      if (context) context.setViews([...context.views, { kind: "commander" }]);
    }
  });

  const login = useCallback(async () => {
    try {
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
      // const authToken = res.headers.get("set-auth-token");
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

      if (context) {
        context.setSession({ email: json.user.email, bearToken: token ?? "" });
        context.setViews([...context.views, { kind: "commander" }]);
      }
    } catch (e: any) {
      setError(e.message ?? "Unkown error");
    } finally {
      setLoading(false);
    }
  }, [url, email, password, setLoading, context]);

  if (loading) {
    return <Text color="gray">Loading...</Text>;
  }

  if (context && context.session) {
    return (
      <Text bold dimColor>
        Login as {context.session.email}
      </Text>
    );
  }

  if (!active) {
    return (
      <Text bold dimColor>
        Login canceld
      </Text>
    );
  }

  return (
    <Box flexDirection="column">
      <Box columnGap={1}>
        <Text bold dimColor>
          Email:
        </Text>
        <TextInput
          value={email}
          onChange={setEmail}
          placeholder="abc@abc.com"
          focus={activeField === "email"}
          onSubmit={() => setActiveField("password")}
        />
      </Box>
      <Box columnGap={1}>
        <Text bold dimColor>
          Password:
        </Text>
        <TextInput
          value={password}
          onChange={setPassword}
          mask="*"
          focus={activeField === "password"}
          onSubmit={login}
        />
      </Box>

      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}
