import type { ZodType } from "zod";
import { message } from "../db/schema.js";

export interface Handler<TInput, TOutput> {
  readonly name: string;
  readonly description?: string;

  prepare(input: TInput): Promise<{ prompt: string; schema: ZodType<TOutput> }>;

  // convert message into string
  messageToString(msg: typeof message.$inferSelect): string;
}
