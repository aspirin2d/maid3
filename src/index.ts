import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { auth } from "./auth.js";
import { initializeDefaultAdmin } from "./admin.js";

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

app.get("/", (c) => {
  return c.html(`<p>Hello, World</p>`);
});

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

serve(
  {
    fetch: app.fetch,
    port: parseInt(process.env.PORT!),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
