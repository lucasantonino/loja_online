import { prisma } from "@/lib/db/prisma";
import {
  BadRequestError,
  getRequestId,
  handleApiError,
  ok,
  UnprocessableEntityError,
} from "@/lib/http/api-response";
import { enforceRateLimit, extractClientIp } from "@/lib/rate-limit";
import { deliveryQuoteInputSchema, quoteDelivery } from "@/modules/delivery/quote";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    await enforceRateLimit({
      bucket: "deliveryQuote",
      identifier: extractClientIp(request),
    });

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BadRequestError("Corpo JSON invalido.", "INVALID_JSON");
    }

    const input = deliveryQuoteInputSchema.parse(rawBody);

    const [storeConfig, activeZones] = await Promise.all([
      prisma.storeConfig.findUnique({
        where: { id: "default" },
        select: {
          primaryCity: true,
          primaryState: true,
          storePickupEnabled: true,
          storePickupAddress: true,
          storePickupInstructions: true,
        },
      }),
      prisma.deliveryZone.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const config = storeConfig ?? {
      primaryCity: null,
      primaryState: null,
      storePickupEnabled: false,
      storePickupAddress: null,
      storePickupInstructions: null,
    };

    const quote = quoteDelivery(input, activeZones, config);

    if (!quote.covered) {
      throw new UnprocessableEntityError(
        "O CEP informado esta fora da nossa area de entrega local.",
        "OUT_OF_COVERAGE_AREA",
        {
          cep: input.cep,
          pickupOption: quote.pickupOption,
          coverageHint: quote.coverageHint,
        },
      );
    }

    return ok(quote, 200, requestId);
  } catch (error) {
    return handleApiError(error, requestId, { route: "/api/delivery/quote" });
  }
}
