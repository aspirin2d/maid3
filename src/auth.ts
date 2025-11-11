import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/index.js"; // your drizzle instance

import { bearer, admin, apiKey } from "better-auth/plugins";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  plugins: [bearer(), admin(), apiKey()],
});
