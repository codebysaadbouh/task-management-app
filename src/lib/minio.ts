import { Client } from "minio";

// Validate required environment variables
const requiredVars = [
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
] as const;

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(
      `[minio] Missing required environment variable: ${varName}`
    );
  }
}

const endpoint = process.env.MINIO_ENDPOINT!;
const port = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : 9000;
const useSSL = process.env.MINIO_USE_SSL === "true";
const accessKey = process.env.MINIO_ACCESS_KEY!;
const secretKey = process.env.MINIO_SECRET_KEY!;
const bucket = process.env.MINIO_BUCKET!;

// Singleton MinIO client
const minioClient = new Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

// Ensure the bucket exists at startup
async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket);
      console.log(`[minio] Bucket "${bucket}" created.`);
    }
  } catch (err) {
    console.error(`[minio] Failed to ensure bucket "${bucket}":`, err);
  }
}

ensureBucket();

/**
 * Upload an object to MinIO.
 * @param storageKey - The object key (path) in the bucket
 * @param buffer - The file content as a Buffer
 * @param contentType - The MIME type of the file
 */
export async function putObject(
  storageKey: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await minioClient.putObject(bucket, storageKey, buffer, buffer.length, {
    "Content-Type": contentType,
  });
}

/**
 * Remove an object from MinIO.
 * @param storageKey - The object key (path) in the bucket
 */
export async function removeObject(storageKey: string): Promise<void> {
  await minioClient.removeObject(bucket, storageKey);
}

/**
 * Generate a presigned URL for downloading an object.
 * @param storageKey - The object key (path) in the bucket
 * @param expirySeconds - URL expiry duration in seconds
 * @returns A presigned URL string
 */
export async function presignedGetObject(
  storageKey: string,
  expirySeconds: number
): Promise<string> {
  return minioClient.presignedGetObject(bucket, storageKey, expirySeconds);
}
