import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  if (plainPassword.length < 8) {
    throw new RangeError("A senha deve possuir no minimo 8 caracteres.");
  }
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  if (!plainPassword || !passwordHash) {
    return false;
  }
  return bcrypt.compare(plainPassword, passwordHash);
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashTokenSha256(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
