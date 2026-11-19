import { revalidatePath, revalidateTag } from "next/cache";
import { Prisma, ProductStatus } from "@prisma/client";
import { deleteCloudinaryAsset, signProductImageUpload } from "@/lib/cloudinary";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, UnprocessableEntityError } from "@/lib/http/api-response";
import { recordAuditLog } from "@/modules/admin/audit";
import type {
  CreateCategoryInput,
  ListProductsQuery,
  SignMediaUploadInput,
  UpdateCategoryInput,
  UpdateProductInput,
} from "@/modules/catalog/schemas";
import type { ActorContext } from "@/modules/inventory/inventory.service";
import {
  buildOptionCombinationKey,
  DEFAULT_OPTION_COMBINATION_KEY,
  DEFAULT_VARIANT_LABEL,
  slugify,
} from "@/modules/variants/combination-key";
import { resolveAvailableStock } from "@/modules/variants/matrix";
import type { CreateProductInput } from "@/modules/variants/schemas";

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  activeProductCount: number;
  children: CategoryTreeNode[];
}

export async function listActiveCategories(options?: {
  includeEmpty?: boolean;
}): Promise<CategoryTreeNode[]> {
  const includeEmpty = options?.includeEmpty ?? false;

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          products: {
            where: {
              status: "ACTIVE",
              deletedAt: null,
            },
          },
        },
      },
    },
  });

  const nodesById = new Map<string, CategoryTreeNode>();
  for (const cat of categories) {
    nodesById.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      parentId: cat.parentId,
      sortOrder: cat.sortOrder,
      activeProductCount: cat._count.products,
      children: [],
    });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of nodesById.values()) {
    if (node.parentId && nodesById.has(node.parentId)) {
      nodesById.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  if (includeEmpty) {
    return roots;
  }

  const filterNonEmpty = (nodes: CategoryTreeNode[]): CategoryTreeNode[] =>
    nodes
      .map((node) => ({
        ...node,
        children: filterNonEmpty(node.children),
      }))
      .filter((node) => node.activeProductCount > 0 || node.children.length > 0);

  return filterNonEmpty(roots);
}

export interface PublicProductListItem {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  basePriceCents: number;
  compareAtPriceCents: number | null;
  hasVariants: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  primaryImage: {
    url: string;
    altText: string;
  } | null;
  secondaryImage: {
    url: string;
    altText: string;
  } | null;
  inStock: boolean;
  totalAvailableStock: number;
  colorSwatches: Array<{
    value: string;
    slug: string;
    colorHex: string;
  }>;
}

export async function listPublicProducts(query: ListProductsQuery) {
  const andConditions: Prisma.ProductWhereInput[] = [
    { status: "ACTIVE" },
    { deletedAt: null },
    { category: { isActive: true } },
  ];

  if (query.q) {
    andConditions.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        {
          variants: {
            some: {
              sku: { contains: query.q, mode: "insensitive" },
              isActive: true,
              deletedAt: null,
            },
          },
        },
      ],
    });
  }

  if (query.category) {
    andConditions.push({
      category: {
        isActive: true,
        OR: [{ slug: query.category }, { parent: { slug: query.category } }],
      },
    });
  }

  if (query.minPriceCents !== undefined) {
    andConditions.push({ basePriceCents: { gte: query.minPriceCents } });
  }

  if (query.maxPriceCents !== undefined) {
    andConditions.push({ basePriceCents: { lte: query.maxPriceCents } });
  }

  if (query.color && query.color.length > 0) {
    andConditions.push({
      variants: {
        some: {
          isActive: true,
          deletedAt: null,
          optionValues: {
            some: {
              optionValue: {
                slug: { in: query.color },
                option: { slug: "cor" },
              },
            },
          },
        },
      },
    });
  }

  if (query.size && query.size.length > 0) {
    andConditions.push({
      variants: {
        some: {
          isActive: true,
          deletedAt: null,
          optionValues: {
            some: {
              optionValue: {
                slug: { in: query.size },
                option: { slug: "tamanho" },
              },
            },
          },
        },
      },
    });
  }

  if (query.inStockOnly) {
    const inStockProducts = await prisma.$queryRaw<Array<{ productId: string }>>`
      SELECT DISTINCT "productId"
      FROM "ProductVariant"
      WHERE "isActive" = true
        AND "deletedAt" IS NULL
        AND ("stockOnHand" - "stockReserved") > 0
    `;
    andConditions.push({
      id: { in: inStockProducts.map((row) => row.productId) },
    });
  }

  const where: Prisma.ProductWhereInput = { AND: andConditions };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    query.sort === "price_asc"
      ? { basePriceCents: "asc" }
      : query.sort === "price_desc"
        ? { basePriceCents: "desc" }
        : { createdAt: "desc" };

  const skip = (query.page - 1) * query.pageSize;

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 2,
          select: { url: true, altText: true },
        },
        variants: {
          where: { isActive: true, deletedAt: null },
          select: {
            stockOnHand: true,
            stockReserved: true,
          },
        },
        options: {
          where: { slug: "cor" },
          include: {
            values: {
              orderBy: { sortOrder: "asc" },
              select: { value: true, slug: true, colorHex: true },
            },
          },
        },
      },
    }),
  ]);

  const items: PublicProductListItem[] = products.map((product) => {
    const totalAvailableStock = product.variants.reduce(
      (sum, variant) => sum + resolveAvailableStock(variant),
      0,
    );

    const colorOption = product.options[0];
    const colorSwatches = (colorOption?.values ?? [])
      .filter((val): val is { value: string; slug: string; colorHex: string } =>
        Boolean(val.colorHex),
      )
      .slice(0, 5);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.shortDescription,
      basePriceCents: product.basePriceCents,
      compareAtPriceCents: product.compareAtPriceCents,
      hasVariants: product.hasVariants,
      category: product.category,
      primaryImage: product.images[0] ?? null,
      secondaryImage: product.images[1] ?? null,
      inStock: totalAvailableStock > 0,
      totalAvailableStock,
      colorSwatches,
    };
  });

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getPublicProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      deletedAt: null,
      category: { isActive: true },
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          optionValueId: true,
          cloudinaryPublicId: true,
          url: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
        },
      },
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          values: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              value: true,
              slug: true,
              colorHex: true,
              sortOrder: true,
            },
          },
        },
      },
      variants: {
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          optionValues: {
            select: { optionValueId: true },
          },
        },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Produto nao encontrado ou indisponivel.", "PRODUCT_NOT_FOUND");
  }

  const variants = product.variants.map((variant) => {
    const availableStock = resolveAvailableStock(variant);
    return {
      id: variant.id,
      sku: variant.sku,
      isDefault: variant.isDefault,
      optionCombinationKey: variant.optionCombinationKey,
      label: variant.label,
      priceCents: variant.priceCents,
      compareAtPriceCents: variant.compareAtPriceCents,
      availableStock,
      inStock: availableStock > 0,
      optionValueIds: variant.optionValues.map((link) => link.optionValueId),
    };
  });

  const totalAvailableStock = variants.reduce((sum, v) => sum + v.availableStock, 0);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    shortDescription: product.shortDescription,
    basePriceCents: product.basePriceCents,
    compareAtPriceCents: product.compareAtPriceCents,
    hasVariants: product.hasVariants,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    sizeGuideMarkdown: product.sizeGuideMarkdown,
    category: product.category,
    images: product.images,
    options: product.options,
    variants,
    inStock: totalAvailableStock > 0,
    totalAvailableStock,
  };
}

