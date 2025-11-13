import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { auth } from "./auth.js";
import { db } from "./db/index.js";
import { user } from "./db/schema.js";
import { env } from "./env.js";

/**
 * Initialize default admin user if configured via environment variables
 * This ensures there's always at least one admin user in the system
 */
export async function initializeDefaultAdmin() {
  // Skip if admin credentials are not configured
  if (!env.DEFAULT_ADMIN_EMAIL || !env.DEFAULT_ADMIN_PASSWORD) {
    console.log(
      "No default admin credentials configured. Skipping admin initialization.",
    );
    return null;
  }

  try {
    // Check if admin user already exists
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, env.DEFAULT_ADMIN_EMAIL))
      .limit(1);

    if (existingUser.length > 0) {
      const adminUser = existingUser[0];

      // Update role to admin if not already set
      if (adminUser.role !== "admin") {
        await db
          .update(user)
          .set({ role: "admin" })
          .where(eq(user.id, adminUser.id));
        console.log(
          `Updated existing user ${env.DEFAULT_ADMIN_EMAIL} to admin role`,
        );
      } else {
        // console.log(
        //   `Default admin user ${env.DEFAULT_ADMIN_EMAIL} already exists`,
        // );
      }

      return adminUser.id;
    }

    // Create new admin user using Better Auth internal API
    console.log(`Creating default admin user: ${env.DEFAULT_ADMIN_EMAIL}`);

    const newUser = await auth.api.signUpEmail({
      body: {
        email: env.DEFAULT_ADMIN_EMAIL,
        password: env.DEFAULT_ADMIN_PASSWORD,
        name: env.DEFAULT_ADMIN_NAME || "Admin",
      },
    });

    if (!newUser || !newUser.user) {
      throw new Error("Failed to create admin user");
    }

    // Update the user's role to admin
    await db
      .update(user)
      .set({
        role: "admin",
        emailVerified: true,
      })
      .where(eq(user.id, newUser.user.id));

    console.log(
      `Default admin user created successfully: ${env.DEFAULT_ADMIN_EMAIL}`,
    );
    return newUser.user.id;
  } catch (error) {
    console.error("Failed to initialize default admin user:", error);
    // Don't throw - allow server to start even if admin creation fails
    return null;
  }
}

type AdminEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

type ApiArgs<T> = T extends (args: infer A) => any ? A : never;
type BodyOf<T> = ApiArgs<T> extends { body: infer B } ? B : never;
type QueryOf<T> = ApiArgs<T> extends { query: infer Q } ? Q : never;

type CreateUserBody = BodyOf<typeof auth.api.createUser>;
type UpdateUserBody = BodyOf<typeof auth.api.adminUpdateUser>;
type SetRoleBody = BodyOf<typeof auth.api.setRole>;
type SetUserPasswordBody = BodyOf<typeof auth.api.setUserPassword>;
type RemoveUserBody = BodyOf<typeof auth.api.removeUser>;
type ListUsersQueryParam = QueryOf<typeof auth.api.listUsers>;
type GetUserQuery = QueryOf<typeof auth.api.getUser>;

export type AdminContext = Context<AdminEnv>;
export type AdminNext = () => Promise<void>;

export const requireAdmin = async (c: AdminContext, next: AdminNext) => {
  const user = c.get("user");

  // Check if user is authenticated
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Check if user has admin role
  if (!user.role || user.role !== "admin") {
    return c.json({ error: "Unauthorized: Admin access required" }, 403);
  }

  await next();
};

const roleSchema = z.union([z.string().min(1), z.array(z.string().min(1))]);
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: roleSchema.optional(),
  data: z.record(z.string(), z.any()).optional(),
});

const updateUserSchema = z.object({
  email: z.email().optional(),
  name: z.string().min(1).optional(),
  image: z.url().optional(),
  emailVerified: z.boolean().optional(),
  role: roleSchema.optional(),
  password: z.string().min(8).optional(),
  data: z.record(z.string(), z.any()).optional(),
});

