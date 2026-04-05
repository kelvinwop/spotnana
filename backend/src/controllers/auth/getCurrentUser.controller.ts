import { Context } from "elysia";
import { AuthUser } from "../../middlewares/auth";
import { toPublicUserAiSettings } from "../../models/chat/chatTypes";
import { UserModel } from "../../models/User";

export async function getCurrentUserHandler(context: Context & { user: AuthUser }) {
  const { user, set } = context;

  try {
    const foundUser = await UserModel.findById(user.userId).lean().exec();

    if (!foundUser) {
      set.status = 404;
      return { error: "User not found" };
    }

    return {
      user: {
        id: foundUser._id.toString(),
        username: foundUser.username,
        email: foundUser.email,
        role: foundUser.role,
        aiSettings: toPublicUserAiSettings(foundUser.aiSettings),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    set.status = 500;
    return { error: "Failed to get user", message };
  }
}

