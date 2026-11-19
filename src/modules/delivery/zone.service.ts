import { prisma } from "@/lib/db/prisma";
import { NotFoundError, UnprocessableEntityError } from "@/lib/http/api-response";
import { recordAuditLog } from "@/modules/admin/audit";
import type {
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
} from "@/modules/delivery/zone.schemas";
import type { ActorContext } from "@/modules/inventory/inventory.service";

export async function listAdminDeliveryZones() {
  return prisma.deliveryZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { city: "asc" }, { name: "asc" }],
  });
}

export async function createDeliveryZone(input: CreateDeliveryZoneInput, actor: ActorContext) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.deliveryZone.create({
      data: {
        name: input.name,
        city: input.city,
        state: input.state,
        matchType: input.matchType,
        cepStart: input.cepStart ?? null,
        cepEnd: input.cepEnd ?? null,
        neighborhoods: input.neighborhoods,
        feeCents: input.feeCents,
        freeShippingMinCents: input.freeShippingMinCents ?? null,
        estimatedDaysMin: input.estimatedDaysMin,
        estimatedDaysMax: input.estimatedDaysMax,
        estimatedLabel: input.estimatedLabel,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "DELIVERY_ZONE_CREATED",
      entityType: "DeliveryZone",
      entityId: created.id,
      afterState: {
        name: created.name,
        matchType: created.matchType,
        feeCents: created.feeCents,
        isActive: created.isActive,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return created;
  });
}

export async function updateDeliveryZone(
  zoneId: string,
  input: UpdateDeliveryZoneInput,
  actor: ActorContext,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.deliveryZone.findUnique({ where: { id: zoneId } });
    if (!existing) {
      throw new NotFoundError("Zona de entrega nao encontrada.", "DELIVERY_ZONE_NOT_FOUND");
    }

    const nextMatchType = input.matchType ?? existing.matchType;
    const nextCepStart = input.cepStart !== undefined ? input.cepStart : existing.cepStart;
    const nextCepEnd = input.cepEnd !== undefined ? input.cepEnd : existing.cepEnd;
    const nextNeighborhoods =
      input.neighborhoods !== undefined ? input.neighborhoods : existing.neighborhoods;
    const nextMinDays =
      input.estimatedDaysMin !== undefined ? input.estimatedDaysMin : existing.estimatedDaysMin;
    const nextMaxDays =
      input.estimatedDaysMax !== undefined ? input.estimatedDaysMax : existing.estimatedDaysMax;

    if (nextMaxDays < nextMinDays) {
      throw new UnprocessableEntityError(
        "Prazo maximo deve ser maior ou igual ao prazo minimo.",
        "INVALID_DELIVERY_DAYS",
      );
    }

    if (nextMatchType === "CEP_RANGE" && (!nextCepStart || !nextCepEnd || nextCepStart > nextCepEnd)) {
      throw new UnprocessableEntityError(
        "Faixa de CEP invalida para zona CEP_RANGE.",
        "INVALID_CEP_RANGE",
      );
    }

    if (nextMatchType === "NEIGHBORHOOD" && nextNeighborhoods.length === 0) {
      throw new UnprocessableEntityError(
        "Informe ao menos um bairro para zona NEIGHBORHOOD.",
        "EMPTY_NEIGHBORHOODS",
      );
    }

    const updated = await tx.deliveryZone.update({
      where: { id: zoneId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.matchType !== undefined ? { matchType: input.matchType } : {}),
        ...(input.cepStart !== undefined ? { cepStart: input.cepStart } : {}),
        ...(input.cepEnd !== undefined ? { cepEnd: input.cepEnd } : {}),
        ...(input.neighborhoods !== undefined ? { neighborhoods: input.neighborhoods } : {}),
        ...(input.feeCents !== undefined ? { feeCents: input.feeCents } : {}),
        ...(input.freeShippingMinCents !== undefined
          ? { freeShippingMinCents: input.freeShippingMinCents }
          : {}),
        ...(input.estimatedDaysMin !== undefined
          ? { estimatedDaysMin: input.estimatedDaysMin }
          : {}),
        ...(input.estimatedDaysMax !== undefined
          ? { estimatedDaysMax: input.estimatedDaysMax }
          : {}),
        ...(input.estimatedLabel !== undefined ? { estimatedLabel: input.estimatedLabel } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "DELIVERY_ZONE_UPDATED",
      entityType: "DeliveryZone",
      entityId: updated.id,
      beforeState: {
        name: existing.name,
        feeCents: existing.feeCents,
        isActive: existing.isActive,
      },
      afterState: {
        name: updated.name,
        feeCents: updated.feeCents,
        isActive: updated.isActive,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  });
}

export async function deleteDeliveryZone(zoneId: string, actor: ActorContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.deliveryZone.findUnique({ where: { id: zoneId } });
    if (!existing) {
      throw new NotFoundError("Zona de entrega nao encontrada.", "DELIVERY_ZONE_NOT_FOUND");
    }

    await tx.deliveryZone.delete({ where: { id: zoneId } });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "DELIVERY_ZONE_DELETED",
      entityType: "DeliveryZone",
      entityId: zoneId,
      beforeState: { name: existing.name, city: existing.city, state: existing.state },
      afterState: null,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { deleted: true, id: zoneId };
  });
}
