import { type Document, model, type Model, models, Schema, Types } from "mongoose";
import {
  chatRoleValues,
  type ChatConversationRecord,
  type ChatConversationSummary,
  type ChatMessageRecord,
  type ChatRole,
} from "./chatTypes";

interface PersistedChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
}

export interface IConversation {
  userId: Types.ObjectId;
  title: string;
  messages: PersistedChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationDocument extends IConversation, Document<Types.ObjectId> {}

const ChatMessageSchema = new Schema<PersistedChatMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: chatRoleValues, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    messages: { type: [ChatMessageSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });

export const ConversationModel =
  (models.Conversation as Model<IConversationDocument>) ||
  model<IConversationDocument>("Conversation", ConversationSchema);

function toMessageRecord(message: PersistedChatMessage): ChatMessageRecord {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toConversationSummary(document: IConversationDocument): ChatConversationSummary {
  return {
    id: document._id.toString(),
    title: document.title,
    updatedAt: document.updatedAt.toISOString(),
    createdAt: document.createdAt.toISOString(),
    messageCount: document.messages.length,
    owner: "account",
  };
}

export function toConversationRecord(document: IConversationDocument): ChatConversationRecord {
  return {
    ...toConversationSummary(document),
    messages: document.messages.map((message) => toMessageRecord(message)),
  };
}
