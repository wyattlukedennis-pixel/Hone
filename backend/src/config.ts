import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const env = process.env;
const parsedTokenTtl = Number(env.AUTH_TOKEN_TTL_DAYS ?? "30");
const rawUploadsDir = env.UPLOADS_DIR ?? "./uploads";
const uploadsDir = path.isAbsolute(rawUploadsDir) ? rawUploadsDir : path.resolve(process.cwd(), rawUploadsDir);

const nodeEnv = env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

function requireEnvInProduction(key: string, fallback: string): string {
  const value = env[key];
  if (value) return value;
  if (isProduction) {
    throw new Error(`${key} is required in production. Set it as an environment variable.`);
  }
  return fallback;
}

export const config = {
  nodeEnv,
  isProduction,
  port: Number(env.PORT ?? "4000"),
  appVersion: env.APP_VERSION ?? "0.1.0",
  commitSha: env.COMMIT_SHA ?? "unknown",
  databaseUrl: env.DATABASE_URL ?? "",
  baseUrl: env.BASE_URL ?? "",
  auth: {
    jwtSecret: requireEnvInProduction("JWT_SECRET", "dev-insecure-secret-change-me"),
    tokenTtlDays: Number.isFinite(parsedTokenTtl) && parsedTokenTtl > 0 ? parsedTokenTtl : 30
  },
  uploads: {
    dir: uploadsDir,
    maxFileSizeBytes: Number(env.UPLOAD_MAX_FILE_SIZE_BYTES ?? String(100 * 1024 * 1024)) // 100MB default
  },
  media: {
    rawBucket: env.MEDIA_RAW_BUCKET ?? env.BUCKET_NAME ?? "",
    processedBucket: env.MEDIA_PROCESSED_BUCKET ?? "",
    cdnBaseUrl: env.MEDIA_CDN_BASE_URL ?? ""
  },
  email: {
    resendApiKey: env.RESEND_API_KEY ?? "",
    fromAddress: env.EMAIL_FROM ?? "Hone <onboarding@resend.dev>"
  },
  cors: {
    origin: env.CORS_ORIGIN ?? "*"
  }
};
