import { Elysia, t } from "elysia";
import {
  getCurrentUserHandler,
  loginHandler,
  logoutHandler,
  registerHandler,
  updateAiSettingsHandler,
} from "../../controllers/auth";
import { requireAuth } from "../../middlewares/auth";
import { updateAccountAiSettingsSchema } from "../../models/chat/chatTypes";

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  .post("/register", registerHandler, {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 50 }),
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 8, maxLength: 120 }),
    }),
  })
  .post("/login", loginHandler, {
    body: t.Object({
      username: t.String({ minLength: 1 }),
      password: t.String({ minLength: 1 }),
    }),
  })
  .use(
    new Elysia()
      .use(requireAuth)
      .get("/me", getCurrentUserHandler)
      .put("/settings/ai", updateAiSettingsHandler, {
        body: updateAccountAiSettingsSchema,
      })
      .post("/logout", logoutHandler)
  );
