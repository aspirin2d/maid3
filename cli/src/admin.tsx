import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import { MIN_PASSWORD_LENGTH, validateEmail, validateName } from "./validation.js";
import {
  createApiClient,
  type AdminUser,
  type AdminUsersResponse,
} from "./api.js";
import {
  ErrorText,
  FieldRow,
  FormContainer,
  HelpText,
  LoadingText,
  WarningText,
} from "./ui.js";

type ViewMode = "list" | "confirm-delete" | "confirm-reset" | "edit";
type EditStep = "name" | "email" | "role" | "password";

const PAGE_SIZE = 10;
const VALID_ROLES = ["user", "admin"] as const;
const DEFAULT_ROLE = "user";

function isValidRole(role: string): boolean {
  return VALID_ROLES.includes(role as typeof VALID_ROLES[number]);
}

function normalizeRole(role: string | null | undefined): string {
  const normalized = (role ?? DEFAULT_ROLE).toLowerCase().trim();
  return isValidRole(normalized) ? normalized : DEFAULT_ROLE;
}

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

export function AdminUsers({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();
  const apiClient = useMemo(() => createApiClient(url), [url]);

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [usersData, setUsersData] = useState<AdminUsersResponse | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editStep, setEditStep] = useState<EditStep>("name");
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "",
    password: "",
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
    if (!session?.bearerToken || !session.isAdmin) return;

    const controller = new AbortController();
    let cancelled = false;

    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      setLoadError(null);

      try {
        const response = await apiClient.listUsers(session.bearerToken, {
          limit: PAGE_SIZE,
          offset: (currentPage - 1) * PAGE_SIZE,
        });

        if (cancelled) return;

        const normalizedUsers = Array.isArray(response.users)
          ? response.users
          : [];

        const total =
          typeof response.total === "number" ? response.total : normalizedUsers.length;

        const normalizedMeta = {
          page: response.meta?.page ?? currentPage,
          pageSize: response.meta?.pageSize ?? PAGE_SIZE,
          totalPages: response.meta?.totalPages ?? Math.ceil(total / PAGE_SIZE),
          hasNext: response.meta?.hasNext ?? currentPage * PAGE_SIZE < total,
          hasPrev: response.meta?.hasPrev ?? currentPage > 1,
        };

        setUsersData({
          users: normalizedUsers,
          total,
          meta: normalizedMeta,
        });

        setSelectedIndex((prev) => clampIndex(prev, normalizedUsers.length));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error) {
          setLoadError(err.message);
        } else {
          setLoadError("Unexpected error while loading users");
        }
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    };

    fetchUsers();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session?.bearerToken, session?.isAdmin, currentPage, apiClient, refreshTrigger]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [currentPage]);

  const selectedUser = useMemo(() => {
    if (!usersData?.users.length) return null;
    return usersData.users[clampIndex(selectedIndex, usersData.users.length)];
  }, [usersData, selectedIndex]);

  const hasEditChanges = useCallback((): boolean => {
    if (!selectedUser) return false;
    return (
      editFormData.name !== (selectedUser.name ?? "") ||
      editFormData.email !== selectedUser.email ||
      editFormData.role !== normalizeRole(selectedUser.role) ||
      editFormData.password !== ""
    );
  }, [selectedUser, editFormData]);

  const deleteUser = useCallback(async () => {
    if (!selectedUser || !session?.bearerToken) return;

    setIsOperationLoading(true);
    clearOperationState();

    try {
      await apiClient.deleteUser(session.bearerToken, selectedUser.id);
      setViewMode("list");
      triggerRefresh();
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to delete user",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [selectedUser, session?.bearerToken, apiClient, clearOperationState, triggerRefresh]);

  const validateEditForm = useCallback((): string | null => {
    const nameError = validateName(editFormData.name);
    if (nameError) return nameError;

    const emailError = validateEmail(editFormData.email);
    if (emailError) return emailError;

    if (!editFormData.role) return "Role is required";
    if (!isValidRole(editFormData.role)) {
      return `Role must be one of: ${VALID_ROLES.join(", ")}`;
    }

    const trimmedPassword = editFormData.password.trim();
    if (trimmedPassword && trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    return null;
  }, [editFormData]);

  const updateUser = useCallback(async () => {
    if (!selectedUser || !session?.bearerToken) return;

    const validationError = validateEditForm();
    if (validationError) {
      setOperationError(validationError);
      return;
    }

    setIsOperationLoading(true);
    clearOperationState();

    try {
      const trimmedPassword = editFormData.password.trim();
      await apiClient.updateUser(session.bearerToken, selectedUser.id, {
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role,
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      });

      setViewMode("list");
      setEditFormData({ name: "", email: "", role: "", password: "" });
      triggerRefresh();
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to update user",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [
    selectedUser,
    editFormData,
    session?.bearerToken,
    apiClient,
    validateEditForm,
    clearOperationState,
    triggerRefresh,
  ]);

  const resetPassword = useCallback(async () => {
    if (!selectedUser || !session?.bearerToken) return;

    setIsOperationLoading(true);
    clearOperationState();

    try {
      const response = await apiClient.resetUserPassword(
        session.bearerToken,
        selectedUser.id,
      );

      setOperationMessage(
        `Temporary password for ${selectedUser.email}: ${response.password}`,
      );
      setViewMode("list");
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to reset password",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [selectedUser, session?.bearerToken, apiClient, clearOperationState]);

  const handleNavigateUsers = useCallback(
    (direction: number) => {
      setSelectedIndex((prev) => {
        const maxIndex = (usersData?.users.length ?? 1) - 1;
        return cycleIndex(prev, direction, maxIndex);
      });
    },
    [usersData?.users.length],
  );

  const handleNavigatePages = useCallback(
    (direction: number) => {
      if (direction < 0 && usersData?.meta.hasPrev) {
        setCurrentPage((prev) => Math.max(1, prev - 1));
      } else if (direction > 0 && usersData?.meta.hasNext) {
        setCurrentPage((prev) => prev + 1);
      }
    },
    [usersData?.meta],
  );

  const validateAndAdvanceEditStep = useCallback(() => {
    if (editStep === "name") {
      const nameError = validateName(editFormData.name);
      if (nameError) {
        setOperationError(nameError);
      } else {
        setOperationError(null);
        setEditStep("email");
      }
    } else if (editStep === "email") {
      const emailError = validateEmail(editFormData.email);
      if (emailError) {
        setOperationError(emailError);
      } else {
        setOperationError(null);
        setEditStep("role");
      }
    } else if (editStep === "role") {
      if (!editFormData.role) {
        setOperationError("Role is required");
      } else if (!isValidRole(editFormData.role)) {
        setOperationError(`Role must be one of: ${VALID_ROLES.join(", ")}`);
      } else {
        setOperationError(null);
        setEditStep("password");
      }
    }
  }, [editStep, editFormData]);

  const handleEditStepNavigation = useCallback(
    (direction: number) => {
      setOperationError(null);
      const steps: EditStep[] = ["name", "email", "role", "password"];
      const currentIndex = steps.indexOf(editStep);
      const nextIndex = currentIndex + direction;

      if (nextIndex >= 0 && nextIndex < steps.length) {
        setEditStep(steps[nextIndex]);
      }
    },
    [editStep],
  );

  const enterEditMode = useCallback(() => {
    if (!selectedUser) return;
    setEditFormData({
      name: selectedUser.name ?? "",
      email: selectedUser.email,
      role: normalizeRole(selectedUser.role),
      password: "",
    });
    setEditStep("name");
    setViewMode("edit");
    clearOperationState();
  }, [selectedUser, clearOperationState]);

  const cancelEditMode = useCallback(() => {
    if (hasEditChanges()) {
      setOperationMessage("Changes discarded");
    }
    setViewMode("list");
    setEditFormData({ name: "", email: "", role: "", password: "" });
    clearOperationState();
  }, [hasEditChanges, clearOperationState]);

  useInput(
    (input, key) => {
      if (viewMode === "confirm-delete") {
        if (input === "y" || input === "Y") {
          deleteUser();
        } else if (input === "n" || input === "N" || key.escape) {
          setViewMode("list");
          clearOperationState();
        }
        return;
      }

      if (viewMode === "confirm-reset") {
        if (isOperationLoading) return;

        if (input === "y" || input === "Y") {
          resetPassword();
        } else if (input === "n" || input === "N" || key.escape) {
          setViewMode("list");
          clearOperationState();
        }
        return;
      }

      if (viewMode === "edit") {
        if (key.escape) {
          cancelEditMode();
          return;
        }

        if (key.tab && !key.shift) {
          validateAndAdvanceEditStep();
          return;
        }

        if (key.shift && key.tab) {
          handleEditStepNavigation(-1);
          return;
        }

        return;
      }

      if (input === "q" || input === "Q") {
        exitToCommander("Exited /admin users");
        return;
      }

      if (input === "x" || input === "X") {
        if (selectedUser) {
          setViewMode("confirm-delete");
          clearOperationState();
        }
        return;
      }

      if (input === "e" || input === "E") {
        if (selectedUser) {
          enterEditMode();
        }
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((prev) => {
          const maxIndex = (usersData?.users.length ?? 1) - 1;
          return Math.min(maxIndex, prev + 1);
        });
        return;
      }

      if (key.tab) {
        const direction = key.shift ? -1 : 1;
        handleNavigateUsers(direction);
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

      if ((input === "p" || input === "P") && selectedUser) {
        setViewMode("confirm-reset");
        clearOperationState();
        return;
      }
    },
    { isActive: !!session?.isAdmin },
  );

  if (!session) {
    return <WarningText>Please login to view admin users</WarningText>;
  }

  if (!session.isAdmin) {
    return <ErrorText>Admin privileges are required for this view</ErrorText>;
  }

  if (viewMode === "confirm-delete" && selectedUser) {
    return (
      <FormContainer>
        <Text bold color="red">
          Delete User
        </Text>
        <Box flexDirection="column" borderStyle="single" paddingX={1}>
          <Text>{selectedUser.name ?? selectedUser.email}</Text>
          <Text dimColor>{selectedUser.email}</Text>
          <Text dimColor>Role: {selectedUser.role ?? DEFAULT_ROLE}</Text>
        </Box>
        <WarningText>Are you sure you want to delete this user?</WarningText>
        {isOperationLoading ? (
          <LoadingText>Deleting user...</LoadingText>
        ) : (
          <HelpText>Press Y to confirm, N or Esc to cancel</HelpText>
        )}
        {operationError && <ErrorText>{operationError}</ErrorText>}
      </FormContainer>
    );
  }

  if (viewMode === "confirm-reset" && selectedUser) {
    return (
      <FormContainer>
        <Text bold color="yellow">
          Reset Password
        </Text>
        <Box flexDirection="column" borderStyle="single" paddingX={1}>
          <Text>{selectedUser.name ?? selectedUser.email}</Text>
          <Text dimColor>{selectedUser.email}</Text>
          <Text dimColor>Role: {selectedUser.role ?? DEFAULT_ROLE}</Text>
        </Box>
        <WarningText>
          Reset password and generate a temporary password for this user?
        </WarningText>
        {isOperationLoading ? (
          <LoadingText>Resetting password...</LoadingText>
        ) : (
          <HelpText>Press Y to confirm, N or Esc to cancel</HelpText>
        )}
        {operationMessage && <WarningText>{operationMessage}</WarningText>}
        {operationError && <ErrorText>{operationError}</ErrorText>}
      </FormContainer>
    );
  }

  if (viewMode === "edit" && selectedUser) {
    return (
      <FormContainer>
        <Text bold>Edit User: {selectedUser.email}</Text>

        <FieldRow label="Name">
          {editStep === "name" ? (
            <TextInput
              value={editFormData.name}
              onChange={(value) =>
                setEditFormData((prev) => ({ ...prev, name: value }))
              }
              placeholder="Enter name"
              focus
              onSubmit={validateAndAdvanceEditStep}
            />
          ) : (
            <>{editFormData.name}</>
          )}
        </FieldRow>

        {(editStep === "email" || editStep === "role" || editStep === "password") && (
          <FieldRow label="Email">
            {editStep === "email" ? (
              <TextInput
                value={editFormData.email}
                onChange={(value) =>
                  setEditFormData((prev) => ({ ...prev, email: value }))
                }
                placeholder="user@example.com"
                focus
                onSubmit={validateAndAdvanceEditStep}
              />
            ) : (
              <>{editFormData.email}</>
            )}
          </FieldRow>
        )}

        {(editStep === "role" || editStep === "password") && (
          <FieldRow label="Role">
            {editStep === "role" ? (
              <TextInput
                value={editFormData.role}
                onChange={(value) =>
                  setEditFormData((prev) => ({ ...prev, role: value }))
                }
                placeholder={VALID_ROLES.join(" or ")}
                focus
                onSubmit={validateAndAdvanceEditStep}
              />
            ) : (
              <>{editFormData.role}</>
            )}
          </FieldRow>
        )}

        {editStep === "password" && (
          <FieldRow label="Password">
            <TextInput
              value={editFormData.password}
              onChange={(value) =>
                setEditFormData((prev) => ({ ...prev, password: value }))
              }
              placeholder="Leave blank to keep current"
              focus
              mask="*"
              onSubmit={updateUser}
            />
          </FieldRow>
        )}

        {editStep === "name" && (
          <HelpText>Press Tab to continue, Esc to cancel</HelpText>
        )}
        {editStep === "email" && (
          <HelpText>Press Tab to continue, Shift+Tab to go back, Esc to cancel</HelpText>
        )}
        {editStep === "role" && (
          <HelpText>Press Tab to continue, Shift+Tab to go back, Esc to cancel</HelpText>
        )}
        {editStep === "password" && (
          <HelpText>
            Press Enter to save (leave blank to keep current password), Shift+Tab to go
            back, Esc to cancel
          </HelpText>
        )}

        {isOperationLoading && <LoadingText>Updating user...</LoadingText>}
        {operationError && <ErrorText>{operationError}</ErrorText>}
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <Text bold>{`/admin users — Page ${usersData?.meta.page ?? currentPage}`}</Text>

      {isLoadingUsers && <LoadingText>Loading users...</LoadingText>}

      {loadError && <ErrorText>{loadError}</ErrorText>}

      {!isLoadingUsers && !loadError && (
        <>
          {usersData?.users.length ? (
            <Box flexDirection="column">
              {usersData.users.map((user, index) => {
                const isSelected = index === selectedIndex;
                const displayName = user.name ?? "Unnamed";
                const displayRole = user.role ?? DEFAULT_ROLE;
                const line = `${displayName} <${user.email}> · ${displayRole}`;
                return (
                  <Text
                    key={user.id}
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
            <Text dimColor>No users found</Text>
          )}

          {selectedUser && (
            <Box flexDirection="column" borderStyle="single" paddingX={1}>
              <Text>{selectedUser.name ?? selectedUser.email}</Text>
              <Text dimColor>ID: {selectedUser.id}</Text>
              <Text dimColor>
                Role: {selectedUser.role ?? DEFAULT_ROLE} | Status:{" "}
                {selectedUser.status ?? "unknown"}
              </Text>
              {selectedUser.createdAt && (
                <Text dimColor>
                  Created: {new Date(selectedUser.createdAt).toLocaleString()}
                </Text>
              )}
            </Box>
          )}

          <Box columnGap={2}>
            <Text dimColor>
              Users {usersData?.users.length ? selectedIndex + 1 : 0}/
              {usersData?.users.length ?? 0} on this page
            </Text>
            <Text dimColor>
              Total: {usersData?.total ?? 0} • Page {usersData?.meta.page ?? currentPage}/
              {usersData?.meta.totalPages ?? 1}
            </Text>
          </Box>

          <HelpText>
            ↑/↓/Tab select
            {usersData?.meta.hasPrev && " • ← previous page"}
            {usersData?.meta.hasNext && " • → next page"}
            {selectedUser && " • e edit • x delete • p reset pwd"} • q exit
          </HelpText>
          {isOperationLoading && <LoadingText>Working...</LoadingText>}
          {operationMessage && <WarningText>{operationMessage}</WarningText>}
          {operationError && <ErrorText>{operationError}</ErrorText>}
        </>
      )}
    </FormContainer>
  );
}
