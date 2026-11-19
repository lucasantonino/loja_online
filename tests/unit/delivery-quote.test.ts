import { describe, expect, it } from "vitest";
import { UnprocessableEntityError } from "@/lib/http/api-response";
import {
  normalizeCep,
  normalizeGeoText,
  quoteDelivery,
  type DeliveryZoneRecord,
  type StoreDeliverySettings,
} from "@/modules/delivery/quote";

const zones: DeliveryZoneRecord[] = [
  {
    id: "zone_cep",
    name: "Centro CEP",
    city: "Sao Paulo",
    state: "SP",
    matchType: "CEP_RANGE",
    cepStart: "01000000",
    cepEnd: "01599999",
    neighborhoods: [],
    feeCents: 1500,
    freeShippingMinCents: 25000,
    estimatedDaysMin: 1,
    estimatedDaysMax: 2,
    estimatedLabel: "1 a 2 dias uteis",
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "zone_bairro",
    name: "Pinheiros / Jardins",
    city: "São Paulo",
    state: "SP",
    matchType: "NEIGHBORHOOD",
    cepStart: null,
    cepEnd: null,
    neighborhoods: ["Pinheiros", "Jardim Paulista"],
    feeCents: 1800,
    freeShippingMinCents: null,
    estimatedDaysMin: 1,
    estimatedDaysMax: 2,
    estimatedLabel: "1 a 2 dias uteis",
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "zone_city",
    name: "Sao Paulo Demais Regioes",
    city: "Sao Paulo",
    state: "SP",
    matchType: "CITY_FLAT",
    cepStart: null,
    cepEnd: null,
    neighborhoods: [],
    feeCents: 2500,
    freeShippingMinCents: 35000,
    estimatedDaysMin: 2,
    estimatedDaysMax: 3,
    estimatedLabel: "2 a 3 dias uteis",
    isActive: true,
    sortOrder: 3,
  },
];

const storeSettings: StoreDeliverySettings = {
  primaryCity: "Sao Paulo",
  primaryState: "SP",
  storePickupEnabled: false,
  storePickupAddress: null,
  storePickupInstructions: null,
};

describe("delivery quote engine (docs/05 §3.4, CA12)", () => {
  it("normaliza CEP e texto geografico removendo acentos", () => {
    expect(normalizeCep("01310-100")).toBe("01310100");
    expect(() => normalizeCep("1234")).toThrow(UnprocessableEntityError);
    expect(normalizeGeoText("  São   Paulo  ")).toBe("sao paulo");
  });

  it("prioriza CEP_RANGE sobre NEIGHBORHOOD e CITY_FLAT", () => {
    const result = quoteDelivery(
      {
        cep: "01310-100",
        neighborhood: "Pinheiros",
        city: "Sao Paulo",
        state: "SP",
        subtotalCents: 10000,
      },
      zones,
      storeSettings,
    );

    expect(result.covered).toBe(true);
    expect(result.matchedZone?.id).toBe("zone_cep");
    expect(result.matchedZone?.feeCents).toBe(1500);
    expect(result.matchedZone?.freeShippingApplied).toBe(false);
  });

  it("aplica frete gratis quando subtotal atinge freeShippingMinCents", () => {
    const result = quoteDelivery(
      {
        cep: "01310100",
        subtotalCents: 25000,
      },
      zones,
      storeSettings,
    );

    expect(result.covered).toBe(true);
    expect(result.matchedZone?.baseFeeCents).toBe(1500);
    expect(result.matchedZone?.feeCents).toBe(0);
    expect(result.matchedZone?.freeShippingApplied).toBe(true);
  });

  it("faz fallback para NEIGHBORHOOD normalizando acentos e caixa", () => {
    const result = quoteDelivery(
      {
        cep: "05422-000",
        neighborhood: "  jardim   PAULISTA ",
        city: "sao paulo",
        state: "sp",
        subtotalCents: 12000,
      },
      zones,
      storeSettings,
    );

    expect(result.covered).toBe(true);
    expect(result.matchedZone?.id).toBe("zone_bairro");
    expect(result.matchedZone?.feeCents).toBe(1800);
  });

  it("retorna covered=false fora da area de cobertura (CA12) e informa retirada quando ativa", () => {
    const withoutPickup = quoteDelivery(
      {
        cep: "20040-002",
        city: "Rio de Janeiro",
        state: "RJ",
        subtotalCents: 12000,
      },
      zones,
      storeSettings,
    );
    expect(withoutPickup.covered).toBe(false);
    expect(withoutPickup.matchedZone).toBeNull();
    expect(withoutPickup.pickupOption).toBeNull();

    const withPickup = quoteDelivery(
      {
        cep: "20040-002",
        city: "Rio de Janeiro",
        state: "RJ",
        subtotalCents: 12000,
      },
      zones,
      {
        ...storeSettings,
        storePickupEnabled: true,
        storePickupAddress: "Rua Augusta, 1000",
        storePickupInstructions: "Retirar apos confirmacao",
      },
    );
    expect(withPickup.covered).toBe(false);
    expect(withPickup.pickupOption).toEqual({
      enabled: true,
      address: "Rua Augusta, 1000",
      instructions: "Retirar apos confirmacao",
      feeCents: 0,
    });
  });
});
