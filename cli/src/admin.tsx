import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import { MIN_PASSWORD_LENGTH, validateEmail, validateName } from "./validation.js";

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  createdAt?: string | null;
  status?: string | null;
};

type AdminUsersResponse = {
  users: AdminUser[];
  total: number;
  meta: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

type ResetPasswordResponse = {
  userId: string;
  password: string;
};

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
        const params = new URLSearchParams({
          limit: PAGE_SIZE.toString(),
          offset: ((currentPage - 1) * PAGE_SIZE).toString(),
        });

        const response = await fetch(`${url}/admin/u?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${session.bearerToken}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = `Failed to load users (HTTP ${response.status})`;
          try {
            const body = await response.json();
            if (body.error) message = body.error;
          } catch {}
          throw new Error(message);
        }

        const json = (await response.json()) as Partial<AdminUsersResponse>;
        if (cancelled) return;

        const normalizedUsers = Array.isArray(json.users)
          ? (json.users as AdminUser[])
          : [];

        const total =
          typeof json.total === "number" ? json.total : normalizedUsers.length;

        const normalizedMeta = {
          page: json.meta?.page ?? currentPage,
          pageSize: json.meta?.pageSize ?? PAGE_SIZE,
          totalPages: json.meta?.totalPages ?? Math.ceil(total / PAGE_SIZE),
          hasNext: json.meta?.hasNext ?? currentPage * PAGE_SIZE < total,
          hasPrev: json.meta?.hasPrev ?? currentPage > 1,
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
  }, [session?.bearerToken, session?.isAdmin, currentPage, url, refreshTrigger]);

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
      const response = await fetch(`${url}/admin/u/${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.bearerToken}`,
        },
      });

      if (!response.ok) {
        let message = `Failed to delete user (HTTP ${response.status})`;
        try {
          const body = await response.json();
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      setViewMode("list");
      triggerRefresh();
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to delete user",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [selectedUser, session?.bearerToken, url, clearOperationState, triggerRefresh]);

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
      const response = await fetch(`${url}/admin/u/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editFormData.name,
          email: editFormData.email,
          role: editFormData.role,
          ...(trimmedPassword ? { password: trimmedPassword } : {}),
        }),
      });

      if (!response.ok) {
        let message = `Failed to update user (HTTP ${response.status})`;
        try {
          const body = await response.json();
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

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
    url,
    validateEditForm,
    clearOperationState,
    triggerRefresh,
  ]);

  const resetPassword = useCallback(async () => {
    if (!selectedUser || !session?.bearerToken) return;

    setIsOperationLoading(true);
    clearOperationState();

    try {
      const response = await fetch(`${url}/admin/u/${selectedUser.id}/pwd`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.bearerToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        let message = `Failed to reset password (HTTP ${response.status})`;
        try {
          const body = await response.json();
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      const body = (await response.json()) as Partial<ResetPasswordResponse>;
      if (!body?.password) {
        throw new Error("Password reset succeeded but password missing");
      }

      setOperationMessage(
        `Temporary password for ${selectedUser.email}: ${body.password}`,
      );
      setViewMode("list");
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to reset password",
      );
    } finally {
      setIsOperationLoading(false);
    }
  }, [selectedUser, session?.bearerToken, url, clearOperationState]);

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
    return <Text color="yellow">Please login to view admin users.</Text>;
  }

  if (!session.isAdmin) {
    return (
      <Text color="red">Admin privileges are required for this view.</Text>
    );
  }

  if (viewMode === "confirm-delete" && selectedUser) {
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold color="red">
          Delete User
        </Text>
        <Box flexDirection="column" borderStyle="single" paddingX={1}>
          <Text>{selectedUser.name ?? selectedUser.email}</Text>
          <Text dimColor>{selectedUser.email}</Text>
          <Text dimColor>Role: {selectedUser.role ?? DEFAULT_ROLE}</Text>
        </Box>
        <Text color="yellow">Are you sure you want to delete this user?</Text>
        {isOperationLoading ? (
          <Text dimColor>Deleting user...</Text>
        ) : (
          <Text dimColor>Press Y to confirm, N or Esc to cancel</Text>
        )}
        {operationError && <Text color="red">{operationError}</Text>}
      </Box>
    );
  }

  if (viewMode === "confirm-reset" && selectedUser) {
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold color="yellow">
          Reset Password
        </Text>
        <Box flexDirection="column" borderStyle="single" paddingX={1}>
          <Text>{selectedUser.name ?? selectedUser.email}</Text>
          <Text dimColor>{selectedUser.email}</Text>
          <Text dimColor>Role: {selectedUser.role ?? DEFAULT_ROLE}</Text>
        </Box>
        <Text color="yellow">
          Reset password and generate a temporary password for this user?
        </Text>
        {isOperationLoading ? (
          <Text dimColor>Resetting password...</Text>
        ) : (
          <Text dimColor>Press Y to confirm, N or Esc to cancel</Text>
        )}
        {operationMessage && <Text color="yellow">{operationMessage}</Text>}
        {operationError && <Text color="red">{operationError}</Text>}
      </Box>
    );
  }

  if (viewMode === "edit" && selectedUser) {
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold>Edit User: {selectedUser.email}</Text>

        <Box columnGap={1}>
          <Text bold dimColor>
            Name:
          </Text>
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
            <Text>{editFormData.name}</Text>
          )}
        </Box>

        {(editStep === "email" || editStep === "role" || editStep === "password") && (
          <Box columnGap={1}>
            <Text bold dimColor>
              Email:
            </Text>
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
              <Text>{editFormData.email}</Text>
            )}
          </Box>
        )}

        {(editStep === "role" || editStep === "password") && (
          <Box columnGap={1}>
            <Text bold dimColor>
              Role:
            </Text>
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
              <Text>{editFormData.role}</Text>
            )}
          </Box>
        )}

        {editStep === "password" && (
          <Box columnGap={1}>
            <Text bold dimColor>
              Password:
            </Text>
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
          </Box>
        )}

        {editStep === "name" && (
          <Text dimColor>Press Tab to continue, Esc to cancel</Text>
        )}
        {editStep === "email" && (
          <Text dimColor>
            Press Tab to continue, Shift+Tab to go back, Esc to cancel
          </Text>
        )}
        {editStep === "role" && (
          <Text dimColor>
            Press Tab to continue, Shift+Tab to go back, Esc to cancel
          </Text>
        )}
        {editStep === "password" && (
          <Text dimColor>
            Press Enter to save (leave blank to keep current password), Shift+Tab to go
            back, Esc to cancel
          </Text>
        )}

        {isOperationLoading && <Text dimColor>Updating user...</Text>}
        {operationError && <Text color="red">{operationError}</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" rowGap={1}>
      <Text bold>{`/admin users — Page ${usersData?.meta.page ?? currentPage}`}</Text>

      {isLoadingUsers && <Text dimColor>Loading users...</Text>}

      {loadError && <Text color="red">{loadError}</Text>}

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
            <Text dimColor>No users found.</Text>
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

          <Text dimColor>
            ↑/↓/Tab select
            {usersData?.meta.hasPrev && " • ← previous page"}
            {usersData?.meta.hasNext && " • → next page"}
            {selectedUser && " • e edit • x delete • p reset pwd"} • q exit
          </Text>
          {isOperationLoading && <Text dimColor>Working...</Text>}
          {operationMessage && <Text color="yellow">{operationMessage}</Text>}
          {operationError && <Text color="red">{operationError}</Text>}
        </>
      )}
    </Box>
  );
}
