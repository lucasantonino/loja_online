import { createSessionToken } from "@/lib/auth/session";
import {
  generateOpaqueToken,
  hashPassword,
  hashTokenSha256,
  verifyPassword,
} from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/lib/http/api-response";
import { recordAuditLog } from "@/modules/admin/audit";
import type {
  AnonymizeAccountInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/modules/auth/schemas";

const PASSWORD_RESET_TTL_MINUTES = 30;

export async function registerCustomer(input: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError("Ja existe uma conta cadastrada com este e-mail.", "EMAIL_IN_USE");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone ?? null,
      role: "CUSTOMER",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      passwordHash: true,
    },
  });

  const sessionToken = createSessionToken({
    userId: user.id,
    passwordHash: user.passwordHash,
  });

  // Envio nao bloqueante (RNF04)
  void sendWelcomeEmail({ to: user.email, name: user.name });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    sessionToken,
  };
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      anonymizedAt: true,
      passwordHash: true,
    },
  });

  if (!user || !user.passwordHash || !user.isActive || user.anonymizedAt) {
    throw new UnauthorizedError("E-mail ou senha invalidos.", "INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("E-mail ou senha invalidos.", "INVALID_CREDENTIALS");
  }

  const sessionToken = createSessionToken({
    userId: user.id,
    passwordHash: user.passwordHash,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    sessionToken,
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      anonymizedAt: true,
    },
  });

  // Anti-enumeracao: retorna silenciosamente mesmo se nao existir
  if (!user || !user.isActive || user.anonymizedAt) {
    return;
  }

  const rawToken = generateOpaqueToken(32);
  const tokenHash = hashTokenSha256(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const baseUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const resetUrl = `${baseUrl}/recuperar-senha?token=${encodeURIComponent(rawToken)}`;

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
  });
}

export async function resetPasswordWithToken(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashTokenSha256(input.token);
  const now = new Date();
  const newPasswordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    const tokenRecord = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, isActive: true, anonymizedAt: true },
        },
      },
    });

    if (
      !tokenRecord ||
      tokenRecord.usedAt !== null ||
      tokenRecord.expiresAt <= now ||
      !tokenRecord.user.isActive ||
      tokenRecord.user.anonymizedAt !== null
    ) {
      throw new UnprocessableEntityError(
        "Token de recuperacao invalido ou expirado.",
        "INVALID_OR_EXPIRED_RESET_TOKEN",
      );
    }

    // Atualizar passwordHash tambem invalida todas as sessoes anteriores via password version
    await tx.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: newPasswordHash },
    });

    await tx.passwordResetToken.updateMany({
      where: {
        userId: tokenRecord.userId,
        usedAt: null,
      },
      data: { usedAt: now },
    });
  });
}

export async function getAccountProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      anonymizedAt: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive || user.anonymizedAt) {
    throw new NotFoundError("Usuario nao encontrado.", "USER_NOT_FOUND");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      addresses: {
        select: {
          id: true,
          label: true,
          recipientName: true,
          phone: true,
          cep: true,
          street: true,
          number: true,
          complement: true,
          neighborhood: true,
          city: true,
          state: true,
          referencePoint: true,
          isDefault: true,
          createdAt: true,
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          deliveryMethod: true,
          subtotalCents: true,
          deliveryFeeCents: true,
          discountCents: true,
          totalCents: true,
          shippingAddressSnapshot: true,
          createdAt: true,
          items: {
            select: {
              productNameSnapshot: true,
              variantLabelSnapshot: true,
              skuSnapshot: true,
              quantity: true,
              unitPriceCents: true,
              lineTotalCents: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("Usuario nao encontrado.", "USER_NOT_FOUND");
  }

  return {
    exportedAt: new Date().toISOString(),
    user,
  };
}

export async function anonymizeUserAccount(
  userId: string,
  input: AnonymizeAccountInput,
  auditMeta: { ipAddress: string | null; userAgent: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        anonymizedAt: true,
        orders: {
          where: {
            status: {
              in: ["PAID", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP"],
            },
          },
          select: { id: true, orderNumber: true },
        },
      },
    });

    if (!user || user.anonymizedAt) {
      throw new NotFoundError("Conta nao encontrada ou ja anonimizada.", "USER_NOT_FOUND");
    }

    if (user.passwordHash) {
      if (!input.password) {
        throw new UnprocessableEntityError(
          "Informe sua senha atual para confirmar a anonimizacao.",
          "PASSWORD_CONFIRMATION_REQUIRED",
        );
      }
      const passwordOk = await verifyPassword(input.password, user.passwordHash);
      if (!passwordOk) {
        throw new UnauthorizedError("Senha atual incorreta.", "INVALID_PASSWORD");
      }
    }

    if (user.orders.length > 0) {
      throw new ConflictError(
        "Nao e possivel excluir a conta enquanto houver pedidos em andamento.",
        "ACTIVE_ORDERS_IN_PROGRESS",
        { orderNumbers: user.orders.map((o) => o.orderNumber) },
      );
    }

    const now = new Date();

    await tx.address.deleteMany({
      where: { userId },
    });

    await tx.cart.deleteMany({
      where: { userId, convertedAt: null },
    });

    await tx.passwordResetToken.deleteMany({
      where: { userId },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Usuario Excluido",
        email: `deleted_${userId}@anon.invalid`,
        phone: null,
        cpf: null,
        passwordHash: null,
        isActive: false,
        anonymizedAt: now,
      },
    });

    await recordAuditLog(tx, {
      actorUserId: userId,
      action: "USER_ANONYMIZED_LGPD",
      entityType: "User",
      entityId: userId,
      beforeState: { anonymizedAt: null },
      afterState: { anonymizedAt: now.toISOString() },
      ipAddress: auditMeta.ipAddress,
      userAgent: auditMeta.userAgent,
    });

    return { anonymizedAt: now.toISOString() };
  });
}
