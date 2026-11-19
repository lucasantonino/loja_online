"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ComputedCartState } from "@/modules/cart/cart-math";

export interface ClientCartData extends ComputedCartState {
  cartId: string | null;
}

const EMPTY_CART: ClientCartData = {
  cartId: null,
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  priceChanges: [],
  stockWarnings: [],
  hasBlockingIssues: false,
};

interface CartContextValue {
  cart: ClientCartData;
  loading: boolean;
  mutating: boolean;
  drawerOpen: boolean;
  lastError: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  clearError: () => void;
  refreshCart: () => Promise<void>;
  addItem: (
    variantId: string,
    quantity?: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateQuantity: (
    itemId: string,
    quantity: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  removeItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [cart, setCart] = useState<ClientCartData>(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { data?: ClientCartData };
      if (payload.data) {
        setCart(payload.data);
      }
    } catch {
      // Silencioso em falha transitoria de rede
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart, pathname]);

  const addItem = useCallback(async (variantId: string, quantity = 1) => {
    setMutating(true);
    setLastError(null);
    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity }),
      });

      const payload = (await response.json()) as {
        data?: ClientCartData;
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        const message = payload.error?.message ?? "Nao foi possivel adicionar a sacola.";
        setLastError(message);
        return { ok: false, error: message };
      }

      setCart(payload.data);
      setDrawerOpen(true);
      return { ok: true };
    } catch {
      const message = "Erro de rede ao adicionar item a sacola.";
      setLastError(message);
      return { ok: false, error: message };
    } finally {
      setMutating(false);
    }
  }, []);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    setMutating(true);
    setLastError(null);
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });

      const payload = (await response.json()) as {
        data?: ClientCartData;
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        const message = payload.error?.message ?? "Nao foi possivel atualizar quantidade.";
        setLastError(message);
        return { ok: false, error: message };
      }

      setCart(payload.data);
      return { ok: true };
    } catch {
      const message = "Erro de rede ao atualizar quantidade.";
      setLastError(message);
      return { ok: false, error: message };
    } finally {
      setMutating(false);
    }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    setMutating(true);
    setLastError(null);
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as {
        data?: ClientCartData;
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        const message = payload.error?.message ?? "Nao foi possivel remover o item.";
        setLastError(message);
        return { ok: false, error: message };
      }

      setCart(payload.data);
      return { ok: true };
    } catch {
      const message = "Erro de rede ao remover item.";
      setLastError(message);
      return { ok: false, error: message };
    } finally {
      setMutating(false);
    }
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        mutating,
        drawerOpen,
        lastError,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        clearError: () => setLastError(null),
        refreshCart,
        addItem,
        updateQuantity,
        removeItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart deve ser usado dentro de CartProvider.");
  }
  return ctx;
}
