import { beforeEach, describe, expect, it } from "vitest";
import {
  buildProductMediaFolder,
  generateCloudinarySignature,
  MAX_IMAGE_FILE_SIZE_BYTES,
  signProductImageUpload,
} from "@/lib/cloudinary";
import { resetEnvCacheForTests } from "@/lib/env";
import { TooManyRequestsError, UnprocessableEntityError } from "@/lib/errors";
import { enforceRateLimit, resetInMemoryRateLimitForTests } from "@/lib/rate-limit";
import { updateProductSchema } from "@/modules/catalog/schemas";

describe("rate limit & cloudinary signing (docs/03 §6-7)", () => {
  beforeEach(() => {
    resetInMemoryRateLimitForTests();
    resetEnvCacheForTests();
  });

  it("bloqueia excesso de tentativas no rate limit com TooManyRequestsError (429)", async () => {
    for (let i = 0; i < 5; i += 1) {
      await enforceRateLimit({ bucket: "forgotPassword", identifier: "127.0.0.1:teste@a.com" });
    }

    await expect(
      enforceRateLimit({ bucket: "forgotPassword", identifier: "127.0.0.1:teste@a.com" }),
    ).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it("gera assinatura Cloudinary deterministica e rejeita MIME/tamanho invalidos", () => {
    expect(buildProductMediaFolder("store/prod/", "prod_123")).toBe("store/prod/products/prod_123");

    const sig = generateCloudinarySignature(
      { timestamp: 1700000000, folder: "store/dev/products/p1" },
      "my_secret",
    );
    expect(sig).toHaveLength(40);
    expect(
      generateCloudinarySignature(
        { folder: "store/dev/products/p1", timestamp: 1700000000 },
        "my_secret",
      ),
    ).toBe(sig);

    expect(() =>
      signProductImageUpload({
        productId: "p1",
        contentType: "image/svg+xml",
        fileSizeBytes: 1024,
      }),
    ).toThrow(UnprocessableEntityError);

    expect(() =>
      signProductImageUpload({
        productId: "p1",
        contentType: "image/webp",
        fileSizeBytes: MAX_IMAGE_FILE_SIZE_BYTES + 1,
      }),
    ).toThrow(UnprocessableEntityError);
  });

  it("valida payload de atualizacao de produto com imagens e variantes", () => {
    const valid = updateProductSchema.safeParse({
      name: "Camiseta Atualizada",
      status: "ACTIVE",
      variantUpdates: [{ id: "var_1", priceCents: 9990, isActive: true }],
      images: [
        {
          cloudinaryPublicId: "store/dev/products/p1/foto1",
          url: "https://res.cloudinary.com/demo/image/upload/v1/foto1.webp",
          altText: "Frente da camiseta preta",
          sortOrder: 0,
          isPrimary: true,
        },
      ],
    });

    expect(valid.success).toBe(true);
  });
});