const listUsersQuerySchema = z.object({
  searchValue: z.string().optional(),
  searchField: z.enum(["email", "name"] as const).optional(),
  searchOperator: z
    .enum(["contains", "starts_with", "ends_with"] as const)
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(["asc", "desc"] as const).optional(),
  filterField: z.string().optional(),
  filterValue: z.string().optional(),
  filterOperator: z
    .enum(["eq", "ne", "lt", "lte", "gt", "gte", "contains"] as const)
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z
    .coerce.number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .optional(),
});

type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;
type ListUsersQuery = Omit<
  ListUsersQueryInput,
  "filterValue" | "page" | "pageSize"
> & {
  filterValue?: string | number | boolean;
};

const normalizeFilterValue = (value: string) => {
  if (value === "true") return true;
  if (value === "false") return false;

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  return value;
};

const normalizeListUsersQuery = (
  query: ListUsersQueryInput,
): ListUsersQuery => {
  const { filterValue, page, pageSize, ...rest } = query;
  const normalized: ListUsersQuery = { ...rest };

  if (typeof filterValue !== "undefined") {
    normalized.filterValue = normalizeFilterValue(filterValue);
  }

  return normalized;
};

type JsonParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

const parseJsonBody = async <T>(
  c: AdminContext,
  schema: z.ZodSchema<T>,
): Promise<JsonParseResult<T>> => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch (error) {
    console.error("Failed to parse JSON body", error);
    return {
      success: false,
      response: c.json({ error: "Invalid JSON body" }, 400),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      response: c.json(
        {
          error: "Invalid request body",
          details: z.treeifyError(parsed.error),
        },
        400,
      ),
    };
  }

  return { success: true, data: parsed.data };
};

type ParsedListQueryResult =
  | {
      success: true;
      data: {
        query: ListUsersQueryParam;
        pagination: {
          page: number;
          pageSize: number;
        };
      };
    }
  | {
      success: false;
      response: Response;
    };

const parseListQuery = (c: AdminContext): ParsedListQueryResult => {
  const rawQuery = c.req.query();
  const parsed = listUsersQuerySchema.safeParse(rawQuery);

  if (!parsed.success) {
    return {
      success: false as const,
      response: c.json(
        {
          error: "Invalid query parameters",
          details: z.treeifyError(parsed.error),
        },
        400,
      ),
    };
  }

  const {
    page: rawPage,
    pageSize: rawPageSize,
    limit: rawLimit,
    offset: rawOffset,
    ...rest
  } = parsed.data;

  const resolvedPageSize = Math.min(
    rawLimit ?? rawPageSize ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  const resolvedOffset =
    typeof rawOffset !== "undefined"
      ? rawOffset
      : Math.max((rawPage ?? 1) - 1, 0) * resolvedPageSize;

  const resolvedPage =
    typeof rawOffset !== "undefined"
      ? Math.floor(resolvedOffset / resolvedPageSize) + 1
      : rawPage ?? 1;

  const normalizedQuery = normalizeListUsersQuery({
    ...rest,
    limit: resolvedPageSize,
    offset: resolvedOffset,
  }) as ListUsersQueryParam;

  return {
    success: true,
    data: {
      query: normalizedQuery,
      pagination: {
        page: resolvedPage,
        pageSize: resolvedPageSize,
      },
    },
  };
};

const handleAdminApiError = (
  c: AdminContext,
  error: unknown,
  action: string,
) => {
  console.error(`Failed to ${action}:`, error);
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status) || 500
      : 500;
  const message =
    error instanceof Error ? error.message : "Unexpected admin API error";

  const normalizedStatus =
    status >= 400 && status <= 599
      ? (status as ContentfulStatusCode)
      : (500 as ContentfulStatusCode);

  return c.json({ error: message }, normalizedStatus);
};