export async function createProduct(input: CreateProductInput, actor: ActorContext) {
  const productSlug = input.slug ?? slugify(input.name);
  if (!productSlug) {
    throw new UnprocessableEntityError(
      "Nao foi possivel gerar um slug valido para o produto.",
      "INVALID_PRODUCT_SLUG",
    );
  }

  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: input.categoryId },
      select: { id: true, name: true },
    });

    if (!category) {
      throw new NotFoundError("Categoria informada nao existe.", "CATEGORY_NOT_FOUND");
    }

    const product = await tx.product.create({
      data: {
        name: input.name,
        slug: productSlug,
        description: input.description,
        shortDescription: input.shortDescription ?? null,
        categoryId: input.categoryId,
        basePriceCents: input.basePriceCents,
        compareAtPriceCents: input.compareAtPriceCents ?? null,
        hasVariants: input.hasVariants,
        status: input.status,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        sizeGuideMarkdown: input.sizeGuideMarkdown ?? null,
      },
    });

    if (!input.hasVariants) {
      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          sku: input.defaultVariant.sku,
          isDefault: true,
          optionCombinationKey: DEFAULT_OPTION_COMBINATION_KEY,
          label: DEFAULT_VARIANT_LABEL,
          priceCents: input.defaultVariant.priceCents ?? input.basePriceCents,
          compareAtPriceCents:
            input.defaultVariant.compareAtPriceCents ?? input.compareAtPriceCents ?? null,
          stockOnHand: input.defaultVariant.initialStock,
          stockReserved: 0,
          isActive: true,
        },
      });

      if (input.defaultVariant.initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            actorUserId: actor.actorUserId ?? null,
            type: "INITIAL",
            quantityDelta: input.defaultVariant.initialStock,
            reservedDelta: 0,
            stockOnHandAfter: variant.stockOnHand,
            stockReservedAfter: 0,
            reason: "Estoque inicial do produto simples",
          },
        });
      }
    } else {
      const scopedLookup = new Map<string, { id: string; value: string; optionSlug: string }>();
      const bareLookup = new Map<string, Array<{ id: string; value: string; optionSlug: string }>>();

      for (const optInput of input.options) {
        const optionSlug = optInput.slug ?? slugify(optInput.name);
        const createdOption = await tx.productOption.create({
          data: {
            productId: product.id,
            name: optInput.name,
            slug: optionSlug,
            isRequired: optInput.isRequired,
            sortOrder: optInput.sortOrder,
          },
        });

        for (const valInput of optInput.values) {
          const valSlug = valInput.slug ?? slugify(valInput.value);
          const createdVal = await tx.productOptionValue.create({
            data: {
              optionId: createdOption.id,
              value: valInput.value,
              slug: valSlug,
              colorHex: valInput.colorHex ?? null,
              sortOrder: valInput.sortOrder,
            },
          });

          const entry = {
            id: createdVal.id,
            value: createdVal.value,
            optionSlug,
          };
          scopedLookup.set(`${optionSlug}:${valSlug}`, entry);
          const list = bareLookup.get(valSlug) ?? [];
          list.push(entry);
          bareLookup.set(valSlug, list);
        }
      }

      for (const variantInput of input.variants) {
        const resolvedValues = variantInput.optionValueSlugs.map((rawRef) => {
          const ref = rawRef.trim().toLowerCase();
          const scoped = scopedLookup.get(ref);
          if (scoped) {
            return scoped;
          }
          const bareMatches = bareLookup.get(ref);
          if (!bareMatches || bareMatches.length !== 1) {
            throw new UnprocessableEntityError(
              `Referencia de valor de opcao invalida ou ambigua: "${rawRef}".`,
              "INVALID_OPTION_VALUE_REFERENCE",
            );
          }
          return bareMatches[0] as { id: string; value: string; optionSlug: string };
        });

        const optionCombinationKey = buildOptionCombinationKey(
          resolvedValues.map((val) => val.id),
        );

        const createdVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: variantInput.sku,
            isDefault: false,
            optionCombinationKey,
            label: variantInput.label ?? resolvedValues.map((v) => v.value).join(" · "),
            priceCents: variantInput.priceCents,
            compareAtPriceCents: variantInput.compareAtPriceCents ?? null,
            stockOnHand: variantInput.initialStock,
            stockReserved: 0,
            isActive: variantInput.isActive,
          },
        });

        await tx.productVariantOptionValue.createMany({
          data: resolvedValues.map((val) => ({
            variantId: createdVariant.id,
            optionValueId: val.id,
          })),
        });

        if (variantInput.initialStock > 0) {
          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              variantId: createdVariant.id,
              actorUserId: actor.actorUserId ?? null,
              type: "INITIAL",
              quantityDelta: variantInput.initialStock,
              reservedDelta: 0,
              stockOnHandAfter: createdVariant.stockOnHand,
              stockReservedAfter: 0,
              reason: `Estoque inicial da variante ${createdVariant.sku}`,
            },
          });
        }
      }
    }

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product.id,
      afterState: {
        name: product.name,
        slug: product.slug,
        hasVariants: product.hasVariants,
        status: product.status,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: {
        options: { include: { values: true } },
        variants: { include: { optionValues: true } },
      },
    });
  });
}

