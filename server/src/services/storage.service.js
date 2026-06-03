import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// ─── S3 Client Configuration (Filebase-compatible) ─────────────────────────
const s3Client = new S3Client({
  endpoint: process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com',
  region: process.env.FILEBASE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.FILEBASE_BUCKET || 'tassarutdocuments';
const DEFAULT_EXPIRY = parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '3600', 10);

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to Filebase.
 * @param {Buffer} buffer - File binary data from multer memoryStorage
 * @param {string} objectKey - Unique key in the bucket (e.g. "documents/{userId}/{uuid}.pdf")
 * @param {string} mimeType - MIME type (e.g. "application/pdf")
 * @returns {Promise<{objectKey: string, bucketName: string}>}
 */
export async function uploadFile(buffer, objectKey, mimeType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return { objectKey, bucketName: BUCKET };
}

/**
 * Generate a time-limited signed download URL for a Filebase object.
 * The browser downloads directly from Filebase — no server bandwidth used.
 * @param {string} objectKey - The Filebase object key
 * @param {object} [options]
 * @param {string} [options.bucket] - Bucket name (defaults to FILEBASE_BUCKET env)
 * @param {string} [options.filename] - Forces the browser to download with this filename
 * @param {number} [options.expiresIn] - Seconds until URL expires (default: 3600)
 * @returns {Promise<string>} Signed URL
 */
export async function getSignedDownloadUrl(objectKey, {
  bucket = BUCKET,
  filename,
  expiresIn = DEFAULT_EXPIRY,
} = {}) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    // If filename is provided, force download with that name
    ...(filename && {
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Delete a file from Filebase.
 * @param {string} objectKey - The Filebase object key to delete
 * @param {string} [bucket] - Bucket name (defaults to FILEBASE_BUCKET env)
 */
export async function deleteFile(objectKey, bucket = BUCKET) {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  await s3Client.send(command);
}

/**
 * Verify connectivity to Filebase (useful for health checks and setup validation).
 * @returns {Promise<{connected: boolean, bucketExists?: boolean, buckets?: string[], error?: string}>}
 */
export async function testConnection() {
  try {
    const { Buckets } = await s3Client.send(new ListBucketsCommand({}));
    const bucketExists = Buckets.some(b => b.Name === BUCKET);
    return { connected: true, bucketExists, buckets: Buckets.map(b => b.Name) };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}