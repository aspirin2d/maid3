import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/index.js";
import { env } from "./env.js";

import { bearer, admin, apiKey } from "better-auth/plugins";

export const auth = betterAuth({
  baseURL: env.BASE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // Require email verification in production for security
    requireEmailVerification: env.isProduction,
  },
  plugins: [bearer(), admin(), apiKey()],
});
