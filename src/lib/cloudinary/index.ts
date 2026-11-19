import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";
import { AppError, UnprocessableEntityError } from "@/lib/http/api-response";
import { logger } from "@/lib/logger";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (docs/03 §6.1)

export function buildProductMediaFolder(baseFolder: string, productId: string): string {
  const cleanBase = baseFolder.replace(/^\/+|\/+$/g, "");
  return `${cleanBase}/products/${productId}`;
}

export function generateCloudinarySignature(
  params: Record<string, string | number | undefined>,
  apiSecret: string,
): string {
  const excluded = new Set(["file", "api_key", "resource_type", "signature"]);
  const serialized = Object.entries(params)
    .filter(
      ([key, value]) =>
        !excluded.has(key) && value !== undefined && value !== null && String(value) !== "",
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${serialized}${apiSecret}`)
    .digest("hex");
}

export interface SignUploadInput {
  productId: string;
  contentType: string;
  fileSizeBytes: number;
}

export function signProductImageUpload(input: SignUploadInput) {
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      input.contentType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
    )
  ) {
    throw new UnprocessableEntityError(
      "Formato de imagem nao permitido. Aceitos: JPEG, PNG, WebP ou AVIF.",
      "INVALID_IMAGE_MIME_TYPE",
      { contentType: input.contentType },
    );
  }

  if (input.fileSizeBytes <= 0 || input.fileSizeBytes > MAX_IMAGE_FILE_SIZE_BYTES) {
    throw new UnprocessableEntityError(
      "Tamanho de imagem invalido. O limite maximo e de 5 MB.",
      "INVALID_IMAGE_FILE_SIZE",
      { maxBytes: MAX_IMAGE_FILE_SIZE_BYTES },
    );
  }

  const env = getEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(
      501,
      "CLOUDINARY_NOT_CONFIGURED",
      "Variaveis do Cloudinary nao configuradas neste ambiente.",
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = buildProductMediaFolder(env.CLOUDINARY_BASE_FOLDER, input.productId);
  const signature = generateCloudinarySignature(
    { folder, timestamp },
    env.CLOUDINARY_API_SECRET,
  );

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    folder,
    timestamp,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  const env = getEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    return;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateCloudinarySignature(
      { public_id: publicId, timestamp },
      env.CLOUDINARY_API_SECRET,
    );

    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: env.CLOUDINARY_API_KEY,
      signature,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
      {
        method: "POST",
        body,
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      logger.warn(
        { publicId, status: response.status },
        "Falha ao remover ativo orfao no Cloudinary",
      );
    }
  } catch (error) {
    logger.warn({ err: error, publicId }, "Excecao ao remover imagem no Cloudinary");
  }
}
