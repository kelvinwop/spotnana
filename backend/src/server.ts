import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { ensureDatabaseConnection, getDatabaseAvailabilityMessage } from "./config/database";
import { getBackendEnvironmentConfig } from "./config/env";
import { seedAdminUser } from "./models/User";
import { routes } from "./routes";

const environment = getBackendEnvironmentConfig();

async function startServer() {
  try {
    console.log("🚀 Starting Spotnana Chat backend...");

    const database = await ensureDatabaseConnection();
    if (database.available) {
      await seedAdminUser();
    } else {
      console.warn(`⚠️ ${getDatabaseAvailabilityMessage()} Account mode will be unavailable until MongoDB connects.`);
    }

    const app = new Elysia()
      .use(
        cors({
          origin: environment.frontendUrl,
          credentials: true,
          allowedHeaders: ["Content-Type", "Authorization"],
        })
      )
      .onError(({ code, error, set }) => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (code === "NOT_FOUND") {
          set.status = 404;
          return { error: "Not Found" };
        }

        if (code === "VALIDATION") {
          set.status = 400;
          return { error: "Validation Error", message: errorMessage };
        }

        if (!set.status || set.status === 200) {
          set.status = 500;
        }

        return {
          error: errorMessage || "Internal Server Error",
          code,
        };
      })
      .get("/health", async () => {
        const availability = await ensureDatabaseConnection();
        return {
          status: "ok",
          timestamp: new Date().toISOString(),
          database: availability.available ? "connected" : "unavailable",
        };
      })
      .use(routes)
      .listen({
        port: environment.port,
        hostname: "0.0.0.0",
      });

    console.log(`✅ Backend server running at http://${app.server?.hostname}:${app.server?.port}`);
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

