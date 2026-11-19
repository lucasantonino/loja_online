import { UnprocessableEntityError } from "@/lib/errors";
import { buildOptionCombinationKey, buildSuggestedSku } from "@/modules/variants/combination-key";

export interface StockBalance {
  stockOnHand: number;
  stockReserved: number;
}

export function resolveAvailableStock(balance: StockBalance): number {
  return Math.max(0, balance.stockOnHand - balance.stockReserved);
}

export interface MatrixOptionValueInput {
  id: string;
  value: string;
  slug: string;
}

export interface MatrixOptionInput {
  id: string;
  name: string;
  slug: string;
  values: ReadonlyArray<MatrixOptionValueInput>;
}

export interface GeneratedVariantRow {
  optionCombinationKey: string;
  optionValueIds: string[];
  label: string;
  suggestedSku: string;
}

export function generateVariantMatrix(
  productSlug: string,
  options: ReadonlyArray<MatrixOptionInput>,
): GeneratedVariantRow[] {
  if (options.length === 0) {
    throw new UnprocessableEntityError(
      "Informe ao menos uma opcao para gerar a matriz de variantes.",
      "EMPTY_OPTIONS",
    );
  }

  for (const option of options) {
    if (option.values.length === 0) {
      throw new UnprocessableEntityError(
        `A opcao "${option.name}" precisa de ao menos um valor.`,
        "EMPTY_OPTION_VALUES",
      );
    }
  }

  let combinations: MatrixOptionValueInput[][] = [[]];
  for (const option of options) {
    const next: MatrixOptionValueInput[][] = [];
    for (const prefix of combinations) {
      for (const value of option.values) {
        next.push([...prefix, value]);
      }
    }
    combinations = next;
  }

  return combinations.map((selectedValues) => ({
    optionCombinationKey: buildOptionCombinationKey(selectedValues.map((v) => v.id)),
    optionValueIds: selectedValues.map((v) => v.id),
    label: selectedValues.map((v) => v.value).join(" · "),
    suggestedSku: buildSuggestedSku(
      productSlug,
      selectedValues.map((v) => v.slug),
    ),
  }));
}

export interface AvailabilityOptionValue {
  id: string;
  value: string;
  slug: string;
  colorHex?: string | null;
}

export interface AvailabilityOption {
  id: string;
  name: string;
  slug: string;
  isRequired: boolean;
  values: ReadonlyArray<AvailabilityOptionValue>;
}

export interface AvailabilityVariant {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stockOnHand?: number;
  stockReserved?: number;
  availableStock?: number;
  isActive?: boolean;
  deletedAt?: Date | null;
  optionValueIds: ReadonlyArray<string>;
}

function getVariantAvailableStock(variant: AvailabilityVariant): number {
  if (
    typeof variant.stockOnHand === "number" &&
    typeof variant.stockReserved === "number"
  ) {
    return resolveAvailableStock({
      stockOnHand: variant.stockOnHand,
      stockReserved: variant.stockReserved,
    });
  }
  return Math.max(0, variant.availableStock ?? 0);
}

export interface OptionValueAvailabilityState extends AvailabilityOptionValue {
  exists: boolean;
  inStock: boolean;
  selected: boolean;
}

export interface OptionAvailabilityGroup {
  id: string;
  name: string;
  slug: string;
  isRequired: boolean;
  selectedValueId: string | null;
  values: OptionValueAvailabilityState[];
}

export interface ComputedVariantAvailability {
  options: OptionAvailabilityGroup[];
  missingRequiredOptionIds: string[];
  allRequiredSelected: boolean;
  matchedVariant: (AvailabilityVariant & { availableStock: number }) | null;
  isMatchedInStock: boolean;
}

/**
 * Calcula disponibilidade cruzada na PDP (RF11, CA04, CA05).
 * Exemplo: se Branca + M estiver esgotado, selecionar Branca desabilita M
 * sem bloquear P e G, e desmarcar ou selecionar Preta volta a habilitar M.
 */
export function computeOptionAvailability(
  options: ReadonlyArray<AvailabilityOption>,
  variants: ReadonlyArray<AvailabilityVariant>,
  selectedByOptionId: Record<string, string | undefined>,
): ComputedVariantAvailability {
  const activeVariants = variants.filter(
    (variant) => variant.isActive !== false && !variant.deletedAt,
  );

  const optionGroups: OptionAvailabilityGroup[] = options.map((option) => {
    const otherSelectedValueIds = Object.entries(selectedByOptionId)
      .filter(([optId, valId]) => optId !== option.id && typeof valId === "string" && valId.length > 0)
      .map(([, valId]) => valId as string);

    const values: OptionValueAvailabilityState[] = option.values.map((val) => {
      const matchingVariants = activeVariants.filter((variant) => {
        if (!variant.optionValueIds.includes(val.id)) {
          return false;
        }
        return otherSelectedValueIds.every((otherId) => variant.optionValueIds.includes(otherId));
      });

      const exists = matchingVariants.length > 0;
      const inStock = matchingVariants.some((variant) => getVariantAvailableStock(variant) > 0);

      return {
        ...val,
        exists,
        inStock,
        selected: selectedByOptionId[option.id] === val.id,
      };
    });

    return {
      id: option.id,
      name: option.name,
      slug: option.slug,
      isRequired: option.isRequired,
      selectedValueId: selectedByOptionId[option.id] ?? null,
      values,
    };
  });

  const missingRequiredOptionIds = options
    .filter((option) => option.isRequired && !selectedByOptionId[option.id])
    .map((option) => option.id);

  const allRequiredSelected = missingRequiredOptionIds.length === 0;
  const selectedValueIds = options
    .map((option) => selectedByOptionId[option.id])
    .filter((valId): valId is string => typeof valId === "string" && valId.length > 0);

  let matchedVariant: (AvailabilityVariant & { availableStock: number }) | null = null;
  if (allRequiredSelected && selectedValueIds.length > 0) {
    const found = activeVariants.find(
      (variant) =>
        variant.optionValueIds.length === selectedValueIds.length &&
        selectedValueIds.every((valId) => variant.optionValueIds.includes(valId)),
    );

    if (found) {
      matchedVariant = {
        ...found,
        availableStock: getVariantAvailableStock(found),
      };
    }
  }

  return {
    options: optionGroups,
    missingRequiredOptionIds,
    allRequiredSelected,
    matchedVariant,
    isMatchedInStock: matchedVariant ? matchedVariant.availableStock > 0 : false,
  };
}
