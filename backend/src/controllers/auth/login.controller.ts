import { Context } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { generateToken } from "../../utils/jwt";
import { verifyPassword } from "../../utils/hash";
import { buildAuthUserResponse, createSession } from "./shared";

type LoginBody = { username: string; password: string };

export async function loginHandler(context: Context) {
  const { username, password } = context.body as LoginBody;

  try {
    const user = await UserModel.findOne({ username }).select("+password").exec();

    if (!user || !user.password || !user.authMethods.includes(AuthMethod.LOCAL)) {
      context.set.status = 401;
      return { error: "Invalid credentials" };
    }

    if (!user.isActive) {
      context.set.status = 403;
      return { error: "Account is disabled" };
    }

    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
      context.set.status = 401;
      return { error: "Invalid credentials" };
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    });

    await createSession(user._id.toString(), token, context);

    return {
      token,
      user: buildAuthUserResponse(user),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    context.set.status = 500;
    return { error: "Failed to login", message };
  }
}

