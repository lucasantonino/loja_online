import { z } from "zod";

export const manualStockAdjustmentSchema = z.object({
  variantId: z.string().trim().min(1, "Variante e obrigatoria."),
  type: z.enum(["MANUAL_ADJUSTMENT_IN", "MANUAL_ADJUSTMENT_OUT"]),
  quantity: z.number().int().positive("Quantidade deve ser um inteiro positivo."),
  reason: z
    .string()
    .trim()
    .min(3, "Motivo do ajuste e obrigatorio (minimo 3 caracteres).")
    .max(300, "Motivo deve ter no maximo 300 caracteres."),
});

export type ManualStockAdjustmentInput = z.infer<typeof manualStockAdjustmentSchema>;
