import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import {
  createApiClient,
  type CreateStoryRequest,
  type Story,
  type StoryListResponse,
  type UpdateStoryRequest,
} from "./api.js";
import {
  ErrorText,
  FieldRow,
  FormContainer,
  HelpText,
  LoadingText,
  WarningText,
} from "./ui.js";

type ViewMode = "list" | "confirm-delete" | "create" | "edit";
type StoryFormStep = "name" | "embeddingProvider" | "llmProvider" | "handler";

type StoryFormData = {
  name: string;
  embeddingProvider: string;
  llmProvider: string;
  handler: string;
};

const createEmptyStoryForm = (): StoryFormData => ({
  name: "",
  embeddingProvider: "",
  llmProvider: "",
  handler: "",
});

const PAGE_SIZE = 10;
const EMBEDDING_PROVIDERS = ["openai", "ollama", "dashscope"] as const;
const LLM_PROVIDERS = ["openai", "ollama"] as const;

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}

function cycleIndex(
  current: number,
  direction: number,
  maxIndex: number,
): number {
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
  const [storiesData, setStoriesData] = useState<StoryListResponse | null>(
    null,
  );
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [formStep, setFormStep] = useState<StoryFormStep>("name");
  const [storyFormData, setStoryFormData] = useState<StoryFormData>(() =>
    createEmptyStoryForm(),
  );
  const [storyBeingEdited, setStoryBeingEdited] = useState<Story | null>(null);

  const resetFormState = useCallback(() => {
    setStoryFormData(createEmptyStoryForm());
    setFormStep("name");
  }, []);

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
          typeof response.total === "number"
            ? response.total
            : normalizedStories.length;

        const hasNext =
          response.hasNext ?? offset + normalizedStories.length < total;

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
    return storiesData.stories[
      clampIndex(selectedIndex, storiesData.stories.length)
    ];
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
  }, [
    selectedStory,
    session?.bearerToken,
    apiClient,
    clearOperationState,
    triggerRefresh,
  ]);

  const validateStoryForm = useCallback((): string | null => {
    if (!storyFormData.name.trim()) {
      return "Story name is required";
    }

    if (storyFormData.name.length > 200) {
      return "Story name must be 200 characters or less";
    }

    if (storyFormData.embeddingProvider) {
      const validEmbedding = EMBEDDING_PROVIDERS.some(
        (p) => p === storyFormData.embeddingProvider,
      );
      if (!validEmbedding) {
        return `Embedding provider must be one of: ${EMBEDDING_PROVIDERS.join(", ")} or leave blank`;
      }
    }

    if (storyFormData.llmProvider) {
      const validLlm = LLM_PROVIDERS.some(
        (p) => p === storyFormData.llmProvider,
      );
      if (!validLlm) {
        return `LLM provider must be one of: ${LLM_PROVIDERS.join(", ")} or leave blank`;
      }
    }

    if (storyFormData.handler && storyFormData.handler.length > 100) {
      return "Handler must be 100 characters or less";
    }

    return null;
  }, [storyFormData]);

  const createStory = useCallback(async () => {
    if (!session?.bearerToken) return;

    const validationError = validateStoryForm();
    if (validationError) {
      setOperationError(validationError);
      return;
    }

    setIsOperationLoading(true);
    clearOperationState();

    try {
      const payload: CreateStoryRequest = {
        name: storyFormData.name.trim(),
      };

      if (storyFormData.embeddingProvider) {
        payload.embeddingProvider = storyFormData
          .embeddingProvider as CreateStoryRequest["embeddingProvider"];
      }

      if (storyFormData.llmProvider) {
        payload.llmProvider = storyFormData.llmProvider as CreateStoryRequest["llmProvider"];
      }

      if (storyFormData.handler.trim()) {
        payload.handler = storyFormData.handler.trim();
      }

      await apiClient.createStory(session.bearerToken, payload);

      setViewMode("list");
      resetFormState();
      setOperationMessage("Story created");
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
    storyFormData,
    apiClient,
    validateStoryForm,
    clearOperationState,
    resetFormState,
    triggerRefresh,
  ]);

  const updateStory = useCallback(async () => {
    if (!session?.bearerToken || !storyBeingEdited) return;

    const validationError = validateStoryForm();
    if (validationError) {
      setOperationError(validationError);
      return;
    }

    clearOperationState();

    const payload: UpdateStoryRequest = {};
    const trimmedName = storyFormData.name.trim();
    if (trimmedName && trimmedName !== storyBeingEdited.name) {
      payload.name = trimmedName;
    }

    const embedding = storyFormData.embeddingProvider;
    if (
      embedding &&
      embedding !== (storyBeingEdited.embeddingProvider ?? "")
    ) {
      payload.embeddingProvider = embedding as UpdateStoryRequest["embeddingProvider"];
    }

    const llm = storyFormData.llmProvider;
    if (llm && llm !== (storyBeingEdited.llmProvider ?? "")) {
      payload.llmProvider = llm as UpdateStoryRequest["llmProvider"];
    }

    const handler = storyFormData.handler.trim();
    if (handler && handler !== (storyBeingEdited.handler ?? "")) {
      payload.handler = handler;
    }

    if (Object.keys(payload).length === 0) {
      setOperationError("No changes to update");
      return;
    }

    setIsOperationLoading(true);

    try {
      await apiClient.updateStory(
        session.bearerToken,
        storyBeingEdited.id,
        payload,
      );

      setViewMode("list");
      setStoryBeingEdited(null);
      resetFormState();
      setOperationMessage("Story updated");
      triggerRefresh();
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to update story",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [
    session?.bearerToken,
    storyBeingEdited,
    storyFormData,
    apiClient,
    validateStoryForm,
    resetFormState,
    triggerRefresh,
    clearOperationState,
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

  const validateAndAdvanceFormStep = useCallback(() => {
    if (formStep === "name") {
      if (!storyFormData.name.trim()) {
        setOperationError("Story name is required");
      } else if (storyFormData.name.length > 200) {
        setOperationError("Story name must be 200 characters or less");
      } else {
        setOperationError(null);
        setFormStep("embeddingProvider");
      }
    } else if (formStep === "embeddingProvider") {
      if (storyFormData.embeddingProvider) {
        const validEmbedding = EMBEDDING_PROVIDERS.some(
          (p) => p === storyFormData.embeddingProvider,
        );
        if (!validEmbedding) {
          setOperationError(
            `Embedding provider must be one of: ${EMBEDDING_PROVIDERS.join(", ")} or leave blank`,
          );
          return;
        }
      }
      setOperationError(null);
      setFormStep("llmProvider");
    } else if (formStep === "llmProvider") {
      if (storyFormData.llmProvider) {
        const validLlm = LLM_PROVIDERS.some(
          (p) => p === storyFormData.llmProvider,
        );
        if (!validLlm) {
          setOperationError(
            `LLM provider must be one of: ${LLM_PROVIDERS.join(", ")} or leave blank`,
          );
          return;
        }
      }
      setOperationError(null);
      setFormStep("handler");
    }
  }, [formStep, storyFormData]);

  const handleFormStepNavigation = useCallback(
    (direction: number) => {
      setOperationError(null);
      const steps: StoryFormStep[] = [
        "name",
        "embeddingProvider",
        "llmProvider",
        "handler",
      ];
      const currentIndex = steps.indexOf(formStep);
      const nextIndex = currentIndex + direction;

      if (nextIndex >= 0 && nextIndex < steps.length) {
        const nextStep = steps[nextIndex];
        if (nextStep) {
          setFormStep(nextStep);
        }
      }
    },
    [formStep],
  );

  const enterCreateMode = useCallback(() => {
    resetFormState();
    setStoryBeingEdited(null);
    setViewMode("create");
    clearOperationState();
  }, [clearOperationState, resetFormState]);

  const cancelCreateMode = useCallback(() => {
    setViewMode("list");
    resetFormState();
    clearOperationState();
  }, [clearOperationState, resetFormState]);

  const enterEditMode = useCallback(() => {
    if (!selectedStory) return;
    setStoryBeingEdited(selectedStory);
    setStoryFormData({
      name: selectedStory.name,
      embeddingProvider: selectedStory.embeddingProvider ?? "",
      llmProvider: selectedStory.llmProvider ?? "",
      handler: selectedStory.handler ?? "",
    });
    setFormStep("name");
    setViewMode("edit");
    clearOperationState();
  }, [selectedStory, clearOperationState]);

  const cancelEditMode = useCallback(() => {
    setViewMode("list");
    setStoryBeingEdited(null);
    resetFormState();
    clearOperationState();
  }, [clearOperationState, resetFormState]);

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

      if (viewMode === "create" || viewMode === "edit") {
        if (key.escape) {
          if (viewMode === "create") {
            cancelCreateMode();
          } else {
            cancelEditMode();
          }
          return;
        }

        if (key.tab && !key.shift) {
          validateAndAdvanceFormStep();
          return;
        }

        if (key.shift && key.tab) {
          handleFormStepNavigation(-1);
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

      if ((input === "e" || input === "E") && selectedStory) {
        enterEditMode();
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

  if (viewMode === "create" || viewMode === "edit") {
    const isEditing = viewMode === "edit";
    return (
      <FormContainer>
        <Text bold>
          {isEditing ? "Edit Story" : "Create New Story"}
          {isEditing && storyBeingEdited
            ? ` — ${storyBeingEdited.name}`
            : ""}
        </Text>

        <FieldRow label="Name">
          {formStep === "name" ? (
            <TextInput
              value={storyFormData.name}
              onChange={(value) =>
                setStoryFormData((prev) => ({ ...prev, name: value }))
              }
              placeholder="Enter story name"
              focus
              onSubmit={validateAndAdvanceFormStep}
            />
          ) : (
            <Text>{storyFormData.name || " "}</Text>
          )}
        </FieldRow>

        {(formStep === "embeddingProvider" ||
          formStep === "llmProvider" ||
          formStep === "handler") && (
          <FieldRow label="Embedding">
            {formStep === "embeddingProvider" ? (
              <TextInput
                value={storyFormData.embeddingProvider}
                onChange={(value) =>
                setStoryFormData((prev) => ({
                  ...prev,
                  embeddingProvider: value,
                }))
              }
              placeholder={
                isEditing
                  ? `${EMBEDDING_PROVIDERS.join("/")} or leave blank to keep current`
                  : `${EMBEDDING_PROVIDERS.join("/")} or blank`
              }
                focus
                onSubmit={validateAndAdvanceFormStep}
              />
            ) : (
              <Text>{storyFormData.embeddingProvider || "default"}</Text>
            )}
          </FieldRow>
        )}

        {(formStep === "llmProvider" || formStep === "handler") && (
          <FieldRow label="LLM">
            {formStep === "llmProvider" ? (
              <TextInput
                value={storyFormData.llmProvider}
                onChange={(value) =>
                setStoryFormData((prev) => ({ ...prev, llmProvider: value }))
              }
              placeholder={
                isEditing
                  ? `${LLM_PROVIDERS.join("/")} or leave blank to keep current`
                  : `${LLM_PROVIDERS.join("/")} or blank`
              }
                focus
                onSubmit={validateAndAdvanceFormStep}
              />
            ) : (
              <Text>{storyFormData.llmProvider || "default"}</Text>
            )}
          </FieldRow>
        )}

        {formStep === "handler" && (
          <FieldRow label="Handler">
            <TextInput
              value={storyFormData.handler}
              onChange={(value) =>
                setStoryFormData((prev) => ({ ...prev, handler: value }))
              }
              placeholder={
                isEditing ? "Leave blank to keep current" : "Leave blank for default"
              }
              focus
              onSubmit={isEditing ? updateStory : createStory}
            />
          </FieldRow>
        )}

        {formStep === "name" && (
          <HelpText>
            {isEditing
              ? "Press Tab to continue, Esc to cancel editing"
              : "Press Tab to continue, Esc to cancel"}
          </HelpText>
        )}
        {formStep === "embeddingProvider" && (
          <HelpText>
            Press Tab to continue, Shift+Tab to go back, Esc to cancel
          </HelpText>
        )}
        {formStep === "llmProvider" && (
          <HelpText>
            Press Tab to continue, Shift+Tab to go back, Esc to cancel
          </HelpText>
        )}
        {formStep === "handler" && (
          <HelpText>
            {isEditing
              ? "Press Enter to save (leave blank to keep current), Shift+Tab to go back, Esc to cancel"
              : "Press Enter to create (leave blank for default), Shift+Tab to go back, Esc to cancel"}
          </HelpText>
        )}

        {isOperationLoading && (
          <LoadingText>
            {isEditing ? "Updating story..." : "Creating story..."}
          </LoadingText>
        )}
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
                LLM: {selectedStory.llmProvider} | Embedding:{" "}
                {selectedStory.embeddingProvider}
              </Text>
              <Text dimColor>
                Handler: {selectedStory.handler || "default"}
              </Text>
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
              Total: {storiesData?.total ?? 0} • Page {currentPage}/{totalPages}
            </Text>
          </Box>

          <HelpText>
            ↑/↓/Tab select
            {hasPrev ? " • ← previous page" : ""}
            {hasNext ? " • → next page" : ""}
            {" • c create"}
            {selectedStory ? " • e edit • x delete" : ""} • q exit
          </HelpText>
          {isOperationLoading && <LoadingText>Working...</LoadingText>}
          {operationMessage && <WarningText>{operationMessage}</WarningText>}
          {operationError && <ErrorText>{operationError}</ErrorText>}
        </>
      )}
    </FormContainer>
  );
}
