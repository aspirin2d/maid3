import { and, desc, eq, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppContext, AppEnv } from "./app-env.js";
import { db } from "./db/index.js";
import { message, story } from "./db/schema.js";

const storyParamsSchema = z.object({
  id: z.coerce.number().int().positive("Invalid story id"),
});

const storyListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const embeddingProviders = ["openai", "ollama", "dashscope"] as const;
const llmProviders = ["openai", "ollama"] as const;

const createStorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  embeddingProvider: z.enum(embeddingProviders).optional(),
  llmProvider: z.enum(llmProviders).optional(),
  handler: z.string().trim().min(1).max(100).optional(),
});

const updateStorySchema = createStorySchema
  .partial()
  .refine(
    (value) => Object.values(value).some((v) => typeof v !== "undefined"),
    { message: "Provide at least one field to update" },
  );

const createMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"] as const),
  content: z.string().min(1),
  extracted: z.boolean().optional(),
});

const messageParamsSchema = z.object({
  id: z.coerce.number().int().positive("Invalid story id"),
  messageId: z.coerce.number().int().positive("Invalid message id"),
});

type JsonParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

const parseJsonBody = async <T>(
  c: AppContext,
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

const requireUser = (c: AppContext) => {
  const user = c.get("user");
  if (!user) {
    return {
      success: false as const,
      response: c.json({ error: "Authentication required" }, 401),
    };
  }

  return { success: true as const, user };
};

const fetchUserStory = async (storyId: number, userId: string) => {
  const rows = await db
    .select()
    .from(story)
    .where(and(eq(story.id, storyId), eq(story.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
};

const fetchStoryMessages = async (storyId: number) => {
  return db
    .select()
    .from(message)
    .where(eq(message.storyId, storyId))
    .orderBy(message.createdAt);
};

const DEFAULT_LIMIT = 20;

type StoryDeps = {
  handleUserApiError: (
    c: AppContext,
    error: unknown,
    fallbackMessage: string,
  ) => Response | Promise<Response>;
};

export const registerStoryRoutes = (app: Hono<AppEnv>, deps: StoryDeps) => {
  app.get("/api/s", async (c) => {
    const auth = requireUser(c);
    if (!auth.success) return auth.response;

    const parsedQuery = storyListQuerySchema.safeParse(c.req.query());
    if (!parsedQuery.success) {
      return c.json(
        { error: "Invalid query", details: z.treeifyError(parsedQuery.error) },
        400,
      );
    }

    const limit = parsedQuery.data.limit ?? DEFAULT_LIMIT;
    const offset = parsedQuery.data.offset ?? 0;

    try {
      const [stories, totalResult] = await Promise.all([
        db
          .select()
          .from(story)
          .where(eq(story.userId, auth.user.id))
          .orderBy(desc(story.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`cast(count(*) as integer)` })
          .from(story)
          .where(eq(story.userId, auth.user.id)),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return c.json({
        stories,
        total,
        limit,
        offset,
        hasNext: offset + stories.length < total,
      });
    } catch (error) {
      return deps.handleUserApiError(c, error, "Failed to list stories");
    }
  });

  app.post("/api/s", async (c) => {
    const auth = requireUser(c);
    if (!auth.success) return auth.response;

    const body = await parseJsonBody(c, createStorySchema);
    if (!body.success) return body.response;

    const payload: typeof story.$inferInsert = {
      userId: auth.user.id,
      name: body.data.name,
    };

    if (body.data.embeddingProvider) {
      payload.embeddingProvider = body.data.embeddingProvider;
    }

    if (body.data.llmProvider) {
      payload.llmProvider = body.data.llmProvider;
    }

    if (body.data.handler) {
      payload.handler = body.data.handler;
    }

    try {
      const created = await db.insert(story).values(payload).returning();
      return c.json({ story: created[0] }, 201);
    } catch (error) {
      return deps.handleUserApiError(c, error, "Failed to create story");
    }
  });

  app.get("/api/s/:id", async (c) => {
    const auth = requireUser(c);
    if (!auth.success) return auth.response;

    const params = storyParamsSchema.safeParse({ id: c.req.param("id") });
    if (!params.success) {
      return c.json({ error: "Invalid story id" }, 400);
    }

    const storyId = params.data.id;

    try {
      const storyRecord = await fetchUserStory(storyId, auth.user.id);
      if (!storyRecord) {
        return c.json({ error: "Story not found" }, 404);
      }

      const messages = await fetchStoryMessages(storyId);

      return c.json({ story: storyRecord, messages });
    } catch (error) {
      return deps.handleUserApiError(c, error, "Failed to load story");
    }
  });

  app.patch("/api/s/:id", async (c) => {
    const auth = requireUser(c);
    if (!auth.success) return auth.response;

    const params = storyParamsSchema.safeParse({ id: c.req.param("id") });
    if (!params.success) {
      return c.json({ error: "Invalid story id" }, 400);
    }

    const body = await parseJsonBody(c, updateStorySchema);
    if (!body.success) return body.response;

    const storyId = params.data.id;

    try {
      const updateData: Partial<typeof story.$inferInsert> = {};
      if (typeof body.data.name !== "undefined")
        updateData.name = body.data.name;
      if (typeof body.data.embeddingProvider !== "undefined") {
        updateData.embeddingProvider = body.data.embeddingProvider;
      }
      if (typeof body.data.llmProvider !== "undefined") {
        updateData.llmProvider = body.data.llmProvider;
      }
      if (typeof body.data.handler !== "undefined") {
        updateData.handler = body.data.handler;
      }

      const updated = await db
        .update(story)
        .set(updateData)
        .where(and(eq(story.id, storyId), eq(story.userId, auth.user.id)))
        .returning();

      if (!updated.length) {
        return c.json({ error: "Story not found" }, 404);
      }

      return c.json({ story: updated[0] });
    } catch (error) {
      return deps.handleUserApiError(c, error, "Failed to update story");
    }
  });

  app.delete("/api/s/:id", async (c) => {
    const auth = requireUser(c);
    if (!auth.success) return auth.response;

    const params = storyParamsSchema.safeParse({ id: c.req.param("id") });
    if (!params.success) {
      return c.json({ error: "Invalid story id" }, 400);
    }

    const storyId = params.data.id;

    try {
      const deleted = await db
        .delete(story)
        .where(and(eq(story.id, storyId), eq(story.userId, auth.user.id)))
        .returning({ id: story.id });

      if (!deleted.length) {
        return c.json({ error: "Story not found" }, 404);
      }

      return c.json({ status: "deleted", storyId });
    } catch (error) {
      return deps.handleUserApiError(c, error, "Failed to delete story");
    }
  });
};
