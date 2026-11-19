import { randomBytes } from "node:crypto";
import { prisma, type PrismaTx } from "@/lib/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, UnprocessableEntityError } from "@/lib/http/api-response";
import {
  computeCartState,
  isVariantPurchasable,
  planVisitorCartMerge,
  type ComputedCartState,
  type MergeWarningNotice,
  type RawCartItemRecord,
} from "@/modules/cart/cart-math";
import { CART_TTL_SECONDS } from "@/modules/cart/cookie";
import { resolveAvailableStock } from "@/modules/variants/matrix";

export interface CartActor {
  userId?: string | null;
  sessionToken?: string | null;
}

export interface CartResponse extends ComputedCartState {
  cartId: string | null;
}

function cartExpiresAt(): Date {
  return new Date(Date.now() + CART_TTL_SECONDS * 1000);
}

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          product: {
            include: {
              images: {
                orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
                take: 1,
                select: { url: true, altText: true },
              },
            },
          },
        },
      },
    },
  },
};

function mapCartItems(
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitPriceAtAddCents: number;
    variant: {
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
        images: Array<{ url: string; altText: string }>;
      };
    };
  }>,
): RawCartItemRecord[] {
  return items.map((item) => ({
    id: item.id,
    variantId: item.variantId,
    quantity: item.quantity,
    unitPriceAtAddCents: item.unitPriceAtAddCents,
    variant: {
      id: item.variant.id,
      sku: item.variant.sku,
      label: item.variant.label,
      priceCents: item.variant.priceCents,
      compareAtPriceCents: item.variant.compareAtPriceCents,
      stockOnHand: item.variant.stockOnHand,
      stockReserved: item.variant.stockReserved,
      isActive: item.variant.isActive,
      deletedAt: item.variant.deletedAt,
      product: {
        id: item.variant.product.id,
        name: item.variant.product.name,
        slug: item.variant.product.slug,
        status: item.variant.product.status,
        deletedAt: item.variant.product.deletedAt,
        primaryImageUrl: item.variant.product.images[0]?.url ?? null,
        primaryImageAlt: item.variant.product.images[0]?.altText ?? null,
      },
    },
  }));
}

async function findActiveCart(tx: PrismaTx, actor: CartActor) {
  if (actor.userId) {
    return tx.cart.findFirst({
      where: { userId: actor.userId, convertedAt: null },
      include: cartInclude,
    });
  }
  if (actor.sessionToken) {
    return tx.cart.findFirst({
      where: {
        sessionToken: actor.sessionToken,
        convertedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: cartInclude,
    });
  }
  return null;
}

export async function getCart(actor: CartActor): Promise<CartResponse> {
  if (!actor.userId && !actor.sessionToken) {
    return {
      cartId: null,
      ...computeCartState([]),
    };
  }

  const cart = await findActiveCart(prisma, actor);
  if (!cart) {
    return {
      cartId: null,
      ...computeCartState([]),
    };
  }

  return {
    cartId: cart.id,
    ...computeCartState(mapCartItems(cart.items)),
  };
}

export async function addItemToCart(params: {
  actor: CartActor;
  variantId: string;
  quantity: number;
}): Promise<{ cart: CartResponse; newVisitorSessionToken?: string }> {
  const newVisitorSessionToken =
    !params.actor.userId && !params.actor.sessionToken
      ? randomBytes(24).toString("hex")
      : undefined;
  const effectiveSessionToken = params.actor.sessionToken ?? newVisitorSessionToken ?? null;

  const result = await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: params.variantId },
      include: {
        product: {
          include: {
            images: {
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 1,
              select: { url: true, altText: true },
            },
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundError("Variacao do produto nao encontrada.", "VARIANT_NOT_FOUND");
    }

    const purchasable = isVariantPurchasable({
      ...variant,
      product: {
        ...variant.product,
        primaryImageUrl: variant.product.images[0]?.url ?? null,
        primaryImageAlt: variant.product.images[0]?.altText ?? null,
      },
    });

    if (!purchasable) {
      throw new UnprocessableEntityError(
        "Este produto ou variacao nao esta disponivel para venda.",
        "VARIANT_UNAVAILABLE",
      );
    }

    let cart = await findActiveCart(tx, {
      userId: params.actor.userId,
      sessionToken: effectiveSessionToken,
    });

    if (!cart) {
      cart = await tx.cart.create({
        data: params.actor.userId
          ? { userId: params.actor.userId }
          : {
              sessionToken: effectiveSessionToken,
              expiresAt: cartExpiresAt(),
            },
        include: cartInclude,
      });
    } else if (!params.actor.userId) {
      await tx.cart.update({
        where: { id: cart.id },
        data: { expiresAt: cartExpiresAt() },
      });
    }

    const existingItem = cart.items.find((i) => i.variantId === params.variantId);
    const nextQuantity = (existingItem?.quantity ?? 0) + params.quantity;
    const availableStock = resolveAvailableStock(variant);

    if (availableStock < nextQuantity) {
      throw new ConflictError(
        availableStock === 0
          ? "Esta variacao esta esgotada no momento."
          : `Estoque insuficiente. Disponivel: ${availableStock} unidade(s).`,
        "OUT_OF_STOCK",
        {
          variantId: variant.id,
          availableStock,
          requestedQuantity: nextQuantity,
        },
      );
    }

    await tx.cartItem.upsert({
      where: {
        cartId_variantId: {
          cartId: cart.id,
          variantId: params.variantId,
        },
      },
      update: {
        quantity: nextQuantity,
        unitPriceAtAddCents: variant.priceCents,
      },
      create: {
        cartId: cart.id,
        variantId: params.variantId,
        quantity: nextQuantity,
        unitPriceAtAddCents: variant.priceCents,
      },
    });

    const refreshed = await tx.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: cartInclude,
    });

    return {
      cartId: refreshed.id,
      ...computeCartState(mapCartItems(refreshed.items)),
    };
  });

  return {
    cart: result,
    ...(newVisitorSessionToken ? { newVisitorSessionToken } : {}),
  };
}

