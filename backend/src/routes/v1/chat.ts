import { Elysia, t } from "elysia";
import {
  createCompletionHandler,
  createGuestCompletionHandler,
  deleteConversationHandler,
  getConversationHandler,
  listConversationsHandler,
  renameConversationHandler,
} from "../../controllers/chat";
import { requireAuth } from "../../middlewares/auth";
import {
  accountChatCompletionRequestSchema,
  guestChatCompletionRequestSchema,
  renameConversationSchema,
} from "../../models/chat/chatTypes";

export const chatRoutes = new Elysia({ prefix: "/api/v1/chat" })
  .post("/guest/completions", createGuestCompletionHandler, {
    body: guestChatCompletionRequestSchema,
  })
  .use(
    new Elysia()
      .use(requireAuth)
      .get("/conversations", listConversationsHandler)
      .get("/conversations/:id", getConversationHandler, {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
      })
      .post("/completions", createCompletionHandler, {
        body: accountChatCompletionRequestSchema,
      })
      .put("/conversations/:id/title", renameConversationHandler, {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        body: renameConversationSchema,
      })
      .delete("/conversations/:id", deleteConversationHandler, {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
      })
  );
