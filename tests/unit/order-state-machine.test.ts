import { describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/http/api-response";
import {
  assertValidOrderTransition,
  canTransitionDeliveryStatus,
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  canTransitionReservationStatus,
} from "@/modules/orders/state-machine";

describe("state machines (docs/05 §1)", () => {
  it("permite fluxo completo de entrega local", () => {
    expect(
      canTransitionOrderStatus({
        fromStatus: "AWAITING_PAYMENT",
        toStatus: "PAID",
        deliveryMethod: "LOCAL_DELIVERY",
      }),
    ).toBe(true);

    expect(
      canTransitionOrderStatus({
        fromStatus: "PAID",
        toStatus: "PREPARING",
        deliveryMethod: "LOCAL_DELIVERY",
      }),
    ).toBe(true);

    expect(
      canTransitionOrderStatus({
        fromStatus: "PREPARING",
        toStatus: "OUT_FOR_DELIVERY",
        deliveryMethod: "LOCAL_DELIVERY",
      }),
    ).toBe(true);

    expect(
      canTransitionOrderStatus({
        fromStatus: "OUT_FOR_DELIVERY",
        toStatus: "DELIVERED",
        deliveryMethod: "LOCAL_DELIVERY",
      }),
    ).toBe(true);
  });

  it("bloqueia OUT_FOR_DELIVERY para STORE_PICKUP e READY_FOR_PICKUP para LOCAL_DELIVERY", () => {
    expect(
      canTransitionOrderStatus({
        fromStatus: "PREPARING",
        toStatus: "OUT_FOR_DELIVERY",
        deliveryMethod: "STORE_PICKUP",
      }),
    ).toBe(false);

    expect(
      canTransitionOrderStatus({
        fromStatus: "PREPARING",
        toStatus: "READY_FOR_PICKUP",
        deliveryMethod: "LOCAL_DELIVERY",
      }),
    ).toBe(false);

    expect(
      canTransitionOrderStatus({
        fromStatus: "PREPARING",
        toStatus: "READY_FOR_PICKUP",
        deliveryMethod: "STORE_PICKUP",
      }),
    ).toBe(true);
  });

  it("restringe AWAITING_PAYMENT -> PREPARING apenas a PAY_ON_DELIVERY ativo", () => {
    expect(
      canTransitionOrderStatus({
        fromStatus: "AWAITING_PAYMENT",
        toStatus: "PREPARING",
        deliveryMethod: "LOCAL_DELIVERY",
        paymentMethod: "PIX",
        payOnDeliveryEnabled: true,
      }),
    ).toBe(false);

    expect(
      canTransitionOrderStatus({
        fromStatus: "AWAITING_PAYMENT",
        toStatus: "PREPARING",
        deliveryMethod: "LOCAL_DELIVERY",
        paymentMethod: "PAY_ON_DELIVERY",
        payOnDeliveryEnabled: false,
      }),
    ).toBe(false);

    expect(
      canTransitionOrderStatus({
        fromStatus: "AWAITING_PAYMENT",
        toStatus: "PREPARING",
        deliveryMethod: "LOCAL_DELIVERY",
        paymentMethod: "PAY_ON_DELIVERY",
        payOnDeliveryEnabled: true,
      }),
    ).toBe(true);
  });

  it("lanca ConflictError em transicao invalida de pedido", () => {
    expect(() =>
      assertValidOrderTransition({
        fromStatus: "EXPIRED",
        toStatus: "PAID",
        deliveryMethod: "LOCAL_DELIVERY",
      }),
    ).toThrow(ConflictError);
  });

  it("valida maquinas de pagamento, entrega e reserva de estoque", () => {
    expect(canTransitionPaymentStatus("PENDING", "PAID")).toBe(true);
    expect(canTransitionPaymentStatus("PAID", "REFUNDED")).toBe(true);
    expect(canTransitionPaymentStatus("FAILED", "PAID")).toBe(false);

    expect(canTransitionDeliveryStatus("OUT_FOR_DELIVERY", "FAILED_ATTEMPT")).toBe(true);
    expect(canTransitionDeliveryStatus("FAILED_ATTEMPT", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransitionDeliveryStatus("DELIVERED", "CANCELLED")).toBe(false);

    expect(canTransitionReservationStatus("ACTIVE", "CONFIRMED")).toBe(true);
    expect(canTransitionReservationStatus("ACTIVE", "EXPIRED")).toBe(true);
    expect(canTransitionReservationStatus("EXPIRED", "CONFIRMED")).toBe(false);
    expect(canTransitionReservationStatus("RELEASED", "CONFIRMED")).toBe(false);
  });
});
