import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteConversationHandler } from "./deleteConversation.controller";
import { getConversationHandler } from "./getConversation.controller";
import { renameConversationHandler } from "./renameConversation.controller";

const {
  findOneMock,
  findOneAndDeleteMock,
} = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  findOneAndDeleteMock: vi.fn(),
}));

vi.mock("../../models/chat/Conversation", () => ({
  ConversationModel: {
    findOne: findOneMock,
    findOneAndDelete: findOneAndDeleteMock,
  },
  toConversationRecord: (conversation: PersistedConversationDocument) => ({
    id: conversation._id.toString(),
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
    messageCount: conversation.messages.length,
    owner: "account" as const,
    messages: conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  }),
}));

type ExecResult<T> = {
  exec: () => Promise<T>;
};

function createExecResult<T>(value: T): ExecResult<T> {
  return {
    exec: async () => value,
  };
}

interface PersistedMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface PersistedConversationDocument {
  _id: { toString: () => string };
  userId: string;
  title: string;
  messages: PersistedMessage[];
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<void>;
}

function createPersistedConversation(
  overrides: Partial<Omit<PersistedConversationDocument, "_id" | "save">> & {
    id?: string;
    save?: () => Promise<void>;
  } = {}
): PersistedConversationDocument {
  return {
    _id: {
      toString: () => overrides.id ?? "507f1f77bcf86cd799439011",
    },
    userId: overrides.userId ?? "user-1",
    title: overrides.title ?? "Existing conversation",
    messages: overrides.messages ?? [
      {
        id: "message-1",
        role: "user",
        content: "Persisted user question",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:01.000Z"),
    save: overrides.save ?? (async () => {}),
  };
}

function createBaseContext(id: string) {
  return {
    params: { id },
    user: {
      userId: "user-1",
      username: "spotnana",
      email: "spotnana@example.com",
      role: "user",
    },
    set: {} as { status?: number | string },
  };
}

describe("adjacent account conversation id boundary", () => {
  beforeEach(() => {
    findOneMock.mockReset();
    findOneAndDeleteMock.mockReset();
  });

  afterEach(() => {
    findOneMock.mockReset();
    findOneAndDeleteMock.mockReset();
  });

  it.each([
    "not-a-valid-object-id",
    "abcdefghijkl",
    "507f1f77bcf86cd79943901z",
    "507F1F77BCF86CD799439011",
  ])(
    "getConversation rejects malformed id %s through the typed invalid_request boundary",
    async (id) => {
      const context = createBaseContext(id);

      const response = await getConversationHandler(context);

      expect(context.set.status).toBe(400);
      expect(response).toEqual({
        error: "Invalid conversation target",
        message: "The supplied conversationId is not a valid conversation identifier.",
        kind: "invalid_request",
      });
      expect(findOneMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    "not-a-valid-object-id",
    "abcdefghijkl",
    "507f1f77bcf86cd79943901z",
    "507F1F77BCF86CD799439011",
  ])(
    "deleteConversation rejects malformed id %s through the typed invalid_request boundary",
    async (id) => {
      const context = createBaseContext(id);

      const response = await deleteConversationHandler(context);

      expect(context.set.status).toBe(400);
      expect(response).toEqual({
        error: "Invalid conversation target",
        message: "The supplied conversationId is not a valid conversation identifier.",
        kind: "invalid_request",
      });
      expect(findOneAndDeleteMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    "not-a-valid-object-id",
    "abcdefghijkl",
    "507f1f77bcf86cd79943901z",
    "507F1F77BCF86CD799439011",
  ])(
    "renameConversation rejects malformed id %s through the typed invalid_request boundary",
    async (id) => {
      const context = {
        ...createBaseContext(id),
        body: { title: "  Renamed conversation  " },
      };

      const response = await renameConversationHandler(context);

      expect(context.set.status).toBe(400);
      expect(response).toEqual({
        error: "Invalid conversation target",
        message: "The supplied conversationId is not a valid conversation identifier.",
        kind: "invalid_request",
      });
      expect(findOneMock).not.toHaveBeenCalled();
    }
  );

  it("getConversation looks up the canonical parsed id and returns the owned conversation", async () => {
    const conversation = createPersistedConversation();
    findOneMock.mockReturnValue(createExecResult(conversation));

    const context = createBaseContext("507f1f77bcf86cd799439011");
    const response = await getConversationHandler(context);

    expect(findOneMock).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439011",
      userId: "user-1",
    });
    expect(response).toMatchObject({
      mode: "account",
      conversation: {
        id: "507f1f77bcf86cd799439011",
      },
    });
  });

  it("deleteConversation looks up the canonical parsed id before deleting", async () => {
    const conversation = createPersistedConversation();
    findOneAndDeleteMock.mockReturnValue(createExecResult(conversation));

    const context = createBaseContext("507f1f77bcf86cd799439011");
    const response = await deleteConversationHandler(context);

    expect(findOneAndDeleteMock).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439011",
      userId: "user-1",
    });
    expect(response).toEqual({ success: true });
  });

  it("renameConversation looks up the canonical parsed id before saving the trimmed title", async () => {
    const save = vi.fn(async () => {});
    const conversation = createPersistedConversation({ save });
    findOneMock.mockReturnValue(createExecResult(conversation));

    const context = {
      ...createBaseContext("507f1f77bcf86cd799439011"),
      body: { title: "  Renamed conversation  " },
    };
    const response = await renameConversationHandler(context);

    expect(findOneMock).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439011",
      userId: "user-1",
    });
    expect(conversation.title).toBe("Renamed conversation");
    expect(save).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      mode: "account",
      conversation: {
        id: "507f1f77bcf86cd799439011",
        title: "Renamed conversation",
      },
    });
  });
});
