import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppContext, AppEnv } from "./app-env.js";
import { db } from "./db/index.js";
import { message, story } from "./db/schema.js";

const storyParamsSchema = z.object({
  id: z.coerce.number().int().positive("Invalid story id"),
});

type StoryDeps = {
  handleUserApiError: (
    c: AppContext,
    error: unknown,
    fallbackMessage: string,
  ) => Response | Promise<Response>;
};

export const registerStoryRoutes = (app: Hono<AppEnv>, deps: StoryDeps) => {
  app.get("/api/s/:id", async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const params = storyParamsSchema.safeParse({ id: c.req.param("id") });
    if (!params.success) {
      return c.json({ error: "Invalid story id" }, 400);
    }

    const storyId = params.data.id;

    try {
      const result = await db
        .select()
        .from(story)
        .where(and(eq(story.id, storyId), eq(story.userId, user.id)))
        .limit(1);

      const storyRecord = result[0];

      if (!storyRecord) {
        return c.json({ error: "Story not found" }, 404);
      }

      const messages = await db
        .select()
        .from(message)
        .where(eq(message.storyId, storyId))
        .orderBy(message.createdAt);

      return c.json({ story: storyRecord, messages });
    } catch (error) {
      return deps.handleUserApiError(c, error, "Failed to load story");
    }
  });
};
