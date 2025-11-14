import { useCallback, useEffect, useMemo, useState } from "react";
import { useInput } from "ink";
import TextInput from "ink-text-input";
import { createApiClient } from "./api.js";
import { useAddViews, useSession } from "./context.js";
import { validateName } from "./validation.js";
import {
  ErrorText,
  FieldRow,
  FormContainer,
  KeyboardHelp,
  LoadingText,
} from "./ui.js";

export default function UpdateName({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  const [name, setName] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) return;

    addViews(
      [
        {
          kind: "text",
          option: {
            label: "Please login before updating your name",
            color: "yellow",
          },
        },
        { kind: "commander" },
      ],
      1,
    );
    setInitializing(false);
  }, [session, addViews]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      setInitializing(true);
      try {
        const data = await apiClient.getSession(session.bearerToken);
        if (cancelled) return;
        setName(data.user.name ?? "");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load profile",
        );
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, apiClient]);

  useInput((_input, key) => {
    if (key.escape && !loading) {
      addViews(
        [
          {
            kind: "text",
            option: { label: "Update name canceled", dimColor: true },
          },
          { kind: "commander" },
        ],
        1,
      );
    }
  });

  const submit = useCallback(async () => {
    if (!session) return;
    const trimmed = name.trim();
    const nameError = validateName(trimmed);
    if (nameError) {
      setError(nameError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiClient.updateName(session.bearerToken, {
        name: trimmed,
      });

      addViews(
        [
          {
            kind: "text",
            option: {
              label: `Updated name to ${response.user.name ?? trimmed}`,
              color: "green",
            },
          },
          { kind: "commander" },
        ],
        1,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update your name",
      );
    } finally {
      setLoading(false);
    }
  }, [session, name, apiClient, addViews]);

  if (!session) return null;
  if (initializing) {
    return <LoadingText>Loading profile...</LoadingText>;
  }

  if (loading) {
    return <LoadingText>Updating name...</LoadingText>;
  }

  return (
    <FormContainer>
      <FieldRow label="New Name">
        <TextInput
          value={name}
          onChange={(value) => {
            setName(value);
            setError("");
          }}
          focus
          onSubmit={submit}
          placeholder="Ada Lovelace"
        />
      </FieldRow>
      <KeyboardHelp hints={[{ key: "Enter", action: "Save" }, { key: "Esc", action: "Cancel" }]} />
      {error && <ErrorText>{error}</ErrorText>}
    </FormContainer>
  );
}
