import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { useAddViews, useSession } from "./context.js";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  banned: boolean;
  createdAt: string;
}

export function AdminUsersList({ url }: { url: string }) {
  const [session] = useSession();
  const addViews = useAddViews();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!session) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`${url}/api/admin/users`, {
          headers: {
            Authorization: `Bearer ${session.bearerToken}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("Unauthorized: Admin access required");
          }
          throw new Error(`Failed to fetch users: ${res.status}`);
        }

        const data = await res.json();
        setUsers(data.users || []);
      } catch (e) {
        if (e instanceof Error) {
          if (e.name === "AbortError") {
            setError("Request timeout - server not responding");
          } else if (e instanceof TypeError) {
            setError("Network error: Cannot connect to server");
          } else {
            setError(e.message);
          }
        } else {
          setError("Unknown error");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [url, session]);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        addViews({ removeLast: true }, { kind: "commander" });
      }, 100);
    }
  }, [loading, addViews]);

  if (loading) {
    return <Text color="gray">Loading users...</Text>;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (users.length === 0) {
    return <Text dimColor>No users found</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={36}>
          <Text bold>ID</Text>
        </Box>
        <Box width={25}>
          <Text bold>Email</Text>
        </Box>
        <Box width={20}>
          <Text bold>Name</Text>
        </Box>
        <Box width={10}>
          <Text bold>Role</Text>
        </Box>
        <Box width={8}>
          <Text bold>Banned</Text>
        </Box>
      </Box>
      {users.map((user) => (
        <Box key={user.id}>
          <Box width={36}>
            <Text dimColor>{user.id}</Text>
          </Box>
          <Box width={25}>
            <Text>{user.email}</Text>
          </Box>
          <Box width={20}>
            <Text>{user.name || "-"}</Text>
          </Box>
          <Box width={10}>
            <Text color={user.role === "admin" ? "cyan" : undefined}>
              {user.role || "user"}
            </Text>
          </Box>
          <Box width={8}>
            <Text color={user.banned ? "red" : "green"}>
              {user.banned ? "Yes" : "No"}
            </Text>
          </Box>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Total users: {users.length}</Text>
      </Box>
    </Box>
  );
}

export function AdminUsersDelete({
  url,
  userId,
}: {
  url: string;
  userId: string;
}) {
  const [session] = useSession();
  const addViews = useAddViews();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const deleteUser = async () => {
      if (!session) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(`${url}/api/admin/users/${userId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.bearerToken}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("Unauthorized: Admin access required");
          }
          if (res.status === 404) {
            throw new Error(`User not found: ${userId}`);
          }
          let message = `Failed to delete user: ${res.status}`;
          try {
            const data = await res.json();
            if (data.error) message = data.error;
          } catch {}
          throw new Error(message);
        }

        setSuccess(true);
      } catch (e) {
        if (e instanceof Error) {
          if (e.name === "AbortError") {
            setError("Request timeout - server not responding");
          } else if (e instanceof TypeError) {
            setError("Network error: Cannot connect to server");
          } else {
            setError(e.message);
          }
        } else {
          setError("Unknown error");
        }
      } finally {
        setLoading(false);
      }
    };

    deleteUser();
  }, [url, userId, session]);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        addViews({ removeLast: true }, { kind: "commander" });
      }, 2000);
    }
  }, [loading, addViews]);

  if (loading) {
    return <Text color="gray">Deleting user {userId}...</Text>;
  }

  if (error) {
    return <Text color="red">{error}</Text>;
  }

  if (success) {
    return <Text color="green">User {userId} deleted successfully</Text>;
  }

  return null;
}
