import type { DeliveryMatchType } from "@prisma/client";
import { z } from "zod";
import { UnprocessableEntityError } from "@/lib/http/api-response";

export const deliveryQuoteInputSchema = z.object({
  cep: z.string().trim().min(8, "CEP deve conter 8 digitos.").max(9),
  neighborhood: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(2).optional(),
  subtotalCents: z.number().int().nonnegative().default(0),
});

export type DeliveryQuoteInput = z.infer<typeof deliveryQuoteInputSchema>;

export interface DeliveryZoneRecord {
  id: string;
  name: string;
  city: string;
  state: string;
  matchType: DeliveryMatchType;
  cepStart: string | null;
  cepEnd: string | null;
  neighborhoods: string[];
  feeCents: number;
  freeShippingMinCents: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  estimatedLabel: string;
  isActive: boolean;
  sortOrder: number;
}

export interface StoreDeliverySettings {
  primaryCity: string | null;
  primaryState: string | null;
  storePickupEnabled: boolean;
  storePickupAddress: string | null;
  storePickupInstructions: string | null;
}

export interface PickupOptionResult {
  enabled: true;
  address: string | null;
  instructions: string | null;
  feeCents: 0;
}

export interface DeliveryQuoteResult {
  covered: boolean;
  matchedZone: {
    id: string;
    name: string;
    matchType: DeliveryMatchType;
    city: string;
    state: string;
    baseFeeCents: number;
    feeCents: number;
    freeShippingApplied: boolean;
    freeShippingMinCents: number | null;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    estimatedLabel: string;
  } | null;
  pickupOption: PickupOptionResult | null;
  coverageHint: {
    primaryCity: string | null;
    primaryState: string | null;
  };
}

export function normalizeCep(rawCep: string): string {
  const digits = rawCep.replace(/\D/g, "");
  if (digits.length !== 8) {
    throw new UnprocessableEntityError(
      "CEP invalido. Informe exatamente 8 digitos numericos.",
      "INVALID_CEP",
      { cep: rawCep },
    );
  }
  return digits;
}

export function normalizeGeoText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function matchesCityState(
  zone: DeliveryZoneRecord,
  normalizedCity?: string,
  normalizedState?: string,
): boolean {
  if (normalizedState && normalizeGeoText(zone.state) !== normalizedState) {
    return false;
  }
  if (normalizedCity && normalizeGeoText(zone.city) !== normalizedCity) {
    return false;
  }
  return true;
}

function findMatchingZone(
  cep: string,
  neighborhood: string | undefined,
  city: string | undefined,
  state: string | undefined,
  activeZones: ReadonlyArray<DeliveryZoneRecord>,
): DeliveryZoneRecord | null {
  const sortedZones = [...activeZones]
    .filter((zone) => zone.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const normNeighborhood = neighborhood ? normalizeGeoText(neighborhood) : undefined;
  const normCity = city ? normalizeGeoText(city) : undefined;
  const normState = state ? normalizeGeoText(state) : undefined;

  // 1. Precedencia maxima: faixa de CEP (CEP_RANGE)
  for (const zone of sortedZones) {
    if (zone.matchType !== "CEP_RANGE" || !zone.cepStart || !zone.cepEnd) {
      continue;
    }
    const start = zone.cepStart.replace(/\D/g, "");
    const end = zone.cepEnd.replace(/\D/g, "");
    if (start.length === 8 && end.length === 8 && cep >= start && cep <= end) {
      return zone;
    }
  }

  // 2. Segunda precedencia: bairro normalizado (NEIGHBORHOOD)
  if (normNeighborhood) {
    for (const zone of sortedZones) {
      if (zone.matchType !== "NEIGHBORHOOD") {
        continue;
      }
      if (!matchesCityState(zone, normCity, normState)) {
        continue;
      }
      const hasNeighborhood = zone.neighborhoods.some(
        (item) => normalizeGeoText(item) === normNeighborhood,
      );
      if (hasNeighborhood) {
        return zone;
      }
    }
  }

  // 3. Terceira precedencia: taxa unica municipal (CITY_FLAT)
  if (normCity) {
    for (const zone of sortedZones) {
      if (zone.matchType !== "CITY_FLAT") {
        continue;
      }
      if (matchesCityState(zone, normCity, normState)) {
        return zone;
      }
    }
  }

  return null;
}

export function quoteDelivery(
  input: DeliveryQuoteInput,
  zones: ReadonlyArray<DeliveryZoneRecord>,
  storeConfig: StoreDeliverySettings,
): DeliveryQuoteResult {
  const cep = normalizeCep(input.cep);
  const matched = findMatchingZone(
    cep,
    input.neighborhood,
    input.city,
    input.state,
    zones,
  );

  const pickupOption: PickupOptionResult | null = storeConfig.storePickupEnabled
    ? {
        enabled: true,
        address: storeConfig.storePickupAddress,
        instructions: storeConfig.storePickupInstructions,
        feeCents: 0,
      }
    : null;

  if (!matched) {
    return {
      covered: false,
      matchedZone: null,
      pickupOption,
      coverageHint: {
        primaryCity: storeConfig.primaryCity,
        primaryState: storeConfig.primaryState,
      },
    };
  }

  const freeShippingApplied =
    matched.freeShippingMinCents !== null &&
    input.subtotalCents >= matched.freeShippingMinCents;

  return {
    covered: true,
    matchedZone: {
      id: matched.id,
      name: matched.name,
      matchType: matched.matchType,
      city: matched.city,
      state: matched.state,
      baseFeeCents: matched.feeCents,
      feeCents: freeShippingApplied ? 0 : matched.feeCents,
      freeShippingApplied,
      freeShippingMinCents: matched.freeShippingMinCents,
      estimatedDaysMin: matched.estimatedDaysMin,
      estimatedDaysMax: matched.estimatedDaysMax,
      estimatedLabel: matched.estimatedLabel,
    },
    pickupOption,
    coverageHint: {
      primaryCity: storeConfig.primaryCity,
      primaryState: storeConfig.primaryState,
    },
  };
}
