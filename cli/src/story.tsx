import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import { createApiClient, type StoryListResponse, type Story } from "./api.js";
import {
  ErrorText,
  FieldRow,
  FormContainer,
  HelpText,
  LoadingText,
  WarningText,
} from "./ui.js";

type ViewMode = "list" | "confirm-delete" | "create";
type CreateStep = "name" | "embeddingProvider" | "llmProvider" | "handler";

const PAGE_SIZE = 10;
const EMBEDDING_PROVIDERS = ["openai", "ollama", "dashscope"] as const;
const LLM_PROVIDERS = ["openai", "ollama"] as const;

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function cycleIndex(current: number, direction: number, maxIndex: number): number {
  const next = current + direction;
  if (next > maxIndex) return 0;
  if (next < 0) return maxIndex;
  return next;
}

export function Stories({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [storiesData, setStoriesData] = useState<StoryListResponse | null>(null);
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [createStep, setCreateStep] = useState<CreateStep>("name");
  const [createFormData, setCreateFormData] = useState({
    name: "",
    embeddingProvider: "",
    llmProvider: "",
    handler: "",
  });

  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const clearOperationState = useCallback(() => {
    setOperationError(null);
    setOperationMessage(null);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!session?.bearerToken) return;

    const controller = new AbortController();
    let cancelled = false;

    const fetchStories = async () => {
      setIsLoadingStories(true);
      setLoadError(null);

      try {
        const offset = (currentPage - 1) * PAGE_SIZE;
        const response = await apiClient.listStories(session.bearerToken, {
          limit: PAGE_SIZE,
          offset,
        });

        if (cancelled) return;

        const normalizedStories = Array.isArray(response.stories)
          ? response.stories
          : [];

        const total =
          typeof response.total === "number" ? response.total : normalizedStories.length;

        const totalPages = Math.ceil(total / PAGE_SIZE);
        const hasNext = response.hasNext ?? offset + normalizedStories.length < total;
        const hasPrev = currentPage > 1;

        setStoriesData({
          stories: normalizedStories,
          total,
          limit: response.limit ?? PAGE_SIZE,
          offset: response.offset ?? offset,
          hasNext,
        });

        setSelectedIndex((prev) => clampIndex(prev, normalizedStories.length));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error) {
          setLoadError(err.message);
        } else {
          setLoadError("Unexpected error while loading stories");
        }
      } finally {
        if (!cancelled) setIsLoadingStories(false);
      }
    };

    fetchStories();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session?.bearerToken, currentPage, apiClient, refreshTrigger]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [currentPage]);

  const selectedStory = useMemo(() => {
    if (!storiesData?.stories.length) return null;
    return storiesData.stories[clampIndex(selectedIndex, storiesData.stories.length)];
  }, [storiesData, selectedIndex]);

  const deleteStory = useCallback(async () => {
    if (!selectedStory || !session?.bearerToken) return;

    setIsOperationLoading(true);
    clearOperationState();

    try {
      await apiClient.deleteStory(session.bearerToken, selectedStory.id);
      setViewMode("list");
      triggerRefresh();
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to delete story",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [selectedStory, session?.bearerToken, apiClient, clearOperationState, triggerRefresh]);

  const validateCreateForm = useCallback((): string | null => {
    if (!createFormData.name.trim()) {
      return "Story name is required";
    }

    if (createFormData.name.length > 200) {
      return "Story name must be 200 characters or less";
    }

    if (createFormData.embeddingProvider) {
      const validEmbedding = EMBEDDING_PROVIDERS.some(p => p === createFormData.embeddingProvider);
      if (!validEmbedding) {
        return `Embedding provider must be one of: ${EMBEDDING_PROVIDERS.join(", ")} or leave blank`;
      }
    }

    if (createFormData.llmProvider) {
      const validLlm = LLM_PROVIDERS.some(p => p === createFormData.llmProvider);
      if (!validLlm) {
        return `LLM provider must be one of: ${LLM_PROVIDERS.join(", ")} or leave blank`;
      }
    }

    if (createFormData.handler && createFormData.handler.length > 100) {
      return "Handler must be 100 characters or less";
    }

    return null;
  }, [createFormData]);

  const createStory = useCallback(async () => {
    if (!session?.bearerToken) return;

    const validationError = validateCreateForm();
    if (validationError) {
      setOperationError(validationError);
      return;
    }

    setIsOperationLoading(true);
    clearOperationState();

    try {
      const payload: any = {
        name: createFormData.name.trim(),
      };

      if (createFormData.embeddingProvider) {
        payload.embeddingProvider = createFormData.embeddingProvider;
      }

      if (createFormData.llmProvider) {
        payload.llmProvider = createFormData.llmProvider;
      }

      if (createFormData.handler.trim()) {
        payload.handler = createFormData.handler.trim();
      }

      await apiClient.createStory(session.bearerToken, payload);

      setViewMode("list");
      setCreateFormData({ name: "", embeddingProvider: "", llmProvider: "", handler: "" });
      triggerRefresh();
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to create story",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [
    session?.bearerToken,
    createFormData,
    apiClient,
    validateCreateForm,
    clearOperationState,
    triggerRefresh,
  ]);

  const handleNavigateStories = useCallback(
    (direction: number) => {
      setSelectedIndex((prev) => {
        const maxIndex = (storiesData?.stories.length ?? 1) - 1;
        return cycleIndex(prev, direction, maxIndex);
      });
    },
    [storiesData?.stories.length],
  );

  const handleNavigatePages = useCallback(
    (direction: number) => {
      if (direction < 0 && currentPage > 1) {
        setCurrentPage((prev) => Math.max(1, prev - 1));
      } else if (direction > 0 && storiesData?.hasNext) {
        setCurrentPage((prev) => prev + 1);
      }
    },
    [currentPage, storiesData?.hasNext],
  );

  const validateAndAdvanceCreateStep = useCallback(() => {
    if (createStep === "name") {
      if (!createFormData.name.trim()) {
        setOperationError("Story name is required");
      } else if (createFormData.name.length > 200) {
        setOperationError("Story name must be 200 characters or less");
      } else {
        setOperationError(null);
        setCreateStep("embeddingProvider");
      }
    } else if (createStep === "embeddingProvider") {
      if (createFormData.embeddingProvider) {
        const validEmbedding = EMBEDDING_PROVIDERS.some(p => p === createFormData.embeddingProvider);
        if (!validEmbedding) {
          setOperationError(`Embedding provider must be one of: ${EMBEDDING_PROVIDERS.join(", ")} or leave blank`);
          return;
        }
      }
      setOperationError(null);
      setCreateStep("llmProvider");
    } else if (createStep === "llmProvider") {
      if (createFormData.llmProvider) {
        const validLlm = LLM_PROVIDERS.some(p => p === createFormData.llmProvider);
        if (!validLlm) {
          setOperationError(`LLM provider must be one of: ${LLM_PROVIDERS.join(", ")} or leave blank`);
          return;
        }
      }
      setOperationError(null);
      setCreateStep("handler");
    }
  }, [createStep, createFormData]);

  const handleCreateStepNavigation = useCallback(
    (direction: number) => {
      setOperationError(null);
      const steps: CreateStep[] = ["name", "embeddingProvider", "llmProvider", "handler"];
      const currentIndex = steps.indexOf(createStep);
      const nextIndex = currentIndex + direction;

      if (nextIndex >= 0 && nextIndex < steps.length) {
        const nextStep = steps[nextIndex];
        if (nextStep) {
          setCreateStep(nextStep);
        }
      }
    },
    [createStep],
  );

  const enterCreateMode = useCallback(() => {
    setCreateFormData({
      name: "",
      embeddingProvider: "",
      llmProvider: "",
      handler: "",
    });
    setCreateStep("name");
    setViewMode("create");
    clearOperationState();
  }, [clearOperationState]);

  const cancelCreateMode = useCallback(() => {
    setViewMode("list");
    setCreateFormData({ name: "", embeddingProvider: "", llmProvider: "", handler: "" });
    clearOperationState();
  }, [clearOperationState]);

  useInput(
    (input, key) => {
      if (viewMode === "confirm-delete") {
        if (input === "y" || input === "Y") {
          deleteStory();
        } else if (input === "n" || input === "N" || key.escape) {
          setViewMode("list");
          clearOperationState();
        }
        return;
      }

      if (viewMode === "create") {
        if (key.escape) {
          cancelCreateMode();
          return;
        }

        if (key.tab && !key.shift) {
          validateAndAdvanceCreateStep();
          return;
        }

        if (key.shift && key.tab) {
          handleCreateStepNavigation(-1);
          return;
        }

        return;
      }

      if (input === "q" || input === "Q") {
        exitToCommander("Exited /story");
        return;
      }

      if (input === "x" || input === "X") {
        if (selectedStory) {
          setViewMode("confirm-delete");
          clearOperationState();
        }
        return;
      }

      if (input === "c" || input === "C") {
        enterCreateMode();
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((prev) => {
          const maxIndex = (storiesData?.stories.length ?? 1) - 1;
          return Math.min(maxIndex, prev + 1);
        });
        return;
      }

      if (key.tab) {
        const direction = key.shift ? -1 : 1;
        handleNavigateStories(direction);
        return;
      }

      if (key.leftArrow) {
        handleNavigatePages(-1);
        return;
      }

      if (key.rightArrow) {
        handleNavigatePages(1);
        return;
      }
    },
    { isActive: !!session },
  );

  if (!session) {
    return <WarningText>Please login to view stories</WarningText>;
  }

  if (viewMode === "confirm-delete" && selectedStory) {
    return (
      <FormContainer>
        <Text bold color="red">
          Delete Story
        </Text>
        <Box flexDirection="column" borderStyle="single" paddingX={1}>
          <Text>{selectedStory.name}</Text>
          <Text dimColor>ID: {selectedStory.id}</Text>
          <Text dimColor>Embedding: {selectedStory.embeddingProvider}</Text>
          <Text dimColor>LLM: {selectedStory.llmProvider}</Text>
        </Box>
        <WarningText>Are you sure you want to delete this story?</WarningText>
        {isOperationLoading ? (
          <LoadingText>Deleting story...</LoadingText>
        ) : (
          <HelpText>Press Y to confirm, N or Esc to cancel</HelpText>
        )}
        {operationError && <ErrorText>{operationError}</ErrorText>}
      </FormContainer>
    );
  }

  if (viewMode === "create") {
    return (
      <FormContainer>
        <Text bold>Create New Story</Text>

        <FieldRow label="Name">
          {createStep === "name" ? (
            <TextInput
              value={createFormData.name}
              onChange={(value) =>
                setCreateFormData((prev) => ({ ...prev, name: value }))
              }
              placeholder="Enter story name"
              focus
              onSubmit={validateAndAdvanceCreateStep}
            />
          ) : (
            <Text>{createFormData.name || " "}</Text>
          )}
        </FieldRow>

        {(createStep === "embeddingProvider" || createStep === "llmProvider" || createStep === "handler") && (
          <FieldRow label="Embedding">
            {createStep === "embeddingProvider" ? (
              <TextInput
                value={createFormData.embeddingProvider}
                onChange={(value) =>
                  setCreateFormData((prev) => ({ ...prev, embeddingProvider: value }))
                }
                placeholder={`${EMBEDDING_PROVIDERS.join("/")} or blank`}
                focus
                onSubmit={validateAndAdvanceCreateStep}
              />
            ) : (
              <Text>{createFormData.embeddingProvider || "default"}</Text>
            )}
          </FieldRow>
        )}

        {(createStep === "llmProvider" || createStep === "handler") && (
          <FieldRow label="LLM">
            {createStep === "llmProvider" ? (
              <TextInput
                value={createFormData.llmProvider}
                onChange={(value) =>
                  setCreateFormData((prev) => ({ ...prev, llmProvider: value }))
                }
                placeholder={`${LLM_PROVIDERS.join("/")} or blank`}
                focus
                onSubmit={validateAndAdvanceCreateStep}
              />
            ) : (
              <Text>{createFormData.llmProvider || "default"}</Text>
            )}
          </FieldRow>
        )}

        {createStep === "handler" && (
          <FieldRow label="Handler">
            <TextInput
              value={createFormData.handler}
              onChange={(value) =>
                setCreateFormData((prev) => ({ ...prev, handler: value }))
              }
              placeholder="Leave blank for default"
              focus
              onSubmit={createStory}
            />
          </FieldRow>
        )}

        {createStep === "name" && (
          <HelpText>Press Tab to continue, Esc to cancel</HelpText>
        )}
        {createStep === "embeddingProvider" && (
          <HelpText>Press Tab to continue, Shift+Tab to go back, Esc to cancel</HelpText>
        )}
        {createStep === "llmProvider" && (
          <HelpText>Press Tab to continue, Shift+Tab to go back, Esc to cancel</HelpText>
        )}
        {createStep === "handler" && (
          <HelpText>
            Press Enter to create (leave blank for default), Shift+Tab to go back, Esc to cancel
          </HelpText>
        )}

        {isOperationLoading && <LoadingText>Creating story...</LoadingText>}
        {operationError && <ErrorText>{operationError}</ErrorText>}
      </FormContainer>
    );
  }

  const totalPages = storiesData ? Math.ceil(storiesData.total / PAGE_SIZE) : 1;
  const hasPrev = currentPage > 1;
  const hasNext = storiesData?.hasNext ?? false;

  return (
    <FormContainer>
      <Text bold>{`/story — Page ${currentPage}`}</Text>

      {isLoadingStories && <LoadingText>Loading stories...</LoadingText>}

      {loadError && <ErrorText>{loadError}</ErrorText>}

      {!isLoadingStories && !loadError && (
        <>
          {storiesData?.stories.length ? (
            <Box flexDirection="column">
              {storiesData.stories.map((story, index) => {
                const isSelected = index === selectedIndex;
                const line = `${story.name} · ${story.llmProvider}/${story.embeddingProvider}`;
                return (
                  <Text
                    key={story.id}
                    color={isSelected ? "cyan" : undefined}
                    dimColor={!isSelected}
                  >
                    {isSelected ? "› " : "  "}
                    {line}
                  </Text>
                );
              })}
            </Box>
          ) : (
            <Text dimColor>No stories found. Press c to create one.</Text>
          )}

          {selectedStory && (
            <Box flexDirection="column" borderStyle="single" paddingX={1}>
              <Text>{selectedStory.name}</Text>
              <Text dimColor>ID: {selectedStory.id}</Text>
              <Text dimColor>
                LLM: {selectedStory.llmProvider} | Embedding: {selectedStory.embeddingProvider}
              </Text>
              <Text dimColor>Handler: {selectedStory.handler || "default"}</Text>
              {selectedStory.createdAt && (
                <Text dimColor>
                  Created: {new Date(selectedStory.createdAt).toLocaleString()}
                </Text>
              )}
            </Box>
          )}

          <Box columnGap={2}>
            <Text dimColor>
              Stories {storiesData?.stories.length ? selectedIndex + 1 : 0}/
              {storiesData?.stories.length ?? 0} on this page
            </Text>
            <Text dimColor>
              Total: {storiesData?.total ?? 0} • Page {currentPage}/
              {totalPages}
            </Text>
          </Box>

          <HelpText>
            ↑/↓/Tab select
            {hasPrev ? " • ← previous page" : ""}
            {hasNext ? " • → next page" : ""}
            {" • c create"}
            {selectedStory ? " • x delete" : ""} • q exit
          </HelpText>
          {isOperationLoading && <LoadingText>Working...</LoadingText>}
          {operationMessage && <WarningText>{operationMessage}</WarningText>}
          {operationError && <ErrorText>{operationError}</ErrorText>}
        </>
      )}
    </FormContainer>
  );
}
