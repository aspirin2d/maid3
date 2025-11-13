import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";
import { validateEmail, validateName } from "./validation.js";

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

const PAGE_SIZE = 10;

type Mode = "list" | "confirm-delete" | "edit";
type EditStep = "name" | "email" | "role";

export function AdminUsers({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();

  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete/Edit mode states
  const [mode, setMode] = useState<Mode>("list");
  const [editStep, setEditStep] = useState<EditStep>("name");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);

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
    if (!session?.bearerToken || !session.isAdmin) return;

    const controller = new AbortController();
    let cancelled = false;

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: PAGE_SIZE.toString(),
          offset: ((page - 1) * PAGE_SIZE).toString(),
        });

        const res = await fetch(`${url}/admin/u?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${session.bearerToken}`,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = `Failed to load users (HTTP ${res.status})`;
          try {
            const body = await res.json();
            if (body.error) message = body.error;
          } catch {}
          throw new Error(message);
        }

        const json = (await res.json()) as Partial<AdminUsersResponse>;
        if (cancelled) return;

        const normalizedUsers = Array.isArray(json.users)
          ? (json.users as AdminUser[])
          : [];

        const total =
          typeof json.total === "number" ? json.total : normalizedUsers.length;

        // Use backend-calculated meta values when available
        // Otherwise calculate based on current state
        const normalizedMeta = {
          page: json.meta?.page ?? page,
          pageSize: json.meta?.pageSize ?? PAGE_SIZE,
          totalPages: json.meta?.totalPages ?? Math.ceil(total / PAGE_SIZE),
          hasNext: json.meta?.hasNext ?? page * PAGE_SIZE < total,
          hasPrev: json.meta?.hasPrev ?? page > 1,
        };

        setState({
          users: normalizedUsers,
          total,
          meta: normalizedMeta,
        });
        setSelectedIndex((prev) =>
          normalizedUsers.length === 0
            ? 0
            : Math.min(prev, normalizedUsers.length - 1),
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unexpected error while loading users");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUsers();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session?.bearerToken, session?.isAdmin, page, url]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [page]);

  const selectedUser = useMemo(() => {
    if (!state?.users.length) return null;
    return state.users[Math.min(selectedIndex, state.users.length - 1)];
  }, [state, selectedIndex]);

  const deleteUser = useCallback(async () => {
    if (!selectedUser || !session?.bearerToken) return;

    setOperationLoading(true);
    setOperationError(null);

    try {
      const res = await fetch(`${url}/admin/u/${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.bearerToken}`,
        },
      });

      if (!res.ok) {
        let message = `Failed to delete user (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      // Refresh the list
      setMode("list");
      setPage(1);
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to delete user",
      );
    } finally {
      setOperationLoading(false);
    }
  }, [selectedUser, session?.bearerToken, url, setPage, setMode]);

  const updateUser = useCallback(async () => {
    if (!selectedUser || !session?.bearerToken) return;

    const nameError = validateName(editName);
    if (nameError) {
      setOperationError(nameError);
      return;
    }

    const emailError = validateEmail(editEmail);
    if (emailError) {
      setOperationError(emailError);
      return;
    }

    if (!editRole) {
      setOperationError("Role is required");
      return;
    }

    setOperationLoading(true);
    setOperationError(null);

    try {
      const res = await fetch(`${url}/admin/u/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          role: editRole,
        }),
      });

      if (!res.ok) {
        let message = `Failed to update user (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }

      // Refresh the list
      setMode("list");
      setPage(1);
    } catch (err) {
      setOperationError(
        err instanceof Error ? err.message : "Failed to update user",
      );
    } finally {
      setOperationLoading(false);
    }
  }, [
    selectedUser,
    editName,
    editEmail,
    editRole,
    session?.bearerToken,
    url,
    setPage,
    setMode,
  ]);

  useInput(
    (input, key) => {
      // Handle mode-specific inputs
      if (mode === "confirm-delete") {
        if (input === "y" || input === "Y") {
          deleteUser();
          return;
        }
        if (input === "n" || input === "N" || key.escape) {
          setMode("list");
          setOperationError(null);
          return;
        }
        return;
      }

      if (mode === "edit") {
        if (key.escape) {
          setMode("list");
          setOperationError(null);
          return;
        }

        if (key.tab && !key.shift) {
          if (editStep === "name") {
            const nameError = validateName(editName);
            if (nameError) {
              setOperationError(nameError);
            } else {
              setOperationError(null);
              setEditStep("email");
            }
            return;
          }
          if (editStep === "email") {
            const emailError = validateEmail(editEmail);
            if (emailError) {
              setOperationError(emailError);
            } else {
              setOperationError(null);
              setEditStep("role");
            }
            return;
          }
          return;
        }

        if (key.shift && key.tab) {
          setOperationError(null);
          if (editStep === "role") {
            setEditStep("email");
            return;
          }
          if (editStep === "email") {
            setEditStep("name");
            return;
          }
          return;
        }

        return;
      }

      // List mode inputs
      if (input === "q" || input === "Q") {
        exitToCommander("Exited /admin users");
        return;
      }

      if (input === "x" || input === "X") {
        if (selectedUser) {
          setMode("confirm-delete");
          setOperationError(null);
        }
        return;
      }

      if (input === "e" || input === "E") {
        if (selectedUser) {
          setEditName(selectedUser.name ?? "");
          setEditEmail(selectedUser.email);
          setEditRole(selectedUser.role ?? "user");
          setEditStep("name");
          setMode("edit");
          setOperationError(null);
        }
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedIndex((prev) => {
          const maxIndex = (state?.users.length ?? 1) - 1;
          return Math.min(maxIndex, prev + 1);
        });
        return;
      }

      if (key.tab && !key.shift) {
        setSelectedIndex((prev) => {
          const maxIndex = (state?.users.length ?? 1) - 1;
          return prev >= maxIndex ? 0 : prev + 1;
        });
        return;
      }

      if (key.tab && key.shift) {
        setSelectedIndex((prev) => {
          const maxIndex = (state?.users.length ?? 1) - 1;
          return prev <= 0 ? maxIndex : prev - 1;
        });
        return;
      }

      if (key.leftArrow && (state?.meta.hasPrev ?? false)) {
        setPage((prev) => Math.max(1, prev - 1));
        return;
      }

      if (key.rightArrow && (state?.meta.hasNext ?? false)) {
        setPage((prev) => prev + 1);
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

  // Confirm delete mode
  if (mode === "confirm-delete" && selectedUser) {
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold color="red">
          Delete User
        </Text>
        <Box flexDirection="column" borderStyle="single" paddingX={1}>
          <Text>{selectedUser.name ?? selectedUser.email}</Text>
          <Text dimColor>{selectedUser.email}</Text>
          <Text dimColor>Role: {selectedUser.role ?? "user"}</Text>
        </Box>
        <Text color="yellow">Are you sure you want to delete this user?</Text>
        {operationLoading ? (
          <Text dimColor>Deleting user…</Text>
        ) : (
          <Text dimColor>Press Y to confirm, N or Esc to cancel</Text>
        )}
        {operationError && <Text color="red">{operationError}</Text>}
      </Box>
    );
  }

  // Edit mode
  if (mode === "edit" && selectedUser) {
    return (
      <Box flexDirection="column" rowGap={1}>
        <Text bold>Edit User: {selectedUser.email}</Text>

        <Box columnGap={1}>
          <Text bold dimColor>
            Name:
          </Text>
          {editStep === "name" ? (
            <TextInput
              value={editName}
              onChange={setEditName}
              placeholder="Enter name"
              focus
              onSubmit={() => {
                const nameError = validateName(editName);
                if (nameError) {
                  setOperationError(nameError);
                  return;
                }
                setOperationError(null);
                setEditStep("email");
              }}
            />
          ) : (
            <Text>{editName}</Text>
          )}
        </Box>

        {(editStep === "email" || editStep === "role") && (
          <Box columnGap={1}>
            <Text bold dimColor>
              Email:
            </Text>
            {editStep === "email" ? (
              <TextInput
                value={editEmail}
                onChange={setEditEmail}
                placeholder="user@example.com"
                focus
                onSubmit={() => {
                  const emailError = validateEmail(editEmail);
                  if (emailError) {
                    setOperationError(emailError);
                    return;
                  }
                  setOperationError(null);
                  setEditStep("role");
                }}
              />
            ) : (
              <Text>{editEmail}</Text>
            )}
          </Box>
        )}

        {editStep === "role" && (
          <Box columnGap={1}>
            <Text bold dimColor>
              Role:
            </Text>
            <TextInput
              value={editRole}
              onChange={setEditRole}
              placeholder="user or admin"
              focus
              onSubmit={updateUser}
            />
          </Box>
        )}

        {editStep === "name" && (
          <Text dimColor>Press Tab to continue, Esc to cancel</Text>
        )}
        {editStep === "email" && (
          <Text dimColor>Press Tab to continue, Shift+Tab to go back, Esc to cancel</Text>
        )}
        {editStep === "role" && (
          <Text dimColor>Press Enter to save, Shift+Tab to go back, Esc to cancel</Text>
        )}

        {operationLoading && <Text dimColor>Updating user…</Text>}
        {operationError && <Text color="red">{operationError}</Text>}
      </Box>
    );
  }

  // List mode
  return (
    <Box flexDirection="column" rowGap={1}>
      <Text bold>{`/admin users — Page ${state?.meta.page ?? page}`}</Text>

      {loading && <Text dimColor>Loading users…</Text>}

      {error && <Text color="red">{error}</Text>}

      {!loading && !error && (
        <>
          {state?.users.length ? (
            <Box flexDirection="column">
              {state.users.map((user, index) => {
                const isSelected = index === selectedIndex;
                const line = `${user.name ?? "Unnamed"} <${user.email}> · ${
                  user.role ?? "user"
                }`;
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
                Role: {selectedUser.role ?? "user"} | Status:{" "}
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
              Users {state?.users.length ? selectedIndex + 1 : 0}/
              {state?.users.length ?? 0} on this page
            </Text>
            <Text dimColor>
              Total: {state?.total ?? 0} • Page {state?.meta.page ?? page}/
              {state?.meta.totalPages ?? 1}
            </Text>
          </Box>

          <Text dimColor>
            ↑/↓/Tab select
            {state?.meta.hasPrev && " • ← previous page"}
            {state?.meta.hasNext && " • → next page"}
            {selectedUser && " • e edit • x delete"} • q exit
          </Text>
        </>
      )}
    </Box>
  );
}
