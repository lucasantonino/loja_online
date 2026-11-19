import type {
  DeliveryMethod,
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  StockReservationStatus,
} from "@prisma/client";
import { ConflictError } from "@/lib/http/api-response";

export const ORDER_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  AWAITING_PAYMENT: ["PAID", "EXPIRED", "CANCELLED", "PREPARING"],
  PAID: ["PREPARING", "REFUNDED"],
  PREPARING: ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  READY_FOR_PICKUP: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, ReadonlyArray<PaymentStatus>> = {
  PENDING: ["AUTHORIZED", "PAID", "FAILED", "EXPIRED"],
  AUTHORIZED: ["PAID", "FAILED"],
  PAID: ["REFUNDED", "PARTIALLY_REFUNDED"],
  FAILED: [],
  EXPIRED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ["REFUNDED"],
};

export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, ReadonlyArray<DeliveryStatus>> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_ATTEMPT"],
  READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
  FAILED_ATTEMPT: ["OUT_FOR_DELIVERY", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const STOCK_RESERVATION_TRANSITIONS: Record<
  StockReservationStatus,
  ReadonlyArray<StockReservationStatus>
> = {
  ACTIVE: ["CONFIRMED", "RELEASED", "EXPIRED"],
  CONFIRMED: [],
  RELEASED: [],
  EXPIRED: [],
};

export interface OrderTransitionContext {
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  deliveryMethod: DeliveryMethod;
  paymentMethod?: PaymentMethod;
  payOnDeliveryEnabled?: boolean;
}

export function canTransitionOrderStatus(ctx: OrderTransitionContext): boolean {
  const allowed = ORDER_TRANSITIONS[ctx.fromStatus];
  if (!allowed.includes(ctx.toStatus)) {
    return false;
  }

  if (ctx.fromStatus === "AWAITING_PAYMENT" && ctx.toStatus === "PREPARING") {
    return ctx.paymentMethod === "PAY_ON_DELIVERY" && ctx.payOnDeliveryEnabled === true;
  }

  if (ctx.toStatus === "OUT_FOR_DELIVERY" && ctx.deliveryMethod !== "LOCAL_DELIVERY") {
    return false;
  }

  if (ctx.toStatus === "READY_FOR_PICKUP" && ctx.deliveryMethod !== "STORE_PICKUP") {
    return false;
  }

  return true;
}

export function assertValidOrderTransition(ctx: OrderTransitionContext): void {
  if (!canTransitionOrderStatus(ctx)) {
    throw new ConflictError(
      `Transicao de status de pedido invalida: ${ctx.fromStatus} -> ${ctx.toStatus}.`,
      "INVALID_ORDER_STATUS_TRANSITION",
      {
        fromStatus: ctx.fromStatus,
        toStatus: ctx.toStatus,
        deliveryMethod: ctx.deliveryMethod,
      },
    );
  }
}

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function canTransitionDeliveryStatus(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}

export function canTransitionReservationStatus(
  from: StockReservationStatus,
  to: StockReservationStatus,
): boolean {
  return STOCK_RESERVATION_TRANSITIONS[from].includes(to);
}
