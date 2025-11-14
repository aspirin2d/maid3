import { eq, and, asc } from "drizzle-orm";
import { db } from "./db/index.js";
import { story, message } from "./db/schema.js";

/**
 * Query messages by user with optional filters
 * @param userId - The user ID to query messages for
 * @param filters - Optional filters for storyId and extracted status
 * @param options - Optional parameters for pagination
 * @param options.limit - Maximum number of messages to return (defaults to all)
 * @param options.offset - Number of messages to skip (defaults to 0)
 */
export async function getMessagesByUser(
  userId: string,
  filters?: {
    storyId?: number;
    extracted?: boolean;
    role?: "system" | "assistant" | "user";
  },
  options?: { limit?: number; offset?: number },
) {
  const conditions = [eq(story.userId, userId)];

  if (filters?.storyId !== undefined) {
    conditions.push(eq(message.storyId, filters.storyId));
  }

  if (filters?.extracted !== undefined) {
    conditions.push(eq(message.extracted, filters.extracted));
  }

  if (filters?.role !== undefined) {
    conditions.push(eq(message.role, filters.role));
  }

  const whereClause =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  const baseQuery = db
    .select({
      id: message.id,
      storyId: message.storyId,
      role: message.role,
      content: message.content,
      extracted: message.extracted,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    })
    .from(message)
    .innerJoin(story, eq(message.storyId, story.id))
    .where(whereClause)
    .orderBy(asc(message.createdAt));

  const limitedQuery =
    options?.limit !== undefined ? baseQuery.limit(options.limit) : baseQuery;

  const finalQuery =
    options?.offset !== undefined
      ? limitedQuery.offset(options.offset)
      : limitedQuery;

  return await finalQuery;
}
