import mongoose from "mongoose";
import { getDatabaseEnvironmentConfig } from "./database-env";

export interface DatabaseAvailability {
  available: boolean;
  reason?: string;
}

let connectionPromise: Promise<typeof mongoose> | null = null;
let hasLoggedConnectedState = false;
let lastConnectionError: Error | null = null;

function buildMongoUri(mongoUri: string, dbName: string): string {
  try {
    const parsed = new URL(mongoUri);
    parsed.pathname = `/${dbName}`;
    return parsed.toString();
  } catch {
    const [base, query] = mongoUri.split("?");
    const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    return query ? `${normalizedBase}/${dbName}?${query}` : `${normalizedBase}/${dbName}`;
  }
}

function normalizeConnectionError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function getConnectionString(): string {
  const envConfig = getDatabaseEnvironmentConfig();
  return buildMongoUri(envConfig.mongoUri, envConfig.dbName);
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(getConnectionString())
    .then((connection) => {
      lastConnectionError = null;

      if (!hasLoggedConnectedState) {
        hasLoggedConnectedState = true;
        const dbName = connection.connection.db?.databaseName ?? "unknown";
        console.log(`✅ Connected to MongoDB: ${dbName}`);
      }

      return connection;
    })
    .catch((error: unknown) => {
      const normalizedError = normalizeConnectionError(error);
      lastConnectionError = normalizedError;
      throw normalizedError;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

export async function ensureDatabaseConnection(): Promise<DatabaseAvailability> {
  try {
    await connectToDatabase();
    return { available: true };
  } catch (error) {
    const normalizedError = normalizeConnectionError(error);
    lastConnectionError = normalizedError;
    return {
      available: false,
      reason: normalizedError.message,
    };
  }
}

export function getDatabaseAvailabilityMessage(): string {
  if (lastConnectionError) {
    return `MongoDB is unavailable: ${lastConnectionError.message}`;
  }

  return "MongoDB is unavailable.";
}

export async function disconnectFromDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
  hasLoggedConnectedState = false;
}