export async function archiveOrDeleteProduct(productId: string, actor: ActorContext) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        _count: {
          select: {
            orderItems: true,
            inventoryMovements: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError("Produto nao encontrado.", "PRODUCT_NOT_FOUND");
    }

    const mustArchive =
      product._count.orderItems > 0 || product._count.inventoryMovements > 0;

    if (mustArchive) {
      const now = new Date();
      await tx.product.update({
        where: { id: product.id },
        data: {
          status: "ARCHIVED",
          deletedAt: product.deletedAt ?? now,
        },
      });

      await tx.productVariant.updateMany({
        where: { productId: product.id },
        data: {
          isActive: false,
          deletedAt: now,
        },
      });

      await recordAuditLog(tx, {
        actorUserId: actor.actorUserId ?? null,
        action: "PRODUCT_ARCHIVED",
        entityType: "Product",
        entityId: product.id,
        beforeState: { status: product.status, deletedAt: product.deletedAt },
        afterState: { status: "ARCHIVED", deletedAt: now.toISOString() },
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });

      return { outcome: "ARCHIVED" as const, productId: product.id };
    }

    const images = await tx.productImage.findMany({
      where: { productId: product.id },
      select: { cloudinaryPublicId: true },
    });

    await tx.product.delete({
      where: { id: product.id },
    });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "PRODUCT_DELETED",
      entityType: "Product",
      entityId: product.id,
      beforeState: { name: product.name, slug: product.slug },
      afterState: null,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    for (const img of images) {
      void deleteCloudinaryAsset(img.cloudinaryPublicId);
    }

    return { outcome: "DELETED" as const, productId: product.id };
  });
}

