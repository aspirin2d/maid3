import { useCallback, useEffect, useMemo, useState } from "react";
import { useInput } from "ink";
import TextInput from "ink-text-input";
import { createApiClient } from "./api.js";
import { useAddViews, useSession } from "./context.js";
import { validatePassword } from "./validation.js";
import {
  ErrorText,
  FieldRow,
  FormContainer,
  HelpText,
  KeyboardHelp,
  LoadingText,
} from "./ui.js";

type Step = "current" | "new" | "confirm";

export default function UpdatePassword({ url }: { url: string }) {
  const [session, setSession] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  const [step, setStep] = useState<Step>("current");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) return;
    addViews(
      [
        {
          kind: "text",
          option: {
            label: "Please login before updating your password",
            color: "yellow",
          },
        },
        { kind: "commander" },
      ],
      1,
    );
  }, [session, addViews]);

  useInput((_input, key) => {
    if (loading) return;

    if (key.tab && !key.shift) {
      setStep((prev) => (prev === "current" ? "new" : prev === "new" ? "confirm" : "confirm"));
      setError("");
      return;
    }

    if (key.shift && key.tab) {
      setStep((prev) => (prev === "confirm" ? "new" : "current"));
      setError("");
      return;
    }

    if (key.escape) {
      addViews(
        [
          {
            kind: "text",
            option: { label: "Password update canceled", dimColor: true },
          },
          { kind: "commander" },
        ],
        1,
      );
    }
  });

  const submit = useCallback(async () => {
    if (!session) return;

    const currentError = validatePassword(currentPassword);
    if (currentError) {
      setError(`Current password: ${currentError}`);
      setStep("current");
      return;
    }

    const newError = validatePassword(newPassword);
    if (newError) {
      setError(`New password: ${newError}`);
      setStep("new");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from the current password");
      setStep("new");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setStep("confirm");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { token: maybeNewToken } = await apiClient.updateSelf(
        session.bearerToken,
        {
          password: newPassword,
        },
      );

      if (maybeNewToken) {
        setSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            bearerToken: maybeNewToken,
          };
        });
      }

      addViews(
        [
          {
            kind: "text",
            option: { label: "Password updated", color: "green" },
          },
          { kind: "commander" },
        ],
        1,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update your password",
      );
      setStep("current");
    } finally {
      setLoading(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [session, currentPassword, newPassword, confirmPassword, apiClient, setSession, addViews]);

  if (!session) return null;
  if (loading) {
    return <LoadingText>Updating password...</LoadingText>;
  }

  const hints = [
    { key: "Tab", action: "Next field" },
    { key: "Shift+Tab", action: "Previous field" },
    { key: "Enter", action: step === "confirm" ? "Save" : "Next" },
    { key: "Esc", action: "Cancel" },
  ];

  return (
    <FormContainer>
      <FieldRow label="Current Password">
        <TextInput
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value);
            setError("");
          }}
          mask="*"
          focus={step === "current"}
          onSubmit={() => setStep("new")}
        />
      </FieldRow>
      <FieldRow label="New Password">
        <TextInput
          value={newPassword}
          onChange={(value) => {
            setNewPassword(value);
            setError("");
          }}
          mask="*"
          focus={step === "new"}
          onSubmit={() => setStep("confirm")}
        />
      </FieldRow>
      <FieldRow label="Confirm Password">
        <TextInput
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setError("");
          }}
          mask="*"
          focus={step === "confirm"}
          onSubmit={submit}
        />
      </FieldRow>
      <HelpText>Your current password is required to confirm the change.</HelpText>
      <KeyboardHelp hints={hints} />
      {error && <ErrorText>{error}</ErrorText>}
    </FormContainer>
  );
}
