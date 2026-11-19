import { Prisma } from "@prisma/client";
import { prisma, type PrismaTx } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, UnprocessableEntityError } from "@/lib/http/api-response";
import { recordAuditLog } from "@/modules/admin/audit";
import type { ManualStockAdjustmentInput } from "@/modules/inventory/schemas";

export interface ActorContext {
  actorUserId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface VariantBalanceRow {
  productId: string;
  stockOnHand: number;
  stockReserved: number;
}

interface ReleasedReservationRow {
  id: string;
  variantId: string;
  quantity: number;
}

export async function adjustVariantStock(
  input: ManualStockAdjustmentInput,
  actor: ActorContext,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: {
        id: true,
        productId: true,
        sku: true,
        stockOnHand: true,
        stockReserved: true,
        deletedAt: true,
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError("Variante nao encontrada.", "VARIANT_NOT_FOUND");
    }

    const isInbound = input.type === "MANUAL_ADJUSTMENT_IN";

    const updatedRows = isInbound
      ? await tx.$queryRaw<VariantBalanceRow[]>`
          UPDATE "ProductVariant"
          SET "stockOnHand" = "stockOnHand" + ${input.quantity},
              "updatedAt" = NOW()
          WHERE id = ${input.variantId}
            AND "deletedAt" IS NULL
          RETURNING "productId", "stockOnHand", "stockReserved"
        `
      : await tx.$queryRaw<VariantBalanceRow[]>`
          UPDATE "ProductVariant"
          SET "stockOnHand" = "stockOnHand" - ${input.quantity},
              "updatedAt" = NOW()
          WHERE id = ${input.variantId}
            AND "deletedAt" IS NULL
            AND ("stockOnHand" - "stockReserved") >= ${input.quantity}
          RETURNING "productId", "stockOnHand", "stockReserved"
        `;

    const updated = updatedRows[0];
    if (!updated) {
      throw new ConflictError(
        "Estoque disponivel insuficiente para realizar a baixa manual.",
        "INSUFFICIENT_AVAILABLE_STOCK",
        {
          variantId: existing.id,
          sku: existing.sku,
          availableStock: Math.max(0, existing.stockOnHand - existing.stockReserved),
        },
      );
    }

    const quantityDelta = isInbound ? input.quantity : -input.quantity;

    const movement = await tx.inventoryMovement.create({
      data: {
        productId: updated.productId,
        variantId: existing.id,
        actorUserId: actor.actorUserId ?? null,
        type: input.type,
        quantityDelta,
        reservedDelta: 0,
        stockOnHandAfter: updated.stockOnHand,
        stockReservedAfter: updated.stockReserved,
        reason: input.reason,
      },
    });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "INVENTORY_ADJUSTED",
      entityType: "ProductVariant",
      entityId: existing.id,
      beforeState: {
        stockOnHand: existing.stockOnHand,
        stockReserved: existing.stockReserved,
      },
      afterState: {
        stockOnHand: updated.stockOnHand,
        stockReserved: updated.stockReserved,
        movementType: input.type,
        quantity: input.quantity,
        reason: input.reason,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return {
      variantId: existing.id,
      sku: existing.sku,
      stockOnHand: updated.stockOnHand,
      stockReserved: updated.stockReserved,
      availableStock: updated.stockOnHand - updated.stockReserved,
      movementId: movement.id,
    };
  });
}

export interface ReserveStockItemInput {
  variantId: string;
  quantity: number;
}

export interface ReserveStockParams {
  orderId: string;
  expiresAt: Date;
  items: ReadonlyArray<ReserveStockItemInput>;
  actorUserId?: string | null;
}

export async function reserveStockInTx(tx: PrismaTx, params: ReserveStockParams) {
  if (params.items.length === 0) {
    throw new UnprocessableEntityError(
      "Nenhum item informado para reserva de estoque.",
      "EMPTY_RESERVATION_ITEMS",
    );
  }

  // Agrega por variantId e ordena deterministicamente para evitar deadlocks concorrentes
  const aggregated = new Map<string, number>();
  for (const item of params.items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new UnprocessableEntityError(
        "Quantidade invalida para reserva de estoque.",
        "INVALID_RESERVATION_QUANTITY",
      );
    }
    aggregated.set(item.variantId, (aggregated.get(item.variantId) ?? 0) + item.quantity);
  }

  const orderedItems = [...aggregated.entries()]
    .sort(([idA], [idB]) => (idA < idB ? -1 : idA > idB ? 1 : 0))
    .map(([variantId, quantity]) => ({ variantId, quantity }));

  const reservations = [];

  for (const item of orderedItems) {
    const updatedRows = await tx.$queryRaw<VariantBalanceRow[]>`
      UPDATE "ProductVariant"
      SET "stockReserved" = "stockReserved" + ${item.quantity},
          "updatedAt" = NOW()
      WHERE id = ${item.variantId}
        AND "isActive" = true
        AND "deletedAt" IS NULL
        AND ("stockOnHand" - "stockReserved") >= ${item.quantity}
        AND EXISTS (
          SELECT 1 FROM "Product" p
          WHERE p.id = "ProductVariant"."productId"
            AND p.status = 'ACTIVE'::"ProductStatus"
            AND p."deletedAt" IS NULL
        )
      RETURNING "productId", "stockOnHand", "stockReserved"
    `;

    const updated = updatedRows[0];
    if (!updated) {
      throw new ConflictError(
        "Estoque insuficiente ou produto indisponivel para concluir a reserva.",
        "OUT_OF_STOCK",
        { variantId: item.variantId, requestedQuantity: item.quantity },
      );
    }

    const reservation = await tx.stockReservation.create({
      data: {
        orderId: params.orderId,
        variantId: item.variantId,
        quantity: item.quantity,
        status: "ACTIVE",
        expiresAt: params.expiresAt,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: updated.productId,
        variantId: item.variantId,
        orderId: params.orderId,
        actorUserId: params.actorUserId ?? null,
        type: "RESERVE",
        quantityDelta: 0,
        reservedDelta: item.quantity,
        stockOnHandAfter: updated.stockOnHand,
        stockReservedAfter: updated.stockReserved,
        reason: "Reserva temporaria de checkout",
      },
    });

    reservations.push(reservation);
  }

  return reservations;
}

