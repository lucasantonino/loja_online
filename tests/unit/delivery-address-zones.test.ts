import { describe, expect, it } from "vitest";
import { createAddressSchema } from "@/modules/delivery/address.schemas";
import { createDeliveryZoneSchema } from "@/modules/delivery/zone.schemas";

describe("address & delivery zone schemas (T10)", () => {
  it("normaliza CEP, telefone e UF no cadastro de endereco", () => {
    const parsed = createAddressSchema.safeParse({
      label: "Casa",
      recipientName: "Ana Paula",
      phone: "(11) 99876-5432",
      cep: "01310-100",
      street: "Av. Paulista",
      number: "1000",
      neighborhood: "Bela Vista",
      city: "Sao Paulo",
      state: "sp",
      isDefault: true,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cep).toBe("01310100");
      expect(parsed.data.phone).toBe("11998765432");
      expect(parsed.data.state).toBe("SP");
    }

    expect(
      createAddressSchema.safeParse({
        recipientName: "Ana",
        phone: "123",
        cep: "0131",
        street: "Rua A",
        number: "1",
        neighborhood: "Centro",
        city: "SP",
        state: "SP",
      }).success,
    ).toBe(false);
  });

  it("valida regras especificas de DeliveryZone (CEP_RANGE, NEIGHBORHOOD e prazos)", () => {
    // CEP_RANGE sem faixa completa deve falhar
    expect(
      createDeliveryZoneSchema.safeParse({
        name: "Centro",
        city: "Sao Paulo",
        state: "SP",
        matchType: "CEP_RANGE",
        cepStart: "01000000",
        feeCents: 1500,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        estimatedLabel: "1 a 2 dias uteis",
      }).success,
    ).toBe(false);

    // CEP_RANGE com cepStart > cepEnd deve falhar
    expect(
      createDeliveryZoneSchema.safeParse({
        name: "Centro",
        city: "Sao Paulo",
        state: "SP",
        matchType: "CEP_RANGE",
        cepStart: "02000000",
        cepEnd: "01000000",
        feeCents: 1500,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        estimatedLabel: "1 a 2 dias uteis",
      }).success,
    ).toBe(false);

    // NEIGHBORHOOD sem bairros deve falhar
    expect(
      createDeliveryZoneSchema.safeParse({
        name: "Pinheiros",
        city: "Sao Paulo",
        state: "SP",
        matchType: "NEIGHBORHOOD",
        neighborhoods: [],
        feeCents: 1800,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        estimatedLabel: "1 a 2 dias uteis",
      }).success,
    ).toBe(false);

    // CITY_FLAT valido
    expect(
      createDeliveryZoneSchema.safeParse({
        name: "Capital Geral",
        city: "Sao Paulo",
        state: "sp",
        matchType: "CITY_FLAT",
        feeCents: 2500,
        freeShippingMinCents: 30000,
        estimatedDaysMin: 2,
        estimatedDaysMax: 3,
        estimatedLabel: "2 a 3 dias uteis",
      }).success,
    ).toBe(true);
  });
});
