import type { Context } from "hono";
import { auth } from "./auth.js";

export type AppEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
};

export type AppContext = Context<AppEnv>;
