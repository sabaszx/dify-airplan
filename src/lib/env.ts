import { z } from "zod";

/**
 * Environment-variable validation.
 * Only NEXT_PUBLIC_* vars are read on the client. Server secrets are validated
 * lazily on the server so the client bundle never needs them.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Cisco Wi-Fi Planner"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "th"]).default("en"),
});

const serverSchema = z.object({
  // Optional in the client-persisted MVP; required once Postgres/Auth are wired.
  DATABASE_URL: z.string().url().optional(),
  STORAGE_BUCKET: z.string().optional(),
  AUTH_SECRET: z.string().min(16).optional(),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
});

export function getServerEnv() {
  return serverSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    AUTH_SECRET: process.env.AUTH_SECRET,
  });
}
