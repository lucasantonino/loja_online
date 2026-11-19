import { getEnv } from "@/lib/env";
import { TooManyRequestsError } from "@/lib/http/api-response";
import { logger } from "@/lib/logger";

export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 15 * 60 },
  register: { limit: 10, windowSeconds: 15 * 60 },
  forgotPassword: { limit: 5, windowSeconds: 60 * 60 },
  deliveryQuote: { limit: 30, windowSeconds: 60 },
  checkout: { limit: 10, windowSeconds: 60 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

interface MemoryWindowEntry {
  count: number;
  resetAtMs: number;
}

const memoryStore = new Map<string, MemoryWindowEntry>();

export function resetInMemoryRateLimitForTests(): void {
  memoryStore.clear();
}

export function extractClientIp(request?: Request): string {
  if (!request) {
    return "unknown";
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

function checkMemoryRateLimit(key: string, limit: number, windowSeconds: number): number | null {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.resetAtMs <= now) {
    memoryStore.set(key, {
      count: 1,
      resetAtMs: now + windowSeconds * 1000,
    });
    return null;
  }

  existing.count += 1;
  if (existing.count > limit) {
    return Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
  }

  return null;
}

async function checkUpstashRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  restUrl: string,
  restToken: string,
): Promise<number | null> {
  const endpoint = `${restUrl.replace(/\/+$/, "")}/pipeline`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSeconds), "NX"],
      ["TTL", key],
    ]),
    signal: AbortSignal.timeout(2500),
  });

  if (!response.ok) {
    throw new Error(`Upstash HTTP ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result?: number }>;
  const count = Number(results[0]?.result ?? 1);
  const ttl = Number(results[2]?.result ?? windowSeconds);

  if (count > limit) {
    return ttl > 0 ? ttl : windowSeconds;
  }

  return null;
}

export async function enforceRateLimit(params: {
  bucket: RateLimitBucket;
  identifier: string;
}): Promise<void> {
  const rule = RATE_LIMITS[params.bucket];
  const key = `rl:${params.bucket}:${params.identifier}`;
  const env = getEnv();

  let retryAfter: number | null = null;

  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      retryAfter = await checkUpstashRateLimit(
        key,
        rule.limit,
        rule.windowSeconds,
        env.UPSTASH_REDIS_REST_URL,
        env.UPSTASH_REDIS_REST_TOKEN,
      );
    } catch (error) {
      logger.warn(
        { err: error, bucket: params.bucket },
        "Falha no Upstash Redis; usando rate limit em memoria como fallback",
      );
      retryAfter = checkMemoryRateLimit(key, rule.limit, rule.windowSeconds);
    }
  } else {
    retryAfter = checkMemoryRateLimit(key, rule.limit, rule.windowSeconds);
  }

  if (retryAfter !== null) {
    throw new TooManyRequestsError(retryAfter);
  }
}
