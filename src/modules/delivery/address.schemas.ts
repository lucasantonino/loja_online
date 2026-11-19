import { z } from "zod";

const cepField = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 8, "CEP deve conter exatamente 8 digitos numericos.");

const phoneField = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length >= 10 && v.length <= 11, "Telefone deve conter DDD + 8 ou 9 digitos.");

const stateUfField = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z]{2}$/.test(v), "UF deve conter 2 letras (ex.: SP).");

export const createAddressSchema = z.object({
  label: z.string().trim().max(40).nullable().optional(),
  recipientName: z.string().trim().min(2, "Nome do destinatario e obrigatorio.").max(120),
  phone: phoneField,
  cep: cepField,
  street: z.string().trim().min(2, "Logradouro e obrigatorio.").max(160),
  number: z.string().trim().min(1, "Numero e obrigatorio.").max(20),
  complement: z.string().trim().max(80).nullable().optional(),
  neighborhood: z.string().trim().min(2, "Bairro e obrigatorio.").max(100),
  city: z.string().trim().min(2, "Cidade e obrigatoria.").max(100),
  state: stateUfField,
  referencePoint: z.string().trim().max(160).nullable().optional(),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
