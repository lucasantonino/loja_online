import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdpInteractive } from "@/components/store/PdpInteractive";
import { isDatabaseConfigured } from "@/lib/env";
import { getPublicProductBySlug } from "@/modules/catalog/catalog.service";

export const dynamic = "force-dynamic";

async function loadProductSafe(slug: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }
  try {
    return await getPublicProductBySlug(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProductSafe(slug);

  if (!product) {
    return {
      title: "Produto nao encontrado",
    };
  }

  const title = product.seoTitle ?? product.name;
  const description = product.seoDescription ?? product.shortDescription ?? product.description.slice(0, 155);
  const primaryImage = product.images[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(primaryImage ? { images: [{ url: primaryImage }] } : {}),
    },
    twitter: {
      card: primaryImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(primaryImage ? { images: [primaryImage] } : {}),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await loadProductSafe(slug);

  if (!product) {
    notFound();
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const primarySku = product.variants[0]?.sku ?? product.slug;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    sku: primarySku,
    image: product.images.map((img) => img.url),
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/produto/${product.slug}`,
      priceCurrency: "BRL",
      price: (product.basePriceCents / 100).toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd }}
      />
      <PdpInteractive product={product} />
    </>
  );
}
