import type { Prisma } from "@prisma/client";
import type { PrismaTx } from "@/lib/db/prisma";

export interface AuditLogInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAuditLog(tx: PrismaTx, input: AuditLogInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState ?? undefined,
      afterState: input.afterState ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
