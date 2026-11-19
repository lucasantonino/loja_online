import { calculateLineTotalCents } from "@/lib/money";
import { resolveAvailableStock } from "@/modules/variants/matrix";

export interface CartVariantSnapshot {
  id: string;
  sku: string;
  label: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  stockOnHand: number;
  stockReserved: number;
  isActive: boolean;
  deletedAt: Date | null;
  product: {
    id: string;
    name: string;
    slug: string;
    status: string;
    deletedAt: Date | null;
    primaryImageUrl: string | null;
    primaryImageAlt: string | null;
  };
}

export interface RawCartItemRecord {
  id: string;
  variantId: string;
  quantity: number;
  unitPriceAtAddCents: number;
  variant: CartVariantSnapshot;
}

export interface PriceChangeNotice {
  itemId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  oldUnitPriceCents: number;
  newUnitPriceCents: number;
}

export interface StockWarningNotice {
  itemId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  requestedQuantity: number;
  availableStock: number;
  reason: "UNAVAILABLE" | "OUT_OF_STOCK" | "REDUCED_STOCK";
}

export interface ComputedCartItem {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  imageAlt: string | null;
  quantity: number;
  availableStock: number;
  isAvailable: boolean;
  unitPriceAtAddCents: number;
  unitPriceCents: number;
  lineTotalCents: number;
  priceChanged: boolean;
}

export interface ComputedCartState {
  items: ComputedCartItem[];
  itemCount: number;
  subtotalCents: number;
  priceChanges: PriceChangeNotice[];
  stockWarnings: StockWarningNotice[];
  hasBlockingIssues: boolean;
}

export function isVariantPurchasable(variant: CartVariantSnapshot): boolean {
  return (
    variant.isActive &&
    variant.deletedAt === null &&
    variant.product.status === "ACTIVE" &&
    variant.product.deletedAt === null
  );
}

export function computeCartState(rawItems: ReadonlyArray<RawCartItemRecord>): ComputedCartState {
  const items: ComputedCartItem[] = [];
  const priceChanges: PriceChangeNotice[] = [];
  const stockWarnings: StockWarningNotice[] = [];
  let subtotalCents = 0;
  let itemCount = 0;

  for (const raw of rawItems) {
    const isAvailable = isVariantPurchasable(raw.variant);
    const availableStock = isAvailable ? resolveAvailableStock(raw.variant) : 0;
    const unitPriceCents = raw.variant.priceCents;
    const lineTotalCents = calculateLineTotalCents(unitPriceCents, raw.quantity);
    const priceChanged = raw.unitPriceAtAddCents !== unitPriceCents;

    if (priceChanged) {
      priceChanges.push({
        itemId: raw.id,
        variantId: raw.variantId,
        productName: raw.variant.product.name,
        variantLabel: raw.variant.label,
        oldUnitPriceCents: raw.unitPriceAtAddCents,
        newUnitPriceCents: unitPriceCents,
      });
    }

    if (!isAvailable) {
      stockWarnings.push({
        itemId: raw.id,
        variantId: raw.variantId,
        productName: raw.variant.product.name,
        variantLabel: raw.variant.label,
        requestedQuantity: raw.quantity,
        availableStock: 0,
        reason: "UNAVAILABLE",
      });
    } else if (availableStock <= 0) {
      stockWarnings.push({
        itemId: raw.id,
        variantId: raw.variantId,
        productName: raw.variant.product.name,
        variantLabel: raw.variant.label,
        requestedQuantity: raw.quantity,
        availableStock: 0,
        reason: "OUT_OF_STOCK",
      });
    } else if (raw.quantity > availableStock) {
      stockWarnings.push({
        itemId: raw.id,
        variantId: raw.variantId,
        productName: raw.variant.product.name,
        variantLabel: raw.variant.label,
        requestedQuantity: raw.quantity,
        availableStock,
        reason: "REDUCED_STOCK",
      });
    }

    subtotalCents += lineTotalCents;
    itemCount += raw.quantity;

    items.push({
      id: raw.id,
      variantId: raw.variantId,
      productId: raw.variant.product.id,
      productName: raw.variant.product.name,
      productSlug: raw.variant.product.slug,
      variantLabel: raw.variant.label,
      sku: raw.variant.sku,
      imageUrl: raw.variant.product.primaryImageUrl,
      imageAlt: raw.variant.product.primaryImageAlt,
      quantity: raw.quantity,
      availableStock,
      isAvailable,
      unitPriceAtAddCents: raw.unitPriceAtAddCents,
      unitPriceCents,
      lineTotalCents,
      priceChanged,
    });
  }

  return {
    items,
    itemCount,
    subtotalCents,
    priceChanges,
    stockWarnings,
    hasBlockingIssues: stockWarnings.length > 0,
  };
}

export interface MergeVisitorItemInput {
  variantId: string;
  quantity: number;
  unitPriceAtAddCents: number;
  productName: string;
  variantLabel: string;
  isAvailable: boolean;
  availableStock: number;
  currentPriceCents: number;
}

export interface MergeUserItemInput {
  variantId: string;
  quantity: number;
  unitPriceAtAddCents: number;
}

export interface MergeWarningNotice {
  type: "DISCARDED_UNAVAILABLE" | "QUANTITY_CAPPED";
  variantId: string;
  productName: string;
  variantLabel: string;
  requestedQuantity: number;
  finalQuantity: number;
}

export interface PlannedCartUpsert {
  variantId: string;
  quantity: number;
  unitPriceAtAddCents: number;
}

export function planVisitorCartMerge(params: {
  visitorItems: ReadonlyArray<MergeVisitorItemInput>;
  userItems: ReadonlyArray<MergeUserItemInput>;
}): {
  upserts: PlannedCartUpsert[];
  warnings: MergeWarningNotice[];
} {
  const userByVariant = new Map<string, MergeUserItemInput>();
  for (const item of params.userItems) {
    userByVariant.set(item.variantId, item);
  }

  const upserts: PlannedCartUpsert[] = [];
  const warnings: MergeWarningNotice[] = [];

  for (const vItem of params.visitorItems) {
    const existing = userByVariant.get(vItem.variantId);
    const existingQty = existing?.quantity ?? 0;

    if (!vItem.isAvailable || vItem.availableStock <= 0) {
      warnings.push({
        type: "DISCARDED_UNAVAILABLE",
        variantId: vItem.variantId,
        productName: vItem.productName,
        variantLabel: vItem.variantLabel,
        requestedQuantity: existingQty + vItem.quantity,
        finalQuantity: existingQty,
      });
      continue;
    }

    const requestedTotal = existingQty + vItem.quantity;
    const finalQuantity = Math.min(requestedTotal, vItem.availableStock);

    if (finalQuantity < requestedTotal) {
      warnings.push({
        type: "QUANTITY_CAPPED",
        variantId: vItem.variantId,
        productName: vItem.productName,
        variantLabel: vItem.variantLabel,
        requestedQuantity: requestedTotal,
        finalQuantity,
      });
    }

    if (finalQuantity > 0) {
      upserts.push({
        variantId: vItem.variantId,
        quantity: finalQuantity,
        unitPriceAtAddCents: existing?.unitPriceAtAddCents ?? vItem.currentPriceCents,
      });
    }
  }

  return { upserts, warnings };
}