export function revalidateCatalogCache(slug?: string): void {
  try {
    revalidateTag("products");
    revalidateTag("categories");
    revalidatePath("/");
    revalidatePath("/produtos");
    if (slug) {
      revalidateTag(`product:${slug}`);
      revalidatePath(`/produto/${slug}`);
    }
  } catch {
    // Em testes unitarios/integracao fora do runtime Next.js, ignorar silenciosamente
  }
}

export async function listAdminCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}

export async function createCategory(input: CreateCategoryInput, actor: ActorContext) {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) {
    throw new UnprocessableEntityError("Slug de categoria invalido.", "INVALID_CATEGORY_SLUG");
  }

  return prisma.$transaction(async (tx) => {
    if (input.parentId) {
      const parent = await tx.category.findUnique({
        where: { id: input.parentId },
        select: { id: true },
      });
      if (!parent) {
        throw new NotFoundError("Categoria pai nao encontrada.", "PARENT_CATEGORY_NOT_FOUND");
      }
    }

    const created = await tx.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "CATEGORY_CREATED",
      entityType: "Category",
      entityId: created.id,
      afterState: { name: created.name, slug: created.slug, isActive: created.isActive },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return created;
  });
}

export async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput,
  actor: ActorContext,
) {
  if (input.parentId && input.parentId === categoryId) {
    throw new UnprocessableEntityError(
      "Uma categoria nao pode ser pai de si mesma.",
      "CIRCULAR_CATEGORY_PARENT",
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.category.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      throw new NotFoundError("Categoria nao encontrada.", "CATEGORY_NOT_FOUND");
    }

    const updated = await tx.category.update({
      where: { id: categoryId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: updated.id,
      beforeState: {
        name: existing.name,
        slug: existing.slug,
        isActive: existing.isActive,
        sortOrder: existing.sortOrder,
      },
      afterState: {
        name: updated.name,
        slug: updated.slug,
        isActive: updated.isActive,
        sortOrder: updated.sortOrder,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  });
}

export async function deleteCategory(categoryId: string, actor: ActorContext) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: { select: { products: true, children: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError("Categoria nao encontrada.", "CATEGORY_NOT_FOUND");
    }

    if (existing._count.products > 0 || existing._count.children > 0) {
      throw new ConflictError(
        "Nao e possivel remover categoria com produtos ou subcategorias vinculadas.",
        "CATEGORY_IN_USE",
        {
          productsCount: existing._count.products,
          childrenCount: existing._count.children,
        },
      );
    }

    await tx.category.delete({ where: { id: categoryId } });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "CATEGORY_DELETED",
      entityType: "Category",
      entityId: categoryId,
      beforeState: { name: existing.name, slug: existing.slug },
      afterState: null,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { deleted: true, id: categoryId };
  });
}

export async function listAdminProducts(params?: {
  q?: string;
  status?: ProductStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params?.pageSize ?? 20));
  const where: Prisma.ProductWhereInput = {};

  if (params?.status) {
    where.status = params.status;
  }
  if (params?.q?.trim()) {
    const term = params.q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
      { variants: { some: { sku: { contains: term, mode: "insensitive" } } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: { url: true, altText: true },
        },
        variants: {
          where: { deletedAt: null },
          select: {
            id: true,
            sku: true,
            priceCents: true,
            stockOnHand: true,
            stockReserved: true,
            isActive: true,
          },
        },
      },
    }),
  ]);

  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getAdminProductById(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      options: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        include: { optionValues: true },
      },
    },
  });

  if (!product) {
    throw new NotFoundError("Produto nao encontrado.", "PRODUCT_NOT_FOUND");
  }

  return product;
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
  actor: ActorContext,
) {
  const removedPublicIds: string[] = [];

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id: productId },
      include: {
        images: { select: { id: true, cloudinaryPublicId: true } },
        variants: { select: { id: true, sku: true, priceCents: true, isActive: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError("Produto nao encontrado.", "PRODUCT_NOT_FOUND");
    }

    if (input.images !== undefined) {
      const storeConfig = await tx.storeConfig.findUnique({
        where: { id: "default" },
        select: { maxImagesPerProduct: true },
      });
      const maxImages = storeConfig?.maxImagesPerProduct ?? 8;

      if (input.images.length > maxImages) {
        throw new UnprocessableEntityError(
          `Maximo de ${maxImages} imagens permitido por produto.`,
          "MAX_IMAGES_EXCEEDED",
          { maxImages, received: input.images.length },
        );
      }

      const incomingIds = new Set(input.images.map((img) => img.cloudinaryPublicId));
      for (const prevImg of existing.images) {
        if (!incomingIds.has(prevImg.cloudinaryPublicId)) {
          removedPublicIds.push(prevImg.cloudinaryPublicId);
        }
      }

      await tx.productImage.deleteMany({ where: { productId } });
      if (input.images.length > 0) {
        const hasPrimary = input.images.some((img) => img.isPrimary);
        await tx.productImage.createMany({
          data: input.images.map((img, index) => ({
            productId,
            optionValueId: img.optionValueId ?? null,
            cloudinaryPublicId: img.cloudinaryPublicId,
            url: img.url,
            altText: img.altText,
            sortOrder: img.sortOrder ?? index,
            isPrimary: hasPrimary ? img.isPrimary : index === 0,
          })),
        });
      }
    }

    if (input.variantUpdates && input.variantUpdates.length > 0) {
      const variantIds = new Set(existing.variants.map((v) => v.id));
      for (const vUpdate of input.variantUpdates) {
        if (!variantIds.has(vUpdate.id)) {
          throw new NotFoundError(
            `Variante ${vUpdate.id} nao pertence a este produto.`,
            "VARIANT_NOT_FOUND",
          );
        }
        await tx.productVariant.update({
          where: { id: vUpdate.id },
          data: {
            ...(vUpdate.sku !== undefined ? { sku: vUpdate.sku } : {}),
            ...(vUpdate.label !== undefined ? { label: vUpdate.label } : {}),
            ...(vUpdate.priceCents !== undefined ? { priceCents: vUpdate.priceCents } : {}),
            ...(vUpdate.compareAtPriceCents !== undefined
              ? { compareAtPriceCents: vUpdate.compareAtPriceCents }
              : {}),
            ...(vUpdate.isActive !== undefined ? { isActive: vUpdate.isActive } : {}),
          },
        });
      }
    }

    const result = await tx.product.update({
      where: { id: productId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.shortDescription !== undefined
          ? { shortDescription: input.shortDescription }
          : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.basePriceCents !== undefined ? { basePriceCents: input.basePriceCents } : {}),
        ...(input.compareAtPriceCents !== undefined
          ? { compareAtPriceCents: input.compareAtPriceCents }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
        ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
        ...(input.sizeGuideMarkdown !== undefined
          ? { sizeGuideMarkdown: input.sizeGuideMarkdown }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        options: { include: { values: { orderBy: { sortOrder: "asc" } } } },
        variants: { orderBy: { createdAt: "asc" } },
      },
    });

    await recordAuditLog(tx, {
      actorUserId: actor.actorUserId ?? null,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: productId,
      beforeState: {
        name: existing.name,
        slug: existing.slug,
        basePriceCents: existing.basePriceCents,
        status: existing.status,
      },
      afterState: {
        name: result.name,
        slug: result.slug,
        basePriceCents: result.basePriceCents,
        status: result.status,
      },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return result;
  });

  for (const publicId of removedPublicIds) {
    void deleteCloudinaryAsset(publicId);
  }

  return updated;
}

export async function prepareProductMediaUpload(input: SignMediaUploadInput) {
  const [product, storeConfig] = await Promise.all([
    prisma.product.findUnique({
      where: { id: input.productId },
      include: { _count: { select: { images: true } } },
    }),
    prisma.storeConfig.findUnique({
      where: { id: "default" },
      select: { maxImagesPerProduct: true },
    }),
  ]);

  if (!product) {
    throw new NotFoundError("Produto nao encontrado.", "PRODUCT_NOT_FOUND");
  }

  const maxImages = storeConfig?.maxImagesPerProduct ?? 8;
  if (product._count.images >= maxImages) {
    throw new UnprocessableEntityError(
      `Este produto ja atingiu o limite de ${maxImages} imagens.`,
      "MAX_IMAGES_REACHED",
      { maxImages, currentCount: product._count.images },
    );
  }

  return signProductImageUpload(input);
}

export async function listPublicFilterFacets(categorySlug?: string) {
  const optionValues = await prisma.productOptionValue.findMany({
    where: {
      option: {
        slug: { in: ["cor", "tamanho"] },
        product: {
          status: "ACTIVE",
          deletedAt: null,
          ...(categorySlug
            ? {
                category: {
                  isActive: true,
                  OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }],
                },
              }
            : { category: { isActive: true } }),
        },
      },
    },
    select: {
      value: true,
      slug: true,
      colorHex: true,
      option: { select: { slug: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const colorsMap = new Map<string, { value: string; slug: string; colorHex: string | null }>();
  const sizesMap = new Map<string, { value: string; slug: string }>();

  for (const item of optionValues) {
    if (item.option.slug === "cor" && !colorsMap.has(item.slug)) {
      colorsMap.set(item.slug, {
        value: item.value,
        slug: item.slug,
        colorHex: item.colorHex,
      });
    } else if (item.option.slug === "tamanho" && !sizesMap.has(item.slug)) {
      sizesMap.set(item.slug, {
        value: item.value,
        slug: item.slug,
      });
    }
  }

  return {
    colors: [...colorsMap.values()],
    sizes: [...sizesMap.values()],
  };
}

export async function getStorePolicyBySlug(slug: string) {
  return prisma.storePolicy.findUnique({
    where: { slug },
  });
}

export async function listPublicPolicies() {
  return prisma.storePolicy.findMany({
    orderBy: { title: "asc" },
  });
}
