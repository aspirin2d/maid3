import { cosineDistance, desc, eq, gt, and, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { memory, message } from "./db/schema.js";
import { getMessagesByUser } from "./message.js";
import { Embeddding, StructureResponse } from "./openai.js";
import {
  FactRetrievalSchema,
  getFactRetrievalMessages,
  getUpdateMemoryMessages,
  MemoryUpdateSchema,
} from "./prompts/memory.js";

export async function extractMemory(userId: string): Promise<{
  factsExtracted: number;
  memoriesAdded: number;
  memoriesUpdated: number;
  messagesExtracted: number;
}> {
  // Step 1: Fetch unextracted messages from the given user
  const unextracted = await getMessagesByUser(userId, {
    extracted: false,
    role: "user",
  });

  if (unextracted.length === 0) {
    return {
      factsExtracted: 0,
      memoriesAdded: 0,
      memoriesUpdated: 0,
      messagesExtracted: 0,
    };
  }

  // Parse messages into a single string for fact extraction
  const contents = unextracted.map((msg) => `${msg.role}: ${msg.content}`);
  const parsed = contents.join("\n\n");

  // Step 2: Extract facts from conversation with LLM
  const factExtractionPrompt = getFactRetrievalMessages(parsed);
  const { facts } = await StructureResponse(
    factExtractionPrompt,
    FactRetrievalSchema,
  );

  // If no facts extracted, mark messages as extracted and return
  if (facts.length === 0) {
    await markMessagesAsExtracted(unextracted.map((msg) => msg.id));
    return {
      factsExtracted: 0,
      memoriesUpdated: 0,
      memoriesAdded: 0,
      messagesExtracted: unextracted.length,
    };
  }

  // Step 3: Prepare similarity context (with unified IDs: 1, 2, 3...)
  // Generate embeddings for all facts
  const factTexts = facts.map((fact) => fact.text);
  const factEmbeddings = await Embeddding(factTexts);

  // Search for similar memories for each fact
  const similarMemories = await bulkSearchSimilarMemories(factEmbeddings, {
    topK: 3,
    userId: userId,
    minSimilarity: 0.7, // Only consider memories with 70%+ similarity
  });

  // Collect all unique similar memories across all facts
  const uniqueMemoriesMap = new Map<number, { id: number; content: string }>();
  for (const results of similarMemories) {
    for (const result of results) {
      if (!uniqueMemoriesMap.has(result.memory.id)) {
        uniqueMemoriesMap.set(result.memory.id, {
          id: result.memory.id,
          content: result.memory.content || "",
        });
      }
    }
  }

  // Create unified ID mapping for existing memories (1, 2, 3...)
  const existingMemories = Array.from(uniqueMemoriesMap.values());
  const unifiedExistingMemories = existingMemories.map((mem, index) => ({
    id: String(index + 1),
    text: mem.content,
    originalId: mem.id,
  }));

  // Create unified ID mapping for new facts (continuing from existing memories count)
  const startFactId = existingMemories.length + 1;
  const unifiedNewFacts = facts.map((fact, index) => ({
    id: String(startFactId + index),
    text: fact.text,
    category: fact.category,
    importance: fact.importance,
    confidence: fact.confidence,
  }));

  // Step 4: Decide memory actions with LLM
  const memoryUpdatePrompt = getUpdateMemoryMessages(
    unifiedExistingMemories,
    unifiedNewFacts,
  );

  const parsedDecisions = await StructureResponse(
    memoryUpdatePrompt,
    MemoryUpdateSchema,
  );

  type PreparedDecision =
    | {
        type: "ADD";
        text: string;
        metadata: {
          category: string;
          importance: number;
          confidence: number;
        };
        embeddingKey: string;
      }
    | {
        type: "UPDATE";
        memoryIndex: number;
        text: string;
        embeddingKey: string;
      };

  const embeddingByText = new Map<string, number[]>();
  factTexts.forEach((text, index) => {
    if (!embeddingByText.has(text)) {
      embeddingByText.set(text, factEmbeddings[index]);
    }
  });

  const textsToEmbed: string[] = [];
  const embedTextSet = new Set<string>();
  const queueEmbeddingText = (text: string) => {
    if (text.length === 0 || embeddingByText.has(text) || embedTextSet.has(text)) {
      return;
    }
    embedTextSet.add(text);
    textsToEmbed.push(text);
  };

  const preparedDecisions: PreparedDecision[] = [];
  for (const decision of parsedDecisions.memory) {
    const decisionId = parseInt(decision.id, 10);
    if (decision.event === "ADD") {
      const factIndex = decisionId - startFactId;
      if (factIndex < 0 || factIndex >= unifiedNewFacts.length) {
        continue;
      }
      const fact = facts[factIndex];
      const factEmbedding = factEmbeddings[factIndex];
      if (!factEmbedding) {
        continue;
      }

      const hasCustomText = Boolean(decision.text && decision.text.length > 0);
      const text = hasCustomText ? decision.text : fact.text;
      queueEmbeddingText(text);

      preparedDecisions.push({
        type: "ADD",
        text,
        metadata: {
          category: fact.category,
          importance: fact.importance,
          confidence: fact.confidence,
        },
        embeddingKey: text,
      });
    } else if (decision.event === "UPDATE") {
      const memoryIndex = decisionId - 1;
      if (memoryIndex < 0 || memoryIndex >= unifiedExistingMemories.length) {
        continue;
      }

      const text = decision.text;
      queueEmbeddingText(text);
      preparedDecisions.push({
        type: "UPDATE",
        memoryIndex,
        text,
        embeddingKey: text,
      });
    }
  }

  const embeddedOverrideVectors =
    textsToEmbed.length > 0 ? await Embeddding(textsToEmbed) : [];
  textsToEmbed.forEach((text, index) => {
    embeddingByText.set(text, embeddedOverrideVectors[index]);
  });

  // Step 5: Apply memory decisions and mark messages
  let memoriesUpdated = 0;
  let memoriesAdded = 0;
  await db.transaction(async (tx) => {
    for (const decision of preparedDecisions) {
      if (decision.type === "ADD") {
        const embedding = embeddingByText.get(decision.embeddingKey);
        if (!embedding) {
          continue;
        }

        await tx.insert(memory).values({
          userId: userId,
          content: decision.text,
          embedding,
          category: decision.metadata.category,
          importance: decision.metadata.importance,
          confidence: decision.metadata.confidence,
          action: "ADD",
        });
        memoriesAdded++;
      } else {
        const originalMemory =
          unifiedExistingMemories[decision.memoryIndex] ?? null;
        if (!originalMemory) {
          continue;
        }
        const embedding = embeddingByText.get(decision.embeddingKey);
        if (!embedding) {
          continue;
        }

        await tx
          .update(memory)
          .set({
            content: decision.text,
            prevContent: originalMemory.text,
            embedding,
            action: "UPDATE",
          })
          .where(eq(memory.id, originalMemory.originalId));
        memoriesUpdated++;
      }
    }

    for (const msg of unextracted) {
      await tx
        .update(message)
        .set({ extracted: true })
        .where(eq(message.id, msg.id));
    }
  });

  return {
    factsExtracted: facts.length,
    memoriesUpdated,
    memoriesAdded,
    messagesExtracted: unextracted.length,
  };
}

/**
 * Bulk search for similar memories using vector embeddings
 *
 * @param queries - Array of query embeddings (each should be a 1536-dimensional array)
 * @param options - Search options
 * @param options.topK - Number of top results to return per query (default: 5)
 * @param options.userId - Optional user ID to filter results by user
 * @param options.minSimilarity - Minimum similarity threshold (0-1, default: 0)
 * @param options.category - Optional category filter
 * @returns Array of results, one array per query embedding
 */
export async function bulkSearchSimilarMemories(
  queries: number[][],
  options: {
    userId: string;
    topK?: number;
    minSimilarity?: number;
  },
) {
  const topK = options?.topK ?? 5;
  const minSimilarity = options?.minSimilarity ?? 0;

  // Execute all queries in parallel for better performance
  const results = await Promise.all(
    queries.map((queryEmbedding) =>
      searchSimilarMemories(queryEmbedding, {
        topK,
        userId: options.userId,
        minSimilarity,
      }),
    ),
  );

  return results;
}

/**
 * Search for similar memories using a single query embedding
 *
 * @param queryEmbedding - Query embedding vector (1536 dimensions)
 * @param options - Search options
 * @param options.topK - Number of top results to return (default: 5)
 * @param options.userId - Optional user ID to filter results by user
 * @param options.minSimilarity - Minimum similarity threshold (0-1, default: 0)
 * @param options.category - Optional category filter
 * @returns Array of similar memories with similarity scores
 */
export async function searchSimilarMemories(
  queryEmbedding: number[],
  options: {
    topK: number;
    userId: string;
    minSimilarity?: number;
  },
) {
  const topK = options?.topK ?? 5;
  const minSimilarity = options?.minSimilarity ?? 0;

  // Calculate cosine distance (1 - cosine similarity)
  const similarity = sql<number>`1 - (${cosineDistance(memory.embedding, queryEmbedding)})`;

  return await db
    .select({
      memory: memory,
      similariy: similarity,
    })
    .from(memory)
    .where(
      and(eq(memory.userId, options.userId), gt(similarity, minSimilarity)),
    )
    .orderBy((t) => desc(t.similariy))
    .limit(topK);
}

/**
 * Helper function to mark messages as extracted (without transaction)
 */
async function markMessagesAsExtracted(messageIds: number[]): Promise<void> {
  if (messageIds.length === 0) return;

  for (const msgId of messageIds) {
    await db
      .update(message)
      .set({ extracted: true })
      .where(eq(message.id, msgId));
  }
}
