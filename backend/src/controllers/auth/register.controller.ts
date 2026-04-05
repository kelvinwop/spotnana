import { Context } from "elysia";
import { UserModel, AuthMethod } from "../../models/User";
import { generateToken } from "../../utils/jwt";
import { hashPassword } from "../../utils/hash";
import { UserRole } from "../../config/roles";
import { buildAuthUserResponse, createSession } from "./shared";

type RegisterBody = { username: string; email: string; password: string };

export async function registerHandler(context: Context) {
  const { username, email, password } = context.body as RegisterBody;

  try {
    const existingUser = await UserModel.findOne({
      $or: [{ username }, { email }],
    })
      .lean()
      .exec();

    if (existingUser) {
      context.set.status = 409;
      return { error: "Username or email already exists" };
    }

    const hashedPassword = await hashPassword(password);
    const user = await UserModel.create({
      username,
      email,
      password: hashedPassword,
      role: UserRole.USER,
      authMethods: [AuthMethod.LOCAL],
      isActive: true,
    });

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
    return { error: "Failed to register user", message };
  }
}

