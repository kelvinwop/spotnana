import {
  type AccountCompletionRequest,
  type ConversationListResponse,
  type ConversationResponse,
  type GuestCompletionRequest,
  type GuestCompletionResponse,
} from "@/types/chat";
import { createManagedChatRequestSignal } from "@/utils/chatRequestSignal";
import { requestJson } from "./http";

export const chatApi = {
  listConversations(): Promise<ConversationListResponse> {
    return requestJson<ConversationListResponse>("/api/v1/chat/conversations", {
      method: "GET",
      auth: true,
    });
  },

  getConversation(conversationId: string): Promise<ConversationResponse> {
    return requestJson<ConversationResponse>(`/api/v1/chat/conversations/${conversationId}`, {
      method: "GET",
      auth: true,
    });
  },

  async createCompletion(
    payload: AccountCompletionRequest,
    signal?: AbortSignal
  ): Promise<ConversationResponse> {
    const managedSignal = createManagedChatRequestSignal(signal);

    try {
      return await requestJson<ConversationResponse>("/api/v1/chat/completions", {
        method: "POST",
        body: payload,
        auth: true,
        signal: managedSignal.signal,
      });
    } finally {
      managedSignal.dispose();
    }
  },

  async createGuestCompletion(
    payload: GuestCompletionRequest,
    signal?: AbortSignal
  ): Promise<GuestCompletionResponse> {
    const managedSignal = createManagedChatRequestSignal(signal);

    try {
      return await requestJson<GuestCompletionResponse>("/api/v1/chat/guest/completions", {
        method: "POST",
        body: payload,
        signal: managedSignal.signal,
      });
    } finally {
      managedSignal.dispose();
    }
  },

  renameConversation(conversationId: string, title: string): Promise<ConversationResponse> {
    return requestJson<ConversationResponse>(`/api/v1/chat/conversations/${conversationId}/title`, {
      method: "PUT",
      body: { title },
      auth: true,
    });
  },

  deleteConversation(conversationId: string): Promise<{ success: true }> {
    return requestJson<{ success: true }>(`/api/v1/chat/conversations/${conversationId}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
