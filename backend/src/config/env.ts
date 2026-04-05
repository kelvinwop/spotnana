export type RuntimeMode = "dev" | "prod" | "test";

interface RequiredBackendEnvMap {
  NODE_ENV: string;
  MONGO_URI: string;
  DEV_DB_NAME: string;
  PROD_DB_NAME: string;
  EPHEMERAL_TEST_DB_NAME: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

interface OptionalBackendEnvMap {
  PORT: string;
  FRONTEND_URL: string;
  TEST_DB_CARE_WIPED_EVERY_TEST_RUN: string;
  ADMIN_DEFAULT_EMAIL: string;
  ADMIN_DEFAULT_PASSWORD: string;
}

type RequiredBackendEnvKey = keyof RequiredBackendEnvMap;
type OptionalBackendEnvKey = keyof OptionalBackendEnvMap;

export interface BackendEnvironmentConfig {
  mode: RuntimeMode;
  mongoUri: string;
  devDbName: string;
  prodDbName: string;
  ephemeralTestDbName: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  port: number;
  frontendUrl: string;
  testDbWipeAcknowledgement?: string;
  adminDefaultEmail?: string;
  adminDefaultPassword?: string;
}

function fail(message: string): never {
  throw new Error(`[env] ${message}`);
}

function readTrimmedEnv(name: RequiredBackendEnvKey | OptionalBackendEnvKey): string | undefined {
  const value = process.env[name];
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requireEnv(name: RequiredBackendEnvKey): string {
  const value = readTrimmedEnv(name);
  if (!value) {
    fail(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: OptionalBackendEnvKey): string | undefined {
  return readTrimmedEnv(name);
}

function parseRuntimeMode(nodeEnvRaw: string): RuntimeMode {
  const normalized = nodeEnvRaw.toLowerCase();

  if (normalized === "dev" || normalized === "development") {
    return "dev";
  }
  if (normalized === "prod" || normalized === "production") {
    return "prod";
  }
  if (normalized === "test") {
    return "test";
  }

  fail(
    `Invalid NODE_ENV="${nodeEnvRaw}". Allowed values: dev, prod, test ` +
      "(aliases: development -> dev, production -> prod)."
  );
}

function parsePort(portRaw: string | undefined): number {
  if (!portRaw) {
    return 5000;
  }

  const parsed = Number(portRaw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    fail(`PORT must be an integer between 1 and 65535. Received: ${portRaw}`);
  }

  return parsed;
}

function parseAbsoluteUrl(urlRaw: string): string {
  try {
    const parsed = new URL(urlRaw);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    fail(`FRONTEND_URL must be a valid absolute URL. Received: ${urlRaw}`);
  }
}

export function getBackendEnvironmentConfig(): BackendEnvironmentConfig {
  const nodeEnvRaw = requireEnv("NODE_ENV");
  const mode = parseRuntimeMode(nodeEnvRaw);

  const mongoUri = requireEnv("MONGO_URI");
  const devDbName = requireEnv("DEV_DB_NAME");
  const prodDbName = requireEnv("PROD_DB_NAME");
  const ephemeralTestDbName = requireEnv("EPHEMERAL_TEST_DB_NAME");
  const jwtSecret = requireEnv("JWT_SECRET");
  const jwtExpiresIn = requireEnv("JWT_EXPIRES_IN");
  const port = parsePort(optionalEnv("PORT"));
  const frontendUrl = parseAbsoluteUrl(optionalEnv("FRONTEND_URL") ?? "http://localhost:5173");
  const testDbWipeAcknowledgement = optionalEnv("TEST_DB_CARE_WIPED_EVERY_TEST_RUN");
  const adminDefaultEmail = optionalEnv("ADMIN_DEFAULT_EMAIL");
  const adminDefaultPassword = optionalEnv("ADMIN_DEFAULT_PASSWORD");

  return {
    mode,
    mongoUri,
    devDbName,
    prodDbName,
    ephemeralTestDbName,
    jwtSecret,
    jwtExpiresIn,
    port,
    frontendUrl,
    testDbWipeAcknowledgement,
    adminDefaultEmail,
    adminDefaultPassword,
  };
}
