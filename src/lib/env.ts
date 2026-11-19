import { z } from "zod";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const optionalString = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = () => z.preprocess(emptyToUndefined, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default("http://localhost:3000"),
  ),
  DATABASE_URL: optionalString(),
  DIRECT_URL: optionalString(),

  AUTH_SECRET: optionalString(),
  AUTH_URL: optionalUrl(),
  CRON_SECRET: optionalString(),

  SEED_ADMIN_EMAIL: optionalString(),
  SEED_ADMIN_PASSWORD: optionalString(),

  PAYMENT_PROVIDER: z.enum(["mercadopago", "pagarme", "asaas"]).default("mercadopago"),
  MERCADOPAGO_ACCESS_TOKEN: optionalString(),
  MERCADOPAGO_WEBHOOK_SECRET: optionalString(),
  NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: optionalString(),

  PAGARME_SECRET_KEY: optionalString(),
  PAGARME_WEBHOOK_SECRET: optionalString(),
  NEXT_PUBLIC_PAGARME_PUBLIC_KEY: optionalString(),

  ASAAS_API_KEY: optionalString(),
  ASAAS_WEBHOOK_TOKEN: optionalString(),
  ASAAS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),

  CLOUDINARY_CLOUD_NAME: optionalString(),
  CLOUDINARY_API_KEY: optionalString(),
  CLOUDINARY_API_SECRET: optionalString(),
  CLOUDINARY_BASE_FOLDER: z.string().default("store/dev"),

  RESEND_API_KEY: optionalString(),
  RESEND_FROM_EMAIL: optionalString(),

  SENTRY_DSN: optionalUrl(),
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl(),
  UPSTASH_REDIS_REST_URL: optionalUrl(),
  UPSTASH_REDIS_REST_TOKEN: optionalString(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
