import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.AWS_REGION ?? "auto",
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return _client;
}

/** Whether S3 storage is configured (Tigris credentials available). */
export function isS3Configured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ENDPOINT_URL_S3 && config.media.rawBucket);
}

/** Upload a buffer to S3/Tigris. */
export async function uploadToS3(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Get the public URL for an object in a public Tigris bucket. */
export function getPublicUrl(bucket: string, key: string): string {
  if (config.media.cdnBaseUrl) {
    return `${config.media.cdnBaseUrl}/${key}`;
  }
  return `https://${bucket}.fly.storage.tigris.dev/${key}`;
}
