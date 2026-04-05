import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { UserRole } from "../config/roles";
import { getBackendEnvironmentConfig } from "../config/env";

const env = getBackendEnvironmentConfig();
const JWT_SECRET = env.jwtSecret;

function parseJwtExpiryToSeconds(raw: string): number {
  const trimmed = raw.trim();
  const exactSeconds = Number(trimmed);
  if (Number.isInteger(exactSeconds) && exactSeconds > 0) {
    return exactSeconds;
  }

  const match = /^(\d+)([smhd])$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid JWT_EXPIRES_IN value: ${raw}. Expected a positive integer number of seconds or a duration like 30s, 15m, 12h, or 7d.`
    );
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "s"
      ? 1
      : unit === "m"
        ? 60
        : unit === "h"
          ? 60 * 60
          : 60 * 60 * 24;

  return amount * multiplier;
}

const JWT_EXPIRES_IN_SECONDS = parseJwtExpiryToSeconds(env.jwtExpiresIn);

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
}

export type VerifyTokenResult =
  | { success: true; payload: JWTPayload }
  | { success: false; error: "invalid_token" | "invalid_payload" };

function readClaim(decoded: jwt.JwtPayload, claim: string): unknown {
  return decoded[claim];
}

function readRequiredStringClaim(decoded: jwt.JwtPayload, claim: string): string | null {
  const value = readClaim(decoded, claim);
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value;
}

function readRoleClaim(decoded: jwt.JwtPayload): UserRole | null {
  const role = readClaim(decoded, "role");
  if (role === UserRole.USER || role === UserRole.ADMIN) {
    return role;
  }
  return null;
}

function parseTokenPayload(decoded: string | jwt.JwtPayload): VerifyTokenResult {
  if (typeof decoded === "string") {
    return { success: false, error: "invalid_payload" };
  }

  const userId = readRequiredStringClaim(decoded, "userId");
  const username = readRequiredStringClaim(decoded, "username");
  const email = readRequiredStringClaim(decoded, "email");
  const role = readRoleClaim(decoded);

  if (!userId || !username || !email || !role) {
    return { success: false, error: "invalid_payload" };
  }

  return {
    success: true,
    payload: {
      userId,
      username,
      email,
      role,
    },
  };
}

export function generateToken(payload: JWTPayload): string {
  const signOptions: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
    jwtid: randomUUID(),
  };

  return jwt.sign(payload, JWT_SECRET, signOptions);
}

export function verifyToken(token: string): VerifyTokenResult {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return parseTokenPayload(decoded);
  } catch {
    return { success: false, error: "invalid_token" };
  }
}

