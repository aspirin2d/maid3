import { eq } from "drizzle-orm";
import { auth } from "./auth.js";
import { db } from "./db/index.js";
import { user } from "./db/schema.js";
import { env } from "./env.js";

/**
 * Initialize default admin user if configured via environment variables
 * This ensures there's always at least one admin user in the system
 */
export async function initializeDefaultAdmin() {
  // Skip if admin credentials are not configured
  if (!env.DEFAULT_ADMIN_EMAIL || !env.DEFAULT_ADMIN_PASSWORD) {
    console.log(
      "No default admin credentials configured. Skipping admin initialization.",
    );
    return null;
  }

  try {
    // Check if admin user already exists
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, env.DEFAULT_ADMIN_EMAIL))
      .limit(1);

    if (existingUser.length > 0) {
      const adminUser = existingUser[0];

      // Update role to admin if not already set
      if (adminUser.role !== "admin") {
        await db
          .update(user)
          .set({ role: "admin" })
          .where(eq(user.id, adminUser.id));
        console.log(
          `Updated existing user ${env.DEFAULT_ADMIN_EMAIL} to admin role`,
        );
      } else {
        // console.log(
        //   `Default admin user ${env.DEFAULT_ADMIN_EMAIL} already exists`,
        // );
      }

      return adminUser.id;
    }

    // Create new admin user using Better Auth internal API
    console.log(`Creating default admin user: ${env.DEFAULT_ADMIN_EMAIL}`);

    const newUser = await auth.api.signUpEmail({
      body: {
        email: env.DEFAULT_ADMIN_EMAIL,
        password: env.DEFAULT_ADMIN_PASSWORD,
        name: env.DEFAULT_ADMIN_NAME || "Admin",
      },
    });

    if (!newUser || !newUser.user) {
      throw new Error("Failed to create admin user");
    }

    // Update the user's role to admin
    await db
      .update(user)
      .set({
        role: "admin",
        emailVerified: true,
      })
      .where(eq(user.id, newUser.user.id));

    console.log(
      `Default admin user created successfully: ${env.DEFAULT_ADMIN_EMAIL}`,
    );
    return newUser.user.id;
  } catch (error) {
    console.error("Failed to initialize default admin user:", error);
    // Don't throw - allow server to start even if admin creation fails
    return null;
  }
}

import type { Context } from "hono";

export type AdminContext = Context<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
  };
}>;
export type AdminNext = () => Promise<void>;

export const requireAdmin = async (c: AdminContext, next: AdminNext) => {
  const user = c.get("user");

  // Check if user is authenticated
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Check if user has admin role
  if (!user.role || user.role !== "admin") {
    return c.json({ error: "Unauthorized: Admin access required" }, 403);
  }

  await next();
};
