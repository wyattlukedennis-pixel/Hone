import { buildApp } from "./app.js";
import { config } from "./config.js";
import { runMigrations } from "./db/runMigrations.js";

const app = buildApp();

async function start() {
  try {
    await runMigrations({
      info: (message) => {
        app.log.info({ migration: message }, "db migration");
      }
    });
    await app.listen({
      port: config.port,
      host: "0.0.0.0"
    });
    app.log.info(`hone-backend listening on ${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
