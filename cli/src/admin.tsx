import { Box, Text, useInput } from "ink";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddViews, useSession } from "./context.js";

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

export function AdminUsers({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();

  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [state, setState] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        const normalizedMeta = {
          page: json.meta?.page ?? page,
          pageSize: json.meta?.pageSize ?? PAGE_SIZE,
          totalPages: json.meta?.totalPages ?? 1,
          hasNext: json.meta?.hasNext ?? false,
          hasPrev: json.meta?.hasPrev ?? page > 1,
        };

        const normalizedUsers = Array.isArray(json.users)
          ? (json.users as AdminUser[])
          : [];

        setState({
          users: normalizedUsers,
          total:
            typeof json.total === "number"
              ? json.total
              : normalizedUsers.length,
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

  useInput(
    (input, key) => {
      if (input === "q" || input === "Q") {
        exitToCommander("Exited /admin users");
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

  const selectedUser = useMemo(() => {
    if (!state?.users.length) return null;
    return state.users[Math.min(selectedIndex, state.users.length - 1)];
  }, [state, selectedIndex]);

  if (!session) {
    return <Text color="yellow">Please login to view admin users.</Text>;
  }

  if (!session.isAdmin) {
    return (
      <Text color="red">Admin privileges are required for this view.</Text>
    );
  }

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
            ↑/↓ select • ← previous page • → next page • q exit
          </Text>
        </>
      )}
    </Box>
  );
}
