import { z } from "zod";

const optionalCepField = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || v.length === 8, "CEP deve conter 8 digitos numericos.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const deliveryZoneObjectSchema = z.object({
  name: z.string().trim().min(2, "Nome da zona e obrigatorio.").max(100),
  city: z.string().trim().min(2, "Cidade e obrigatoria.").max(100),
  state: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z]{2}$/.test(v), "UF deve conter 2 letras."),
  matchType: z.enum(["CEP_RANGE", "NEIGHBORHOOD", "CITY_FLAT"]),
  cepStart: optionalCepField,
  cepEnd: optionalCepField,
  neighborhoods: z
    .array(z.string().trim().min(1))
    .default([])
    .transform((arr) => arr.map((s) => s.trim()).filter(Boolean)),
  feeCents: z.number().int().nonnegative("Taxa deve ser em centavos nao negativos."),
  freeShippingMinCents: z.number().int().nonnegative().nullable().optional(),
  estimatedDaysMin: z.number().int().nonnegative().default(0),
  estimatedDaysMax: z.number().int().nonnegative().default(1),
  estimatedLabel: z.string().trim().min(2, "Rotulo de prazo e obrigatorio.").max(120),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const createDeliveryZoneSchema = deliveryZoneObjectSchema.superRefine((data, ctx) => {
  if (data.estimatedDaysMax < data.estimatedDaysMin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["estimatedDaysMax"],
      message: "Prazo maximo deve ser maior ou igual ao prazo minimo.",
    });
  }

  if (data.matchType === "CEP_RANGE") {
    if (!data.cepStart || !data.cepEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cepStart"],
        message: "CEP inicial e CEP final sao obrigatorios para CEP_RANGE.",
      });
    } else if (data.cepStart > data.cepEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cepEnd"],
        message: "CEP final deve ser maior ou igual ao CEP inicial.",
      });
    }
  }

  if (data.matchType === "NEIGHBORHOOD" && data.neighborhoods.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["neighborhoods"],
      message: "Informe ao menos um bairro para zonas do tipo NEIGHBORHOOD.",
    });
  }
});

export const updateDeliveryZoneSchema = deliveryZoneObjectSchema.partial();

export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;
export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;
