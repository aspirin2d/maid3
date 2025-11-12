import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initializeDefaultAdmin } from "./admin.js";
import { auth } from "./auth.js";
import { env } from "./env.js";

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

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
