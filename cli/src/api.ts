type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

type ApiResponse<T> = {
  data: T;
  headers: Headers;
};

class ApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

const DEFAULT_TIMEOUT = 10000;

async function fetchWithTimeout<T>(
  url: string,
  options: FetchOptions = {},
  timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody.error) {
          message = errorBody.error;
        } else if (errorBody.message) {
          message = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors for error messages
      }
      throw new ApiError(message, response.status);
    }

    const data = await response.json();
    return { data, headers: response.headers };
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Request timeout - server not responding");
      }
      if (error instanceof TypeError) {
        throw new Error("Network error: Cannot connect to server");
      }
      throw error;
    }

    throw new Error("Unknown error occurred");
  }
}

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  user: {
    email: string;
    role?: string;
  };
};

export type SignupRequest = {
  name: string;
  email: string;
  password: string;
};

export type SignupResponse = {
  user: {
    email: string;
    role?: string;
  };
};

export type SessionResponse = {
  user: {
    email: string;
    role?: string;
  };
};

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  createdAt?: string | null;
  status?: string | null;
};

export type AdminUsersResponse = {
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

export type UpdateUserRequest = {
  name?: string;
  email?: string;
  role?: string;
  password?: string;
};

export type ResetPasswordResponse = {
  userId: string;
  password: string;
};

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(request: LoginRequest): Promise<{ token: string; user: LoginResponse["user"] }> {
    const { data, headers } = await fetchWithTimeout<LoginResponse>(
      `${this.baseUrl}/auth/sign-in/email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );

    const token = headers.get("set-auth-token");
    if (!token) {
      throw new Error("Missing auth token from server response");
    }

    return { token, user: data.user };
  }

  async getSession(token: string): Promise<SessionResponse> {
    const { data } = await fetchWithTimeout<SessionResponse>(
      `${this.baseUrl}/auth/get-session`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return data;
  }

  async signup(request: SignupRequest): Promise<{ token: string | null; user: SignupResponse["user"] }> {
    const { data, headers } = await fetchWithTimeout<SignupResponse>(
      `${this.baseUrl}/auth/sign-up/email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );

    const token = headers.get("set-auth-token");
    return { token, user: data.user };
  }

  async listUsers(
    token: string,
    params: { limit: number; offset: number },
  ): Promise<AdminUsersResponse> {
    const queryParams = new URLSearchParams({
      limit: params.limit.toString(),
      offset: params.offset.toString(),
    });

    const { data } = await fetchWithTimeout<AdminUsersResponse>(
      `${this.baseUrl}/admin/u?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    return data;
  }

  async deleteUser(token: string, userId: string): Promise<void> {
    await fetchWithTimeout(
      `${this.baseUrl}/admin/u/${userId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
  }

  async updateUser(
    token: string,
    userId: string,
    request: UpdateUserRequest,
  ): Promise<void> {
    await fetchWithTimeout(
      `${this.baseUrl}/admin/u/${userId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      },
    );
  }

  async resetUserPassword(
    token: string,
    userId: string,
  ): Promise<ResetPasswordResponse> {
    const { data } = await fetchWithTimeout<ResetPasswordResponse>(
      `${this.baseUrl}/admin/u/${userId}/pwd`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );

    if (!data.password) {
      throw new Error("Password reset succeeded but password missing");
    }

    return data;
  }
}

export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}
