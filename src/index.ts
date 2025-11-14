import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { initializeDefaultAdmin, registerAdminRoutes } from "./admin.js";
import { auth } from "./auth.js";
import { env } from "./env.js";

type AppEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

type AppContext = Context<AppEnv>;

const app = new Hono<AppEnv>();

// Global error handler
app.onError((err, c) => {
  console.error("Server error:", err);

  // Don't expose internal errors in production
  if (env.isProduction) {
    return c.json({ error: "Internal server error" }, 500);
  }

  return c.json(
    {
      error: "Internal server error",
      message: err.message,
      stack: err.stack,
    },
    500,
  );
});

// Request logging
app.use("*", logger());

// CORS configuration
const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((origin) =>
  origin.trim(),
);

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return null;

      // In development, allow all origins
      if (env.isDevelopment) return origin;

      // In production, check against whitelist
      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    },
    credentials: true,
  }),
);

app.get("/", (c) => {
  return c.html(`<p>Hello, World</p>`);
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

const updateNameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

const updatePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(8, "Current password must be at least 8 characters"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  revokeOtherSessions: z.boolean().optional(),
});

const parseJsonBody = async <T>(c: AppContext, schema: z.ZodSchema<T>) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch (error) {
    console.error("Failed to parse JSON body", error);
    return {
      success: false as const,
      response: c.json({ error: "Invalid JSON body" }, 400),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false as const,
      response: c.json(
        { error: "Invalid request body", details: z.treeifyError(parsed.error) },
        400,
      ),
    };
  }

  return { success: true as const, data: parsed.data };
};

const handleUserApiError = (
  c: AppContext,
  error: unknown,
  fallbackMessage: string,
) => {
  console.error(fallbackMessage, error);
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: number }).status) || 500
      : 500;
  const normalizedStatus =
    status >= 400 && status <= 599
      ? (status as ContentfulStatusCode)
      : (500 as ContentfulStatusCode);
  const message =
    error instanceof Error ? error.message : fallbackMessage;
  return c.json({ error: message }, normalizedStatus);
};

// Auth api
app.use("/api/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);

  await next();
});

app.post("/api/update/name", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const body = await parseJsonBody(c, updateNameSchema);
  if (!body.success) return body.response;

  try {
    await auth.api.updateUser({
      headers: c.req.raw.headers,
      body: { name: body.data.name },
    });

    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    return c.json({
      status: "success",
      user: session?.user ?? { ...user, name: body.data.name },
    });
  } catch (error) {
    return handleUserApiError(c, error, "Failed to update name");
  }
});

app.post("/api/update/password", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const body = await parseJsonBody(c, updatePasswordSchema);
  if (!body.success) return body.response;

  try {
    const result = await auth.api.changePassword({
      headers: c.req.raw.headers,
      body: body.data,
    });

    return c.json({
      status: "success",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    return handleUserApiError(c, error, "Failed to update password");
  }
});

registerAdminRoutes(app);

await initializeDefaultAdmin();
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Start server
const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  },
);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  // Close server
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // In production, might want to restart the process
  if (env.isProduction) {
    gracefulShutdown("UNHANDLED_REJECTION");
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Always exit on uncaught exceptions
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});
