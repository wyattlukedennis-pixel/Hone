import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const env = process.env;
const parsedTokenTtl = Number(env.AUTH_TOKEN_TTL_DAYS ?? "30");
const rawUploadsDir = env.UPLOADS_DIR ?? "./uploads";
const uploadsDir = path.isAbsolute(rawUploadsDir) ? rawUploadsDir : path.resolve(process.cwd(), rawUploadsDir);

export const config = {
  nodeEnv: env.NODE_ENV ?? "development",
  port: Number(env.PORT ?? "4000"),
  appVersion: env.APP_VERSION ?? "0.1.0",
  commitSha: env.COMMIT_SHA ?? "unknown",
  databaseUrl: env.DATABASE_URL ?? "",
  auth: {
    jwtSecret: env.JWT_SECRET ?? "dev-insecure-secret-change-me",
    tokenTtlDays: Number.isFinite(parsedTokenTtl) && parsedTokenTtl > 0 ? parsedTokenTtl : 30
  },
  uploads: {
    dir: uploadsDir
  },
  media: {
    rawBucket: env.MEDIA_RAW_BUCKET ?? "",
    processedBucket: env.MEDIA_PROCESSED_BUCKET ?? "",
    cdnBaseUrl: env.MEDIA_CDN_BASE_URL ?? ""
  }
};