export async function confirmReservationsInTx(
  tx: PrismaTx,
  params: { orderId: string; actorUserId?: string | null },
) {
  const confirmedReservations = await tx.$queryRaw<ReleasedReservationRow[]>`
    UPDATE "StockReservation"
    SET status = 'CONFIRMED'::"StockReservationStatus",
        "confirmedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "orderId" = ${params.orderId}
      AND status = 'ACTIVE'::"StockReservationStatus"
    RETURNING id, "variantId", quantity
  `;

  if (confirmedReservations.length === 0) {
    return [];
  }

  const ordered = [...confirmedReservations].sort((a, b) =>
    a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0,
  );

  for (const res of ordered) {
    const updatedRows = await tx.$queryRaw<VariantBalanceRow[]>`
      UPDATE "ProductVariant"
      SET "stockOnHand" = "stockOnHand" - ${res.quantity},
          "stockReserved" = "stockReserved" - ${res.quantity},
          "updatedAt" = NOW()
      WHERE id = ${res.variantId}
        AND "stockOnHand" >= ${res.quantity}
        AND "stockReserved" >= ${res.quantity}
      RETURNING "productId", "stockOnHand", "stockReserved"
    `;

    const updated = updatedRows[0];
    if (!updated) {
      throw new ConflictError(
        "Inconsistencia ao confirmar baixa definitiva de estoque.",
        "STOCK_CONFIRMATION_INVARIANT_ERROR",
        { orderId: params.orderId, variantId: res.variantId },
      );
    }

    await tx.inventoryMovement.create({
      data: {
        productId: updated.productId,
        variantId: res.variantId,
        orderId: params.orderId,
        actorUserId: params.actorUserId ?? null,
        type: "SALE",
        quantityDelta: -res.quantity,
        reservedDelta: -res.quantity,
        stockOnHandAfter: updated.stockOnHand,
        stockReservedAfter: updated.stockReserved,
        reason: "Venda confirmada apos pagamento",
      },
    });
  }

  return ordered;
}

export async function releaseReservationsInTx(
  tx: PrismaTx,
  params: {
    orderId: string;
    targetStatus: "RELEASED" | "EXPIRED";
    actorUserId?: string | null;
    reason?: string;
  },
) {
  const statusSql =
    params.targetStatus === "EXPIRED"
      ? Prisma.sql`'EXPIRED'::"StockReservationStatus"`
      : Prisma.sql`'RELEASED'::"StockReservationStatus"`;

  const releasedReservations = await tx.$queryRaw<ReleasedReservationRow[]>`
    UPDATE "StockReservation"
    SET status = ${statusSql},
        "releasedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "orderId" = ${params.orderId}
      AND status = 'ACTIVE'::"StockReservationStatus"
    RETURNING id, "variantId", quantity
  `;

  if (releasedReservations.length === 0) {
    return [];
  }

  const ordered = [...releasedReservations].sort((a, b) =>
    a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0,
  );

  for (const res of ordered) {
    const updatedRows = await tx.$queryRaw<VariantBalanceRow[]>`
      UPDATE "ProductVariant"
      SET "stockReserved" = "stockReserved" - ${res.quantity},
          "updatedAt" = NOW()
      WHERE id = ${res.variantId}
        AND "stockReserved" >= ${res.quantity}
      RETURNING "productId", "stockOnHand", "stockReserved"
    `;

    const updated = updatedRows[0];
    if (!updated) {
      throw new ConflictError(
        "Inconsistencia ao liberar reserva de estoque.",
        "STOCK_RELEASE_INVARIANT_ERROR",
        { orderId: params.orderId, variantId: res.variantId },
      );
    }

    await tx.inventoryMovement.create({
      data: {
        productId: updated.productId,
        variantId: res.variantId,
        orderId: params.orderId,
        actorUserId: params.actorUserId ?? null,
        type: "RELEASE",
        quantityDelta: 0,
        reservedDelta: -res.quantity,
        stockOnHandAfter: updated.stockOnHand,
        stockReservedAfter: updated.stockReserved,
        reason:
          params.reason ??
          (params.targetStatus === "EXPIRED"
            ? "Liberacao automatica por expiracao de reserva"
            : "Liberacao por cancelamento ou falha de pagamento"),
      },
    });
  }

  return ordered;
}

export async function listAdminInventory(params?: { q?: string }) {
  const term = params?.q?.trim();

  const where: Prisma.ProductVariantWhereInput = {
    deletedAt: null,
    product: { deletedAt: null },
    ...(term
      ? {
          OR: [
            { sku: { contains: term, mode: "insensitive" } },
            { label: { contains: term, mode: "insensitive" } },
            { product: { name: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [variants, movements] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      orderBy: [{ stockOnHand: "asc" }, { sku: "asc" }],
      take: 100,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    }),
    prisma.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        product: { select: { name: true } },
        variant: { select: { sku: true, label: true } },
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    variants: variants.map((v) => ({
      ...v,
      availableStock: Math.max(0, v.stockOnHand - v.stockReserved),
    })),
    movements,
  };
}
