import { z } from "zod";

export const strongPasswordSchema = z
  .string()
  .min(8, "A senha deve ter no minimo 8 caracteres.")
  .max(128, "A senha deve ter no maximo 128 caracteres.")
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra.")
  .regex(/\d/, "A senha deve conter ao menos um numero.");

export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Informe um e-mail valido.")
  .max(180);

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no minimo 2 caracteres.").max(120),
  email: normalizedEmailSchema,
  password: strongPasswordSchema,
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v && v.length > 0 ? v.replace(/\D/g, "") : undefined)),
  acceptTerms: z.literal(true, {
    errorMap: () => ({
      message: "Voce precisa aceitar os Termos de Uso e a Politica de Privacidade.",
    }),
  }),
});

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const forgotPasswordSchema = z.object({
  email: normalizedEmailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, "Token de recuperacao invalido."),
  newPassword: strongPasswordSchema,
});

export const anonymizeAccountSchema = z.object({
  confirmPhrase: z.literal("EXCLUIR MINHA CONTA", {
    errorMap: () => ({
      message: 'Digite exatamente "EXCLUIR MINHA CONTA" para confirmar.',
    }),
  }),
  password: z.string().min(1).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AnonymizeAccountInput = z.infer<typeof anonymizeAccountSchema>;
