import { Box, Text, useInput } from "ink";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createApiClient, type HelloResponse } from "./api.js";
import { useAddViews, useSession } from "./context.js";
import { ErrorText, KeyboardHelp, LoadingText, WarningText } from "./ui.js";

export function LlmHello({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  const [result, setResult] = useState<HelloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompleted, setHasCompleted] = useState(false);

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
      setHasCompleted(false);

      try {
        const response = await apiClient.getHelloMessage(session?.bearerToken);
        if (cancelled) return;
        setResult(response);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to fetch hello response",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasCompleted(true);
        }
      }
    };

    fetchHello();

    return () => {
      cancelled = true;
    };
  }, [apiClient, session?.bearerToken]);

  useInput((_input) => {
    if (!isLoading && hasCompleted) {
      exitToCommander("Closed /llm/hello");
    }
  });

  if (isLoading) {
    return <LoadingText>Calling /api/openai/hello...</LoadingText>;
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {!session && (
        <WarningText>
          Not authenticated. Request sent anonymously without bearer token.
        </WarningText>
      )}

      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        result && (
          <Box flexDirection="column">
            <Box>
              <Box width={12}>
                <Text dimColor>Greeting</Text>
              </Box>
              <Text>{result.greeting.trim()}</Text>
            </Box>
            <Box>
              <Box width={12}>
                <Text dimColor>Detail</Text>
              </Box>
              <Text>{result.detail.trim()}</Text>
            </Box>
          </Box>
        )
      )}

      <KeyboardHelp hints={[{ key: "Any key", action: "to continue..." }]} />
    </Box>
  );
}
