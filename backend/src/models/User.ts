import { type Document, model, type Model, models, Schema, Types } from "mongoose";
import { getBackendEnvironmentConfig } from "../config/env";
import {
  type StoredUserAiSettings,
  getDefaultModelForProviderPreference,
} from "./chat/chatTypes";
import { UserRole } from "../config/roles";
import { hashPassword } from "../utils/hash";

export enum AuthMethod {
  LOCAL = "local",
}

export interface IUser {
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  authMethods: AuthMethod[];
  lastLogin?: Date;
  aiSettings: StoredUserAiSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document<Types.ObjectId> {}

export type UserModelType = Model<IUserDocument>;

const UserSchema = new Schema<IUserDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, select: false },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    isActive: { type: Boolean, default: true },
    authMethods: {
      type: [{ type: String, enum: Object.values(AuthMethod) }],
      default: [AuthMethod.LOCAL],
    },
    lastLogin: { type: Date },
    aiSettings: {
      apiKey: { type: String, trim: true },
      providerPreference: {
        type: String,
        enum: ["auto", "openai", "openrouter"],
        default: "auto",
      },
      model: {
        type: String,
        required: true,
        trim: true,
        default: getDefaultModelForProviderPreference("auto"),
      },
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel =
  (models.User as Model<IUserDocument>) || model<IUserDocument>("User", UserSchema);

export async function seedAdminUser() {
  const adminUsername = "administrator";
  const existing = await UserModel.findOne({ username: adminUsername }).lean().exec();

  if (existing) {
    return existing;
  }

  const { adminDefaultEmail, adminDefaultPassword } = getBackendEnvironmentConfig();
  const adminEmail = adminDefaultEmail ?? "admin@localhost";
  if (!adminDefaultPassword) {
    console.log("⚠️ ADMIN_DEFAULT_PASSWORD not set — skipping admin seed");
    return null;
  }

  const hashedPassword = await hashPassword(adminDefaultPassword);

  const admin = await UserModel.create({
    username: adminUsername,
    email: adminEmail,
    password: hashedPassword,
    role: UserRole.ADMIN,
    isActive: true,
    authMethods: [AuthMethod.LOCAL],
  });

  console.log("✅ Admin user created successfully");
  return admin;
}

