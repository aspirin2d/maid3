import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type SessionData = {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
  expiresAt: number;
};

const SESSION_FILE = join(homedir(), ".maid-session");

/**
 * Save session data to file
 */
export async function saveSession(data: SessionData): Promise<void> {
  try {
    await writeFile(SESSION_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save session:", error);
    throw error;
  }
}

/**
 * Load session data from file
 */
export async function loadSession(): Promise<SessionData | null> {
  try {
    if (!existsSync(SESSION_FILE)) {
      return null;
    }

    const content = await readFile(SESSION_FILE, "utf-8");
    const data = JSON.parse(content) as SessionData;

    // Check if session is expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      await clearSession();
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to load session:", error);
    return null;
  }
}

/**
 * Clear session file
 */
export async function clearSession(): Promise<void> {
  try {
    if (existsSync(SESSION_FILE)) {
      await unlink(SESSION_FILE);
    }
  } catch (error) {
    console.error("Failed to clear session:", error);
  }
}

/**
 * Verify session with API using bearer token
 */
export async function verifySession(
  apiUrl: string,
  token: string,
): Promise<{ valid: boolean; user?: unknown }> {
  try {
    const response = await fetch(`${apiUrl}/auth/get-session`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json();
    return { valid: true, user: data.user };
  } catch (error) {
    console.error("Failed to verify session:", error);
    return { valid: false };
  }
}
