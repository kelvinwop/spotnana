import { Context } from "elysia";
import { SessionModel } from "../../models/Session";
import { AuthUser } from "../../middlewares/auth";

export async function logoutHandler(context: Context & { user: AuthUser }) {
  const authHeader = context.request.headers.get("authorization");
  const token = authHeader?.substring(7);

  if (token) {
    await SessionModel.updateOne({ token, isActive: true }, { isActive: false }).exec();
  }

  return { message: "Logged out successfully" };
}

