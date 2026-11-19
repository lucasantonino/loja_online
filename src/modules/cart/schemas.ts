import { z } from "zod";

export const addCartItemSchema = z.object({
  variantId: z.string().trim().min(1, "Variante e obrigatoria."),
  quantity: z.number().int().min(1, "Quantidade minima e 1.").max(99, "Quantidade maxima por operacao e 99.").default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0, "Quantidade nao pode ser negativa.").max(99, "Quantidade maxima e 99."),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
