import { UnprocessableEntityError } from "@/lib/errors";

export const DEFAULT_OPTION_COMBINATION_KEY = "DEFAULT";
export const DEFAULT_VARIANT_LABEL = "Padrao";

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Gera chave canonica ordenada lexicograficamente (RN21).
 * Independente da ordem em que o cliente ou UI envie os IDs dos valores,
 * o resultado e sempre deterministico (ex.: "optv_a|optv_b").
 */
export function buildOptionCombinationKey(optionValueIds: readonly string[]): string {
  if (optionValueIds.length === 0) {
    throw new UnprocessableEntityError(
      "Uma variante de produto variavel deve possuir ao menos um valor de opcao.",
      "EMPTY_VARIANT_OPTIONS",
    );
  }

  const normalized = optionValueIds.map((id) => id.trim()).filter((id) => id.length > 0);
  if (normalized.length !== optionValueIds.length) {
    throw new UnprocessableEntityError(
      "IDs de valores de opcao invalidos na combinacao.",
      "INVALID_OPTION_VALUE_ID",
    );
  }

  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw new UnprocessableEntityError(
      "Nao e permitido repetir valores de opcao na mesma combinacao.",
      "DUPLICATE_OPTION_VALUE_IN_COMBINATION",
    );
  }

  const sorted = [...normalized].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.join("|");
}

export function buildSuggestedSku(
  productSlug: string,
  optionValueSlugs: readonly string[],
): string {
  const base = slugify(productSlug).toUpperCase();
  const suffix = optionValueSlugs.map((slug) => slugify(slug).toUpperCase()).filter(Boolean);
  const parts = [base, ...suffix].filter(Boolean);
  return parts.join("-").slice(0, 64);
}
