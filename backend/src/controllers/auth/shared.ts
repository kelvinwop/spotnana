import { Context } from "elysia";
import { getBackendEnvironmentConfig } from "../../config/env";
import { toPublicUserAiSettings } from "../../models/chat/chatTypes";
import { type IUserDocument } from "../../models/User";
import { SessionModel, parseUserAgent } from "../../models/Session";

export function getClientInfo(context: Context) {
  const request = context.request;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  return { ipAddress, userAgent };
}

function calculateSessionExpiry(): Date {
  const { jwtExpiresIn } = getBackendEnvironmentConfig();
  const exactSeconds = Number(jwtExpiresIn);
  if (Number.isInteger(exactSeconds) && exactSeconds > 0) {
    return new Date(Date.now() + exactSeconds * 1000);
  }

  const match = /^(\d+)([smhd])$/.exec(jwtExpiresIn.trim());
  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const multiplier =
    match[2] === "s"
      ? 1000
      : match[2] === "m"
        ? 60 * 1000
        : match[2] === "h"
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

  return new Date(Date.now() + amount * multiplier);
}

export async function createSession(userId: string, token: string, context: Context) {
  const { ipAddress, userAgent } = getClientInfo(context);
  const deviceInfo = parseUserAgent(userAgent);

  await SessionModel.create({
    userId,
    token,
    ipAddress,
    userAgent,
    deviceInfo,
    isActive: true,
    lastActivity: new Date(),
    expiresAt: calculateSessionExpiry(),
  });
}

export function buildAuthUserResponse(
  user: Pick<IUserDocument, "_id" | "username" | "email" | "role" | "aiSettings">
) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    aiSettings: toPublicUserAiSettings(user.aiSettings),
  };
}

