import { Context } from "elysia";
import {
  type UpdateAccountAiSettingsRequest,
  normalizeStoredUserAiSettings,
  trimApiKey,
} from "../../models/chat/chatTypes";
import { UserModel } from "../../models/User";
import { AuthUser } from "../../middlewares/auth";
import { buildAuthUserResponse } from "./shared";

export async function updateAiSettingsHandler(
  context: Context & { body: UpdateAccountAiSettingsRequest; user: AuthUser }
) {
  const { body, set, user } = context;

  try {
    const foundUser = await UserModel.findById(user.userId).exec();
    if (!foundUser) {
      set.status = 404;
      return { error: "User not found" };
    }

    const previousSettings = normalizeStoredUserAiSettings(foundUser.aiSettings);
    const nextApiKey =
      body.apiKeyChange.type === "keep"
        ? previousSettings.apiKey
        : body.apiKeyChange.type === "clear"
          ? undefined
          : trimApiKey(body.apiKeyChange.value);

    if (body.apiKeyChange.type === "set" && (!nextApiKey || nextApiKey.length === 0)) {
      set.status = 400;
      return { error: "API key is required" };
    }

    foundUser.aiSettings = normalizeStoredUserAiSettings({
      providerPreference: body.providerPreference,
      model: body.model,
      apiKey: nextApiKey,
    });

    await foundUser.save();

    return {
      user: buildAuthUserResponse(foundUser),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    set.status = 500;
    return { error: "Failed to update AI settings", message };
  }
}
