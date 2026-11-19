import { describe, expect, it } from "vitest";
import {
  generateOpaqueToken,
  hashPassword,
  hashTokenSha256,
  verifyPassword,
} from "@/lib/auth/password";
import {
  assertResourceOwner,
  computePasswordVersion,
  createSessionToken,
  requireAdmin,
  requireAuth,
  verifySessionToken,
  type SessionUser,
} from "@/lib/auth/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { anonymizeAccountSchema, registerSchema } from "@/modules/auth/schemas";

describe("auth, sessions & RBAC (T08, RF13, RF17, CA14)", () => {
  it("gera e valida token de sessao assinado e invalida ao trocar senha", () => {
    const now = 1_700_000_000;
    const oldHash = "$2b$12$oldhashvalue";
    const token = createSessionToken({
      userId: "user_1",
      passwordHash: oldHash,
      nowSeconds: now,
      ttlSeconds: 3600,
    });

    const verified = verifySessionToken(token, now + 100);
    expect(verified).not.toBeNull();
    expect(verified?.uid).toBe("user_1");
    expect(verified?.ver).toBe(computePasswordVersion(oldHash));

    // Adulteracao de assinatura ou payload e rejeitada
    const tampered = `${token.slice(0, -2)}xx`;
    expect(verifySessionToken(tampered, now + 100)).toBeNull();

    // Token expirado e rejeitado
    expect(verifySessionToken(token, now + 4000)).toBeNull();

    // Troca de senha gera nova versao de hash, invalidando sessoes antigas
    expect(computePasswordVersion("$2b$12$newhashvalue")).not.toBe(verified?.ver);
  });

  it("aplica guards RBAC e protecao IDOR (RF17, CA14)", () => {
    const customerA: SessionUser = {
      id: "user_a",
      email: "a@loja.local",
      name: "Cliente A",
      role: "CUSTOMER",
    };
    const customerB: SessionUser = {
      id: "user_b",
      email: "b@loja.local",
      name: "Cliente B",
      role: "CUSTOMER",
    };
    const admin: SessionUser = {
      id: "admin_1",
      email: "admin@loja.local",
      name: "Admin",
      role: "ADMIN",
    };

    expect(() => requireAuth(null)).toThrow(UnauthorizedError);
    expect(() => requireAdmin(customerA)).toThrow(ForbiddenError);
    expect(requireAdmin(admin).id).toBe("admin_1");

    expect(assertResourceOwner(customerA, "user_a").id).toBe("user_a");
    expect(() => assertResourceOwner(customerB, "user_a")).toThrow(ForbiddenError);
    expect(assertResourceOwner(admin, "user_a", true).id).toBe("admin_1");
    expect(() => assertResourceOwner(admin, "user_a", false)).toThrow(ForbiddenError);
  });

  it("gera hash bcrypt e tokens opacos SHA-256", async () => {
    await expect(hashPassword("1234567")).rejects.toThrow();

    const hash = await hashPassword("SenhaForte123");
    expect(hash).not.toBe("SenhaForte123");
    expect(await verifyPassword("SenhaForte123", hash)).toBe(true);
    expect(await verifyPassword("Errada123", hash)).toBe(false);

    const raw = generateOpaqueToken(32);
    expect(raw).toHaveLength(64);
    expect(hashTokenSha256(raw)).toHaveLength(64);
    expect(hashTokenSha256(raw)).not.toBe(raw);
  });

  it("valida regras de cadastro (acceptTerms + senha forte) e anonimizacao LGPD", () => {
    expect(
      registerSchema.safeParse({
        name: "Maria Silva",
        email: "MARIA@EXEMPLO.COM",
        password: "abc",
        acceptTerms: true,
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        name: "Maria Silva",
        email: "MARIA@EXEMPLO.COM",
        password: "Senha123",
        acceptTerms: false,
      }).success,
    ).toBe(false);

    const okReg = registerSchema.safeParse({
      name: "Maria Silva",
      email: "MARIA@EXEMPLO.COM",
      password: "Senha123",
      phone: "(11) 98888-7777",
      acceptTerms: true,
    });
    expect(okReg.success).toBe(true);
    if (okReg.success) {
      expect(okReg.data.email).toBe("maria@exemplo.com");
      expect(okReg.data.phone).toBe("11988887777");
    }

    expect(
      anonymizeAccountSchema.safeParse({
        confirmPhrase: "excluir minha conta",
      }).success,
    ).toBe(false);
    expect(
      anonymizeAccountSchema.safeParse({
        confirmPhrase: "EXCLUIR MINHA CONTA",
      }).success,
    ).toBe(true);
  });
});
