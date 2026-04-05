import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCompletionHandler } from "./createCompletion.controller";
import { resetCompletionStateForTests } from "./completionState";
import { AiCompletionError } from "./aiCompletion";

const {
  requestAiCompletionMock,
  findByIdMock,
  findOneMock,
  createConversationMock,
} = vi.hoisted(() => ({
  requestAiCompletionMock: vi.fn(),
  findByIdMock: vi.fn(),
  findOneMock: vi.fn(),
  createConversationMock: vi.fn(),
}));

vi.mock("./aiCompletion", async () => {
  const actual = await vi.importActual<typeof import("./aiCompletion")>("./aiCompletion");
  return {
    ...actual,
    requestAiCompletion: requestAiCompletionMock,
  };
});

vi.mock("../../models/User", () => ({
  UserModel: {
    findById: findByIdMock,
  },
}));

vi.mock("../../models/chat/Conversation", () => ({
  ConversationModel: {
    findOne: findOneMock,
    create: createConversationMock,
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

function createUserQuery(user: { aiSettings?: { apiKey?: string; providerPreference: "auto"; model: string } }) {
  return createExecResult(user);
}

function createConversationQuery(conversation: PersistedConversationDocument | null) {
  return createExecResult(conversation);
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
      {
        id: "message-2",
        role: "assistant",
        content: "Persisted assistant answer",
        createdAt: new Date("2026-01-01T00:00:01.000Z"),
      },
    ],
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:01.000Z"),
    save: overrides.save ?? (async () => {}),
  };
}

function createContext(body: {
  prompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  conversationId?: string;
}): {
  body: {
    prompt: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    conversationId?: string;
  };
  request: Request;
  user: {
    userId: string;
    username: string;
    email: string;
    role: string;
  };
  set: {
    status?: number | string;
  };
} {
  return {
    body,
    request: new Request("http://localhost/api/v1/chat/completions", { method: "POST" }),
    user: {
      userId: "user-1",
      username: "spotnana",
      email: "spotnana@example.com",
      role: "user",
    },
    set: {},
  };
}

describe("createCompletionHandler", () => {
  beforeEach(() => {
    resetCompletionStateForTests();
    requestAiCompletionMock.mockReset();
    findByIdMock.mockReset();
    findOneMock.mockReset();
    createConversationMock.mockReset();
  });

  afterEach(() => {
    resetCompletionStateForTests();
  });

  it("uses persisted conversation messages as the authoritative completion history for account appends", async () => {
    const persistedConversation = createPersistedConversation();

    findByIdMock.mockReturnValue(createUserQuery({
      aiSettings: {
        apiKey: "sk-test-key",
        providerPreference: "auto",
        model: "gpt-4o-mini",
      },
    }));
    findOneMock.mockReturnValue(createConversationQuery(persistedConversation));
    requestAiCompletionMock.mockResolvedValue({
      content: "Fresh assistant reply",
      provider: "openai",
    });

    const response = await createCompletionHandler(
      createContext({
        conversationId: "507f1f77bcf86cd799439011",
        prompt: "New prompt",
        history: [
          {
            role: "assistant",
            content: "Client supplied history should not be trusted",
          },
        ],
      })
    );

    expect(requestAiCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "New prompt",
        messages: [
          {
            role: "user",
            content: "Persisted user question",
          },
          {
            role: "assistant",
            content: "Persisted assistant answer",
          },
        ],
      })
    );
    expect(response).toMatchObject({
      mode: "account",
      conversation: {
        id: "507f1f77bcf86cd799439011",
      },
    });
    expect(persistedConversation.messages).toHaveLength(4);
  });

  it("returns a typed invalid_request failure when an append target is missing", async () => {
    findByIdMock.mockReturnValue(createUserQuery({
      aiSettings: {
        apiKey: "sk-test-key",
        providerPreference: "auto",
        model: "gpt-4o-mini",
      },
    }));
    findOneMock.mockReturnValue(createConversationQuery(null));

    const context = createContext({
      conversationId: "507f1f77bcf86cd799439011",
      prompt: "Append to missing conversation",
      history: [],
    });

    const response = await createCompletionHandler(context);

    expect(context.set.status).toBe(404);
    expect(response).toEqual({
      error: "Conversation not found",
      message: "The requested conversation does not exist for this account.",
      kind: "invalid_request",
    });
    expect(requestAiCompletionMock).not.toHaveBeenCalled();
  });


  it("replays schema-valid persisted system messages when appending to an existing conversation", async () => {
    const persistedConversation = createPersistedConversation({
      messages: [
        {
          id: "message-system",
          role: "system",
          content: "Persisted system guidance",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: "message-user",
          role: "user",
          content: "Persisted user question",
          createdAt: new Date("2026-01-01T00:00:01.000Z"),
        },
        {
          id: "message-assistant",
          role: "assistant",
          content: "Persisted assistant answer",
          createdAt: new Date("2026-01-01T00:00:02.000Z"),
        },
      ],
    });

    findByIdMock.mockReturnValue(createUserQuery({
      aiSettings: {
        apiKey: "sk-test-key",
        providerPreference: "auto",
        model: "gpt-4o-mini",
      },
    }));
    findOneMock.mockReturnValue(createConversationQuery(persistedConversation));
    requestAiCompletionMock.mockResolvedValue({
      content: "Fresh assistant reply",
      provider: "openai",
    });

    const response = await createCompletionHandler(
      createContext({
        conversationId: "507f1f77bcf86cd799439011",
        prompt: "New prompt after system instruction",
        history: [],
      })
    );

    expect(requestAiCompletionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "New prompt after system instruction",
        messages: [
          {
            role: "system",
            content: "Persisted system guidance",
          },
          {
            role: "user",
            content: "Persisted user question",
          },
          {
            role: "assistant",
            content: "Persisted assistant answer",
          },
        ],
      })
    );
    expect(response).toMatchObject({
      mode: "account",
      conversation: {
        id: "507f1f77bcf86cd799439011",
      },
    });
    expect(persistedConversation.messages).toHaveLength(5);
  });
  it.each([
    "not-a-valid-object-id",
    "abcdefghijkl",
    "507f1f77bcf86cd79943901z",
    "507F1F77BCF86CD799439011",
  ])(
    "rejects malformed append target %s without creating a replacement conversation",
    async (conversationId) => {
      findByIdMock.mockReturnValue(createUserQuery({
        aiSettings: {
          apiKey: "sk-test-key",
          providerPreference: "auto",
          model: "gpt-4o-mini",
        },
      }));

      const context = createContext({
        conversationId,
        prompt: "Append to malformed conversation",
        history: [],
      });

      const response = await createCompletionHandler(context);

      expect(context.set.status).toBe(400);
      expect(response).toEqual({
        error: "Invalid conversation target",
        message: "The supplied conversationId is not a valid conversation identifier.",
        kind: "invalid_request",
      });
      expect(findOneMock).not.toHaveBeenCalled();
      expect(createConversationMock).not.toHaveBeenCalled();
      expect(requestAiCompletionMock).not.toHaveBeenCalled();
    }
  );

  it("still surfaces provider failures through the existing typed error contract", async () => {
    findByIdMock.mockReturnValue(createUserQuery({
      aiSettings: {
        apiKey: "sk-test-key",
        providerPreference: "auto",
        model: "gpt-4o-mini",
      },
    }));
    requestAiCompletionMock.mockRejectedValue(
      new AiCompletionError("rate_limited", "Provider limit hit", 429, "openai")
    );

    const context = createContext({
      prompt: "Fresh prompt",
      history: [],
    });

    const response = await createCompletionHandler(context);

    expect(context.set.status).toBe(429);
    expect(response).toEqual({
      error: "Failed to create completion",
      message: "Provider limit hit",
      kind: "rate_limited",
    });
    expect(createConversationMock).not.toHaveBeenCalled();
  });
});
