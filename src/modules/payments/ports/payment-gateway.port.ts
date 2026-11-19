export type SupportedPaymentProvider = "mercadopago" | "pagarme" | "asaas";

export interface PaymentCustomerInput {
  name: string;
  email: string;
  document?: string;
  phone?: string;
}

export interface CreatePixPaymentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  expiresAt: Date;
  customer: PaymentCustomerInput;
  notificationUrl: string;
  idempotencyKey: string;
}

export interface CreateCardPaymentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  installments: number;
  cardToken: string;
  paymentMethodId?: string;
  customer: PaymentCustomerInput;
  notificationUrl: string;
  idempotencyKey: string;
}

export interface NormalizedPaymentResult {
  provider: SupportedPaymentProvider;
  externalPaymentId: string;
  status: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "EXPIRED";
  pixQrCodeBase64?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: Date;
  failureCode?: string;
  failureMessage?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface NormalizedWebhookEvent {
  provider: SupportedPaymentProvider;
  externalEventId: string;
  externalPaymentId: string;
  eventType: string;
  statusFromPayload?: string;
  rawPayload: unknown;
}

export interface PaymentGatewayPort {
  readonly provider: SupportedPaymentProvider;
  createPixPayment(input: CreatePixPaymentInput): Promise<NormalizedPaymentResult>;
  createCardPayment(input: CreateCardPaymentInput): Promise<NormalizedPaymentResult>;
  getPaymentStatus(externalPaymentId: string): Promise<NormalizedPaymentResult>;
  refundPayment(
    externalPaymentId: string,
    amountCents?: number,
  ): Promise<{
    externalRefundId: string;
    status: "REFUNDED" | "PARTIALLY_REFUNDED" | "PENDING";
  }>;
  verifyWebhookSignature(params: {
    rawBody: string;
    headers: Record<string, string | undefined>;
  }): Promise<boolean>;
  parseWebhookEvent(rawBody: string): Promise<NormalizedWebhookEvent>;
}
