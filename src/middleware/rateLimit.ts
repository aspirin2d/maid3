import type { Context, Next } from "hono";
import { env } from "../env.js";

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitStore>();

// Clean up old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now > value.resetTime) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyGenerator?: (c: Context) => string; // Custom key generator
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Simple in-memory rate limiter middleware
 * For production with multiple instances, use Redis-backed rate limiting
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    keyGenerator = (c: Context) => {
      // Default: use IP address as key
      const forwarded = c.req.header("x-forwarded-for");
      const ip = forwarded ? forwarded.split(",")[0] : "unknown";
      return ip;
    },
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return async (c: Context, next: Next) => {
    // Skip rate limiting in test environment
    if (env.isTest) {
      await next();
      return;
    }

    const key = keyGenerator(c);
    const now = Date.now();

    let record = store.get(key);

    // Create new record or reset if window expired
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(key, record);
    }

    // Increment request count
    record.count++;

    // Set rate limit headers
    c.header("X-RateLimit-Limit", max.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, max - record.count).toString());
    c.header("X-RateLimit-Reset", new Date(record.resetTime).toISOString());

    // Check if limit exceeded
    if (record.count > max) {
      c.header("Retry-After", Math.ceil((record.resetTime - now) / 1000).toString());
      return c.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((record.resetTime - now) / 1000)} seconds.`,
        },
        429,
      );
    }

    // Execute the request
    await next();

    // Optionally skip counting successful/failed requests
    const status = c.res.status;
    if (
      (skipSuccessfulRequests && status < 400) ||
      (skipFailedRequests && status >= 400)
    ) {
      record.count--;
    }
  };
}

/**
 * Preset: Strict rate limit for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true, // Only count failed attempts
});

/**
 * Preset: General API rate limit
 * 100 requests per 15 minutes per IP
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

/**
 * Preset: Generous rate limit for development
 * 1000 requests per minute
 */
export const devRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000,
});