export async function updateCartItemQuantity(params: {
  actor: CartActor;
  itemId: string;
  quantity: number;
}): Promise<CartResponse> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.cartItem.findUnique({
      where: { id: params.itemId },
      include: {
        cart: true,
        variant: {
          include: {
            product: {
              select: { id: true, status: true, deletedAt: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundError("Item nao encontrado no carrinho.", "CART_ITEM_NOT_FOUND");
    }

    const ownsByUser = Boolean(params.actor.userId && item.cart.userId === params.actor.userId);
    const ownsBySession = Boolean(
      !params.actor.userId &&
        params.actor.sessionToken &&
        item.cart.sessionToken === params.actor.sessionToken,
    );

    if (!ownsByUser && !ownsBySession) {
      throw new ForbiddenError("Voce nao tem permissao para alterar este item do carrinho.");
    }

    if (params.quantity === 0) {
      await tx.cartItem.delete({ where: { id: item.id } });
    } else {
      const purchasable =
        item.variant.isActive &&
        item.variant.deletedAt === null &&
        item.variant.product.status === "ACTIVE" &&
        item.variant.product.deletedAt === null;

      if (!purchasable) {
        throw new UnprocessableEntityError(
          "Produto indisponivel no momento.",
          "VARIANT_UNAVAILABLE",
        );
      }

      const availableStock = resolveAvailableStock(item.variant);
      if (params.quantity > availableStock) {
        throw new ConflictError(
          `Quantidade solicitada excede o estoque disponivel (${availableStock} un.).`,
          "OUT_OF_STOCK",
          {
            variantId: item.variantId,
            availableStock,
            requestedQuantity: params.quantity,
          },
        );
      }

      await tx.cartItem.update({
        where: { id: item.id },
        data: { quantity: params.quantity },
      });
    }

    const refreshed = await tx.cart.findUniqueOrThrow({
      where: { id: item.cartId },
      include: cartInclude,
    });

    return {
      cartId: refreshed.id,
      ...computeCartState(mapCartItems(refreshed.items)),
    };
  });
}

export async function removeCartItem(params: {
  actor: CartActor;
  itemId: string;
}): Promise<CartResponse> {
  return updateCartItemQuantity({
    actor: params.actor,
    itemId: params.itemId,
    quantity: 0,
  });
}

export async function mergeVisitorCartToUser(params: {
  userId: string;
  sessionToken: string | null | undefined;
}): Promise<{
  merged: boolean;
  warnings: MergeWarningNotice[];
  cart: CartResponse;
}> {
  if (!params.sessionToken) {
    const cart = await getCart({ userId: params.userId });
    return { merged: false, warnings: [], cart };
  }

  const sessionToken = params.sessionToken;

  return prisma.$transaction(async (tx) => {
    const visitorCart = await tx.cart.findFirst({
      where: {
        sessionToken,
        convertedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: cartInclude,
    });

    let userCart = await tx.cart.findFirst({
      where: { userId: params.userId, convertedAt: null },
      include: cartInclude,
    });

    if (!visitorCart || visitorCart.items.length === 0) {
      if (visitorCart) {
        await tx.cart.update({
          where: { id: visitorCart.id },
          data: { convertedAt: new Date() },
        });
      }
      const currentCart = userCart
        ? { cartId: userCart.id, ...computeCartState(mapCartItems(userCart.items)) }
        : { cartId: null, ...computeCartState([]) };
      return { merged: false, warnings: [], cart: currentCart };
    }

    if (!userCart) {
      userCart = await tx.cart.create({
        data: { userId: params.userId },
        include: cartInclude,
      });
    }

    const mappedVisitor = mapCartItems(visitorCart.items);
    const plan = planVisitorCartMerge({
      visitorItems: mappedVisitor.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceAtAddCents: item.unitPriceAtAddCents,
        productName: item.variant.product.name,
        variantLabel: item.variant.label,
        isAvailable: isVariantPurchasable(item.variant),
        availableStock: resolveAvailableStock(item.variant),
        currentPriceCents: item.variant.priceCents,
      })),
      userItems: userCart.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceAtAddCents: item.unitPriceAtAddCents,
      })),
    });

    for (const upsert of plan.upserts) {
      await tx.cartItem.upsert({
        where: {
          cartId_variantId: {
            cartId: userCart.id,
            variantId: upsert.variantId,
          },
        },
        update: {
          quantity: upsert.quantity,
          unitPriceAtAddCents: upsert.unitPriceAtAddCents,
        },
        create: {
          cartId: userCart.id,
          variantId: upsert.variantId,
          quantity: upsert.quantity,
          unitPriceAtAddCents: upsert.unitPriceAtAddCents,
        },
      });
    }

    await tx.cart.update({
      where: { id: visitorCart.id },
      data: { convertedAt: new Date() },
    });

    const refreshed = await tx.cart.findUniqueOrThrow({
      where: { id: userCart.id },
      include: cartInclude,
    });

    return {
      merged: true,
      warnings: plan.warnings,
      cart: {
        cartId: refreshed.id,
        ...computeCartState(mapCartItems(refreshed.items)),
      },
    };
  });
}
