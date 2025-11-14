import type { Hono } from "hono";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { AppEnv } from "./app-env.js";
import { env } from "./env.js";

const RESPONSE_MODEL = env.OPENAI_RESPONSE_MODEL ?? "gpt-4.1";
const EMBEDDING_MODEL = env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export async function StructureResponse<TFormat extends z.ZodTypeAny>(
  prompt: string,
  format: TFormat,
): Promise<z.infer<TFormat>> {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const res = await client.responses.parse({
    model: RESPONSE_MODEL,
    input: prompt,
    text: { format: zodTextFormat(format, "output") },
  });

  return res.output_parsed as z.infer<TFormat>;
}
export async function Embeddding(input: string): Promise<number[]>;
export async function Embeddding(input: Array<string>): Promise<number[][]>;
export async function Embeddding(input: string | Array<string>) {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const res = await client.embeddings.create({
    input: input,
    model: EMBEDDING_MODEL,
    dimensions: 1536,
  });
  const embeddings = res.data.map((d) => d.embedding);

  if (typeof input === "string") {
    return embeddings[0];
  }

  return embeddings;
}

const helloResponseSchema = z.object({
  greeting: z.string().min(1),
  detail: z.string().min(1),
});

const createHelloPrompt = (name: string) =>
  `Return JSON with "greeting" and "detail" fields that warmly welcome Maid3 user ${name}. Keep it short and reference them by name.`;

export const registerOpenAiRoutes = (app: Hono<AppEnv>) => {
  app.get("/api/openai/hello", async (c) => {
    try {
      const user = c.get("user");
      const displayName =
        user?.name?.trim() && user.name.trim().length > 0
          ? user.name.trim()
          : (user?.email ?? "friend");
      const hello = await StructureResponse(
        createHelloPrompt(displayName),
        helloResponseSchema,
      );
      const embedding = await Embeddding(hello.greeting);
      return c.json({ ...hello, embedding });
    } catch (error) {
      console.error("Failed to generate OpenAI hello response", error);
      return c.json({ error: "Unable to generate hello response" }, 500);
    }
  });
};
