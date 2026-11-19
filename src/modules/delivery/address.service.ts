import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/http/api-response";
import type { CreateAddressInput, UpdateAddressInput } from "@/modules/delivery/address.schemas";

export async function listUserAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createUserAddress(userId: string, input: CreateAddressInput) {
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId } });
    const shouldBeDefault = input.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: {
        userId,
        label: input.label ?? null,
        recipientName: input.recipientName,
        phone: input.phone,
        cep: input.cep,
        street: input.street,
        number: input.number,
        complement: input.complement ?? null,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        referencePoint: input.referencePoint ?? null,
        isDefault: shouldBeDefault,
      },
    });
  });
}

export async function updateUserAddress(
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findUnique({
      where: { id: addressId },
    });

    if (!existing) {
      throw new NotFoundError("Endereco nao encontrado.", "ADDRESS_NOT_FOUND");
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError("Voce nao tem permissao para editar este endereco.");
    }

    if (input.isDefault === true) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    return tx.address.update({
      where: { id: addressId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.recipientName !== undefined ? { recipientName: input.recipientName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.cep !== undefined ? { cep: input.cep } : {}),
        ...(input.street !== undefined ? { street: input.street } : {}),
        ...(input.number !== undefined ? { number: input.number } : {}),
        ...(input.complement !== undefined ? { complement: input.complement } : {}),
        ...(input.neighborhood !== undefined ? { neighborhood: input.neighborhood } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.referencePoint !== undefined ? { referencePoint: input.referencePoint } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
  });
}

export async function deleteUserAddress(userId: string, addressId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findUnique({
      where: { id: addressId },
    });

    if (!existing) {
      throw new NotFoundError("Endereco nao encontrado.", "ADDRESS_NOT_FOUND");
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError("Voce nao tem permissao para excluir este endereco.");
    }

    await tx.address.delete({ where: { id: addressId } });

    if (existing.isDefault) {
      const nextDefault = await tx.address.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      if (nextDefault) {
        await tx.address.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    }

    return { deleted: true, id: addressId };
  });
}
