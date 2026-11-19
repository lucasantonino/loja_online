import { z } from "zod";
import { slugSchema } from "@/modules/variants/schemas";

const parseSlugList = (val: unknown): string[] | undefined => {
  if (val === undefined || val === null || val === "") {
    return undefined;
  }
  const rawList = Array.isArray(val) ? val : [val];
  const parts = rawList
    .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  return parts.length > 0 ? [...new Set(parts)] : undefined;
};

const parseOptionalBoolean = (val: unknown): boolean | undefined => {
  if (val === undefined || val === null || val === "") {
    return undefined;
  }
  if (typeof val === "boolean") {
    return val;
  }
  if (val === "true" || val === "1") {
    return true;
  }
  if (val === "false" || val === "0") {
    return false;
  }
  return undefined;
};

const parseOptionalNonNegInt = (val: unknown): number | undefined => {
  if (val === undefined || val === null || val === "") {
    return undefined;
  }
  const num = Number(val);
  return Number.isFinite(num) ? num : (val as number);
};

export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  color: z.preprocess(parseSlugList, z.array(z.string().min(1)).optional()),
  size: z.preprocess(parseSlugList, z.array(z.string().min(1)).optional()),
  minPriceCents: z.preprocess(parseOptionalNonNegInt, z.number().int().nonnegative().optional()),
  maxPriceCents: z.preprocess(parseOptionalNonNegInt, z.number().int().nonnegative().optional()),
  inStockOnly: z.preprocess(parseOptionalBoolean, z.boolean().default(false)),
  sort: z.enum(["price_asc", "price_desc", "newest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(20),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const listCategoriesQuerySchema = z.object({
  includeEmpty: z.preprocess(parseOptionalBoolean, z.boolean().default(false)),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Nome da categoria e obrigatorio.").max(100),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const productImageInputSchema = z.object({
  optionValueId: z.string().trim().min(1).nullable().optional(),
  cloudinaryPublicId: z.string().trim().min(1, "Public ID da imagem e obrigatorio.").max(255),
  url: z.string().url("URL da imagem invalida."),
  altText: z.string().trim().min(2, "Texto alternativo (alt) e obrigatorio.").max(200),
  sortOrder: z.number().int().nonnegative().default(0),
  isPrimary: z.boolean().default(false),
});

export const variantUpdateInputSchema = z.object({
  id: z.string().trim().min(1),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/)
    .transform((v) => v.toUpperCase())
    .optional(),
  label: z.string().trim().min(1).max(120).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  compareAtPriceCents: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  slug: slugSchema.optional(),
  description: z.string().trim().min(5).max(10000).optional(),
  shortDescription: z.string().trim().max(400).nullable().optional(),
  categoryId: z.string().trim().min(1).optional(),
  basePriceCents: z.number().int().nonnegative().optional(),
  compareAtPriceCents: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  seoTitle: z.string().trim().max(180).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  sizeGuideMarkdown: z.string().trim().max(10000).nullable().optional(),
  variantUpdates: z.array(variantUpdateInputSchema).optional(),
  images: z.array(productImageInputSchema).optional(),
});

export const signMediaUploadSchema = z.object({
  productId: z.string().trim().min(1, "productId e obrigatorio."),
  contentType: z.string().trim().min(1, "contentType e obrigatorio."),
  fileSizeBytes: z.number().int().positive("fileSizeBytes deve ser positivo."),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type SignMediaUploadInput = z.infer<typeof signMediaUploadSchema>;
