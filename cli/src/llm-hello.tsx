import { Box, Text, useInput } from "ink";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient, type HelloResponse } from "./api.js";
import { useAddViews, useSession } from "./context.js";
import {
  ErrorText,
  FieldLabel,
  KeyboardHelp,
  LoadingText,
  WarningText,
} from "./ui.js";

export function LlmHello({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  const [result, setResult] = useState<HelloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const exitToCommander = useCallback(
    (label: string) => {
      addViews(
        [
          {
            kind: "text",
            option: { label, dimColor: true },
          },
          { kind: "commander" },
        ],
        1,
      );
    },
    [addViews],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchHello = async () => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await apiClient.getHelloMessage(
          session?.bearerToken,
        );
        if (cancelled) return;
        setResult(response);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch hello response",
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchHello();

    return () => {
      cancelled = true;
    };
  }, [apiClient, session?.bearerToken, refreshTick]);

  const refresh = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      exitToCommander("Closed /llm/hello");
    }

    if (key.return && !isLoading) {
      exitToCommander("Back to commands");
    }

    if (!isLoading && input?.toLowerCase() === "r") {
      refresh();
    }
  });

  if (isLoading) {
    return <LoadingText>Calling /api/openai/hello...</LoadingText>;
  }

  return (
    <Box flexDirection="column" rowGap={1}>
      {!session && (
        <WarningText>
          Not authenticated. Request sent anonymously without bearer token.
        </WarningText>
      )}

      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        result && (
          <Box flexDirection="column" rowGap={1}>
            <Box columnGap={1}>
              <FieldLabel>Greeting</FieldLabel>
              <Text>{result.greeting}</Text>
            </Box>
            <Box columnGap={1}>
              <FieldLabel>Detail</FieldLabel>
              <Text>{result.detail}</Text>
            </Box>
          </Box>
        )
      )}

      <KeyboardHelp
        hints={[
          { key: "Enter", action: "Close" },
          { key: "Esc", action: "Cancel" },
          { key: "r", action: "Refresh" },
        ]}
      />
    </Box>
  );
}
