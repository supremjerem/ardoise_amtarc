import { z } from "zod";

/*
 * Environment variables, validated at startup.
 * A loud failure on boot beats an obscure error the first time a member
 * tries to log in.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)"),
  /*
   * Salt used to hash IP addresses in login_attempts.
   * Without it an address would either be stored in clear, or be trivially
   * recoverable by brute force — the IPv4 space is tiny.
   */
  IP_HASH_SECRET: z.string().min(16, "IP_HASH_SECRET must be at least 16 characters"),
  /*
   * Pepper mixed into PINs before hashing. It lives only in the server
   * configuration, never in the database, so a leaked database alone does
   * not allow cracking four-digit codes offline.
   *
   * Changing it invalidates every existing PIN — they would need resetting.
   */
  PIN_PEPPER: z.string().min(16, "PIN_PEPPER must be at least 16 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid configuration:\n${details}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
