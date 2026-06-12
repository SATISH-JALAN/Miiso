import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { logger } from "../utils/logger.js";

// Import Route Plugins
import { permissionsRoutes } from "./routes/permissions.js";
import { eventsRoutes } from "./routes/events.js";
import { historyRoutes } from "./routes/history.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { approvalsRoutes } from "./routes/approvals.js";
import { revokeManualRoutes } from "./routes/revoke-manual.js";
import { vetoRoutes } from "./routes/veto.js";
import { webhookRoutes } from "./routes/webhook.js";
import { threatIntelRoutes } from "./routes/threatIntel.js";
import { seedWalletRoutes } from "./routes/seedWallet.js";
import { revokeBatchRoutes } from "./routes/batch.js";
import { analyzeRoutes } from "./routes/analyze.js";

export function buildApp() {
  const app = Fastify({
    logger: false, // We use our own custom structured logger
    bodyLimit: 1048576, // 1MB body limit
  });

  // Enable CORS for frontend Vite SPA (on localhost:3000 or similar)
  app.register(cors, {
    origin: true, // Allow all origins for dev/hackathon, can be locked down in env
    credentials: true,
  });

  // Rate Limiting
  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // Custom parser to capture raw request body for Webhook Ed25519 signature checks
  // but still parsed as JSON for normal routes.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    try {
      const text = body.toString("utf8");
      (req as any).rawBody = text;
      if (!text.trim()) {
        done(null, {});
        return;
      }
      const json = JSON.parse(text);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Error Handler
  app.setErrorHandler((error, request, reply) => {
    logger.error(`❌ HTTP Error: ${error.message}`, error, {
      url: request.url,
      method: request.method,
      statusCode: error.statusCode,
    });
    
    reply.status(error.statusCode || 500).send({
      error: error.name || "InternalServerError",
      message: error.message || "An unexpected error occurred",
      statusCode: error.statusCode || 500,
    });
  });

  // Register Routes
  app.register(permissionsRoutes, { prefix: "/api" });
  app.register(eventsRoutes, { prefix: "/api" });
  app.register(historyRoutes, { prefix: "/api" });
  app.register(dashboardRoutes, { prefix: "/api" });
  app.register(approvalsRoutes, { prefix: "/api" });
  app.register(revokeManualRoutes, { prefix: "/api" });
  app.register(revokeBatchRoutes, { prefix: "/api" });
  app.register(vetoRoutes, { prefix: "/api" });
  app.register(webhookRoutes, { prefix: "/api" });
  app.register(threatIntelRoutes, { prefix: "/api" });
  app.register(seedWalletRoutes, { prefix: "/api" });
  app.register(analyzeRoutes, { prefix: "/api" });

  return app;
}
