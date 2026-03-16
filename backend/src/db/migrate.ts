import { runMigrations } from "./runMigrations.js";

void runMigrations({
  info: (message) => {
    console.log(message);
  }
});
