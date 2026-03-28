import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";

import { registerAuthRoutes } from "./auth/routes.js";
import { requireAuth } from "./auth/guard.js";
import { registerClipRoutes } from "./clips/routes.js";
import { config } from "./config.js";
import { registerJourneyRoutes } from "./journeys/routes.js";
import { registerProgressRoutes } from "./progress/routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024
  });

  app.setErrorHandler((error, _request, reply) => {
    // Convert schema drift failures into actionable client errors.
    const errorCode =
      typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (error && typeof error === "object") {
      if (errorCode === "42703" || errorCode === "42P01") {
        return reply.code(503).send({ error: "BACKEND_MIGRATION_REQUIRED" });
      }
    }

    const statusCodeCandidate =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
    const messageCandidate =
      typeof error === "object" && error !== null && "message" in error ? (error as { message?: unknown }).message : undefined;

    const statusCode =
      typeof statusCodeCandidate === "number" && statusCodeCandidate >= 400 && statusCodeCandidate < 600
        ? statusCodeCandidate
        : 500;
    const message = statusCode >= 500 ? "Internal Server Error" : typeof messageCandidate === "string" ? messageCandidate : "Request failed";

    app.log.error(error);
    return reply.code(statusCode).send({ error: message });
  });

  // CORS
  void app.register(cors, {
    origin: config.cors.origin === "*" ? true : config.cors.origin.split(",").map((s) => s.trim()),
    credentials: true
  });

  // Rate limiting
  void app.register(rateLimit, {
    global: false // only apply to specific routes via route options
  });

  void app.register(multipart, {
    limits: {
      fileSize: config.uploads.maxFileSizeBytes
    }
  });

  void app.register(fastifyStatic, {
    root: config.uploads.dir,
    prefix: "/media/",
    decorateReply: false
  });

  // Protect media routes — require valid auth token
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/media/")) return;
    const auth = await requireAuth(request, reply);
    if (!auth) return;
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "hone-backend",
      now: new Date().toISOString()
    };
  });

  app.get("/version", async () => {
    return {
      service: "hone-backend",
      version: config.appVersion,
      commit: config.isProduction ? undefined : config.commitSha
    };
  });

  registerAuthRoutes(app);
  registerJourneyRoutes(app);
  registerClipRoutes(app);
  registerProgressRoutes(app);

  return app;
}
