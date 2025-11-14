import { Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import { validateEmail, validatePassword, validateName } from "./validation.js";
import { createApiClient } from "./api.js";
import {
  ErrorText,
  FieldRow,
  FormContainer,
  HelpText,
  LoadingText,
} from "./ui.js";

export default function Signup({ url }: { url: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "email" | "password">("name");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [, setSession] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  useInput((_input, key) => {
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
        [
          {
            kind: "text",
            option: { label: "Signup canceled", dimColor: true },
          },
          { kind: "commander" },
        ],
        1,
      );
    }
  });

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

      const { token, user } = await apiClient.signup({
        name,
        email,
        password,
      });

      setSession({
        email: user.email,
        bearerToken: token ?? "",
        isAdmin: user.role === "admin",
      });

      addViews(
        [
          {
            kind: "text",
            option: {
              label: "Signed up as " + user.email,
            },
          },
          { kind: "commander" },
        ],
        1,
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
  }, [apiClient, name, email, password, setSession, addViews]);

  if (loading) {
    return <LoadingText>Loading...</LoadingText>;
  }

  return (
    <FormContainer>
      <FieldRow label="Name">
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
          <Text>{name || " "}</Text>
        )}
      </FieldRow>

      {(step === "email" || step === "password") && (
        <FieldRow label="Email">
          {step === "email" ? (
            <TextInput
              value={email}
              onChange={setEmail}
              placeholder="user@example.com"
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
            <Text>{email || " "}</Text>
          )}
        </FieldRow>
      )}

      {step === "password" && (
        <FieldRow label="Password">
          <TextInput
            value={password}
            onChange={setPassword}
            mask="*"
            focus
            onSubmit={signup}
          />
        </FieldRow>
      )}

      {step === "name" && (
        <HelpText>Press Tab to continue, Esc to cancel</HelpText>
      )}

      {step === "email" && (
        <HelpText>Press Tab to continue, Shift+Tab to go back, Esc to cancel</HelpText>
      )}

      {step === "password" && (
        <HelpText>Press Shift+Tab to go back, Esc to cancel</HelpText>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </FormContainer>
  );
}
