import { Context, Elysia } from "elysia";
import { ensureDatabaseConnection, getDatabaseAvailabilityMessage } from "../config/database";
import { UserRole } from "../config/roles";
import { SessionModel } from "../models/Session";
import { verifyToken } from "../utils/jwt";

export interface AuthUser {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
}

export type AuthContext = Context & {
  user: AuthUser;
};

type RequestHeaders = Record<string, string | undefined>;
type StatusSetter = { status?: number | string };

function getBearerToken(headers: RequestHeaders): string {
  const authHeader = headers.authorization ?? headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Authentication required");
  }
  return authHeader.substring(7);
}

async function authenticateToken(
  headers: RequestHeaders,
  set: StatusSetter,
  requireAdminRole: boolean
): Promise<{ user: AuthUser }> {
  const availability = await ensureDatabaseConnection();
  if (!availability.available) {
    set.status = 503;
    throw new Error(getDatabaseAvailabilityMessage());
  }

  let token: string;
  try {
    token = getBearerToken(headers);
  } catch {
    set.status = 401;
    throw new Error("Unauthorized: Authentication required");
  }

  const tokenVerification = verifyToken(token);
  if (!tokenVerification.success) {
    set.status = 401;
    throw new Error("Unauthorized: Invalid token");
  }

  if (requireAdminRole && tokenVerification.payload.role !== UserRole.ADMIN) {
    set.status = 403;
    throw new Error("Forbidden: Admin access required");
  }

  const session = await SessionModel.findOneAndUpdate(
    {
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    },
    { lastActivity: new Date() },
    { new: true }
  )
    .lean()
    .exec();

  if (!session) {
    set.status = 401;
    throw new Error("Unauthorized: Session revoked or expired");
  }

  return {
    user: {
      userId: tokenVerification.payload.userId,
      username: tokenVerification.payload.username,
      email: tokenVerification.payload.email,
      role: tokenVerification.payload.role,
    },
  };
}

export const requireAuth = new Elysia().derive({ as: "scoped" }, async ({ headers, set }) =>
  authenticateToken(headers as RequestHeaders, set, false)
);

export const requireAdmin = new Elysia().derive({ as: "scoped" }, async ({ headers, set }) =>
  authenticateToken(headers as RequestHeaders, set, true)
);
