import "dotenv/config";

/**
 * Validates and exports environment variables
 * Throws error at startup if required variables are missing or invalid
 */

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getPort(): number {
  const portStr = process.env.PORT;
  if (!portStr) {
    console.warn("PORT not set, using default: 3000");
    return 3000;
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `PORT must be a valid number between 1 and 65535, got: ${portStr}`,
    );
  }

  return port;
}

function getNodeEnv(): "development" | "production" | "test" {
  const env = process.env.NODE_ENV;
  if (env === "production" || env === "test") {
    return env;
  }
  return "development";
}

// Validate and export all environment variables
export const env = {
  // Server config
  PORT: getPort(),
  NODE_ENV: getNodeEnv(),
  BASE_URL: getOptionalEnv("BASE_URL", `http://localhost:${getPort()}`),

  // Database
  DB_URL: getRequiredEnv("DB_URL"),

  // CORS
  ALLOWED_ORIGINS: getOptionalEnv("ALLOWED_ORIGINS", "http://localhost:3000"),

  // Admin defaults (optional)
  DEFAULT_ADMIN_EMAIL: process.env.DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_NAME: process.env.DEFAULT_ADMIN_NAME,

  // Feature flags
  isProduction: getNodeEnv() === "production",
  isDevelopment: getNodeEnv() === "development",
  isTest: getNodeEnv() === "test",
} as const;
