import { z } from "zod";
import { buildOptionCombinationKey, slugify } from "@/modules/variants/combination-key";

export const skuSchema = z
  .string()
  .trim()
  .min(2, "SKU deve ter no minimo 2 caracteres.")
  .max(64, "SKU deve ter no maximo 64 caracteres.")
  .regex(/^[A-Za-z0-9._-]+$/, "SKU deve conter apenas letras, numeros, '.', '_' ou '-'.")
  .transform((val) => val.toUpperCase());

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalido.");

export const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Cor hexadecimal deve seguir o formato #RRGGBB.")
  .nullable()
  .optional();

export const centsSchema = z.number().int().nonnegative();

export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);

export const optionValueInputSchema = z.object({
  value: z.string().trim().min(1, "Valor da opcao e obrigatorio.").max(60),
  slug: slugSchema.optional(),
  colorHex: colorHexSchema,
  sortOrder: z.number().int().nonnegative().default(0),
});

export const productOptionInputSchema = z.object({
  name: z.string().trim().min(1, "Nome da opcao e obrigatorio.").max(60),
  slug: slugSchema.optional(),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
  values: z.array(optionValueInputSchema).min(1, "Informe ao menos um valor para a opcao."),
});

export const simpleVariantInputSchema = z.object({
  sku: skuSchema,
  priceCents: centsSchema.optional(),
  compareAtPriceCents: centsSchema.nullable().optional(),
  initialStock: z.number().int().nonnegative().default(0),
});

export const variableVariantInputSchema = z.object({
  sku: skuSchema,
  label: z.string().trim().min(1).max(120).optional(),
  priceCents: centsSchema,
  compareAtPriceCents: centsSchema.nullable().optional(),
  initialStock: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  optionValueSlugs: z
    .array(z.string().trim().min(1))
    .min(1, "Cada variante deve referenciar os valores das opcoes."),
});

const baseProductFields = {
  name: z.string().trim().min(2, "Nome do produto deve ter no minimo 2 caracteres.").max(180),
  slug: slugSchema.optional(),
  description: z.string().trim().min(5, "Descricao e obrigatoria.").max(10000),
  shortDescription: z.string().trim().max(400).nullable().optional(),
  categoryId: z.string().trim().min(1, "Categoria e obrigatoria."),
  basePriceCents: centsSchema,
  compareAtPriceCents: centsSchema.nullable().optional(),
  status: productStatusSchema.default("DRAFT"),
  seoTitle: z.string().trim().max(180).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  sizeGuideMarkdown: z.string().trim().max(10000).nullable().optional(),
};

export const createSimpleProductSchema = z.object({
  ...baseProductFields,
  hasVariants: z.literal(false),
  defaultVariant: simpleVariantInputSchema,
});

const createVariableProductObjectSchema = z.object({
  ...baseProductFields,
  hasVariants: z.literal(true),
  options: z.array(productOptionInputSchema).min(1, "Produto variavel exige ao menos 1 opcao."),
  variants: z
    .array(variableVariantInputSchema)
    .min(1, "Produto variavel exige ao menos 1 variante."),
});

type VariableProductRaw = z.infer<typeof createVariableProductObjectSchema>;

function validateVariableProductData(data: VariableProductRaw, ctx: z.RefinementCtx): void {
  const optionSlugSet = new Set<string>();
  const scopedValueToOption = new Map<string, string>();
  const bareValueToOptions = new Map<string, string[]>();

  for (const [optIdx, option] of data.options.entries()) {
    const optSlug = option.slug ?? slugify(option.name);
    if (optionSlugSet.has(optSlug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options", optIdx, "name"],
        message: `Opcao duplicada: "${option.name}".`,
      });
    }
    optionSlugSet.add(optSlug);

    const localValueSlugs = new Set<string>();
    for (const [valIdx, val] of option.values.entries()) {
      const valSlug = val.slug ?? slugify(val.value);
      if (localValueSlugs.has(valSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", optIdx, "values", valIdx, "value"],
          message: `Valor duplicado na opcao "${option.name}": "${val.value}".`,
        });
      }
      localValueSlugs.add(valSlug);
      scopedValueToOption.set(`${optSlug}:${valSlug}`, optSlug);
      const existingBare = bareValueToOptions.get(valSlug) ?? [];
      existingBare.push(optSlug);
      bareValueToOptions.set(valSlug, existingBare);
    }
  }

  const skuSet = new Set<string>();
  const combinationSet = new Set<string>();

  for (const [varIdx, variant] of data.variants.entries()) {
    if (skuSet.has(variant.sku)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants", varIdx, "sku"],
        message: `SKU duplicado: "${variant.sku}".`,
      });
    }
    skuSet.add(variant.sku);

    if (variant.optionValueSlugs.length !== data.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants", varIdx, "optionValueSlugs"],
        message: `Variante "${variant.sku}" deve selecionar exatamente ${data.options.length} opcoes.`,
      });
      continue;
    }

    const canonicalKeys: string[] = [];
    const usedOptionSlugs = new Set<string>();
    let hasInvalidRef = false;

    for (const rawRef of variant.optionValueSlugs) {
      const ref = rawRef.trim().toLowerCase();
      if (scopedValueToOption.has(ref)) {
        const optSlug = scopedValueToOption.get(ref) as string;
        if (usedOptionSlugs.has(optSlug)) {
          hasInvalidRef = true;
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["variants", varIdx, "optionValueSlugs"],
            message: `Variante "${variant.sku}" possui dois valores para a mesma opcao "${optSlug}".`,
          });
          break;
        }
        usedOptionSlugs.add(optSlug);
        canonicalKeys.push(ref);
        continue;
      }

      const matchedOpts = bareValueToOptions.get(ref);
      if (!matchedOpts || matchedOpts.length === 0) {
        hasInvalidRef = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", varIdx, "optionValueSlugs"],
          message: `Valor de opcao desconhecido "${rawRef}" na variante "${variant.sku}".`,
        });
        break;
      }
      if (matchedOpts.length > 1) {
        hasInvalidRef = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", varIdx, "optionValueSlugs"],
          message: `Valor ambiguo "${rawRef}" na variante "${variant.sku}". Use o formato "opcao:valor".`,
        });
        break;
      }
      const optSlug = matchedOpts[0] as string;
      if (usedOptionSlugs.has(optSlug)) {
        hasInvalidRef = true;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", varIdx, "optionValueSlugs"],
          message: `Variante "${variant.sku}" possui dois valores para a mesma opcao "${optSlug}".`,
        });
        break;
      }
      usedOptionSlugs.add(optSlug);
      canonicalKeys.push(`${optSlug}:${ref}`);
    }

    if (hasInvalidRef) {
      continue;
    }

    try {
      const comboKey = buildOptionCombinationKey(canonicalKeys);
      if (combinationSet.has(comboKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants", varIdx, "optionValueSlugs"],
          message: `Combinacao de opcoes duplicada para o SKU "${variant.sku}".`,
        });
      }
      combinationSet.add(comboKey);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants", varIdx, "optionValueSlugs"],
        message: err instanceof Error ? err.message : "Combinacao invalida.",
      });
    }
  }
}

export const createVariableProductSchema =
  createVariableProductObjectSchema.superRefine(validateVariableProductData);

export const createProductSchema = z
  .discriminatedUnion("hasVariants", [
    createSimpleProductSchema,
    createVariableProductObjectSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.hasVariants) {
      validateVariableProductData(data, ctx);
    }
  });

export type CreateSimpleProductInput = z.infer<typeof createSimpleProductSchema>;
export type CreateVariableProductInput = z.infer<typeof createVariableProductSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
