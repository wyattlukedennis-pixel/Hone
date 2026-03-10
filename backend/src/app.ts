import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";

import { registerAuthRoutes } from "./auth/routes.js";
import { registerClipRoutes } from "./clips/routes.js";
import { config } from "./config.js";
import { registerJourneyRoutes } from "./journeys/routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 50 * 1024 * 1024
  });

  app.register(multipart);
  app.register(fastifyStatic, {
    root: config.uploads.dir,
    prefix: "/media/"
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "hone-backend",
      env: config.nodeEnv,
      now: new Date().toISOString()
    };
  });

  app.get("/version", async () => {
    return {
      service: "hone-backend",
      version: config.appVersion,
      commit: config.commitSha
    };
  });

  registerAuthRoutes(app);
  registerJourneyRoutes(app);
  registerClipRoutes(app);

  return app;
}
