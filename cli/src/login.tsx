import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useState, useContext } from "react";
import { viewContext } from "./context.js";

export default function Login({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeField, setActiveField] = useState<"email" | "password">("email");

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);

  const addView = useContext(viewContext);

  useInput((_input, key) => {
    if (!key.tab) return;

    setActiveField((prev) => {
      if (key.shift) {
        return prev === "email" ? "password" : "email";
      }
      return prev === "password" ? "email" : "password";
    });
  });

  const login = useCallback(async () => {
    try {
      setLoading(true);
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
      const json = await res.json();
      setUser(json.user);

      if (addView) addView({ kind: "commander" });
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [url, email, password, setUser, setLoading, addView]);

  if (loading) {
    return <Text color="gray">Loading...</Text>;
  }

  if (user) {
    return (
      <Text bold dimColor>
        Login as {user.email}
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
          placeholder="********"
          mask="*"
          focus={activeField === "password"}
          onSubmit={login}
        />
      </Box>
    </Box>
  );
}
