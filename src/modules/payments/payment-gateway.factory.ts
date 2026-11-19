import { AppError } from "@/lib/http/api-response";
import type {
  PaymentGatewayPort,
  SupportedPaymentProvider,
} from "@/modules/payments/ports/payment-gateway.port";

type GatewayAdapterFactory = () => PaymentGatewayPort;

const adapterRegistry = new Map<SupportedPaymentProvider, GatewayAdapterFactory>();

export function registerPaymentGatewayAdapter(
  provider: SupportedPaymentProvider,
  factory: GatewayAdapterFactory,
): void {
  adapterRegistry.set(provider, factory);
}

export function isSupportedPaymentProvider(value: string): value is SupportedPaymentProvider {
  return value === "mercadopago" || value === "pagarme" || value === "asaas";
}

export function getPaymentGateway(provider: SupportedPaymentProvider): PaymentGatewayPort {
  const factory = adapterRegistry.get(provider);
  if (!factory) {
    throw new AppError(
      501,
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      `Adaptador de pagamento para "${provider}" ainda nao registrado (previsto em T12).`,
      { provider },
    );
  }
  return factory();
}
