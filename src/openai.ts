import type { Hono } from "hono";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { AppEnv } from "./app-env.js";
import { env } from "./env.js";

const RESPONSE_MODEL = env.OPENAI_RESPONSE_MODEL ?? "gpt-4.1";

export async function StructureResponse(prompt: string, format: z.ZodType) {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const res = await client.responses.parse({
    model: RESPONSE_MODEL,
    input: prompt,
    text: { format: zodTextFormat(format, "output") },
  });

  return res.output_parsed;
}

const helloResponseSchema = z.object({
  greeting: z.string().min(1),
  detail: z.string().min(1),
});

const createHelloPrompt = (name: string) =>
  `Return JSON with \\"greeting\\" and \\"detail\\" fields that warmly welcome Maid3 user ${name}. Keep it short and reference them by name.`;

export const registerOpenAiRoutes = (app: Hono<AppEnv>) => {
  app.get("/api/openai/hello", async (c) => {
    try {
      const user = c.get("user");
      const displayName =
        user?.name?.trim() && user.name.trim().length > 0
          ? user.name.trim()
          : user?.email ?? "friend";
      const hello = await StructureResponse(
        createHelloPrompt(displayName),
        helloResponseSchema,
      );
      return c.json(hello);
    } catch (error) {
      console.error("Failed to generate OpenAI hello response", error);
      return c.json({ error: "Unable to generate hello response" }, 500);
    }
  });
};
