import argon2 from "argon2";
import { getBackendEnvironmentConfig } from "../config/env";

const env = getBackendEnvironmentConfig();

const productionHashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const testHashOptions = {
  type: argon2.argon2id,
  memoryCost: 4096,
  timeCost: 2,
  parallelism: 1,
} as const;

function getPasswordHashOptions() {
  return env.mode === "test" ? testHashOptions : productionHashOptions;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, getPasswordHashOptions());
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