const createAdminRouter = () => {
  const router = new Hono<AdminEnv>();

  router.use("*", requireAdmin);

  router.get("/u", async (c) => {
    const parsedQuery = parseListQuery(c);
    if (!parsedQuery.success) return parsedQuery.response;

    try {
      const result = await auth.api.listUsers({
        headers: c.req.raw.headers,
        query: parsedQuery.data.query,
      });

      const recordResult = result as Record<string, unknown>;
      const limitFromResult =
        typeof recordResult.limit === "number"
          ? (recordResult.limit as number)
          : undefined;
      const offsetFromResult =
        typeof recordResult.offset === "number"
          ? (recordResult.offset as number)
          : undefined;

      const requestedOffsetRaw = parsedQuery.data.query.offset;
      const requestedOffset =
        typeof requestedOffsetRaw === "number"
          ? requestedOffsetRaw
          : Number(requestedOffsetRaw ?? 0) || 0;

      const pageSize = limitFromResult ?? parsedQuery.data.pagination.pageSize;
      const offset = offsetFromResult ?? requestedOffset;
      const total = result.total ?? 0;
      const page = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 1;
      const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
      const hasNext = pageSize > 0 ? offset + pageSize < total : false;
      const hasPrev = page > 1;

      return c.json({
        users: result.users,
        total,
        meta: {
          page,
          pageSize,
          totalPages,
          hasNext,
          hasPrev,
        },
      });
    } catch (error) {
      return handleAdminApiError(c, error, "list users");
    }
  });

  router.post("/u", async (c) => {
    const body = await parseJsonBody(c, createUserSchema);
    if (!body.success) return body.response;

    try {
      const created = await auth.api.createUser({
        headers: c.req.raw.headers,
        body: body.data as CreateUserBody,
      });

      return c.json({ user: created.user }, 201);
    } catch (error) {
      return handleAdminApiError(c, error, "create user");
    }
  });

  router.get("/u/:id", async (c) => {
    const userId = c.req.param("id");

    try {
      const userRecord = await auth.api.getUser({
        headers: c.req.raw.headers,
        query: { id: userId } as GetUserQuery,
      });

      return c.json({ user: userRecord });
    } catch (error) {
      return handleAdminApiError(c, error, "fetch user");
    }
  });

  router.patch("/u/:id", async (c) => {
    const userId = c.req.param("id");
    const body = await parseJsonBody(c, updateUserSchema);
    if (!body.success) return body.response;

    const { role, password, data, ...userFields } = body.data;
    const updatePayload = { ...data, ...userFields } as UpdateUserBody["data"];

    if (
      !Object.keys(updatePayload).length &&
      typeof role === "undefined" &&
      typeof password === "undefined"
    ) {
      return c.json({ error: "Provide at least one field to update" }, 400);
    }

    try {
      await auth.api.adminUpdateUser({
        headers: c.req.raw.headers,
        body: {
          userId,
          data: updatePayload,
        } as UpdateUserBody,
      });

      if (typeof role !== "undefined") {
        await auth.api.setRole({
          headers: c.req.raw.headers,
          body: { userId, role } as SetRoleBody,
        });
      }

      if (typeof password !== "undefined") {
        await auth.api.setUserPassword({
          headers: c.req.raw.headers,
          body: { userId, newPassword: password } as SetUserPasswordBody,
        });
      }

      const refreshed = await auth.api.getUser({
        headers: c.req.raw.headers,
        query: { id: userId } as GetUserQuery,
      });

      return c.json({ user: refreshed });
    } catch (error) {
      return handleAdminApiError(c, error, "update user");
    }
  });

  router.delete("/u/:id", async (c) => {
    const userId = c.req.param("id");

    try {
      const result = await auth.api.removeUser({
        headers: c.req.raw.headers,
        body: { userId } as RemoveUserBody,
      });

      return c.json(result);
    } catch (error) {
      return handleAdminApiError(c, error, "delete user");
    }
  });

  return router;
};

export const registerAdminRoutes = (app: Hono<AdminEnv>) => {
  const router = createAdminRouter();
  app.route("/api/admin", router);
};
